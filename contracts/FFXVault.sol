// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title FFXVault — per-market vault holding USDT collateral and insurance fund.
/// Insurance minimum auto-adjusts to 20% of vault balance.
contract FFXVault {
    bool private _initialized;

    address public opener;          // market creator
    address public token;           // the meme token address
    address public collateral;      // USDT
    address public oracle;          // FFXOracle (shared)
    address public factory;         // FFXFactory
    address public platformAdmin;   // platform admin wallet
    address public perps;           // FFXPerps contract for this market
    address public platformContract;// FFXPlatform contract
    address public botWallet;       // dedicated bot wallet for this market

    uint256 public lockDuration;
    uint256 public vaultLockedUntil;
    uint256 public insuranceLockedUntil;
    uint256 public vaultBalance;
    uint256 public insuranceBalance;
    uint256 public frozenAt;
    uint256 public minVault;        // creator-set minimum vault (e.g. 50 USDT = 50e18)
    bool    public withdrawalRequested;
    bool    public marketClosed;
    uint8   public trustBadge;      // 0=None,1=Silver,2=Gold,3=Platinum

    uint256 public constant LOCK_7D        = 7   days;
    uint256 public constant LOCK_30D       = 30  days;
    uint256 public constant LOCK_90D       = 90  days;
    uint256 public constant LOCK_180D      = 180 days;
    uint256 public constant GRACE_PERIOD   = 3 days;
    uint256 public constant MIN_INS_BPS    = 2000;   // insurance must be >= 20% of vault
    uint256 public constant LIQ_BPS        = 8000;   // 80% loss triggers liquidation
    uint256 public constant BPS            = 10_000;

    event VaultDeposited(address indexed opener, uint256 amount, uint256 unlocksAt);
    event InsuranceDeposited(address indexed opener, uint256 amount);
    event VaultWithdrawalRequested(address indexed opener);
    event VaultWithdrawn(address indexed opener, uint256 vault, uint256 insurance);
    event TraderRefunded(address indexed trader, uint256 amount);
    event MarketFrozen(uint256 at);
    event MarketForceClosed();
    event EmergencyWithdraw(address indexed to, uint256 total);

    modifier onlyOpener()        { require(msg.sender == opener,  "V:op"); _; }
    modifier onlyPerps()         { require(msg.sender == perps,   "V:pr"); _; }
    modifier notClosed()         { require(!marketClosed,         "V:cl"); _; }
    modifier onlyPlatform() {
        require(
            msg.sender == platformAdmin ||
            (platformContract != address(0) && msg.sender == platformContract),
            "V:pa"
        );
        _;
    }

    function initialize(
        address _opener,
        address _token,
        address _collateral,
        address _oracle,
        address _factory,
        uint256 _lock,
        address _platformAdmin,
        uint256 _minVault,
        address _botWallet
    ) external {
        require(!_initialized, "V:ai");
        require(_opener != address(0) && _token != address(0) && _collateral != address(0), "V:0a");
        require(_oracle != address(0) && _factory != address(0) && _platformAdmin != address(0), "V:0b");
        require(
            _lock == LOCK_7D || _lock == LOCK_30D ||
            _lock == LOCK_90D || _lock == LOCK_180D,
            "V:lk"
        );
        _initialized    = true;
        opener          = _opener;
        token           = _token;
        collateral      = _collateral;
        oracle          = _oracle;
        factory         = _factory;
        platformAdmin   = _platformAdmin;
        lockDuration    = _lock;
        minVault        = _minVault;
        botWallet       = _botWallet;

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

    // ─── Deposits ───────────────────────────────────────────────────────────────

    /// @notice Creator deposits into vault. Insurance minimum = 20% of vaultBalance after deposit.
    function depositVault(uint256 amount) external onlyOpener notClosed {
        require(amount > 0, "V:amt");
        require(vaultBalance + amount >= minVault, "V:minv");
        _stf(msg.sender, address(this), amount);
        vaultBalance += amount;
        vaultLockedUntil = block.timestamp + lockDuration;
        emit VaultDeposited(msg.sender, amount, vaultLockedUntil);
        _checkHealth();
    }

    /// @notice Creator deposits into insurance. Must maintain >= 20% of vault.
    function depositInsurance(uint256 amount) external onlyOpener notClosed {
        require(amount > 0, "V:amt");
        _stf(msg.sender, address(this), amount);
        insuranceBalance += amount;
        emit InsuranceDeposited(msg.sender, amount);
        _checkHealth();
    }

    /// @notice Minimum required insurance based on current vault balance.
    function minInsuranceRequired() public view returns (uint256) {
        return (vaultBalance * MIN_INS_BPS) / BPS;
    }

    /// @notice Whether the vault has sufficient insurance coverage.
    function hasMinInsurance() public view returns (bool) {
        return insuranceBalance >= minInsuranceRequired();
    }

    // ─── Withdrawal ─────────────────────────────────────────────────────────────

    function requestWithdrawal() external onlyOpener notClosed {
        require(block.timestamp >= vaultLockedUntil, "V:lk");
        require(!withdrawalRequested, "V:wr");
        withdrawalRequested = true;
        emit VaultWithdrawalRequested(msg.sender);
    }

    function completeWithdrawal() external onlyOpener {
        require(withdrawalRequested, "V:nwr");
        require(block.timestamp >= vaultLockedUntil, "V:lk");
        uint256 v = vaultBalance;
        uint256 i = insuranceBalance;
        vaultBalance     = 0;
        insuranceBalance = 0;
        withdrawalRequested = false;
        marketClosed = true;
        if (v + i > 0) _st(msg.sender, v + i);
        emit VaultWithdrawn(msg.sender, v, i);
    }

    // ─── Perps-facing ────────────────────────────────────────────────────────────

    function payTrader(address trader, uint256 amount) external onlyPerps notClosed {
        if (vaultBalance >= amount) {
            vaultBalance -= amount;
            _st(trader, amount);
        } else if (vaultBalance + insuranceBalance >= amount) {
            uint256 fromVault = vaultBalance;
            vaultBalance      = 0;
            insuranceBalance -= (amount - fromVault);
            _st(trader, amount);
        } else {
            uint256 available = vaultBalance + insuranceBalance;
            vaultBalance     = 0;
            insuranceBalance = 0;
            if (available > 0) _st(trader, available);
            emit TraderRefunded(trader, available);
            return;
        }
        emit TraderRefunded(trader, amount);
        _checkHealth();
    }

    function addToInsurance(uint256 amount) external onlyPerps { if (amount > 0) insuranceBalance += amount; }
    function addToVault(uint256 amount)     external onlyPerps { if (amount > 0) vaultBalance     += amount; }
    function checkHealth()                  external notClosed  { _checkHealth(); }

    // ─── View ────────────────────────────────────────────────────────────────────

    function isFrozen() external view returns (bool) {
        return !hasMinInsurance() && vaultBalance > 0;
    }

    function isWithdrawable()      external view returns (bool) { return block.timestamp >= vaultLockedUntil; }
    function isWithdrawalBlocked() external view returns (bool) { return withdrawalRequested || marketClosed; }

    function trustBadgeName() external view returns (string memory) {
        if (trustBadge == 3) return "Platinum";
        if (trustBadge == 2) return "Gold";
        if (trustBadge == 1) return "Silver";
        return "None";
    }

    // ─── Platform admin ──────────────────────────────────────────────────────────

    function emergencyWithdraw(address to) external onlyPlatform {
        require(to != address(0), "V:0t");
        uint256 total = vaultBalance + insuranceBalance;
        vaultBalance     = 0;
        insuranceBalance = 0;
        if (total > 0) _st(to, total);
        emit EmergencyWithdraw(to, total);
    }

    // ─── Internal ────────────────────────────────────────────────────────────────

    function _checkHealth() internal {
        if (!hasMinInsurance() && vaultBalance > 0) {
            if (frozenAt == 0) {
                frozenAt = block.timestamp;
                emit MarketFrozen(frozenAt);
            } else if (block.timestamp - frozenAt >= GRACE_PERIOD) {
                marketClosed = true;
                emit MarketForceClosed();
            }
        } else {
            frozenAt = 0;
        }
    }

    function _st(address to, uint256 a)                internal {
        (bool ok,) = collateral.call(abi.encodeWithSignature("transfer(address,uint256)", to, a));
        require(ok, "V:tf");
    }
    function _stf(address from, address to, uint256 a) internal {
        (bool ok,) = collateral.call(abi.encodeWithSignature("transferFrom(address,address,uint256)", from, to, a));
        require(ok, "V:tff");
    }
}
