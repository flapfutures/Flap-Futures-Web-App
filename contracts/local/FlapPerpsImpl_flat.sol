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
    uint256 internal constant MIN_POSITION    = 5e18;
    uint256 internal constant MIN_VAULT       = 1e18; // floor only — real minimum is creator config
    uint256 internal constant VAULT_WARN_BPS  = 3000;
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

contract FlapPerpsImpl {
    bool private _initialized;

    address public token;
    address public collateral;
    address public vault;
    address public oracle;
    address public funding;
    address public opener;
    address public platformFeeWallet;
    address public botOperator;
    address public factory;
    address public platformContract;

    uint256 public constant OPENER_SHARE   = 8000;
    uint256 public constant PLATFORM_SHARE = 2000;
    uint256 public constant BPS            = 10_000;
    uint256 public constant FEE_BPS        = 10;
    uint256 public constant MIN_FEE        = 1e18;
    uint256 public constant LIQ_BPS        = 8000;
    uint256 public constant LIQ_INS        = 5000;
    uint256 public constant LIQ_BOT        = 3000;

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
    uint256 public nextPositionId;
    uint256 public totalLongOI;
    uint256 public totalShortOI;
    uint256 public openPositionCount;
    uint256 public pendingOpenerFees;
    bool    public emergencyPaused;
    bool    public paramsLocked;
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

    function initialize(
        address _token, address _collateral, address _vault, address _oracle,
        address _funding, address _opener, address _pfw, address _bot, address _factory
    ) external {
        require(!_initialized, "P:ai");
        require(_token != address(0) && _collateral != address(0) && _vault != address(0), "P:0a");
        require(_oracle != address(0) && _funding != address(0) && _opener != address(0),  "P:0b");
        require(_pfw != address(0) && _bot != address(0) && _factory != address(0),        "P:0c");
        _initialized    = true;
        nextPositionId  = 1;
        token           = _token;
        collateral      = _collateral;
        vault           = _vault;
        oracle          = _oracle;
        funding         = _funding;
        opener          = _opener;
        platformFeeWallet = _pfw;
        botOperator     = _bot;
        factory         = _factory;
        IERC20P(_collateral).approve(_funding, type(uint256).max);
    }

    function openPosition(uint256 margin, uint8 leverage, bool isLong) external marketActive priceIsFresh {
        require(!emergencyPaused && !IVaultP(vault).isFrozen(), "P:ep");
        uint256 mcap = IOracle(oracle).getMcap(token);
        require(leverage >= 1 && leverage <= FlapParams.calcMaxLeverage(mcap), "P:lv");
        require(margin >= FlapParams.MIN_POSITION && margin <= FlapParams.calcMaxPosition(mcap), "P:sz");
        uint256 notional = margin * leverage;
        require(totalLongOI + totalShortOI + notional <= FlapParams.calcMaxOI(mcap), "P:oi");
        uint256 rawFee = (notional * FEE_BPS) / BPS;
        uint256 fee = rawFee < MIN_FEE ? MIN_FEE : rawFee;
        uint256 price = IOracle(oracle).getPrice(token);
        _stf(msg.sender, address(this), margin + fee);
        pendingOpenerFees += (fee * OPENER_SHARE) / BPS;
        _st(platformFeeWallet, (fee * PLATFORM_SHARE) / BPS);
        _st(vault, margin);
        IVaultP(vault).addToVault(margin);
        uint256 id = nextPositionId++;
        Position storage p = positions[id];
        p.trader = msg.sender; p.margin = margin; p.leverage = leverage; p.isLong = isLong;
        p.entryPrice = price; p.size = notional; p.openedAt = block.timestamp; p.isOpen = true;
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
        for (uint256 i = 1; i < nextPositionId; i++) {
            if (positions[i].isOpen) _close(i, price, true);
        }
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
        if (bot > 0)             _st(msg.sender,        bot);
        if (rem - ins - bot > 0) _st(platformFeeWallet, rem - ins - bot);
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
        pendingOpenerFees = 0; _st(opener, a);
        emit FeesClaimed(opener, a);
    }

    function setParamsLocked(bool v) external onlyPlatform { paramsLocked = v; }
    function emergencyPause()        external onlyPlatform { emergencyPaused = true;  }
    function emergencyUnpause()      external onlyPlatform { emergencyPaused = false; }

    function setPlatformContract(address _p) external {
        require(msg.sender == factory || msg.sender == platformFeeWallet, "P:sa");
        require(platformContract == address(0) && _p != address(0), "P:sb");
        platformContract = _p;
    }

    function emergencyDrain(address to) external onlyPlatform {
        require(to != address(0), "P:ed");
        uint256 b = IERC20P(collateral).balanceOf(address(this));
        if (b > 0) require(IERC20P(collateral).transfer(to, b), "P:et");
        emit EmergencyDrain(to, b);
    }

    function getOpenPositionCount()        external view returns (uint256) { return openPositionCount; }
    function getTotalOpenInterest()        external view returns (uint256) { return totalLongOI + totalShortOI; }
    function getPosition(uint256 id)       external view returns (Position memory) { return positions[id]; }
    function getTraderPositions(address t) external view returns (uint256[] memory) { return traderPositions[t]; }
    function getLongRatio() external view returns (uint256) {
        uint256 t = totalLongOI + totalShortOI;
        return t == 0 ? 50 : (totalLongOI * 100) / t;
    }
    function getUnrealizedPnl(uint256 id) external view returns (int256) {
        Position memory p = positions[id];
        return p.isOpen ? _pnl(p, _latestPrice()) : int256(0);
    }
    function isLiquidatable(uint256 id) external view returns (bool) {
        Position memory p = positions[id];
        return p.isOpen && _liqCheck(p, _latestPrice());
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
            if (pc > 0) _st(platformFeeWallet, pc);
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
    function _st(address to, uint256 a)                internal { require(IERC20P(collateral).transfer(to, a),              "P:st");  }
    function _stf(address from, address to, uint256 a) internal { require(IERC20P(collateral).transferFrom(from, to, a),    "P:stf"); }
}