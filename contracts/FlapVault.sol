// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "https://raw.githubusercontent.com/flapfutures/Flap-Futures-Web-App/main/contracts/FlapParams.sol";


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

    address public immutable opener;          // market creator wallet
    address public immutable token;           // the perps token (for param lookups)
    address public immutable collateral;      // USDT on BSC
    address public immutable oracle;          // FlapOracle address
    address public immutable factory;         // FlapFactory (only it can set perps)
    address public immutable platformAdmin;   // FlapPlatform fee wallet - can emergency-withdraw

    address public perps;
    address public platformContract; // FlapPlatform contract address - set once by factory

    uint256 public constant LOCK_7D   = 7  days;
    uint256 public constant LOCK_30D  = 30 days;
    uint256 public constant LOCK_90D  = 90 days;
    uint256 public constant LOCK_180D = 180 days;

    uint256 public vaultBalance;
    uint256 public insuranceBalance;
    uint256 public vaultLockedUntil;       // timestamp when vault unlocks
    uint256 public insuranceLockedUntil;
    uint256 public lockDuration;           // chosen at deposit (seconds)
    uint256 public frozenAt;               // timestamp when market entered FROZEN state
    bool    public withdrawalRequested;    // opener initiated withdrawal
    bool    public marketClosed;           // permanently closed after force-close

    uint256 public constant GRACE_PERIOD  = 3 days;
    uint256 public constant MIN_VAULT     = 100e18;

    // 0=None(7d), 1=Silver(30d), 2=Gold(90d), 3=Platinum(180d)
    uint8 public trustBadge;

    event VaultDeposited(address indexed opener, uint256 amount, uint256 unlocksAt);
    event InsuranceDeposited(address indexed opener, uint256 amount, uint256 unlocksAt);
    event VaultWithdrawalRequested(address indexed opener);
    event VaultWithdrawn(address indexed opener, uint256 vaultAmount, uint256 insuranceAmount);
    event TraderRefunded(address indexed trader, uint256 amount);
    event MarketFrozen(uint256 frozenAt);
    event MarketForceClosedByHealth();
    event VaultHealthUpdated(uint8 health);
    event EmergencyWithdraw(address indexed to, uint256 totalAmount);

    modifier onlyOpener() {
        require(msg.sender == opener, "FlapVault: not opener");
        _;
    }

    modifier onlyPerps() {
        require(msg.sender == perps, "FlapVault: not perps contract");
        _;
    }

    modifier notClosed() {
        require(!marketClosed, "FlapVault: market closed");
        _;
    }

    modifier onlyPlatformAdmin() {
        require(
            msg.sender == platformAdmin ||
            (platformContract != address(0) && msg.sender == platformContract),
            "FlapVault: not platform admin"
        );
        _;
    }

    constructor(
        address _opener,
        address _token,
        address _collateral,
        address _oracle,
        address _factory,
        uint256 _lockDuration,
        address _platformAdmin
    ) {
        require(_opener         != address(0), "FlapVault: zero opener");
        require(_token          != address(0), "FlapVault: zero token");
        require(_collateral     != address(0), "FlapVault: zero collateral");
        require(_oracle         != address(0), "FlapVault: zero oracle");
        require(_factory        != address(0), "FlapVault: zero factory");
        require(_platformAdmin  != address(0), "FlapVault: zero platformAdmin");

        require(
            _lockDuration == LOCK_7D   ||
            _lockDuration == LOCK_30D  ||
            _lockDuration == LOCK_90D  ||
            _lockDuration == LOCK_180D,
            "FlapVault: invalid lock duration"
        );

        opener         = _opener;
        token          = _token;
        collateral     = _collateral;
        oracle         = _oracle;
        factory        = _factory;
        lockDuration   = _lockDuration;
        platformAdmin  = _platformAdmin;

        if (_lockDuration == LOCK_30D)       trustBadge = 1;
        else if (_lockDuration == LOCK_90D)  trustBadge = 2;
        else if (_lockDuration == LOCK_180D) trustBadge = 3;
        else                                 trustBadge = 0;
    }

    function setPerps(address _perps) external {
        require(msg.sender == factory,    "FlapVault: not factory");
        require(perps == address(0),      "FlapVault: perps already set");
        require(_perps != address(0),     "FlapVault: zero perps");
        perps = _perps;
    }

    function setPlatformContract(address _platform) external {
        require(msg.sender == factory,            "FlapVault: not factory");
        require(platformContract == address(0),   "FlapVault: platform already set");
        require(_platform != address(0),          "FlapVault: zero platform");
        platformContract = _platform;
    }

    function initDeposit(uint256 vaultAmount, uint256 insuranceAmount) external notClosed {
        require(msg.sender == factory,           "FlapVault: not factory");
        require(vaultBalance == 0 && insuranceBalance == 0, "FlapVault: already initialised");
        require(vaultAmount  >= MIN_VAULT,       "FlapVault: vault below $100 minimum");
        require(insuranceAmount > 0,             "FlapVault: zero insurance");

        _safeTransferFrom(collateral, factory, address(this), vaultAmount + insuranceAmount);
        vaultBalance     = vaultAmount;
        insuranceBalance = insuranceAmount;

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

        if (block.timestamp >= vaultLockedUntil) {
            vaultLockedUntil = block.timestamp + lockDuration;
        }

        emit VaultDeposited(opener, amount, vaultLockedUntil);
        _checkAndUpdateHealth();
    }

    function depositInsurance(uint256 amount) external onlyOpener notClosed {
        require(amount > 0, "FlapVault: zero amount");

        uint256 mcap    = _getMcap();
        uint256 minIns  = FlapParams.calcMinInsurance(mcap);
        require(insuranceBalance + amount >= minIns, "FlapVault: below insurance minimum");

        _safeTransferFrom(collateral, opener, address(this), amount);
        insuranceBalance += amount;

        if (block.timestamp >= insuranceLockedUntil) {
            insuranceLockedUntil = block.timestamp + lockDuration;
        }

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
        require(
            IFlapPerpsForVault(perps).getOpenPositionCount() == 0,
            "FlapVault: open positions remain"
        );

        uint256 vaultOut    = vaultBalance;
        uint256 insuranceOut = insuranceBalance;
        vaultBalance     = 0;
        insuranceBalance = 0;
        marketClosed     = true;

        if (vaultOut > 0) {
            _safeTransfer(collateral, opener, vaultOut);
        }
        if (insuranceOut > 0) {
            _safeTransfer(collateral, opener, insuranceOut);
        }

        emit VaultWithdrawn(opener, vaultOut, insuranceOut);
    }

    function emergencyWithdraw(address to) external onlyPlatformAdmin {
        require(to != address(0), "FlapVault: zero recipient");
        uint256 total = vaultBalance + insuranceBalance;
        vaultBalance     = 0;
        insuranceBalance = 0;
        marketClosed     = true;
        if (total > 0) {
            _safeTransfer(collateral, to, total);
        }
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
            if (available > 0) {
                _safeTransfer(collateral, trader, available);
            }
            emit TraderRefunded(trader, available);
            return;
        }

        emit TraderRefunded(trader, amount);
        _checkAndUpdateHealth();
    }

    function addToInsurance(uint256 amount) external onlyPerps {
        if (amount > 0) insuranceBalance += amount;
    }

    function addToVault(uint256 amount) external onlyPerps {
        if (amount > 0) vaultBalance += amount;
    }

    function checkHealth() external notClosed {
        _checkAndUpdateHealth();
    }

    function _checkAndUpdateHealth() internal {
        uint256 mcap  = _getMcap();
        uint256 maxOI = FlapParams.calcMaxOI(mcap);
        uint8   health = FlapParams.vaultHealth(vaultBalance, maxOI);

        emit VaultHealthUpdated(health);

        if (health == 2) {
            if (frozenAt == 0) {
                frozenAt = block.timestamp;
                emit MarketFrozen(frozenAt);
            } else if (block.timestamp - frozenAt >= GRACE_PERIOD) {
                _triggerForceClose();
            }
        } else {
            frozenAt = 0;
        }
    }

    function _triggerForceClose() internal {
        IFlapPerpsForVault(perps).forceCloseAll();
        marketClosed = true;
        emit MarketForceClosedByHealth();
    }

    function getHealth() external view returns (uint8) {
        uint256 mcap  = _getMcap();
        uint256 maxOI = FlapParams.calcMaxOI(mcap);
        return FlapParams.vaultHealth(vaultBalance, maxOI);
    }

    function isWithdrawable() external view returns (bool) {
        return block.timestamp >= vaultLockedUntil;
    }

    function isFrozen() external view returns (bool) {
        uint256 mcap  = _getMcap();
        uint256 maxOI = FlapParams.calcMaxOI(mcap);
        return FlapParams.vaultHealth(vaultBalance, maxOI) == 2;
    }

    function isWithdrawalBlocked() external view returns (bool) {
        return withdrawalRequested || marketClosed;
    }

    function trustBadgeName() external view returns (string memory) {
        if (trustBadge == 3) return "Platinum";
        if (trustBadge == 2) return "Gold";
        if (trustBadge == 1) return "Silver";
        return "None";
    }

    function _getMcap() internal view returns (uint256) {
        (bool ok, bytes memory data) = oracle.staticcall(
            abi.encodeWithSignature("getMcap(address)", token)
        );
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
