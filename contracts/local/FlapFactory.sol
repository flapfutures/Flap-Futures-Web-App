// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IFundingReg  { function registerMarket(address perps) external; }
interface IERC20F      { function approve(address s, uint256 a) external returns (bool); }
interface IVaultInit   {
    function initialize(address opener, address token, address collateral, address oracle, address factory, uint256 lock, address pa) external;
    function initDeposit(uint256 va, uint256 ia) external;
    function setPerps(address p) external;
    function setPlatformContract(address p) external;
}
interface IPerpsInit   {
    function initialize(address token, address collateral, address vault, address oracle, address funding, address opener, address pfw, address bot, address factory) external;
    function setPlatformContract(address p) external;
}

contract FlapFactory {
    address public immutable vaultImpl;
    address public immutable perpsImpl;

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

    event MarketCreated(address indexed token, address indexed opener, address vault, address perps, uint256 lock);
    event BotOperatorUpdated(address indexed n);
    event PlatformFeeWalletUpdated(address indexed n);
    event PlatformUpdated(address indexed n);

    modifier onlyBot()           { require(msg.sender == botOperator, "F:bt"); _; }
    modifier onlyBotOrPlatform() { require(msg.sender == botOperator || msg.sender == platform, "F:bp"); _; }

    constructor(
        address _vaultImpl, address _perpsImpl,
        address _bot, address _plat, address _pfw,
        address _col, address _oracle, address _fund
    ) {
        require(_vaultImpl != address(0) && _perpsImpl != address(0), "F:0i");
        require(_bot != address(0) && _pfw != address(0) && _col != address(0), "F:0a");
        require(_oracle != address(0) && _fund != address(0), "F:0b");
        vaultImpl       = _vaultImpl;
        perpsImpl       = _perpsImpl;
        botOperator     = _bot;
        platform        = _plat;
        platformFeeWallet = _pfw;
        collateralToken = _col;
        oracleAddress   = _oracle;
        fundingAddress  = _fund;
    }

    function createMarket(
        address token, address opener, uint256 lockDays
    ) external onlyBotOrPlatform returns (address vault, address perps) {
        require(token != address(0) && opener != address(0) && !markets[token].exists, "F:cm");
        (vault, perps) = _deploy(token, opener, lockDays);
        emit MarketCreated(token, opener, vault, perps, _lock(lockDays));
    }

    function createMarketWithDeposit(
        address token, address opener, uint256 lockDays, uint256 va, uint256 ia
    ) external returns (address vault, address perps) {
        require(msg.sender == platform, "F:np");
        require(token != address(0) && opener != address(0) && !markets[token].exists, "F:md");
        require(va > 0 && ia > 0, "F:mn");
        (vault, perps) = _deploy(token, opener, lockDays);
        IVaultInit(vault).setPlatformContract(msg.sender);
        IPerpsInit(perps).setPlatformContract(msg.sender);
        require(IERC20F(collateralToken).approve(vault, va + ia), "F:ap");
        IVaultInit(vault).initDeposit(va, ia);
        emit MarketCreated(token, opener, vault, perps, _lock(lockDays));
    }

    function _deploy(
        address token, address opener, uint256 lockDays
    ) internal returns (address vault, address perps) {
        uint256 ld = _lock(lockDays);
        vault = _clone(vaultImpl);
        perps = _clone(perpsImpl);
        IVaultInit(vault).initialize(opener, token, collateralToken, oracleAddress, address(this), ld, platformFeeWallet);
        IPerpsInit(perps).initialize(token, collateralToken, vault, oracleAddress, fundingAddress, opener, platformFeeWallet, botOperator, address(this));
        IVaultInit(vault).setPerps(perps);
        if (platform != address(0)) {
            IVaultInit(vault).setPlatformContract(platform);
            IPerpsInit(perps).setPlatformContract(platform);
        }
        IFundingReg(fundingAddress).registerMarket(perps);
        markets[token] = MarketAddresses({ vault: vault, perps: perps, opener: opener, createdAt: block.timestamp, exists: true });
        allTokens.push(token);
    }

    function _clone(address impl) internal returns (address instance) {
        assembly {
            let ptr := mload(0x40)
            mstore(ptr, 0x3d602d80600a3d3981f3363d3d373d3d3d363d73000000000000000000000000)
            mstore(add(ptr, 0x14), shl(0x60, impl))
            mstore(add(ptr, 0x28), 0x5af43d82803e903d91602b57fd5bf30000000000000000000000000000000000)
            instance := create(0, ptr, 0x37)
        }
        require(instance != address(0), "F:cl");
    }

    function getMarket(address t)    external view returns (MarketAddresses memory) { return markets[t]; }
    function marketExists(address t) external view returns (bool)                   { return markets[t].exists; }
    function totalMarkets()          external view returns (uint256)                { return allTokens.length; }
    function getMarkets(uint256 off, uint256 lim) external view returns (address[] memory ts, MarketAddresses[] memory ms) {
        uint256 end = off + lim; if (end > allTokens.length) end = allTokens.length;
        uint256 n = end - off; ts = new address[](n); ms = new MarketAddresses[](n);
        for (uint256 i = 0; i < n; i++) { ts[i] = allTokens[off + i]; ms[i] = markets[ts[i]]; }
    }

    function setBotOperator(address n)       external onlyBotOrPlatform { require(n != address(0), "F:0"); botOperator       = n; emit BotOperatorUpdated(n); }
    function setPlatformFeeWallet(address n) external onlyBotOrPlatform { require(n != address(0), "F:0"); platformFeeWallet = n; emit PlatformFeeWalletUpdated(n); }
    function setPlatform(address n)          external onlyBot           { require(n != address(0), "F:0"); platform          = n; emit PlatformUpdated(n); }

    function _lock(uint256 d) internal pure returns (uint256) {
        if (d == 7)   return 7   days;
        if (d == 30)  return 30  days;
        if (d == 90)  return 90  days;
        if (d == 180) return 180 days;
        revert("F:ld");
    }
}
