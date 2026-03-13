// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title FFXPerps — per-market perpetual contract
/// Supports: Cross/Isolated margin, TP/SL, Limit orders
contract FFXPerps {
    bool private _initialized;

    address public token;
    address public collateral;
    address public vault;
    address public oracle;
    address public funding;
    address public opener;           // market creator
    address public platformFeeWallet;
    address public botWallet;        // per-market dedicated bot
    address public factory;
    address public platformContract;

    // ─── Constants ───────────────────────────────────────────────────────────────
    uint256 public constant OPENER_SHARE   = 8000;  // 80% of trade fee to opener
    uint256 public constant PLATFORM_SHARE = 2000;  // 20% of trade fee to platform
    uint256 public constant BPS            = 10_000;
    uint256 public constant TRADE_FEE_BPS  = 10;    // 0.1%
    uint256 public constant MIN_TRADE_FEE  = 1e18;  // $1 minimum fee
    uint256 public constant LIQ_THRESHOLD_BPS = 8000; // liquidate at 80% margin loss

    // Margin modes
    uint8 public constant ISOLATED = 0;
    uint8 public constant CROSS    = 1;

    // ─── Position ────────────────────────────────────────────────────────────────
    struct Position {
        address trader;
        uint256 margin;        // USDT collateral (18 dec)
        uint8   leverage;
        bool    isLong;
        uint256 entryPrice;    // 18 dec
        uint256 size;          // notional = margin * leverage (18 dec)
        uint256 openedAt;
        bool    isOpen;
        int256  fundingAccrued;
        uint8   marginMode;    // ISOLATED=0, CROSS=1
        uint256 tpPrice;       // take-profit price, 0 = disabled
        uint256 slPrice;       // stop-loss price,   0 = disabled
    }

    // ─── Limit Order ─────────────────────────────────────────────────────────────
    struct LimitOrder {
        address trader;
        uint256 margin;
        uint8   leverage;
        bool    isLong;
        uint256 limitPrice;    // execute when market price reaches this level
        uint8   marginMode;
        uint256 tpPrice;
        uint256 slPrice;
        bool    filled;
        bool    cancelled;
        uint256 createdAt;
    }

    mapping(uint256 => Position)   public positions;
    mapping(address => uint256[])  public traderPositions;
    mapping(uint256 => LimitOrder) public limitOrders;
    mapping(address => uint256[])  public traderLimitOrders;

    uint256 public nextPositionId;
    uint256 public nextLimitOrderId;
    uint256 public totalLongOI;
    uint256 public totalShortOI;
    uint256 public openPositionCount;
    uint256 public pendingOpenerFees;
    bool    public emergencyPaused;
    bool    public paramsLocked;
    int256  public cumulativeLongFunding;
    int256  public cumulativeShortFunding;

    // Cross-margin: trader's available cross balance deposited on contract
    mapping(address => uint256) public crossBalance;

    event PositionOpened(uint256 indexed id, address indexed trader, bool isLong, uint256 margin, uint8 leverage, uint256 entryPrice, uint256 fee, uint8 marginMode);
    event PositionClosed(uint256 indexed id, address indexed trader, int256 pnl, uint256 exitPrice, uint256 fee);
    event PositionLiquidated(uint256 indexed id, address indexed trader, uint256 price);
    event TpSlSet(uint256 indexed id, uint256 tp, uint256 sl);
    event TpSlTriggered(uint256 indexed id, bool isTp, uint256 price);
    event LimitOrderPlaced(uint256 indexed orderId, address indexed trader, bool isLong, uint256 limitPrice, uint256 margin, uint8 leverage);
    event LimitOrderFilled(uint256 indexed orderId, uint256 indexed positionId, uint256 fillPrice);
    event LimitOrderCancelled(uint256 indexed orderId, address indexed trader);
    event CrossDeposited(address indexed trader, uint256 amount);
    event CrossWithdrawn(address indexed trader, uint256 amount);
    event FeesClaimed(address indexed opener, uint256 amount);
    event FundingApplied(int256 lf, int256 sf);
    event EmergencyDrain(address indexed to, uint256 amount);

    modifier notPaused()    { require(!emergencyPaused, "P:ep"); _; }
    modifier onlyBot()      { require(msg.sender == botWallet || msg.sender == platformFeeWallet, "P:bot"); _; }
    modifier onlyFunding()  { require(msg.sender == funding, "P:fn"); _; }
    modifier onlyPlatform() {
        require(
            msg.sender == platformFeeWallet ||
            (platformContract != address(0) && msg.sender == platformContract),
            "P:pl"
        );
        _;
    }
    modifier marketActive() {
        IVaultFFX v = IVaultFFX(vault);
        require(!v.isWithdrawalBlocked(), "P:frozen");
        _;
    }
    modifier priceIsFresh() {
        require(IOracle(oracle).isFresh(token), "P:stale");
        _;
    }

    // ─── Init ────────────────────────────────────────────────────────────────────

    function initialize(
        address _token,
        address _collateral,
        address _vault,
        address _oracle,
        address _funding,
        address _opener,
        address _pfw,
        address _botWallet,
        address _factory
    ) external {
        require(!_initialized, "P:ai");
        require(_token != address(0) && _collateral != address(0) && _vault != address(0), "P:0a");
        require(_oracle != address(0) && _opener != address(0) && _botWallet != address(0), "P:0b");
        bool _initialized2 = true; // suppress unused warning
        _initialized     = _initialized2;
        token            = _token;
        collateral       = _collateral;
        vault            = _vault;
        oracle           = _oracle;
        funding          = _funding;
        opener           = _opener;
        platformFeeWallet= _pfw;
        botWallet        = _botWallet;
        factory          = _factory;
    }

    function setPlatformContract(address _p) external {
        require(msg.sender == factory && platformContract == address(0) && _p != address(0), "P:sc");
        platformContract = _p;
    }

    // ─── Cross Margin Deposit/Withdraw ───────────────────────────────────────────

    /// @notice Deposit USDT as cross-margin collateral pool (shared across all cross positions)
    function depositCross(uint256 amount) external notPaused marketActive {
        require(amount > 0, "P:amt");
        _stf(msg.sender, address(this), amount);
        crossBalance[msg.sender] += amount;
        emit CrossDeposited(msg.sender, amount);
    }

    /// @notice Withdraw excess cross-margin (only amount not required by open positions)
    function withdrawCross(uint256 amount) external notPaused {
        require(crossBalance[msg.sender] >= amount, "P:insuf");
        uint256 used = _crossRequired(msg.sender);
        require(crossBalance[msg.sender] - used >= amount, "P:locked");
        crossBalance[msg.sender] -= amount;
        _st(msg.sender, amount);
        emit CrossWithdrawn(msg.sender, amount);
    }

    // ─── Market Orders ───────────────────────────────────────────────────────────

    /// @notice Open a market position. marginMode: 0=ISOLATED, 1=CROSS
    function openPosition(
        uint256 margin,
        uint8   leverage,
        bool    isLong,
        uint8   marginMode,
        uint256 tpPrice,
        uint256 slPrice
    ) external notPaused marketActive priceIsFresh {
        require(leverage >= 1 && leverage <= 50, "P:lev");
        require(margin > 0, "P:mrg");

        uint256 price = _latestPrice();
        uint256 size  = margin * leverage;

        uint256 fee = size * TRADE_FEE_BPS / BPS;
        if (fee < MIN_TRADE_FEE) fee = MIN_TRADE_FEE;
        uint256 total = margin + fee;

        if (marginMode == ISOLATED) {
            _stf(msg.sender, address(this), total);
        } else {
            // Cross: pull fee only from wallet; margin comes from crossBalance
            require(crossBalance[msg.sender] >= margin, "P:cx-margin");
            crossBalance[msg.sender] -= margin;
            _stf(msg.sender, address(this), fee);
        }

        _distributeFee(fee);

        uint256 id = nextPositionId++;
        int256 fundStart = isLong ? cumulativeLongFunding : cumulativeShortFunding;
        positions[id] = Position({
            trader:         msg.sender,
            margin:         margin,
            leverage:       leverage,
            isLong:         isLong,
            entryPrice:     price,
            size:           size,
            openedAt:       block.timestamp,
            isOpen:         true,
            fundingAccrued: fundStart,
            marginMode:     marginMode,
            tpPrice:        tpPrice,
            slPrice:        slPrice
        });
        traderPositions[msg.sender].push(id);
        if (isLong) totalLongOI += size; else totalShortOI += size;
        openPositionCount++;

        emit PositionOpened(id, msg.sender, isLong, margin, leverage, price, fee, marginMode);
        if (tpPrice > 0 || slPrice > 0) emit TpSlSet(id, tpPrice, slPrice);
    }

    /// @notice Close a market position.
    function closePosition(uint256 id) external notPaused {
        Position storage pos = positions[id];
        require(pos.isOpen, "P:nc");
        require(msg.sender == pos.trader || msg.sender == botWallet || msg.sender == platformFeeWallet, "P:auth");
        uint256 price = _latestPrice();
        _close(id, price, false);
    }

    // ─── TP / SL ─────────────────────────────────────────────────────────────────

    /// @notice Update TP/SL prices for an open position.
    function setTpSl(uint256 id, uint256 tpPrice, uint256 slPrice) external {
        Position storage pos = positions[id];
        require(pos.isOpen, "P:nc");
        require(msg.sender == pos.trader, "P:auth");
        pos.tpPrice = tpPrice;
        pos.slPrice = slPrice;
        emit TpSlSet(id, tpPrice, slPrice);
    }

    /// @notice Execute TP or SL for a position when price condition is met.
    ///         Callable by anyone — bot executes this automatically.
    function executeTpSl(uint256 id) external notPaused {
        Position storage pos = positions[id];
        require(pos.isOpen, "P:nc");
        uint256 price = _latestPrice();
        bool triggered = false;
        if (pos.tpPrice > 0) {
            if (pos.isLong  && price >= pos.tpPrice) triggered = true;
            if (!pos.isLong && price <= pos.tpPrice) triggered = true;
        }
        if (pos.slPrice > 0) {
            if (pos.isLong  && price <= pos.slPrice) triggered = true;
            if (!pos.isLong && price >= pos.slPrice) triggered = true;
        }
        require(triggered, "P:no-trigger");
        bool isTp = pos.tpPrice > 0 && ((pos.isLong && price >= pos.tpPrice) || (!pos.isLong && price <= pos.tpPrice));
        emit TpSlTriggered(id, isTp, price);
        _close(id, price, false);
    }

    // ─── Limit Orders ────────────────────────────────────────────────────────────

    /// @notice Place a limit order. USDT (margin + fee estimate) is held in contract.
    function placeLimitOrder(
        uint256 margin,
        uint8   leverage,
        bool    isLong,
        uint256 limitPrice,
        uint8   marginMode,
        uint256 tpPrice,
        uint256 slPrice
    ) external notPaused marketActive {
        require(leverage >= 1 && leverage <= 50, "P:lev");
        require(margin > 0, "P:mrg");
        require(limitPrice > 0, "P:lp");

        uint256 size    = margin * leverage;
        uint256 feeCap  = size * TRADE_FEE_BPS / BPS;
        if (feeCap < MIN_TRADE_FEE) feeCap = MIN_TRADE_FEE;

        if (marginMode == ISOLATED) {
            _stf(msg.sender, address(this), margin + feeCap);
        } else {
            require(crossBalance[msg.sender] >= margin, "P:cx-margin");
            crossBalance[msg.sender] -= margin;
            _stf(msg.sender, address(this), feeCap);
        }

        uint256 orderId = nextLimitOrderId++;
        limitOrders[orderId] = LimitOrder({
            trader:     msg.sender,
            margin:     margin,
            leverage:   leverage,
            isLong:     isLong,
            limitPrice: limitPrice,
            marginMode: marginMode,
            tpPrice:    tpPrice,
            slPrice:    slPrice,
            filled:     false,
            cancelled:  false,
            createdAt:  block.timestamp
        });
        traderLimitOrders[msg.sender].push(orderId);
        emit LimitOrderPlaced(orderId, msg.sender, isLong, limitPrice, margin, leverage);
    }

    /// @notice Execute a limit order when price condition is met. Called by bot.
    function executeLimitOrder(uint256 orderId) external notPaused priceIsFresh {
        LimitOrder storage lo = limitOrders[orderId];
        require(!lo.filled && !lo.cancelled, "P:lo-done");

        uint256 price = _latestPrice();
        // Long: execute when price <= limitPrice (buy the dip)
        // Short: execute when price >= limitPrice (sell the rip)
        if (lo.isLong)  require(price <= lo.limitPrice, "P:price-hi");
        else            require(price >= lo.limitPrice, "P:price-lo");

        uint256 size   = lo.margin * lo.leverage;
        uint256 fee    = size * TRADE_FEE_BPS / BPS;
        if (fee < MIN_TRADE_FEE) fee = MIN_TRADE_FEE;

        _distributeFee(fee);

        lo.filled = true;

        uint256 id = nextPositionId++;
        int256 fundStart = lo.isLong ? cumulativeLongFunding : cumulativeShortFunding;
        positions[id] = Position({
            trader:         lo.trader,
            margin:         lo.margin,
            leverage:       lo.leverage,
            isLong:         lo.isLong,
            entryPrice:     price,
            size:           size,
            openedAt:       block.timestamp,
            isOpen:         true,
            fundingAccrued: fundStart,
            marginMode:     lo.marginMode,
            tpPrice:        lo.tpPrice,
            slPrice:        lo.slPrice
        });
        traderPositions[lo.trader].push(id);
        if (lo.isLong) totalLongOI += size; else totalShortOI += size;
        openPositionCount++;

        emit LimitOrderFilled(orderId, id, price);
        emit PositionOpened(id, lo.trader, lo.isLong, lo.margin, lo.leverage, price, fee, lo.marginMode);
    }

    /// @notice Cancel an unfilled limit order and refund USDT.
    function cancelLimitOrder(uint256 orderId) external {
        LimitOrder storage lo = limitOrders[orderId];
        require(msg.sender == lo.trader || msg.sender == botWallet, "P:auth");
        require(!lo.filled && !lo.cancelled, "P:lo-done");
        lo.cancelled = true;

        uint256 size    = lo.margin * lo.leverage;
        uint256 feeCap  = size * TRADE_FEE_BPS / BPS;
        if (feeCap < MIN_TRADE_FEE) feeCap = MIN_TRADE_FEE;

        uint256 refund = lo.margin + feeCap;
        if (lo.marginMode == CROSS) {
            crossBalance[lo.trader] += lo.margin;
            _st(lo.trader, feeCap);
        } else {
            _st(lo.trader, refund);
        }
        emit LimitOrderCancelled(orderId, lo.trader);
    }

    // ─── Liquidation ─────────────────────────────────────────────────────────────

    function liquidate(uint256 id) external notPaused {
        Position storage pos = positions[id];
        require(pos.isOpen, "P:nc");
        uint256 price = _latestPrice();
        require(_isLiquidatable(pos, price), "P:not-liq");
        emit PositionLiquidated(id, pos.trader, price);
        _close(id, price, true);
    }

    // ─── Funding ─────────────────────────────────────────────────────────────────

    function applyFunding(int256 longFPU, int256 shortFPU) external onlyFunding {
        cumulativeLongFunding  += longFPU;
        cumulativeShortFunding += shortFPU;
        emit FundingApplied(longFPU, shortFPU);
    }

    function claimFees() external {
        require(msg.sender == opener, "P:op");
        uint256 amount = pendingOpenerFees;
        require(amount > 0, "P:nf");
        pendingOpenerFees = 0;
        _st(msg.sender, amount);
        emit FeesClaimed(msg.sender, amount);
    }

    // ─── View ────────────────────────────────────────────────────────────────────

    function getCurrentParams() external view returns (
        uint256 spread, uint8 maxLeverage, uint256 maxPosition, uint256 maxOI, uint256 currentOI
    ) {
        return (0, 50, type(uint256).max, type(uint256).max, totalLongOI + totalShortOI);
    }

    function getLongRatio() external view returns (uint256) {
        uint256 t = totalLongOI + totalShortOI;
        return t == 0 ? 50 : (totalLongOI * 100) / t;
    }

    function getTotalOI() external view returns (uint256) { return totalLongOI + totalShortOI; }
    function getOpenPositionCount() external view returns (uint256) { return openPositionCount; }

    function getUnrealizedPnl(uint256 id) external view returns (int256) {
        Position memory pos = positions[id];
        if (!pos.isOpen) return 0;
        uint256 price = _latestPriceSafe();
        return price == 0 ? int256(0) : _pnl(pos, price);
    }

    function isLiquidatable(uint256 id) external view returns (bool) {
        Position memory pos = positions[id];
        uint256 price = _latestPriceSafe();
        return pos.isOpen && price > 0 && _isLiquidatable(pos, price);
    }

    function getPosition(uint256 id) external view returns (
        address trader, uint256 margin, uint8 leverage, bool isLong,
        uint256 entryPrice, uint256 size, uint256 openedAt, bool isOpen,
        int256 fundingAccrued, uint8 marginMode, uint256 tpPrice, uint256 slPrice
    ) {
        Position memory p = positions[id];
        return (p.trader, p.margin, p.leverage, p.isLong, p.entryPrice, p.size,
                p.openedAt, p.isOpen, p.fundingAccrued, p.marginMode, p.tpPrice, p.slPrice);
    }

    function getLimitOrder(uint256 orderId) external view returns (
        address trader, uint256 margin, uint8 leverage, bool isLong, uint256 limitPrice,
        uint8 marginMode, uint256 tpPrice, uint256 slPrice, bool filled, bool cancelled, uint256 createdAt
    ) {
        LimitOrder memory lo = limitOrders[orderId];
        return (lo.trader, lo.margin, lo.leverage, lo.isLong, lo.limitPrice,
                lo.marginMode, lo.tpPrice, lo.slPrice, lo.filled, lo.cancelled, lo.createdAt);
    }

    // ─── Platform admin ──────────────────────────────────────────────────────────

    function emergencyPause()   external onlyPlatform { emergencyPaused = true; }
    function emergencyUnpause() external onlyPlatform { emergencyPaused = false; }

    function emergencyDrain(address to) external onlyPlatform {
        require(to != address(0), "P:0t");
        uint256 bal = IERC20(collateral).balanceOf(address(this));
        if (bal > 0) _st(to, bal);
        emit EmergencyDrain(to, bal);
    }

    // ─── Internal ────────────────────────────────────────────────────────────────

    function _close(uint256 id, uint256 exitPrice, bool forced) internal {
        Position storage pos = positions[id];

        uint256 size = pos.size;
        uint256 fee  = size * TRADE_FEE_BPS / BPS;
        if (fee < MIN_TRADE_FEE) fee = MIN_TRADE_FEE;

        int256 rawPnl = _pnl(pos, exitPrice);
        int256 fundingDelta = pos.isLong
            ? (cumulativeLongFunding  - pos.fundingAccrued)
            : (cumulativeShortFunding - pos.fundingAccrued);
        int256 netPnl = rawPnl + fundingDelta - int256(fee);

        int256 netReturn = int256(pos.margin) + netPnl;

        if (netReturn > 0) {
            IVaultFFX(vault).payTrader(pos.trader, uint256(netReturn));
        }

        if (!forced) {
            _distributeFee(fee);
        }

        if (pos.marginMode == CROSS) {
            // restore cross balance if profitable beyond margin
        }

        _removeOI(pos);
        pos.isOpen = false;
        openPositionCount--;

        emit PositionClosed(id, pos.trader, rawPnl, exitPrice, fee);
    }

    function _distributeFee(uint256 fee) internal {
        uint256 openerFee   = (fee * OPENER_SHARE)   / BPS;
        uint256 platformFee = (fee * PLATFORM_SHARE) / BPS;
        pendingOpenerFees  += openerFee;
        if (platformFee > 0) _st(platformFeeWallet, platformFee);
    }

    function _pnl(Position memory pos, uint256 currentPrice) internal pure returns (int256) {
        if (pos.entryPrice == 0) return 0;
        int256 move = (int256(currentPrice) - int256(pos.entryPrice)) * int256(pos.size) / int256(pos.entryPrice);
        return pos.isLong ? move : -move;
    }

    function _isLiquidatable(Position memory pos, uint256 currentPrice) internal pure returns (bool) {
        uint256 loss;
        if (pos.isLong) {
            if (currentPrice >= pos.entryPrice) return false;
            loss = (pos.entryPrice - currentPrice) * pos.size / pos.entryPrice;
        } else {
            if (currentPrice <= pos.entryPrice) return false;
            loss = (currentPrice - pos.entryPrice) * pos.size / pos.entryPrice;
        }
        return loss >= (pos.margin * LIQ_THRESHOLD_BPS) / BPS;
    }

    function _crossRequired(address trader) internal view returns (uint256) {
        uint256[] memory ids = traderPositions[trader];
        uint256 total;
        for (uint256 i = 0; i < ids.length; i++) {
            Position memory p = positions[ids[i]];
            if (p.isOpen && p.marginMode == CROSS) total += p.margin;
        }
        return total;
    }

    function _removeOI(Position memory pos) internal {
        if (pos.isLong) { if (totalLongOI  >= pos.size) totalLongOI  -= pos.size; else totalLongOI  = 0; }
        else            { if (totalShortOI >= pos.size) totalShortOI -= pos.size; else totalShortOI = 0; }
    }

    function _latestPrice() internal view returns (uint256) {
        return IOracle(oracle).getPrice(token);
    }

    function _latestPriceSafe() internal view returns (uint256) {
        (bool ok, bytes memory d) = oracle.staticcall(abi.encodeWithSignature("getPrice(address)", token));
        return (ok && d.length > 0) ? abi.decode(d, (uint256)) : 0;
    }

    function _st(address to, uint256 a) internal {
        (bool ok,) = collateral.call(abi.encodeWithSignature("transfer(address,uint256)", to, a));
        require(ok, "P:tf");
    }
    function _stf(address from, address to, uint256 a) internal {
        (bool ok,) = collateral.call(abi.encodeWithSignature("transferFrom(address,address,uint256)", from, to, a));
        require(ok, "P:tff");
    }

    // allow ETH to be received (for bot gas refunds etc.)
    receive() external payable {}
}

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface IOracle {
    function getPrice(address t) external view returns (uint256);
    function isFresh(address t)  external view returns (bool);
}

interface IVaultFFX {
    function payTrader(address trader, uint256 amount) external;
    function addToInsurance(uint256 amount) external;
    function addToVault(uint256 amount)     external;
    function isFrozen()            external view returns (bool);
    function isWithdrawalBlocked() external view returns (bool);
}

interface IERC20 {
    function balanceOf(address a) external view returns (uint256);
}
