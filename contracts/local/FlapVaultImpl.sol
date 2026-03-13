// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./FlapParams.sol";

interface IERC20V {
    function transfer(address to, uint256 a) external returns (bool);
    function transferFrom(address f, address t, uint256 a) external returns (bool);
}
interface IPerpsV {
    function getOpenPositionCount() external view returns (uint256);
    function forceCloseAll() external;
}

contract FlapVaultImpl {
    bool    private _initialized;

    address public opener;
    address public token;
    address public collateral;
    address public oracle;
    address public factory;
    address public platformAdmin;
    address public perps;
    address public platformContract;
    uint256 public lockDuration;
    uint256 public vaultLockedUntil;
    uint256 public insuranceLockedUntil;
    uint256 public vaultBalance;
    uint256 public insuranceBalance;
    uint256 public frozenAt;
    bool    public withdrawalRequested;
    bool    public marketClosed;
    uint8   public trustBadge;

    uint256 public constant LOCK_7D   = 7   days;
    uint256 public constant LOCK_30D  = 30  days;
    uint256 public constant LOCK_90D  = 90  days;
    uint256 public constant LOCK_180D = 180 days;
    uint256 public constant GRACE_PERIOD = 3 days;
    uint256 public constant MIN_VAULT    = 1e18; // 1 USDT floor only — creator config enforced on UI

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
        require(
            msg.sender == platformAdmin ||
            (platformContract != address(0) && msg.sender == platformContract),
            "V:pa"
        );
        _;
    }

    function initialize(
        address _opener, address _token, address _collateral,
        address _oracle, address _factory, uint256 _lock, address _pa
    ) external {
        require(!_initialized, "V:ai");
        require(_opener != address(0) && _token != address(0) && _collateral != address(0), "V:0a");
        require(_oracle != address(0) && _factory != address(0) && _pa != address(0),       "V:0b");
        require(
            _lock == LOCK_7D || _lock == LOCK_30D ||
            _lock == LOCK_90D || _lock == LOCK_180D, "V:lk"
        );
        _initialized = true;
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
        require(va > 0 && ia > 0, "V:im");
        _stf(factory, address(this), va + ia);
        vaultBalance = va; insuranceBalance = ia;
        vaultLockedUntil     = block.timestamp + lockDuration;
        insuranceLockedUntil = block.timestamp + lockDuration;
        emit VaultDeposited(opener, va, vaultLockedUntil);
        emit InsuranceDeposited(opener, ia, insuranceLockedUntil);
    }

    function depositVault(uint256 a) external onlyOpener notClosed {
        require(a > 0, "V:dv");
        _stf(opener, address(this), a);
        vaultBalance += a;
        if (block.timestamp >= vaultLockedUntil) vaultLockedUntil = block.timestamp + lockDuration;
        emit VaultDeposited(opener, a, vaultLockedUntil);
        _health();
    }

    function depositInsurance(uint256 a) external onlyOpener notClosed {
        require(a > 0, "V:di");
        require(insuranceBalance + a >= FlapParams.calcMinInsurance(_mcap()), "V:dm");
        _stf(opener, address(this), a);
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
        if (vo > 0) _st(opener, vo);
        if (io > 0) _st(opener, io);
        emit VaultWithdrawn(opener, vo, io);
    }

    function emergencyWithdraw(address to) external onlyPlatformAdmin {
        require(to != address(0), "V:ew");
        uint256 t = vaultBalance + insuranceBalance;
        vaultBalance = 0; insuranceBalance = 0; marketClosed = true;
        if (t > 0) _st(to, t);
        emit EmergencyWithdraw(to, t);
    }

    function payTrader(address trader, uint256 a) external onlyPerps {
        if (a == 0) return;
        if (vaultBalance >= a) {
            vaultBalance -= a; _st(trader, a);
        } else if (vaultBalance + insuranceBalance >= a) {
            uint256 fv = vaultBalance;
            vaultBalance = 0; insuranceBalance -= a - fv; _st(trader, a);
        } else {
            uint256 av = vaultBalance + insuranceBalance;
            vaultBalance = 0; insuranceBalance = 0;
            if (av > 0) _st(trader, av);
            emit TraderRefunded(trader, av); return;
        }
        emit TraderRefunded(trader, a);
        _health();
    }

    function addToInsurance(uint256 a) external onlyPerps { if (a > 0) insuranceBalance += a; }
    function addToVault(uint256 a)     external onlyPerps { if (a > 0) vaultBalance     += a; }
    function checkHealth()             external notClosed { _health(); }

    function _health() internal {
        uint256 maxOI = FlapParams.calcMaxOI(_mcap());
        uint8 h = FlapParams.vaultHealth(vaultBalance, maxOI);
        emit VaultHealthUpdated(h);
        if (h == 2) {
            if (frozenAt == 0) { frozenAt = block.timestamp; emit MarketFrozen(frozenAt); }
            else if (block.timestamp - frozenAt >= GRACE_PERIOD) {
                IPerpsV(perps).forceCloseAll();
                marketClosed = true;
                emit MarketForceClosedByHealth();
            }
        } else { frozenAt = 0; }
    }

    function getHealth()           external view returns (uint8)  { return FlapParams.vaultHealth(vaultBalance, FlapParams.calcMaxOI(_mcap())); }
    function isFrozen()            external view returns (bool)   { return FlapParams.vaultHealth(vaultBalance, FlapParams.calcMaxOI(_mcap())) == 2; }
    function isWithdrawable()      external view returns (bool)   { return block.timestamp >= vaultLockedUntil; }
    function isWithdrawalBlocked() external view returns (bool)   { return withdrawalRequested || marketClosed; }
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
    function _st(address to, uint256 a)                internal { require(IERC20V(collateral).transfer(to, a),              "V:tf");  }
    function _stf(address from, address to, uint256 a) internal { require(IERC20V(collateral).transferFrom(from, to, a),    "V:tff"); }
}
