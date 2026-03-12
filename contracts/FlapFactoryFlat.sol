// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library FlapParams {
    uint256 internal constant MCAP_50K    = 50_000e18;
    uint256 internal constant MCAP_100K   = 100_000e18;
    uint256 internal constant MCAP_200K   = 200_000e18;
    uint256 internal constant MCAP_300K   = 300_000e18;
    uint256 internal constant MCAP_400K   = 400_000e18;
    uint256 internal constant MCAP_800K   = 800_000e18;
    uint256 internal constant MCAP_1M     = 1_000_000e18;
    uint256 internal constant MCAP_1P5M   = 1_500_000e18;
    uint256 internal constant MCAP_3M     = 3_000_000e18;
    uint256 internal constant MCAP_5M     = 5_000_000e18;
    uint256 internal constant MCAP_7M     = 7_000_000e18;
    uint256 internal constant MIN_POSITION = 5e18;
    uint256 internal constant MIN_VAULT    = 500e18;
    uint256 internal constant VAULT_WARN_BPS   = 3000;
    uint256 internal constant VAULT_FREEZE_BPS = 1500;

    function calcSpread(uint256 mcap) internal pure returns (uint256) {
        if (mcap < MCAP_50K)  return 50;
        if (mcap < MCAP_100K) return 45;
        if (mcap < MCAP_200K) return 40;
        if (mcap < MCAP_400K) return 35;
        if (mcap < MCAP_800K) return 30;
        if (mcap < MCAP_1P5M) return 25;
        if (mcap < MCAP_3M)   return 20;
        if (mcap < MCAP_7M)   return 15;
        return 10;
    }

    function calcMaxLeverage(uint256 mcap) internal pure returns (uint8) {
        if (mcap < MCAP_50K)  return 1;
        if (mcap < MCAP_100K) return 5;
        if (mcap < MCAP_300K) return 7;
        return 10;
    }

    function calcMaxPosition(uint256 mcap) internal pure returns (uint256) {
        if (mcap < MCAP_50K)  return 20e18;
        if (mcap < MCAP_100K) return 35e18;
        if (mcap < MCAP_300K) return 50e18;
        if (mcap < MCAP_1M)   return 75e18;
        return 100e18;
    }

    function calcMaxOI(uint256 mcap) internal pure returns (uint256) {
        if (mcap < MCAP_50K)  return 1_000e18;
        if (mcap < MCAP_100K) return 2_500e18;
        if (mcap < MCAP_300K) return 6_000e18;
        if (mcap < MCAP_1M)   return 15_000e18;
        if (mcap < MCAP_5M)   return 40_000e18;
        return 100_000e18;
    }

    function calcMinInsurance(uint256 mcap) internal pure returns (uint256) {
        uint256 maxOI = calcMaxOI(mcap);
        uint256 ten = maxOI / 10;
        return ten < 100e18 ? 100e18 : ten;
    }

    function vaultHealth(uint256 vaultBalance, uint256 maxOI) internal pure returns (uint8) {
        if (maxOI == 0) return 0;
        uint256 ratio = (vaultBalance * 10_000) / maxOI;
        if (ratio >= VAULT_WARN_BPS)   return 0;
        if (ratio >= VAULT_FREEZE_BPS) return 1;
        return 2;
    }
}

interface IERC20Safe {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IFlapPerpsForVault {
    function getOpenPositionCount() external view returns (uint256);
    function forceCloseAll() external;
    function getTotalOpenInterest() external view returns (uint256);
}

contract FlapVault {
    using FlapParams for uint256;

    address public immutable opener;
    address public immutable token;
    address public immutable collateral;
    address public immutable oracle;
    address public immutable factory;
    address public immutable platformAdmin;

    address public perps;
    address public platformContract;

    uint256 public constant LOCK_7D   = 7   days;
    uint256 public constant LOCK_30D  = 30  days;
    uint256 public constant LOCK_90D  = 90  days;
    uint256 public constant LOCK_180D = 180 days;

    uint256 public vaultBalance;
    uint256 public insuranceBalance;
    uint256 public vaultLockedUntil;
    uint256 public insuranceLockedUntil;
    uint256 public lockDuration;
    uint256 public frozenAt;
    bool    public withdrawalRequested;
    bool    public marketClosed;

    uint256 public constant GRACE_PERIOD = 3 days;
    uint256 public constant MIN_VAULT    = 100e18;
    uint8   public trustBadge;

    event VaultDeposited(address indexed opener, uint256 amount, uint256 unlocksAt);
    event InsuranceDeposited(address indexed opener, uint256 amount, uint256 unlocksAt);
    event VaultWithdrawalRequested(address indexed opener);
    event VaultWithdrawn(address indexed opener, uint256 vaultAmount, uint256 insuranceAmount);
    event TraderRefunded(address indexed trader, uint256 amount);
    event MarketFrozen(uint256 frozenAt);
    event MarketForceClosedByHealth();
    event VaultHealthUpdated(uint8 health);
    event EmergencyWithdraw(address indexed to, uint256 totalAmount);

    modifier onlyOpener()        { require(msg.sender == opener,   "FlapVault: not opener");   _; }
    modifier onlyPerps()         { require(msg.sender == perps,    "FlapVault: not perps");    _; }
    modifier notClosed()         { require(!marketClosed,          "FlapVault: market closed"); _; }
    modifier onlyPlatformAdmin() {
        require(
            msg.sender == platformAdmin ||
            (platformContract != address(0) && msg.sender == platformContract),
            "FlapVault: not platform admin"
        );
        _;
    }

    constructor(
        address _opener, address _token, address _collateral,
        address _oracle, address _factory, uint256 _lockDuration, address _platformAdmin
    ) {
        require(_opener        != address(0), "FlapVault: zero opener");
        require(_token         != address(0), "FlapVault: zero token");
        require(_collateral    != address(0), "FlapVault: zero collateral");
        require(_oracle        != address(0), "FlapVault: zero oracle");
        require(_factory       != address(0), "FlapVault: zero factory");
        require(_platformAdmin != address(0), "FlapVault: zero platformAdmin");
        require(
            _lockDuration == LOCK_7D || _lockDuration == LOCK_30D ||
            _lockDuration == LOCK_90D || _lockDuration == LOCK_180D,
            "FlapVault: invalid lock duration"
        );
        opener        = _opener;
        token         = _token;
        collateral    = _collateral;
        oracle        = _oracle;
        factory       = _factory;
        lockDuration  = _lockDuration;
        platformAdmin = _platformAdmin;
        if      (_lockDuration == LOCK_30D)  trustBadge = 1;
        else if (_lockDuration == LOCK_90D)  trustBadge = 2;
        else if (_lockDuration == LOCK_180D) trustBadge = 3;
        else                                 trustBadge = 0;
    }

    function setPerps(address _perps) external {
        require(msg.sender == factory, "FlapVault: not factory");
        require(perps == address(0),   "FlapVault: perps already set");
        require(_perps != address(0),  "FlapVault: zero perps");
        perps = _perps;
    }

    function setPlatformContract(address _platform) external {
        require(msg.sender == factory,           "FlapVault: not factory");
        require(platformContract == address(0),  "FlapVault: platform already set");
        require(_platform != address(0),         "FlapVault: zero platform");
        platformContract = _platform;
    }

    function initDeposit(uint256 vaultAmount, uint256 insuranceAmount) external notClosed {
        require(msg.sender == factory,                              "FlapVault: not factory");
        require(vaultBalance == 0 && insuranceBalance == 0,        "FlapVault: already initialised");
        require(vaultAmount  >= MIN_VAULT,                         "FlapVault: vault below $100 minimum");
        require(insuranceAmount > 0,                               "FlapVault: zero insurance");
        _safeTransferFrom(collateral, factory, address(this), vaultAmount + insuranceAmount);
        vaultBalance         = vaultAmount;
        insuranceBalance     = insuranceAmount;
        vaultLockedUntil     = block.timestamp + lockDuration;
        insuranceLockedUntil = block.timestamp + lockDuration;
        emit VaultDeposited(opener, vaultAmount, vaultLockedUntil);
        emit InsuranceDeposited(opener, insuranceAmount, insuranceLockedUntil);
    }

    function depositVault(uint256 amount) external onlyOpener notClosed {
        require(amount > 0, "FlapVault: zero amount");
        require(vaultBalance + amount >= MIN_VAULT, "FlapVault: below $100 minimum");
        _safeTransferFrom(collateral, opener, address(this), amount);
        vaultBalance += amount;
        if (block.timestamp >= vaultLockedUntil) vaultLockedUntil = block.timestamp + lockDuration;
        emit VaultDeposited(opener, amount, vaultLockedUntil);
        _checkAndUpdateHealth();
    }

    function depositInsurance(uint256 amount) external onlyOpener notClosed {
        require(amount > 0, "FlapVault: zero amount");
        uint256 mcap   = _getMcap();
        uint256 minIns = FlapParams.calcMinInsurance(mcap);
        require(insuranceBalance + amount >= minIns, "FlapVault: below insurance minimum");
        _safeTransferFrom(collateral, opener, address(this), amount);
        insuranceBalance += amount;
        if (block.timestamp >= insuranceLockedUntil) insuranceLockedUntil = block.timestamp + lockDuration;
        emit InsuranceDeposited(opener, amount, insuranceLockedUntil);
    }

    function requestWithdrawal() external onlyOpener notClosed {
        require(block.timestamp >= vaultLockedUntil, "FlapVault: vault still locked");
        require(!withdrawalRequested, "FlapVault: already requested");
        withdrawalRequested = true;
        IFlapPerpsForVault(perps).forceCloseAll();
        emit VaultWithdrawalRequested(opener);
    }

    function completeWithdrawal() external onlyOpener {
        require(withdrawalRequested, "FlapVault: withdrawal not requested");
        require(IFlapPerpsForVault(perps).getOpenPositionCount() == 0, "FlapVault: open positions remain");
        uint256 vaultOut     = vaultBalance;
        uint256 insuranceOut = insuranceBalance;
        vaultBalance     = 0;
        insuranceBalance = 0;
        marketClosed     = true;
        if (vaultOut     > 0) _safeTransfer(collateral, opener, vaultOut);
        if (insuranceOut > 0) _safeTransfer(collateral, opener, insuranceOut);
        emit VaultWithdrawn(opener, vaultOut, insuranceOut);
    }

    function emergencyWithdraw(address to) external onlyPlatformAdmin {
        require(to != address(0), "FlapVault: zero recipient");
        uint256 total    = vaultBalance + insuranceBalance;
        vaultBalance     = 0;
        insuranceBalance = 0;
        marketClosed     = true;
        if (total > 0) _safeTransfer(collateral, to, total);
        emit EmergencyWithdraw(to, total);
    }

    function payTrader(address trader, uint256 amount) external onlyPerps {
        if (amount == 0) return;
        if (vaultBalance >= amount) {
            vaultBalance -= amount;
            _safeTransfer(collateral, trader, amount);
        } else if (vaultBalance + insuranceBalance >= amount) {
            uint256 fromVault     = vaultBalance;
            uint256 fromInsurance = amount - fromVault;
            vaultBalance     = 0;
            insuranceBalance -= fromInsurance;
            _safeTransfer(collateral, trader, amount);
        } else {
            uint256 available = vaultBalance + insuranceBalance;
            vaultBalance     = 0;
            insuranceBalance = 0;
            if (available > 0) _safeTransfer(collateral, trader, available);
            emit TraderRefunded(trader, available);
            return;
        }
        emit TraderRefunded(trader, amount);
        _checkAndUpdateHealth();
    }

    function addToInsurance(uint256 amount) external onlyPerps { if (amount > 0) insuranceBalance += amount; }
    function addToVault(uint256 amount)     external onlyPerps { if (amount > 0) vaultBalance     += amount; }
    function checkHealth() external notClosed { _checkAndUpdateHealth(); }

    function _checkAndUpdateHealth() internal {
        uint256 mcap   = _getMcap();
        uint256 maxOI  = FlapParams.calcMaxOI(mcap);
        uint8   health = FlapParams.vaultHealth(vaultBalance, maxOI);
        emit VaultHealthUpdated(health);
        if (health == 2) {
            if (frozenAt == 0) { frozenAt = block.timestamp; emit MarketFrozen(frozenAt); }
            else if (block.timestamp - frozenAt >= GRACE_PERIOD) { _triggerForceClose(); }
        } else { frozenAt = 0; }
    }

    function _triggerForceClose() internal {
        IFlapPerpsForVault(perps).forceCloseAll();
        marketClosed = true;
        emit MarketForceClosedByHealth();
    }

    function getHealth() external view returns (uint8) {
        return FlapParams.vaultHealth(vaultBalance, FlapParams.calcMaxOI(_getMcap()));
    }
    function isWithdrawable()     external view returns (bool) { return block.timestamp >= vaultLockedUntil; }
    function isFrozen()           external view returns (bool) { return FlapParams.vaultHealth(vaultBalance, FlapParams.calcMaxOI(_getMcap())) == 2; }
    function isWithdrawalBlocked() external view returns (bool) { return withdrawalRequested || marketClosed; }
    function trustBadgeName() external view returns (string memory) {
        if (trustBadge == 3) return "Platinum";
        if (trustBadge == 2) return "Gold";
        if (trustBadge == 1) return "Silver";
        return "None";
    }

    function _getMcap() internal view returns (uint256) {
        (bool ok, bytes memory data) = oracle.staticcall(abi.encodeWithSignature("getMcap(address)", token));
        if (!ok || data.length == 0) return 0;
        return abi.decode(data, (uint256));
    }
    function _safeTransfer(address _token, address to, uint256 amount) internal {
        require(IERC20Safe(_token).transfer(to, amount), "FlapVault: transfer failed");
    }
    function _safeTransferFrom(address _token, address from, address to, uint256 amount) internal {
        require(IERC20Safe(_token).transferFrom(from, to, amount), "FlapVault: transferFrom failed");
    }
}

interface IFlapOracle {
    function getPrice(address token) external view returns (uint256);
    function getMcap(address token)  external view returns (uint256);
    function isFresh(address token)  external view returns (bool);
}

interface IFlapVaultPerps {
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

    address public immutable token;
    address public immutable collateral;
    address public immutable vault;
    address public immutable oracle;
    address public immutable funding;
    address public immutable opener;
    address public immutable platformFeeWallet;
    address public immutable botOperator;
    address public immutable factory;

    uint256 public constant OPENER_FEE_SHARE    = 8000;
    uint256 public constant PLATFORM_FEE_SHARE  = 2000;
    uint256 public constant BPS_DENOM           = 10_000;
    uint256 public constant TRADE_FEE_BPS       = 10;
    uint256 public constant MIN_TRADE_FEE       = 1e18;
    uint256 public constant LIQ_THRESHOLD_BPS   = 8000;
    uint256 public constant LIQ_INSURANCE_SHARE = 5000;
    uint256 public constant LIQ_BOT_SHARE       = 3000;
    uint256 public constant LIQ_PLATFORM_SHARE  = 2000;

    struct Position {
        address trader;
        uint256 margin;
        uint8   leverage;
        bool    isLong;
        uint256 entryPrice;
        uint256 size;
        uint256 openedAt;
        bool    isOpen;
        int256  fundingAccrued;
    }

    mapping(uint256 => Position) public positions;
    mapping(address => uint256[]) public traderPositions;

    uint256 public nextPositionId = 1;
    uint256 public totalLongOI;
    uint256 public totalShortOI;
    uint256 public openPositionCount;
    uint256 public pendingOpenerFees;
    bool    public emergencyPaused;
    bool    public paramsLocked;
    address public platformContract;
    int256  public cumulativeLongFunding;
    int256  public cumulativeShortFunding;

    event PositionOpened(uint256 indexed positionId, address indexed trader, bool isLong, uint256 margin, uint8 leverage, uint256 entryPrice, uint256 spreadFee);
    event PositionClosed(uint256 indexed positionId, address indexed trader, int256 pnl, uint256 exitPrice, uint256 spreadFee);
    event PositionLiquidated(uint256 indexed positionId, address indexed trader, uint256 liquidationPrice, uint256 remainingMargin);
    event FeesClaimed(address indexed opener, uint256 amount);
    event FundingApplied(int256 longPerUnit, int256 shortPerUnit);
    event EmergencyDrain(address indexed to, uint256 amount);

    modifier onlyFunding() { require(msg.sender == funding, "FlapPerps: not funding contract"); _; }
    modifier onlyPlatform() {
        require(
            msg.sender == platformFeeWallet ||
            (platformContract != address(0) && msg.sender == platformContract),
            "FlapPerps: not platform"
        );
        _;
    }
    modifier marketActive() {
        require(!IFlapVaultPerps(vault).marketClosed(),          "FlapPerps: market closed");
        require(!IFlapVaultPerps(vault).isWithdrawalBlocked(),   "FlapPerps: withdrawal in progress");
        _;
    }
    modifier priceIsFresh() { require(IFlapOracle(oracle).isFresh(token), "FlapPerps: price stale"); _; }

    constructor(
        address _token, address _collateral, address _vault,
        address _oracle, address _funding, address _opener,
        address _platformFeeWallet, address _botOperator, address _factory
    ) {
        require(_token             != address(0), "FlapPerps: zero token");
        require(_collateral        != address(0), "FlapPerps: zero collateral");
        require(_vault             != address(0), "FlapPerps: zero vault");
        require(_oracle            != address(0), "FlapPerps: zero oracle");
        require(_funding           != address(0), "FlapPerps: zero funding");
        require(_opener            != address(0), "FlapPerps: zero opener");
        require(_platformFeeWallet != address(0), "FlapPerps: zero fee wallet");
        require(_botOperator       != address(0), "FlapPerps: zero bot");
        require(_factory           != address(0), "FlapPerps: zero factory");
        token             = _token;
        collateral        = _collateral;
        vault             = _vault;
        oracle            = _oracle;
        funding           = _funding;
        opener            = _opener;
        platformFeeWallet = _platformFeeWallet;
        botOperator       = _botOperator;
        factory           = _factory;
        IERC20Perps(_collateral).approve(_funding, type(uint256).max);
    }

    function _validateOpen(uint256 margin, uint8 leverage) internal view returns (
        uint256 notional, uint256 openFee, uint256 price
    ) {
        uint256 mcap = IFlapOracle(oracle).getMcap(token);
        require(leverage >= 1 && leverage <= FlapParams.calcMaxLeverage(mcap), "FlapPerps: leverage out of range");
        require(margin >= FlapParams.MIN_POSITION && margin <= FlapParams.calcMaxPosition(mcap), "FlapPerps: position size out of range");
        notional = margin * leverage;
        require(totalLongOI + totalShortOI + notional <= FlapParams.calcMaxOI(mcap), "FlapPerps: OI cap reached");
        uint256 rawFee = (notional * TRADE_FEE_BPS) / BPS_DENOM;
        openFee = rawFee < MIN_TRADE_FEE ? MIN_TRADE_FEE : rawFee;
        price   = IFlapOracle(oracle).getPrice(token);
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

    function openPosition(uint256 margin, uint8 leverage, bool isLong) external marketActive priceIsFresh {
        require(!emergencyPaused,                    "FlapPerps: emergency paused");
        require(!IFlapVaultPerps(vault).isFrozen(),  "FlapPerps: market frozen");
        (uint256 notional, uint256 openFee, uint256 price) = _validateOpen(margin, leverage);
        _safeTransferFrom(collateral, msg.sender, address(this), margin + openFee);
        pendingOpenerFees += (openFee * OPENER_FEE_SHARE) / BPS_DENOM;
        _safeTransfer(collateral, platformFeeWallet, (openFee * PLATFORM_FEE_SHARE) / BPS_DENOM);
        _safeTransfer(collateral, vault, margin);
        IFlapVaultPerps(vault).addToVault(margin);
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
        require(pos.isOpen,              "FlapPerps: not open");
        require(pos.trader == msg.sender,"FlapPerps: not your position");
        _closePosition(positionId, IFlapOracle(oracle).getPrice(token), false);
    }

    function forceCloseAll() external {
        require(msg.sender == vault, "FlapPerps: not vault");
        uint256 price = _getLatestPrice();
        for (uint256 i = 1; i < nextPositionId; i++) {
            if (positions[i].isOpen) _closePosition(i, price, true);
        }
    }

    function liquidate(uint256 positionId) external priceIsFresh {
        Position storage pos = positions[positionId];
        require(pos.isOpen, "FlapPerps: not open");
        uint256 currentPrice = IFlapOracle(oracle).getPrice(token);
        require(_isLiquidatable(pos, currentPrice), "FlapPerps: not liquidatable");
        uint256 remainingMargin = (pos.margin * (BPS_DENOM - LIQ_THRESHOLD_BPS)) / BPS_DENOM;
        uint256 toInsurance = (remainingMargin * LIQ_INSURANCE_SHARE) / BPS_DENOM;
        uint256 toBot       = (remainingMargin * LIQ_BOT_SHARE)       / BPS_DENOM;
        uint256 toPlatform  = remainingMargin - toInsurance - toBot;
        IFlapVaultPerps(vault).addToInsurance(toInsurance);
        if (toBot      > 0) _safeTransfer(collateral, msg.sender,        toBot);
        if (toPlatform > 0) _safeTransfer(collateral, platformFeeWallet, toPlatform);
        _removeFromOI(pos);
        pos.isOpen = false;
        openPositionCount--;
        emit PositionLiquidated(positionId, pos.trader, currentPrice, remainingMargin);
    }

    function applyFunding(int256 longFundingPerUnit, int256 shortFundingPerUnit) external onlyFunding {
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

    function setParamsLocked(bool locked) external onlyPlatform { paramsLocked = locked; }
    function emergencyPause()   external onlyPlatform { emergencyPaused = true;  }
    function emergencyUnpause() external onlyPlatform { emergencyPaused = false; }

    function setPlatformContract(address _platform) external {
        require(msg.sender == factory || msg.sender == platformFeeWallet, "FlapPerps: not factory or platform fee wallet");
        require(platformContract == address(0), "FlapPerps: platform already set");
        require(_platform        != address(0), "FlapPerps: zero platform");
        platformContract = _platform;
    }

    function emergencyDrain(address to) external onlyPlatform {
        require(to != address(0), "FlapPerps: zero recipient");
        uint256 bal = IERC20Perps(collateral).balanceOf(address(this));
        if (bal > 0) require(IERC20Perps(collateral).transfer(to, bal), "FlapPerps: drain failed");
        emit EmergencyDrain(to, bal);
    }

    function getLongRatio() external view returns (uint256) {
        uint256 total = totalLongOI + totalShortOI;
        if (total == 0) return 50;
        return (totalLongOI * 100) / total;
    }
    function getTotalOI()             external view returns (uint256) { return totalLongOI + totalShortOI; }
    function getTotalOpenInterest()   external view returns (uint256) { return totalLongOI + totalShortOI; }
    function getOpenPositionCount()   external view returns (uint256) { return openPositionCount; }
    function getPosition(uint256 id)  external view returns (Position memory) { return positions[id]; }
    function getTraderPositions(address trader) external view returns (uint256[] memory) { return traderPositions[trader]; }

    function getUnrealizedPnl(uint256 positionId) external view returns (int256) {
        Position memory pos = positions[positionId];
        if (!pos.isOpen) return 0;
        return _calcPnl(pos, _getLatestPrice());
    }

    function isLiquidatable(uint256 positionId) external view returns (bool) {
        Position memory pos = positions[positionId];
        if (!pos.isOpen) return false;
        return _isLiquidatable(pos, _getLatestPrice());
    }

    function getCurrentParams() external view returns (uint256 spread, uint8 maxLeverage, uint256 maxPosition, uint256 maxOI, uint256 currentOI) {
        uint256 mcap = IFlapOracle(oracle).getMcap(token);
        spread      = FlapParams.calcSpread(mcap);
        maxLeverage = FlapParams.calcMaxLeverage(mcap);
        maxPosition = FlapParams.calcMaxPosition(mcap);
        maxOI       = FlapParams.calcMaxOI(mcap);
        currentOI   = totalLongOI + totalShortOI;
    }

    function _closePosition(uint256 posId, uint256 exitPrice, bool isForced) internal {
        Position storage pos = positions[posId];
        uint256 rawCloseFee = (pos.size * TRADE_FEE_BPS) / BPS_DENOM;
        uint256 closeFee    = rawCloseFee < MIN_TRADE_FEE ? MIN_TRADE_FEE : rawCloseFee;
        int256 pnl = _calcPnl(pos, exitPrice);
        int256 fundingDelta = pos.isLong
            ? (cumulativeLongFunding  - pos.fundingAccrued)
            : (cumulativeShortFunding - pos.fundingAccrued);
        pnl += fundingDelta;
        int256 netPayout = int256(pos.margin) + pnl - int256(closeFee);
        if (netPayout > 0) IFlapVaultPerps(vault).payTrader(pos.trader, uint256(netPayout));
        if (!isForced && closeFee > 0) {
            pendingOpenerFees += (closeFee * OPENER_FEE_SHARE) / BPS_DENOM;
            uint256 pc = (closeFee * PLATFORM_FEE_SHARE) / BPS_DENOM;
            if (pc > 0) _safeTransfer(collateral, platformFeeWallet, pc);
        }
        _removeFromOI(pos);
        pos.isOpen = false;
        openPositionCount--;
        emit PositionClosed(posId, pos.trader, pnl, exitPrice, closeFee);
    }

    function _calcPnl(Position memory pos, uint256 currentPrice) internal pure returns (int256) {
        if (pos.entryPrice == 0) return 0;
        int256 priceMove = int256(currentPrice) - int256(pos.entryPrice);
        int256 pnl = (priceMove * int256(pos.size)) / int256(pos.entryPrice);
        return pos.isLong ? pnl : -pnl;
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
        return loss >= (pos.margin * LIQ_THRESHOLD_BPS) / BPS_DENOM;
    }

    function _removeFromOI(Position memory pos) internal {
        if (pos.isLong) { if (totalLongOI  >= pos.size) totalLongOI  -= pos.size; else totalLongOI  = 0; }
        else            { if (totalShortOI >= pos.size) totalShortOI -= pos.size; else totalShortOI = 0; }
    }

    function _getLatestPrice() internal view returns (uint256) {
        (bool ok, bytes memory data) = oracle.staticcall(abi.encodeWithSignature("getPrice(address)", token));
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

interface IFlapFundingRegistry {
    function registerMarket(address perps) external;
}

interface IERC20Factory {
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

interface IFlapVaultInit {
    function initDeposit(uint256 vaultAmount, uint256 insuranceAmount) external;
}

interface IFlapVaultPlatform {
    function setPlatformContract(address _platform) external;
}

interface IFlapPerpsPlatform {
    function setPlatformContract(address _platform) external;
}

contract FlapFactory {

    address public botOperator;
    address public platform;
    address public platformFeeWallet;
    address public collateralToken;
    address public oracleAddress;
    address public fundingAddress;

    struct MarketAddresses {
        address vault;
        address perps;
        address opener;
        uint256 createdAt;
        bool    exists;
    }

    mapping(address => MarketAddresses) public markets;
    address[] public allTokens;

    event MarketCreated(address indexed token, address indexed opener, address vault, address perps, uint256 lockDuration);
    event BotOperatorUpdated(address indexed newOperator);
    event PlatformFeeWalletUpdated(address indexed newWallet);
    event PlatformUpdated(address indexed newPlatform);

    modifier onlyBot()           { require(msg.sender == botOperator,                              "FlapFactory: not bot operator");    _; }
    modifier onlyBotOrPlatform() { require(msg.sender == botOperator || msg.sender == platform,    "FlapFactory: not bot or platform"); _; }

    constructor(
        address _botOperator, address _platform, address _platformFeeWallet,
        address _collateralToken, address _oracleAddress, address _fundingAddress
    ) {
        require(_botOperator       != address(0), "FlapFactory: zero bot");
        require(_platformFeeWallet != address(0), "FlapFactory: zero fee wallet");
        require(_collateralToken   != address(0), "FlapFactory: zero collateral");
        require(_oracleAddress     != address(0), "FlapFactory: zero oracle");
        require(_fundingAddress    != address(0), "FlapFactory: zero funding");
        botOperator       = _botOperator;
        platform          = _platform;
        platformFeeWallet = _platformFeeWallet;
        collateralToken   = _collateralToken;
        oracleAddress     = _oracleAddress;
        fundingAddress    = _fundingAddress;
    }

    function createMarket(
        address tokenAddress, address openerWallet, uint256 lockDays
    ) external onlyBotOrPlatform returns (address vault, address perps) {
        require(tokenAddress != address(0),         "FlapFactory: zero token");
        require(openerWallet != address(0),         "FlapFactory: zero opener");
        require(!markets[tokenAddress].exists,      "FlapFactory: market already exists");
        uint256 lockDuration = _lockDaysToSeconds(lockDays);
        FlapVault newVault = new FlapVault(openerWallet, tokenAddress, collateralToken, oracleAddress, address(this), lockDuration, platformFeeWallet);
        FlapPerps newPerps = new FlapPerps(tokenAddress, collateralToken, address(newVault), oracleAddress, fundingAddress, openerWallet, platformFeeWallet, botOperator, address(this));
        newVault.setPerps(address(newPerps));
        if (platform != address(0)) {
            IFlapVaultPlatform(address(newVault)).setPlatformContract(platform);
            IFlapPerpsPlatform(address(newPerps)).setPlatformContract(platform);
        }
        IFlapFundingRegistry(fundingAddress).registerMarket(address(newPerps));
        markets[tokenAddress] = MarketAddresses({ vault: address(newVault), perps: address(newPerps), opener: openerWallet, createdAt: block.timestamp, exists: true });
        allTokens.push(tokenAddress);
        vault = address(newVault);
        perps = address(newPerps);
        emit MarketCreated(tokenAddress, openerWallet, vault, perps, lockDuration);
    }

    function createMarketWithDeposit(
        address tokenAddress, address openerWallet, uint256 lockDays,
        uint256 vaultAmount, uint256 insuranceAmount
    ) external returns (address vault, address perps) {
        require(msg.sender == platform,            "FlapFactory: not platform");
        require(vaultAmount     > 0,               "FlapFactory: zero vault");
        require(insuranceAmount > 0,               "FlapFactory: zero insurance");
        require(tokenAddress   != address(0),      "FlapFactory: zero token");
        require(openerWallet   != address(0),      "FlapFactory: zero opener");
        require(!markets[tokenAddress].exists,     "FlapFactory: market already exists");
        uint256 lockDuration = _lockDaysToSeconds(lockDays);
        FlapVault newVault = new FlapVault(openerWallet, tokenAddress, collateralToken, oracleAddress, address(this), lockDuration, platformFeeWallet);
        FlapPerps newPerps = new FlapPerps(tokenAddress, collateralToken, address(newVault), oracleAddress, fundingAddress, openerWallet, platformFeeWallet, botOperator, address(this));
        newVault.setPerps(address(newPerps));
        IFlapVaultPlatform(address(newVault)).setPlatformContract(msg.sender);
        IFlapPerpsPlatform(address(newPerps)).setPlatformContract(msg.sender);
        IFlapFundingRegistry(fundingAddress).registerMarket(address(newPerps));
        markets[tokenAddress] = MarketAddresses({ vault: address(newVault), perps: address(newPerps), opener: openerWallet, createdAt: block.timestamp, exists: true });
        allTokens.push(tokenAddress);
        vault = address(newVault);
        perps = address(newPerps);
        require(IERC20Factory(collateralToken).approve(vault, vaultAmount + insuranceAmount), "FlapFactory: USDT approve failed");
        IFlapVaultInit(vault).initDeposit(vaultAmount, insuranceAmount);
        emit MarketCreated(tokenAddress, openerWallet, vault, perps, lockDuration);
    }

    function getMarket(address token)   external view returns (MarketAddresses memory) { return markets[token]; }
    function marketExists(address token) external view returns (bool)                  { return markets[token].exists; }
    function totalMarkets()              external view returns (uint256)               { return allTokens.length; }

    function getMarkets(uint256 offset, uint256 limit) external view returns (address[] memory tokens, MarketAddresses[] memory addrs) {
        uint256 end = offset + limit;
        if (end > allTokens.length) end = allTokens.length;
        uint256 count = end - offset;
        tokens = new address[](count);
        addrs  = new MarketAddresses[](count);
        for (uint256 i = 0; i < count; i++) { tokens[i] = allTokens[offset + i]; addrs[i] = markets[tokens[i]]; }
    }

    function setBotOperator(address newBot)       external onlyBotOrPlatform { require(newBot     != address(0), "FlapFactory: zero address"); botOperator       = newBot;      emit BotOperatorUpdated(newBot); }
    function setPlatformFeeWallet(address newWallet) external onlyBotOrPlatform { require(newWallet  != address(0), "FlapFactory: zero address"); platformFeeWallet = newWallet;   emit PlatformFeeWalletUpdated(newWallet); }
    function setPlatform(address newPlatform)     external onlyBot           { require(newPlatform != address(0), "FlapFactory: zero platform"); platform          = newPlatform; emit PlatformUpdated(newPlatform); }

    function _lockDaysToSeconds(uint256 days_) internal pure returns (uint256) {
        if (days_ == 7)   return 7   days;
        if (days_ == 30)  return 30  days;
        if (days_ == 90)  return 90  days;
        if (days_ == 180) return 180 days;
        revert("FlapFactory: invalid lock days (use 7, 30, 90, or 180)");
    }
}
