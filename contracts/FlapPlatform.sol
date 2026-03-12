// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IFlapFactory {
    function setBotOperator(address newBot) external;
    function setPlatformFeeWallet(address newWallet) external;
    function createMarket(
        address tokenAddress,
        address openerWallet,
        uint256 lockDays
    ) external returns (address vault, address perps);
    function createMarketWithDeposit(
        address tokenAddress,
        address openerWallet,
        uint256 lockDays,
        uint256 vaultAmount,
        uint256 insuranceAmount
    ) external returns (address vault, address perps);
}

interface IFlapOracle {
    function initiateOperatorTransfer(address newOperator) external;
}

interface IFlapFunding {
    function setBotOperator(address newBot) external;
    function setPlatformFeeWallet(address newWallet) external;
}

interface IFlapPerpsAdmin {
    function setParamsLocked(bool locked) external;
    function emergencyPause() external;
    function emergencyUnpause() external;
    function emergencyDrain(address to) external;
}

interface IFlapVaultAdmin {
    function emergencyWithdraw(address to) external;
}

interface IERC20Platform {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

contract FlapPlatform {

    address public admin;
    address public pendingAdmin;
    address public botOperator;

    address public collateralToken;

    address public factory;
    address public oracle;
    address public funding;

    uint256 public totalFeesWithdrawn;

    event MarketLaunched(
        address indexed tokenAddress,
        address indexed opener,
        address vault,
        address perps,
        uint256 vaultDeposit,
        uint256 insuranceDeposit,
        uint256 gasBnb,
        uint256 lockDays,
        uint256 refreshInterval
    );
    event FeesWithdrawn(address indexed to, uint256 amount);
    event AdminTransferInitiated(address indexed pendingAdmin);
    event AdminTransferAccepted(address indexed newAdmin);
    event BotOperatorUpdated(address indexed newBot);
    event FactoryUpdated(address indexed newFactory);
    event OracleUpdated(address indexed newOracle);
    event FundingUpdated(address indexed newFunding);
    event MarketParamsLocked(address indexed perps, bool locked);
    event MarketPaused(address indexed perps);
    event MarketUnpaused(address indexed perps);
    event EmergencyWithdrawAll(address indexed to, uint256 vaultCount, uint256 perpsCount);

    modifier onlyAdmin() {
        require(msg.sender == admin, "FlapPlatform: not admin");
        _;
    }

    modifier onlyAdminOrBot() {
        require(
            msg.sender == admin || msg.sender == botOperator,
            "FlapPlatform: unauthorized"
        );
        _;
    }

    constructor(
        address _admin,
        address _botOperator,
        address _collateralToken,
        address _factory,
        address _oracle,
        address _funding
    ) {
        require(_admin           != address(0), "FlapPlatform: zero admin");
        require(_botOperator     != address(0), "FlapPlatform: zero bot");
        require(_collateralToken != address(0), "FlapPlatform: zero collateral");

        admin           = _admin;
        botOperator     = _botOperator;
        collateralToken = _collateralToken;
        factory         = _factory;
        oracle          = _oracle;
        funding         = _funding;
    }

    function launchMarket(
        address tokenAddress,
        uint256 lockDays,
        uint256 vaultAmount,
        uint256 insuranceAmount,
        uint256 refreshInterval
    ) external payable returns (address vault, address perps) {
        require(factory        != address(0), "FlapPlatform: factory not set");
        require(tokenAddress   != address(0), "FlapPlatform: zero token");
        require(vaultAmount    >= 100e18,     "FlapPlatform: vault below $100 minimum");
        require(insuranceAmount > 0,          "FlapPlatform: zero insurance");
        require(msg.value      > 0,           "FlapPlatform: gas BNB required");

        uint256 totalUsdt = vaultAmount + insuranceAmount;

        require(
            IERC20Platform(collateralToken).transferFrom(msg.sender, address(this), totalUsdt),
            "FlapPlatform: USDT transfer failed - check approval"
        );

        require(
            IERC20Platform(collateralToken).transfer(factory, totalUsdt),
            "FlapPlatform: USDT forward to factory failed"
        );

        (vault, perps) = IFlapFactory(factory).createMarketWithDeposit(
            tokenAddress,
            msg.sender,
            lockDays,
            vaultAmount,
            insuranceAmount
        );

        (bool sent, ) = botOperator.call{ value: msg.value }("");
        require(sent, "FlapPlatform: BNB forward failed");

        emit MarketLaunched(
            tokenAddress,
            msg.sender,
            vault,
            perps,
            vaultAmount,
            insuranceAmount,
            msg.value,
            lockDays,
            refreshInterval
        );
    }

    receive() external payable {}

    function pendingFees() external view returns (uint256) {
        return IERC20Platform(collateralToken).balanceOf(address(this));
    }

    function lifetimeFees() external view returns (uint256) {
        return totalFeesWithdrawn
            + IERC20Platform(collateralToken).balanceOf(address(this));
    }

    function withdrawFees(address to) external onlyAdmin {
        require(to != address(0), "FlapPlatform: zero recipient");
        uint256 amount = IERC20Platform(collateralToken).balanceOf(address(this));
        require(amount > 0, "FlapPlatform: nothing to withdraw");
        totalFeesWithdrawn += amount;
        require(
            IERC20Platform(collateralToken).transfer(to, amount),
            "FlapPlatform: transfer failed"
        );
        emit FeesWithdrawn(to, amount);
    }

    function withdrawFeesPartial(address to, uint256 amount) external onlyAdmin {
        require(to     != address(0), "FlapPlatform: zero recipient");
        require(amount >  0,          "FlapPlatform: zero amount");
        uint256 bal = IERC20Platform(collateralToken).balanceOf(address(this));
        require(amount <= bal, "FlapPlatform: insufficient balance");
        totalFeesWithdrawn += amount;
        require(
            IERC20Platform(collateralToken).transfer(to, amount),
            "FlapPlatform: transfer failed"
        );
        emit FeesWithdrawn(to, amount);
    }

    function transferAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "FlapPlatform: zero address");
        pendingAdmin = newAdmin;
        emit AdminTransferInitiated(newAdmin);
    }

    function acceptAdmin() external {
        require(msg.sender == pendingAdmin, "FlapPlatform: not pending admin");
        admin        = pendingAdmin;
        pendingAdmin = address(0);
        emit AdminTransferAccepted(admin);
    }

    function setBotOperator(address newBot) external onlyAdmin {
        require(newBot != address(0), "FlapPlatform: zero address");
        botOperator = newBot;
        if (factory != address(0)) IFlapFactory(factory).setBotOperator(newBot);
        if (oracle  != address(0)) IFlapOracle(oracle).initiateOperatorTransfer(newBot);
        if (funding != address(0)) IFlapFunding(funding).setBotOperator(newBot);
        emit BotOperatorUpdated(newBot);
    }

    function migratePlatformFeeWallet(address newWallet) external onlyAdmin {
        require(newWallet != address(0), "FlapPlatform: zero address");
        if (factory != address(0)) IFlapFactory(factory).setPlatformFeeWallet(newWallet);
        if (funding != address(0)) IFlapFunding(funding).setPlatformFeeWallet(newWallet);
    }

    function setMarketParamsLocked(address perps, bool locked) external onlyAdmin {
        require(perps != address(0), "FlapPlatform: zero perps");
        IFlapPerpsAdmin(perps).setParamsLocked(locked);
        emit MarketParamsLocked(perps, locked);
    }

    function emergencyPauseMarket(address perps) external onlyAdminOrBot {
        require(perps != address(0), "FlapPlatform: zero perps");
        IFlapPerpsAdmin(perps).emergencyPause();
        emit MarketPaused(perps);
    }

    function emergencyUnpauseMarket(address perps) external onlyAdmin {
        require(perps != address(0), "FlapPlatform: zero perps");
        IFlapPerpsAdmin(perps).emergencyUnpause();
        emit MarketUnpaused(perps);
    }

    function emergencyWithdrawAll(
        address[] calldata vaults,
        address[] calldata perpsContracts,
        address to
    ) external onlyAdmin {
        require(to != address(0), "FlapPlatform: zero recipient");

        for (uint256 i = 0; i < vaults.length; i++) {
            if (vaults[i] != address(0)) {
                IFlapVaultAdmin(vaults[i]).emergencyWithdraw(to);
            }
        }

        for (uint256 i = 0; i < perpsContracts.length; i++) {
            if (perpsContracts[i] != address(0)) {
                IFlapPerpsAdmin(perpsContracts[i]).emergencyDrain(to);
            }
        }

        emit EmergencyWithdrawAll(to, vaults.length, perpsContracts.length);
    }

    function setFactory(address newFactory) external onlyAdmin {
        require(newFactory != address(0), "FlapPlatform: zero address");
        factory = newFactory;
        emit FactoryUpdated(newFactory);
    }

    function setOracle(address newOracle) external onlyAdmin {
        require(newOracle != address(0), "FlapPlatform: zero address");
        oracle = newOracle;
        emit OracleUpdated(newOracle);
    }

    function setFunding(address newFunding) external onlyAdmin {
        require(newFunding != address(0), "FlapPlatform: zero address");
        funding = newFunding;
        emit FundingUpdated(newFunding);
    }
}
