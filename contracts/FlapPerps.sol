// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "https://raw.githubusercontent.com/flapfutures/Flap-Futures-Web-App/main/contracts/FlapParams.sol";


interface IFlapOracle {
    function getPrice(address token) external view returns (uint256);
    function getMcap(address token) external view returns (uint256);
    function isFresh(address token) external view returns (bool);
}

interface IFlapVault {
    function payTrader(address trader, uint256 amount) external;
    function addToInsurance(uint256 amount) external;
    function addToVault(uint256 amount) external;
    function isFrozen() external view returns (bool);
    function isWithdrawalBlocked() external view returns (bool);
    function marketClosed() external view returns (bool);
}

interface IERC20Perps {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

contract FlapPerps {

    using FlapParams for uint256;

    address public immutable token;           // perps token address
    address public immutable collateral;      // USDT on BSC
    address public immutable vault;           // FlapVault for this market
    address public immutable oracle;          // FlapOracle (global)
    address public immutable funding;         // FlapFunding (global)
    address public immutable opener;          // market creator (receives 80% spread)
    address public immutable platformFeeWallet;
    address public immutable botOperator;
    address public immutable factory;         // FlapFactory - allowed to wire platformContract

    uint256 public constant OPENER_FEE_SHARE   = 8000;   // 80% to opener
    uint256 public constant PLATFORM_FEE_SHARE = 2000;   // 20% to platform
    uint256 public constant BPS_DENOM          = 10_000;
    uint256 public constant TRADE_FEE_BPS      = 10;     // 0.1% flat fee per side
    uint256 public constant MIN_TRADE_FEE      = 1e18;   // $1 minimum per open/close (18 dec)

    uint256 public constant LIQ_THRESHOLD_BPS  = 8000;   // liquidate at 80% loss
    uint256 public constant LIQ_INSURANCE_SHARE = 5000;  // 50% of penalty -> insurance
    uint256 public constant LIQ_BOT_SHARE       = 3000;  // 30% -> bot operator
    uint256 public constant LIQ_PLATFORM_SHARE  = 2000;  // 20% -> platform

    struct Position {
        address trader;
        uint256 margin;         // collateral deposited (18 decimals)
        uint8   leverage;       // 1-10
        bool    isLong;
        uint256 entryPrice;     // 18 decimals
        uint256 size;           // margin * leverage = notional (18 decimals)
        uint256 openedAt;
        bool    isOpen;
        int256  fundingAccrued; // net funding deducted from margin (18 decimals)
    }

    mapping(uint256 => Position) public positions;
    mapping(address => uint256[]) public traderPositions;  // trader => positionIds

    uint256 public nextPositionId = 1;
    uint256 public totalLongOI;     // total notional on long side (18 decimals)
    uint256 public totalShortOI;    // total notional on short side (18 decimals)
    uint256 public openPositionCount;

    // Opener's accumulated spread fees (claimable)
    uint256 public pendingOpenerFees;

    bool public emergencyPaused;  // true = no new positions (existing can close)
    bool public paramsLocked;     // true = backend won't auto-refresh spread/lev/OI params

    address public platformContract;

    // Funding rate state (set by FlapFunding.applyFunding)
    int256  public cumulativeLongFunding;
    int256  public cumulativeShortFunding;

    event PositionOpened(
        uint256 indexed positionId,
        address indexed trader,
        bool isLong,
        uint256 margin,
        uint8 leverage,
        uint256 entryPrice,
        uint256 spreadFee
    );
    event PositionClosed(
        uint256 indexed positionId,
        address indexed trader,
        int256 pnl,
        uint256 exitPrice,
        uint256 spreadFee
    );
    event PositionLiquidated(
        uint256 indexed positionId,
        address indexed trader,
        uint256 liquidationPrice,
        uint256 remainingMargin
    );
    event FeesClaimed(address indexed opener, uint256 amount);
    event FundingApplied(int256 longPerUnit, int256 shortPerUnit);
    event EmergencyDrain(address indexed to, uint256 amount);

    modifier onlyFunding() {
        require(msg.sender == funding, "FlapPerps: not funding contract");
        _;
    }

    modifier onlyBotOrAnyone(bool permissionless) {
        if (!permissionless) {
            require(msg.sender == botOperator, "FlapPerps: not bot operator");
        }
        _;
    }

    modifier onlyPlatform() {
        require(
            msg.sender == platformFeeWallet ||
            (platformContract != address(0) && msg.sender == platformContract),
            "FlapPerps: not platform"
        );
        _;
    }

    modifier marketActive() {
        require(!IFlapVault(vault).marketClosed(), "FlapPerps: market closed");
        require(!IFlapVault(vault).isWithdrawalBlocked(), "FlapPerps: withdrawal in progress");
        _;
    }

    modifier priceIsFresh() {
        require(IFlapOracle(oracle).isFresh(token), "FlapPerps: price stale");
        _;
    }

    constructor(
        address _token,
        address _collateral,
        address _vault,
        address _oracle,
        address _funding,
        address _opener,
        address _platformFeeWallet,
        address _botOperator,
        address _factory
    ) {
        require(_token            != address(0), "FlapPerps: zero token");
        require(_collateral       != address(0), "FlapPerps: zero collateral");
        require(_vault            != address(0), "FlapPerps: zero vault");
        require(_oracle           != address(0), "FlapPerps: zero oracle");
        require(_funding          != address(0), "FlapPerps: zero funding");
        require(_opener           != address(0), "FlapPerps: zero opener");
        require(_platformFeeWallet!= address(0), "FlapPerps: zero fee wallet");
        require(_botOperator      != address(0), "FlapPerps: zero bot");
        require(_factory          != address(0), "FlapPerps: zero factory");

        token             = _token;
        collateral        = _collateral;
        vault             = _vault;
        oracle            = _oracle;
        funding           = _funding;
        opener            = _opener;
        platformFeeWallet = _platformFeeWallet;
        botOperator       = _botOperator;
        factory           = _factory;

        // Allow FlapFunding to pull platform fees from this contract during settle()
        IERC20Perps(_collateral).approve(_funding, type(uint256).max);
    }

    function _validateOpen(uint256 margin, uint8 leverage) internal view returns (
        uint256 notional,
        uint256 openFee,
        uint256 price
    ) {
        uint256 mcap = IFlapOracle(oracle).getMcap(token);
        require(leverage >= 1 && leverage <= FlapParams.calcMaxLeverage(mcap), "FlapPerps: leverage out of range");
        require(margin >= FlapParams.MIN_POSITION && margin <= FlapParams.calcMaxPosition(mcap), "FlapPerps: position size out of range");
        notional = margin * leverage;
        require(totalLongOI + totalShortOI + notional <= FlapParams.calcMaxOI(mcap), "FlapPerps: OI cap reached");
        uint256 rawFee = (notional * TRADE_FEE_BPS) / BPS_DENOM;
        openFee = rawFee < MIN_TRADE_FEE ? MIN_TRADE_FEE : rawFee;
        price = IFlapOracle(oracle).getPrice(token);
    }

    function _writePosition(
        uint256 posId, address trader,
        uint256 margin, uint8 leverage, bool isLong,
        uint256 price, uint256 notional
    ) internal {
        Position storage p = positions[posId];
        p.trader     = trader;
        p.margin     = margin;
        p.leverage   = leverage;
        p.isLong     = isLong;
        p.entryPrice = price;
        p.size       = notional;
        p.openedAt   = block.timestamp;
        p.isOpen     = true;
    }

    function openPosition(
        uint256 margin,
        uint8   leverage,
        bool    isLong
    ) external marketActive priceIsFresh {
        require(!emergencyPaused, "FlapPerps: emergency paused");
        require(!IFlapVault(vault).isFrozen(), "FlapPerps: market frozen");

        (uint256 notional, uint256 openFee, uint256 price) = _validateOpen(margin, leverage);

        _safeTransferFrom(collateral, msg.sender, address(this), margin + openFee);
        pendingOpenerFees += (openFee * OPENER_FEE_SHARE) / BPS_DENOM;
        _safeTransfer(collateral, platformFeeWallet, (openFee * PLATFORM_FEE_SHARE) / BPS_DENOM);
        _safeTransfer(collateral, vault, margin);
        IFlapVault(vault).addToVault(margin);

        uint256 posId = nextPositionId++;
        _writePosition(posId, msg.sender, margin, leverage, isLong, price, notional);

        traderPositions[msg.sender].push(posId);
        if (isLong) totalLongOI  += notional;
        else        totalShortOI += notional;
        openPositionCount++;

        emit PositionOpened(posId, msg.sender, isLong, margin, leverage, price, openFee);
    }

    function closePosition(uint256 positionId) external priceIsFresh {
        Position storage pos = positions[positionId];
        require(pos.isOpen, "FlapPerps: not open");
        require(pos.trader == msg.sender, "FlapPerps: not your position");
        _closePosition(positionId, IFlapOracle(oracle).getPrice(token), false);
    }

    function forceCloseAll() external {
        require(msg.sender == vault, "FlapPerps: not vault");
        uint256 price = _getLatestPrice();
        for (uint256 i = 1; i < nextPositionId; i++) {
            if (positions[i].isOpen) {
                _closePosition(i, price, true);
            }
        }
    }

    function liquidate(uint256 positionId) external priceIsFresh {
        Position storage pos = positions[positionId];
        require(pos.isOpen, "FlapPerps: not open");

        uint256 currentPrice = IFlapOracle(oracle).getPrice(token);
        require(_isLiquidatable(pos, currentPrice), "FlapPerps: not liquidatable");

        // Remaining margin = 20% of original (80% loss threshold)
        uint256 remainingMargin = (pos.margin * (BPS_DENOM - LIQ_THRESHOLD_BPS)) / BPS_DENOM;

        uint256 toInsurance = (remainingMargin * LIQ_INSURANCE_SHARE) / BPS_DENOM;
        uint256 toBot       = (remainingMargin * LIQ_BOT_SHARE)       / BPS_DENOM;
        uint256 toPlatform  = remainingMargin - toInsurance - toBot;

        IFlapVault(vault).addToInsurance(toInsurance);
        if (toBot > 0)      _safeTransfer(collateral, msg.sender, toBot);
        if (toPlatform > 0) _safeTransfer(collateral, platformFeeWallet, toPlatform);

        _removeFromOI(pos);
        pos.isOpen = false;
        openPositionCount--;

        emit PositionLiquidated(positionId, pos.trader, currentPrice, remainingMargin);
    }

    function applyFunding(int256 longFundingPerUnit, int256 shortFundingPerUnit)
        external onlyFunding
    {
        cumulativeLongFunding  += longFundingPerUnit;
        cumulativeShortFunding += shortFundingPerUnit;
        emit FundingApplied(longFundingPerUnit, shortFundingPerUnit);
    }

    function claimFees() external {
        require(msg.sender == opener, "FlapPerps: not opener");
        uint256 amount = pendingOpenerFees;
        require(amount > 0, "FlapPerps: no fees");
        pendingOpenerFees = 0;
        _safeTransfer(collateral, opener, amount);
        emit FeesClaimed(opener, amount);
    }

    // Called by FlapPlatform (msg.sender == platformFeeWallet).

    function setParamsLocked(bool locked) external onlyPlatform {
        paramsLocked = locked;
    }

    function emergencyPause() external onlyPlatform {
        emergencyPaused = true;
    }

    function emergencyUnpause() external onlyPlatform {
        emergencyPaused = false;
    }

    function setPlatformContract(address _platform) external {
        require(
            msg.sender == factory || msg.sender == platformFeeWallet,
            "FlapPerps: not factory or platform fee wallet"
        );
        require(platformContract == address(0),     "FlapPerps: platform already set");
        require(_platform != address(0),            "FlapPerps: zero platform");
        platformContract = _platform;
    }

    function emergencyDrain(address to) external onlyPlatform {
        require(to != address(0), "FlapPerps: zero recipient");
        uint256 bal = IERC20Perps(collateral).balanceOf(address(this));
        if (bal > 0) {
            require(IERC20Perps(collateral).transfer(to, bal), "FlapPerps: drain failed");
        }
        emit EmergencyDrain(to, bal);
    }

    function getLongRatio() external view returns (uint256) {
        uint256 total = totalLongOI + totalShortOI;
        if (total == 0) return 50;
        return (totalLongOI * 100) / total;
    }

    function getTotalOI() external view returns (uint256) {
        return totalLongOI + totalShortOI;
    }

    function getTotalOpenInterest() external view returns (uint256) {
        return totalLongOI + totalShortOI;
    }

    function getOpenPositionCount() external view returns (uint256) {
        return openPositionCount;
    }

    function getPosition(uint256 positionId) external view returns (Position memory) {
        return positions[positionId];
    }

    function getTraderPositions(address trader) external view returns (uint256[] memory) {
        return traderPositions[trader];
    }

    function getUnrealizedPnl(uint256 positionId) external view returns (int256) {
        Position memory pos = positions[positionId];
        if (!pos.isOpen) return 0;
        uint256 currentPrice = IFlapOracle(oracle).getMcap(token) > 0
            ? _getLatestPrice()
            : pos.entryPrice;
        return _calcPnl(pos, currentPrice);
    }

    function isLiquidatable(uint256 positionId) external view returns (bool) {
        Position memory pos = positions[positionId];
        if (!pos.isOpen) return false;
        uint256 price = _getLatestPrice();
        return _isLiquidatable(pos, price);
    }

    function getCurrentParams() external view returns (
        uint256 spread,
        uint8   maxLeverage,
        uint256 maxPosition,
        uint256 maxOI,
        uint256 currentOI
    ) {
        uint256 mcap = IFlapOracle(oracle).getMcap(token);
        spread       = FlapParams.calcSpread(mcap);
        maxLeverage  = FlapParams.calcMaxLeverage(mcap);
        maxPosition  = FlapParams.calcMaxPosition(mcap);
        maxOI        = FlapParams.calcMaxOI(mcap);
        currentOI    = totalLongOI + totalShortOI;
    }

    function _closePosition(uint256 posId, uint256 exitPrice, bool isForced) internal {
        Position storage pos = positions[posId];
        uint256 mcap = IFlapOracle(oracle).getMcap(token);

        uint256 rawCloseFee = (pos.size * TRADE_FEE_BPS) / BPS_DENOM;
        uint256 closeFee    = rawCloseFee < MIN_TRADE_FEE ? MIN_TRADE_FEE : rawCloseFee;

        int256 pnl = _calcPnl(pos, exitPrice);

        int256 fundingDelta = pos.isLong
            ? (cumulativeLongFunding  - pos.fundingAccrued)
            : (cumulativeShortFunding - pos.fundingAccrued);
        pnl += fundingDelta;

        int256 netPayout = int256(pos.margin) + pnl - int256(closeFee);

        if (netPayout > 0) {
            IFlapVault(vault).payTrader(pos.trader, uint256(netPayout));
        }

        // Distribute close fee (only if not forced)
        if (!isForced && closeFee > 0) {
            uint256 openerCut   = (closeFee * OPENER_FEE_SHARE)   / BPS_DENOM;
            uint256 platformCut = (closeFee * PLATFORM_FEE_SHARE) / BPS_DENOM;
            pendingOpenerFees  += openerCut;
            if (platformCut > 0) {
                _safeTransfer(collateral, platformFeeWallet, platformCut);
            }
        }

        _removeFromOI(pos);
        pos.isOpen = false;
        openPositionCount--;

        emit PositionClosed(posId, pos.trader, pnl, exitPrice, closeFee);
    }

    function _calcPnl(Position memory pos, uint256 currentPrice) internal pure returns (int256) {
        if (pos.entryPrice == 0) return 0;
        int256 priceMove = int256(currentPrice) - int256(pos.entryPrice);
        int256 notional  = int256(pos.size);
        int256 pnl       = (priceMove * notional) / int256(pos.entryPrice);
        return pos.isLong ? pnl : -pnl;
    }

    function _isLiquidatable(Position memory pos, uint256 currentPrice) internal pure returns (bool) {
        int256 pnl  = 0;
        int256 loss = 0;

        if (pos.isLong) {
            if (currentPrice >= pos.entryPrice) return false;
            loss = int256((pos.entryPrice - currentPrice) * pos.size / pos.entryPrice);
        } else {
            if (currentPrice <= pos.entryPrice) return false;
            loss = int256((currentPrice - pos.entryPrice) * pos.size / pos.entryPrice);
        }

        return uint256(loss) >= (pos.margin * LIQ_THRESHOLD_BPS) / BPS_DENOM;
    }

    function _removeFromOI(Position memory pos) internal {
        if (pos.isLong) {
            if (totalLongOI >= pos.size) totalLongOI -= pos.size;
            else totalLongOI = 0;
        } else {
            if (totalShortOI >= pos.size) totalShortOI -= pos.size;
            else totalShortOI = 0;
        }
    }

    function _getLatestPrice() internal view returns (uint256) {
        (bool ok, bytes memory data) = oracle.staticcall(
            abi.encodeWithSignature("getPrice(address)", token)
        );
        if (!ok || data.length == 0) return 0;
        return abi.decode(data, (uint256));
    }

    function _safeTransfer(address _token, address to, uint256 amount) internal {
        require(IERC20Perps(_token).transfer(to, amount), "FlapPerps: transfer failed");
    }

    function _safeTransferFrom(address _token, address from, address to, uint256 amount) internal {
        require(IERC20Perps(_token).transferFrom(from, to, amount), "FlapPerps: transferFrom failed");
    }
}
