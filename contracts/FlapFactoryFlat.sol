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

    function calcSpread(uint256 m) internal pure returns (uint256) {
        if (m < MCAP_50K)  return 50;
        if (m < MCAP_100K) return 45;
        if (m < MCAP_200K) return 40;
        if (m < MCAP_400K) return 35;
        if (m < MCAP_800K) return 30;
        if (m < MCAP_1P5M) return 25;
        if (m < MCAP_3M)   return 20;
        if (m < MCAP_7M)   return 15;
        return 10;
    }
    function calcMaxLeverage(uint256 m) internal pure returns (uint8) {
        if (m < MCAP_50K)  return 1;
        if (m < MCAP_100K) return 5;
        if (m < MCAP_300K) return 7;
        return 10;
    }
    function calcMaxPosition(uint256 m) internal pure returns (uint256) {
        if (m < MCAP_50K)  return 20e18;
        if (m < MCAP_100K) return 35e18;
        if (m < MCAP_300K) return 50e18;
        if (m < MCAP_1M)   return 75e18;
        return 100e18;
    }
    function calcMaxOI(uint256 m) internal pure returns (uint256) {
        if (m < MCAP_50K)  return 1_000e18;
        if (m < MCAP_100K) return 2_500e18;
        if (m < MCAP_300K) return 6_000e18;
        if (m < MCAP_1M)   return 15_000e18;
        if (m < MCAP_5M)   return 40_000e18;
        return 100_000e18;
    }
    function calcMinInsurance(uint256 m) internal pure returns (uint256) {
        uint256 x = calcMaxOI(m) / 10;
        return x < 100e18 ? 100e18 : x;
    }
    function vaultHealth(uint256 bal, uint256 maxOI) internal pure returns (uint8) {
        if (maxOI == 0) return 0;
        uint256 r = (bal * 10_000) / maxOI;
        if (r >= VAULT_WARN_BPS)   return 0;
        if (r >= VAULT_FREEZE_BPS) return 1;
        return 2;
    }
}

interface IERC20V {
    function transfer(address to, uint256 a) external returns (bool);
    function transferFrom(address f, address t, uint256 a) external returns (bool);
    function balanceOf(address a) external view returns (uint256);
}
interface IPerpsV {
    function getOpenPositionCount() external view returns (uint256);
    function forceCloseAll() external;
    function getTotalOpenInterest() external view returns (uint256);
}

contract FlapVault {
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
    uint256 public constant GRACE_PERIOD = 3 days;
    uint256 public constant MIN_VAULT    = 100e18;

    uint256 public vaultBalance;
    uint256 public insuranceBalance;
    uint256 public vaultLockedUntil;
    uint256 public insuranceLockedUntil;
    uint256 public lockDuration;
    uint256 public frozenAt;
    bool    public withdrawalRequested;
    bool    public marketClosed;
    uint8   public trustBadge;

    event VaultDeposited(address indexed opener, uint256 amount, uint256 unlocksAt);
    event InsuranceDeposited(address indexed opener, uint256 amount, uint256 unlocksAt);
    event VaultWithdrawalRequested(address indexed opener);
    event VaultWithdrawn(address indexed opener, uint256 v, uint256 i);
    event TraderRefunded(address indexed trader, uint256 amount);
    event MarketFrozen(uint256 at);
    event MarketForceClosedByHealth();
    event VaultHealthUpdated(uint8 h);
    event EmergencyWithdraw(address indexed to, uint256 total);

    modifier onlyOpener()        { require(msg.sender == opener,  "V:op"); _; }
    modifier onlyPerps()         { require(msg.sender == perps,   "V:pr"); _; }
    modifier notClosed()         { require(!marketClosed,         "V:cl"); _; }
    modifier onlyPlatformAdmin() {
        require(msg.sender == platformAdmin || (platformContract != address(0) && msg.sender == platformContract), "V:pa");
        _;
    }

    constructor(
        address _opener, address _token, address _collateral,
        address _oracle, address _factory, uint256 _lock, address _pa
    ) {
        require(_opener != address(0) && _token != address(0) && _collateral != address(0), "V:0a");
        require(_oracle != address(0) && _factory != address(0) && _pa != address(0),       "V:0b");
        require(_lock == LOCK_7D || _lock == LOCK_30D || _lock == LOCK_90D || _lock == LOCK_180D, "V:lk");
        opener = _opener; token = _token; collateral = _collateral;
        oracle = _oracle; factory = _factory; lockDuration = _lock; platformAdmin = _pa;
        if      (_lock == LOCK_30D)  trustBadge = 1;
        else if (_lock == LOCK_90D)  trustBadge = 2;
        else if (_lock == LOCK_180D) trustBadge = 3;
    }

    function setPerps(address _p) external {
        require(msg.sender == factory && perps == address(0) && _p != address(0), "V:sp");
        perps = _p;
    }
    function setPlatformContract(address _p) external {
        require(msg.sender == factory && platformContract == address(0) && _p != address(0), "V:sc");
        platformContract = _p;
    }
    function initDeposit(uint256 va, uint256 ia) external notClosed {
        require(msg.sender == factory, "V:if");
        require(vaultBalance == 0 && insuranceBalance == 0, "V:ii");
        require(va >= MIN_VAULT && ia > 0, "V:im");
        _stf(collateral, factory, address(this), va + ia);
        vaultBalance = va; insuranceBalance = ia;
        vaultLockedUntil = block.timestamp + lockDuration;
        insuranceLockedUntil = block.timestamp + lockDuration;
        emit VaultDeposited(opener, va, vaultLockedUntil);
        emit InsuranceDeposited(opener, ia, insuranceLockedUntil);
    }
    function depositVault(uint256 a) external onlyOpener notClosed {
        require(a > 0 && vaultBalance + a >= MIN_VAULT, "V:dv");
        _stf(collateral, opener, address(this), a);
        vaultBalance += a;
        if (block.timestamp >= vaultLockedUntil) vaultLockedUntil = block.timestamp + lockDuration;
        emit VaultDeposited(opener, a, vaultLockedUntil);
        _health();
    }
    function depositInsurance(uint256 a) external onlyOpener notClosed {
        require(a > 0, "V:di");
        require(insuranceBalance + a >= FlapParams.calcMinInsurance(_mcap()), "V:dm");
        _stf(collateral, opener, address(this), a);
        insuranceBalance += a;
        if (block.timestamp >= insuranceLockedUntil) insuranceLockedUntil = block.timestamp + lockDuration;
        emit InsuranceDeposited(opener, a, insuranceLockedUntil);
    }
    function requestWithdrawal() external onlyOpener notClosed {
        require(block.timestamp >= vaultLockedUntil && !withdrawalRequested, "V:rw");
        withdrawalRequested = true;
        IPerpsV(perps).forceCloseAll();
        emit VaultWithdrawalRequested(opener);
    }
    function completeWithdrawal() external onlyOpener {
        require(withdrawalRequested && IPerpsV(perps).getOpenPositionCount() == 0, "V:cw");
        uint256 vo = vaultBalance; uint256 io = insuranceBalance;
        vaultBalance = 0; insuranceBalance = 0; marketClosed = true;
        if (vo > 0) _st(collateral, opener, vo);
        if (io > 0) _st(collateral, opener, io);
        emit VaultWithdrawn(opener, vo, io);
    }
    function emergencyWithdraw(address to) external onlyPlatformAdmin {
        require(to != address(0), "V:ew");
        uint256 t = vaultBalance + insuranceBalance;
        vaultBalance = 0; insuranceBalance = 0; marketClosed = true;
        if (t > 0) _st(collateral, to, t);
        emit EmergencyWithdraw(to, t);
    }
    function payTrader(address trader, uint256 a) external onlyPerps {
        if (a == 0) return;
        if (vaultBalance >= a) {
            vaultBalance -= a; _st(collateral, trader, a);
        } else if (vaultBalance + insuranceBalance >= a) {
            uint256 fv = vaultBalance; vaultBalance = 0; insuranceBalance -= a - fv; _st(collateral, trader, a);
        } else {
            uint256 av = vaultBalance + insuranceBalance;
            vaultBalance = 0; insuranceBalance = 0;
            if (av > 0) _st(collateral, trader, av);
            emit TraderRefunded(trader, av); return;
        }
        emit TraderRefunded(trader, a); _health();
    }
    function addToInsurance(uint256 a) external onlyPerps { if (a > 0) insuranceBalance += a; }
    function addToVault(uint256 a)     external onlyPerps { if (a > 0) vaultBalance     += a; }
    function checkHealth() external notClosed { _health(); }

    function _health() internal {
        uint256 maxOI = FlapParams.calcMaxOI(_mcap());
        uint8 h = FlapParams.vaultHealth(vaultBalance, maxOI);
        emit VaultHealthUpdated(h);
        if (h == 2) {
            if (frozenAt == 0) { frozenAt = block.timestamp; emit MarketFrozen(frozenAt); }
            else if (block.timestamp - frozenAt >= GRACE_PERIOD) { IPerpsV(perps).forceCloseAll(); marketClosed = true; emit MarketForceClosedByHealth(); }
        } else { frozenAt = 0; }
    }
    function isFrozen()            external view returns (bool)   { return FlapParams.vaultHealth(vaultBalance, FlapParams.calcMaxOI(_mcap())) == 2; }
    function isWithdrawalBlocked() external view returns (bool)   { return withdrawalRequested || marketClosed; }
    function getHealth()           external view returns (uint8)  { return FlapParams.vaultHealth(vaultBalance, FlapParams.calcMaxOI(_mcap())); }
    function isWithdrawable()      external view returns (bool)   { return block.timestamp >= vaultLockedUntil; }
    function trustBadgeName() external view returns (string memory) {
        if (trustBadge == 3) return "Platinum";
        if (trustBadge == 2) return "Gold";
        if (trustBadge == 1) return "Silver";
        return "None";
    }
    function _mcap() internal view returns (uint256) {
        (bool ok, bytes memory d) = oracle.staticcall(abi.encodeWithSignature("getMcap(address)", token));
        return (ok && d.length > 0) ? abi.decode(d, (uint256)) : 0;
    }
    function _st(address t, address to, uint256 a) internal  { require(IERC20V(t).transfer(to, a), "V:tf"); }
    function _stf(address t, address f, address to, uint256 a) internal { require(IERC20V(t).transferFrom(f, to, a), "V:tff"); }
}

interface IOracle {
    function getPrice(address t) external view returns (uint256);
    function getMcap(address t)  external view returns (uint256);
    function isFresh(address t)  external view returns (bool);
}
interface IVaultP {
    function payTrader(address trader, uint256 a) external;
    function addToInsurance(uint256 a) external;
    function addToVault(uint256 a) external;
    function isFrozen() external view returns (bool);
    function isWithdrawalBlocked() external view returns (bool);
    function marketClosed() external view returns (bool);
}
interface IERC20P {
    function transfer(address to, uint256 a) external returns (bool);
    function transferFrom(address f, address t, uint256 a) external returns (bool);
    function balanceOf(address a) external view returns (uint256);
    function approve(address s, uint256 a) external returns (bool);
}

contract FlapPerps {
    address public immutable token;
    address public immutable collateral;
    address public immutable vault;
    address public immutable oracle;
    address public immutable funding;
    address public immutable opener;
    address public immutable platformFeeWallet;
    address public immutable botOperator;
    address public immutable factory;

    uint256 public constant OPENER_SHARE   = 8000;
    uint256 public constant PLATFORM_SHARE = 2000;
    uint256 public constant BPS            = 10_000;
    uint256 public constant FEE_BPS        = 10;
    uint256 public constant MIN_FEE        = 1e18;
    uint256 public constant LIQ_BPS        = 8000;
    uint256 public constant LIQ_INS        = 5000;
    uint256 public constant LIQ_BOT        = 3000;
    uint256 public constant LIQ_PLAT       = 2000;

    struct Position {
        address trader; uint256 margin; uint8 leverage; bool isLong;
        uint256 entryPrice; uint256 size; uint256 openedAt; bool isOpen; int256 fundingAccrued;
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

    event PositionOpened(uint256 indexed id, address indexed trader, bool isLong, uint256 margin, uint8 leverage, uint256 entryPrice, uint256 fee);
    event PositionClosed(uint256 indexed id, address indexed trader, int256 pnl, uint256 exitPrice, uint256 fee);
    event PositionLiquidated(uint256 indexed id, address indexed trader, uint256 price, uint256 remaining);
    event FeesClaimed(address indexed opener, uint256 amount);
    event FundingApplied(int256 lf, int256 sf);
    event EmergencyDrain(address indexed to, uint256 amount);

    modifier onlyFunding() { require(msg.sender == funding, "P:fn"); _; }
    modifier onlyPlatform() {
        require(msg.sender == platformFeeWallet || (platformContract != address(0) && msg.sender == platformContract), "P:pl");
        _;
    }
    modifier marketActive() {
        require(!IVaultP(vault).marketClosed() && !IVaultP(vault).isWithdrawalBlocked(), "P:ma");
        _;
    }
    modifier priceIsFresh() { require(IOracle(oracle).isFresh(token), "P:ps"); _; }

    constructor(
        address _token, address _collateral, address _vault, address _oracle,
        address _funding, address _opener, address _pfw, address _bot, address _factory
    ) {
        require(_token != address(0) && _collateral != address(0) && _vault != address(0), "P:0a");
        require(_oracle != address(0) && _funding != address(0) && _opener != address(0),  "P:0b");
        require(_pfw != address(0) && _bot != address(0) && _factory != address(0),        "P:0c");
        token = _token; collateral = _collateral; vault = _vault; oracle = _oracle;
        funding = _funding; opener = _opener; platformFeeWallet = _pfw;
        botOperator = _bot; factory = _factory;
        IERC20P(_collateral).approve(_funding, type(uint256).max);
    }

    function _validateOpen(uint256 margin, uint8 leverage) internal view returns (uint256 notional, uint256 fee, uint256 price) {
        uint256 mcap = IOracle(oracle).getMcap(token);
        require(leverage >= 1 && leverage <= FlapParams.calcMaxLeverage(mcap), "P:lv");
        require(margin >= FlapParams.MIN_POSITION && margin <= FlapParams.calcMaxPosition(mcap), "P:sz");
        notional = margin * leverage;
        require(totalLongOI + totalShortOI + notional <= FlapParams.calcMaxOI(mcap), "P:oi");
        uint256 rawFee = (notional * FEE_BPS) / BPS;
        fee   = rawFee < MIN_FEE ? MIN_FEE : rawFee;
        price = IOracle(oracle).getPrice(token);
    }

    function _writePos(uint256 id, address trader, uint256 margin, uint8 leverage, bool isLong, uint256 price, uint256 notional) internal {
        Position storage p = positions[id];
        p.trader = trader; p.margin = margin; p.leverage = leverage; p.isLong = isLong;
        p.entryPrice = price; p.size = notional; p.openedAt = block.timestamp; p.isOpen = true;
    }

    function openPosition(uint256 margin, uint8 leverage, bool isLong) external marketActive priceIsFresh {
        require(!emergencyPaused && !IVaultP(vault).isFrozen(), "P:ep");
        (uint256 notional, uint256 fee, uint256 price) = _validateOpen(margin, leverage);
        _stf(collateral, msg.sender, address(this), margin + fee);
        pendingOpenerFees += (fee * OPENER_SHARE) / BPS;
        _st(collateral, platformFeeWallet, (fee * PLATFORM_SHARE) / BPS);
        _st(collateral, vault, margin);
        IVaultP(vault).addToVault(margin);
        uint256 id = nextPositionId++;
        _writePos(id, msg.sender, margin, leverage, isLong, price, notional);
        traderPositions[msg.sender].push(id);
        if (isLong) totalLongOI += notional; else totalShortOI += notional;
        openPositionCount++;
        emit PositionOpened(id, msg.sender, isLong, margin, leverage, price, fee);
    }

    function closePosition(uint256 posId) external priceIsFresh {
        Position storage pos = positions[posId];
        require(pos.isOpen && pos.trader == msg.sender, "P:cp");
        _close(posId, IOracle(oracle).getPrice(token), false);
    }

    function forceCloseAll() external {
        require(msg.sender == vault, "P:fc");
        uint256 price = _latestPrice();
        for (uint256 i = 1; i < nextPositionId; i++) { if (positions[i].isOpen) _close(i, price, true); }
    }

    function liquidate(uint256 posId) external priceIsFresh {
        Position storage pos = positions[posId];
        require(pos.isOpen, "P:lo");
        uint256 cp = IOracle(oracle).getPrice(token);
        require(_liqCheck(pos, cp), "P:ln");
        uint256 rem = (pos.margin * (BPS - LIQ_BPS)) / BPS;
        uint256 ins = (rem * LIQ_INS) / BPS;
        uint256 bot = (rem * LIQ_BOT) / BPS;
        IVaultP(vault).addToInsurance(ins);
        if (bot > 0)       _st(collateral, msg.sender,        bot);
        if (rem-ins-bot>0) _st(collateral, platformFeeWallet, rem-ins-bot);
        _rmOI(pos); pos.isOpen = false; openPositionCount--;
        emit PositionLiquidated(posId, pos.trader, cp, rem);
    }

    function applyFunding(int256 lf, int256 sf) external onlyFunding {
        cumulativeLongFunding += lf; cumulativeShortFunding += sf;
        emit FundingApplied(lf, sf);
    }
    function claimFees() external {
        require(msg.sender == opener, "P:cf");
        uint256 a = pendingOpenerFees; require(a > 0, "P:c0");
        pendingOpenerFees = 0; _st(collateral, opener, a);
        emit FeesClaimed(opener, a);
    }
    function setParamsLocked(bool v) external onlyPlatform { paramsLocked = v; }
    function emergencyPause()   external onlyPlatform { emergencyPaused = true;  }
    function emergencyUnpause() external onlyPlatform { emergencyPaused = false; }
    function setPlatformContract(address _p) external {
        require(msg.sender == factory || msg.sender == platformFeeWallet, "P:sf");
        require(platformContract == address(0) && _p != address(0), "P:sp");
        platformContract = _p;
    }
    function emergencyDrain(address to) external onlyPlatform {
        require(to != address(0), "P:ed");
        uint256 b = IERC20P(collateral).balanceOf(address(this));
        if (b > 0) require(IERC20P(collateral).transfer(to, b), "P:et");
        emit EmergencyDrain(to, b);
    }

    function getLongRatio()           external view returns (uint256) { uint256 t = totalLongOI + totalShortOI; return t == 0 ? 50 : (totalLongOI * 100) / t; }
    function getTotalOI()             external view returns (uint256) { return totalLongOI + totalShortOI; }
    function getTotalOpenInterest()   external view returns (uint256) { return totalLongOI + totalShortOI; }
    function getOpenPositionCount()   external view returns (uint256) { return openPositionCount; }
    function getPosition(uint256 id)  external view returns (Position memory) { return positions[id]; }
    function getTraderPositions(address t) external view returns (uint256[] memory) { return traderPositions[t]; }
    function getUnrealizedPnl(uint256 id) external view returns (int256) { Position memory p = positions[id]; return p.isOpen ? _pnl(p, _latestPrice()) : int256(0); }
    function isLiquidatable(uint256 id)   external view returns (bool) { Position memory p = positions[id]; return p.isOpen && _liqCheck(p, _latestPrice()); }
    function getCurrentParams() external view returns (uint256 spread, uint8 maxLev, uint256 maxPos, uint256 maxOI, uint256 curOI) {
        uint256 m = IOracle(oracle).getMcap(token);
        spread = FlapParams.calcSpread(m); maxLev = FlapParams.calcMaxLeverage(m);
        maxPos = FlapParams.calcMaxPosition(m); maxOI = FlapParams.calcMaxOI(m); curOI = totalLongOI + totalShortOI;
    }

    function _close(uint256 id, uint256 ep, bool forced) internal {
        Position storage pos = positions[id];
        uint256 rf = (pos.size * FEE_BPS) / BPS;
        uint256 cf = rf < MIN_FEE ? MIN_FEE : rf;
        int256 p = _pnl(pos, ep);
        p += pos.isLong ? (cumulativeLongFunding - pos.fundingAccrued) : (cumulativeShortFunding - pos.fundingAccrued);
        int256 net = int256(pos.margin) + p - int256(cf);
        if (net > 0) IVaultP(vault).payTrader(pos.trader, uint256(net));
        if (!forced && cf > 0) {
            pendingOpenerFees += (cf * OPENER_SHARE) / BPS;
            uint256 pc = (cf * PLATFORM_SHARE) / BPS;
            if (pc > 0) _st(collateral, platformFeeWallet, pc);
        }
        _rmOI(pos); pos.isOpen = false; openPositionCount--;
        emit PositionClosed(id, pos.trader, p, ep, cf);
    }
    function _pnl(Position memory pos, uint256 cp) internal pure returns (int256) {
        if (pos.entryPrice == 0) return 0;
        int256 mv = (int256(cp) - int256(pos.entryPrice)) * int256(pos.size) / int256(pos.entryPrice);
        return pos.isLong ? mv : -mv;
    }
    function _liqCheck(Position memory pos, uint256 cp) internal pure returns (bool) {
        uint256 loss;
        if (pos.isLong)  { if (cp >= pos.entryPrice) return false; loss = (pos.entryPrice - cp) * pos.size / pos.entryPrice; }
        else             { if (cp <= pos.entryPrice) return false; loss = (cp - pos.entryPrice) * pos.size / pos.entryPrice; }
        return loss >= (pos.margin * LIQ_BPS) / BPS;
    }
    function _rmOI(Position memory pos) internal {
        if (pos.isLong) { if (totalLongOI  >= pos.size) totalLongOI  -= pos.size; else totalLongOI  = 0; }
        else            { if (totalShortOI >= pos.size) totalShortOI -= pos.size; else totalShortOI = 0; }
    }
    function _latestPrice() internal view returns (uint256) {
        (bool ok, bytes memory d) = oracle.staticcall(abi.encodeWithSignature("getPrice(address)", token));
        return (ok && d.length > 0) ? abi.decode(d, (uint256)) : 0;
    }
    function _st(address t, address to, uint256 a) internal  { require(IERC20P(t).transfer(to, a), "P:st"); }
    function _stf(address t, address f, address to, uint256 a) internal { require(IERC20P(t).transferFrom(f, to, a), "P:sf"); }
}

interface IFundingReg { function registerMarket(address perps) external; }
interface IERC20F     { function approve(address s, uint256 a) external returns (bool); function transferFrom(address f, address t, uint256 a) external returns (bool); }
interface IVaultInit  { function initDeposit(uint256 va, uint256 ia) external; }
interface IVaultPlat  { function setPlatformContract(address p) external; }
interface IPerpsPlat  { function setPlatformContract(address p) external; }

contract FlapFactory {
    address public botOperator;
    address public platform;
    address public platformFeeWallet;
    address public collateralToken;
    address public oracleAddress;
    address public fundingAddress;

    struct MarketAddresses { address vault; address perps; address opener; uint256 createdAt; bool exists; }
    mapping(address => MarketAddresses) public markets;
    address[] public allTokens;

    event MarketCreated(address indexed token, address indexed opener, address vault, address perps, uint256 lock);
    event BotOperatorUpdated(address indexed n);
    event PlatformFeeWalletUpdated(address indexed n);
    event PlatformUpdated(address indexed n);

    modifier onlyBot()  { require(msg.sender == botOperator, "F:bt"); _; }
    modifier onlyBotOrPlatform() { require(msg.sender == botOperator || msg.sender == platform, "F:bp"); _; }

    constructor(address _bot, address _plat, address _pfw, address _col, address _oracle, address _fund) {
        require(_bot != address(0) && _pfw != address(0) && _col != address(0), "F:0a");
        require(_oracle != address(0) && _fund != address(0), "F:0b");
        botOperator = _bot; platform = _plat; platformFeeWallet = _pfw;
        collateralToken = _col; oracleAddress = _oracle; fundingAddress = _fund;
    }

    function createMarket(address token, address opener, uint256 lockDays) external onlyBotOrPlatform returns (address vault, address perps) {
        require(token != address(0) && opener != address(0) && !markets[token].exists, "F:cm");
        (vault, perps) = _deploy(token, opener, lockDays);
        emit MarketCreated(token, opener, vault, perps, _lock(lockDays));
    }

    function createMarketWithDeposit(address token, address opener, uint256 lockDays, uint256 va, uint256 ia) external returns (address vault, address perps) {
        require(msg.sender == platform, "F:np");
        require(token != address(0) && opener != address(0) && !markets[token].exists, "F:md");
        require(va > 0 && ia > 0, "F:mn");
        (vault, perps) = _deploy(token, opener, lockDays);
        IVaultPlat(vault).setPlatformContract(msg.sender);
        IPerpsPlat(perps).setPlatformContract(msg.sender);
        require(IERC20F(collateralToken).approve(vault, va + ia), "F:ap");
        IVaultInit(vault).initDeposit(va, ia);
        emit MarketCreated(token, opener, vault, perps, _lock(lockDays));
    }

    function _deploy(address token, address opener, uint256 lockDays) internal returns (address vault, address perps) {
        uint256 ld = _lock(lockDays);
        FlapVault nv = new FlapVault(opener, token, collateralToken, oracleAddress, address(this), ld, platformFeeWallet);
        FlapPerps np = new FlapPerps(token, collateralToken, address(nv), oracleAddress, fundingAddress, opener, platformFeeWallet, botOperator, address(this));
        nv.setPerps(address(np));
        if (platform != address(0)) { IVaultPlat(address(nv)).setPlatformContract(platform); IPerpsPlat(address(np)).setPlatformContract(platform); }
        IFundingReg(fundingAddress).registerMarket(address(np));
        markets[token] = MarketAddresses({ vault: address(nv), perps: address(np), opener: opener, createdAt: block.timestamp, exists: true });
        allTokens.push(token);
        vault = address(nv); perps = address(np);
    }

    function getMarket(address t)    external view returns (MarketAddresses memory) { return markets[t]; }
    function marketExists(address t) external view returns (bool)   { return markets[t].exists; }
    function totalMarkets()          external view returns (uint256) { return allTokens.length; }
    function getMarkets(uint256 off, uint256 lim) external view returns (address[] memory ts, MarketAddresses[] memory ms) {
        uint256 end = off + lim; if (end > allTokens.length) end = allTokens.length;
        uint256 n = end - off; ts = new address[](n); ms = new MarketAddresses[](n);
        for (uint256 i = 0; i < n; i++) { ts[i] = allTokens[off + i]; ms[i] = markets[ts[i]]; }
    }
    function setBotOperator(address n)    external onlyBotOrPlatform { require(n != address(0), "F:0"); botOperator = n;       emit BotOperatorUpdated(n); }
    function setPlatformFeeWallet(address n) external onlyBotOrPlatform { require(n != address(0), "F:0"); platformFeeWallet = n; emit PlatformFeeWalletUpdated(n); }
    function setPlatform(address n)       external onlyBot           { require(n != address(0), "F:0"); platform = n;          emit PlatformUpdated(n); }

    function _lock(uint256 d) internal pure returns (uint256) {
        if (d == 7)   return 7   days;
        if (d == 30)  return 30  days;
        if (d == 90)  return 90  days;
        if (d == 180) return 180 days;
        revert("F:ld");
    }
}
