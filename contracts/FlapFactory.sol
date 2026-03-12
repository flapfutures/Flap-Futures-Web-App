// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "https://raw.githubusercontent.com/flapfutures/Flap-Futures-Web-App/main/contracts/FlapVault.sol";
import "https://raw.githubusercontent.com/flapfutures/Flap-Futures-Web-App/main/contracts/FlapPerps.sol";

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
    address public platform;         // FlapPlatform - may call createMarketWithDeposit()
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

    mapping(address => MarketAddresses) public markets;   // token => addresses
    address[] public allTokens;

    event MarketCreated(
        address indexed token,
        address indexed opener,
        address vault,
        address perps,
        uint256 lockDuration
    );
    event BotOperatorUpdated(address indexed newOperator);
    event PlatformFeeWalletUpdated(address indexed newWallet);
    event PlatformUpdated(address indexed newPlatform);

    modifier onlyBot() {
        require(msg.sender == botOperator, "FlapFactory: not bot operator");
        _;
    }

    modifier onlyBotOrPlatform() {
        require(
            msg.sender == botOperator || msg.sender == platform,
            "FlapFactory: not bot or platform"
        );
        _;
    }

    constructor(
        address _botOperator,
        address _platform,
        address _platformFeeWallet,
        address _collateralToken,
        address _oracleAddress,
        address _fundingAddress
    ) {
        require(_botOperator       != address(0), "FlapFactory: zero bot");
        require(_platformFeeWallet != address(0), "FlapFactory: zero fee wallet");
        require(_collateralToken   != address(0), "FlapFactory: zero collateral");
        require(_oracleAddress     != address(0), "FlapFactory: zero oracle");
        require(_fundingAddress    != address(0), "FlapFactory: zero funding");

        botOperator       = _botOperator;
        platform          = _platform;        // may be address(0) at deploy time
        platformFeeWallet = _platformFeeWallet;
        collateralToken   = _collateralToken;
        oracleAddress     = _oracleAddress;
        fundingAddress    = _fundingAddress;
    }

    function createMarket(
        address tokenAddress,
        address openerWallet,
        uint256 lockDays
    ) external onlyBotOrPlatform returns (address vault, address perps) {
        require(tokenAddress  != address(0), "FlapFactory: zero token");
        require(openerWallet  != address(0), "FlapFactory: zero opener");
        require(!markets[tokenAddress].exists, "FlapFactory: market already exists");

        uint256 lockDuration = _lockDaysToSeconds(lockDays);

        // Step 1: Deploy FlapPerps first (vault needs perps address in constructor)

        // Simplest approach: deploy vault then perps, vault accepts perps via setPerps().

        FlapVault  newVault = new FlapVault(
            openerWallet,
            tokenAddress,
            collateralToken,
            oracleAddress,
            address(this),     // factory - grants setPerps() permission
            lockDuration,
            platformFeeWallet  // platformAdmin - can emergency-withdraw
        );

        FlapPerps newPerps = new FlapPerps(
            tokenAddress,
            collateralToken,
            address(newVault),
            oracleAddress,
            fundingAddress,
            openerWallet,
            platformFeeWallet,
            botOperator,
            address(this)      // factory - allows wiring platformContract
        );

        newVault.setPerps(address(newPerps));

        // Wire FlapPlatform as master admin on both contracts (if platform is set)
        if (platform != address(0)) {
            IFlapVaultPlatform(address(newVault)).setPlatformContract(platform);
            IFlapPerpsPlatform(address(newPerps)).setPlatformContract(platform);
        }

        IFlapFundingRegistry(fundingAddress).registerMarket(address(newPerps));

        markets[tokenAddress] = MarketAddresses({
            vault:     address(newVault),
            perps:     address(newPerps),
            opener:    openerWallet,
            createdAt: block.timestamp,
            exists:    true
        });
        allTokens.push(tokenAddress);

        vault = address(newVault);
        perps = address(newPerps);

        emit MarketCreated(tokenAddress, openerWallet, vault, perps, lockDuration);
    }

    function createMarketWithDeposit(
        address tokenAddress,
        address openerWallet,
        uint256 lockDays,
        uint256 vaultAmount,
        uint256 insuranceAmount
    ) external returns (address vault, address perps) {
        require(msg.sender == platform, "FlapFactory: not platform");
        require(vaultAmount    >  0,    "FlapFactory: zero vault");
        require(insuranceAmount > 0,    "FlapFactory: zero insurance");

        // Deploy market (same as createMarket, no separate onlyBot check needed
        // because this function's require(msg.sender == platform) guards it)
        require(tokenAddress  != address(0), "FlapFactory: zero token");
        require(openerWallet  != address(0), "FlapFactory: zero opener");
        require(!markets[tokenAddress].exists, "FlapFactory: market already exists");

        uint256 lockDuration = _lockDaysToSeconds(lockDays);

        FlapVault newVault = new FlapVault(
            openerWallet,
            tokenAddress,
            collateralToken,
            oracleAddress,
            address(this),
            lockDuration,
            platformFeeWallet  // platformAdmin - can emergency-withdraw
        );

        FlapPerps newPerps = new FlapPerps(
            tokenAddress,
            collateralToken,
            address(newVault),
            oracleAddress,
            fundingAddress,
            openerWallet,
            platformFeeWallet,
            botOperator,
            address(this)      // factory - allows wiring platformContract
        );

        newVault.setPerps(address(newPerps));

        // Wire FlapPlatform as master admin on both contracts (platform == msg.sender here)
        IFlapVaultPlatform(address(newVault)).setPlatformContract(msg.sender);
        IFlapPerpsPlatform(address(newPerps)).setPlatformContract(msg.sender);

        IFlapFundingRegistry(fundingAddress).registerMarket(address(newPerps));

        markets[tokenAddress] = MarketAddresses({
            vault:     address(newVault),
            perps:     address(newPerps),
            opener:    openerWallet,
            createdAt: block.timestamp,
            exists:    true
        });
        allTokens.push(tokenAddress);

        vault = address(newVault);
        perps = address(newPerps);

        require(
            IERC20Factory(collateralToken).approve(vault, vaultAmount + insuranceAmount),
            "FlapFactory: USDT approve failed"
        );
        IFlapVaultInit(vault).initDeposit(vaultAmount, insuranceAmount);

        emit MarketCreated(tokenAddress, openerWallet, vault, perps, lockDuration);
    }

    function getMarket(address token) external view returns (MarketAddresses memory) {
        return markets[token];
    }

    function marketExists(address token) external view returns (bool) {
        return markets[token].exists;
    }

    function totalMarkets() external view returns (uint256) {
        return allTokens.length;
    }

    function getMarkets(uint256 offset, uint256 limit)
        external view
        returns (address[] memory tokens, MarketAddresses[] memory addrs)
    {
        uint256 end = offset + limit;
        if (end > allTokens.length) end = allTokens.length;
        uint256 count = end - offset;

        tokens = new address[](count);
        addrs  = new MarketAddresses[](count);

        for (uint256 i = 0; i < count; i++) {
            tokens[i] = allTokens[offset + i];
            addrs[i]  = markets[tokens[i]];
        }
    }

    function setBotOperator(address newBot) external onlyBotOrPlatform {
        require(newBot != address(0), "FlapFactory: zero address");
        botOperator = newBot;
        emit BotOperatorUpdated(newBot);
    }

    function setPlatformFeeWallet(address newWallet) external onlyBotOrPlatform {
        require(newWallet != address(0), "FlapFactory: zero address");
        platformFeeWallet = newWallet;
        emit PlatformFeeWalletUpdated(newWallet);
    }

    function setPlatform(address newPlatform) external onlyBot {
        require(newPlatform != address(0), "FlapFactory: zero platform");
        platform = newPlatform;
        emit PlatformUpdated(newPlatform);
    }

    function _lockDaysToSeconds(uint256 days_) internal pure returns (uint256) {
        if (days_ == 7)   return 7  days;
        if (days_ == 30)  return 30 days;
        if (days_ == 90)  return 90 days;
        if (days_ == 180) return 180 days;
        revert("FlapFactory: invalid lock days (use 7, 30, 90, or 180)");
    }
}
