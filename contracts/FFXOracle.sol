// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title FFXOracle — shared price oracle for all FFX markets
/// Platform bot operator can update any token.
/// Each market's dedicated bot wallet can only update its own token.
/// Factory is authorised to register per-market bot wallets (setTokenBot).
contract FFXOracle {

    address public platformBot;
    address public pendingPlatformBot;
    address public factory;   // FFXFactory — allowed to call setTokenBot

    /// 15 minutes gives market bots a 5-minute grace window above the max
    /// 10-minute refresh interval, so a slightly-late push never stales out trades.
    uint256 public constant STALENESS_PERIOD = 15 minutes;

    struct PriceFeed {
        uint256 price;      // 18-decimal USD price
        uint256 mcap;       // USD market cap (no decimals — raw dollars)
        uint256 liquidity;  // USD liquidity  (no decimals — raw dollars)
        uint256 updatedAt;
    }

    mapping(address => PriceFeed) private feeds;
    mapping(address => address)   public  tokenBot; // token => dedicated market bot

    event PriceUpdated(address indexed token, uint256 price, uint256 mcap, uint256 liquidity);
    event TokenBotSet(address indexed token, address indexed bot);
    event FactorySet(address indexed factory);
    event PlatformBotTransferInitiated(address indexed pending);
    event PlatformBotTransferAccepted(address indexed newBot);

    modifier onlyAuthorized(address token) {
        require(
            msg.sender == platformBot || msg.sender == tokenBot[token],
            "FFXOracle: not authorized"
        );
        _;
    }

    modifier onlyPlatformBot() {
        require(msg.sender == platformBot, "FFXOracle: not platform bot");
        _;
    }

    /// Platform bot OR factory may register token bots.
    modifier onlyBotOrFactory() {
        require(
            msg.sender == platformBot ||
            (factory != address(0) && msg.sender == factory),
            "FFXOracle: unauthorized"
        );
        _;
    }

    constructor(address _platformBot) {
        require(_platformBot != address(0), "FFXOracle: zero address");
        platformBot = _platformBot;
    }

    /// @notice Point oracle at the deployed FFXFactory.
    ///         Must be called by platform bot after Factory is deployed.
    function setFactory(address _factory) external onlyPlatformBot {
        require(_factory != address(0), "FFXOracle: zero factory");
        factory = _factory;
        emit FactorySet(_factory);
    }

    /// @notice Register a dedicated bot wallet for a specific token market.
    ///         Called by FFXFactory.createMarket() or by the platform bot directly.
    function setTokenBot(address token, address bot) external onlyBotOrFactory {
        require(token != address(0) && bot != address(0), "FFXOracle: zero addr");
        tokenBot[token] = bot;
        emit TokenBotSet(token, bot);
    }

    /// @notice Update price for a single token. Callable by platform bot or token's market bot.
    function updatePrice(
        address token,
        uint256 price,
        uint256 mcap,
        uint256 liquidity
    ) external onlyAuthorized(token) {
        require(token != address(0), "FFXOracle: zero token");
        require(price > 0, "FFXOracle: zero price");
        feeds[token] = PriceFeed(price, mcap, liquidity, block.timestamp);
        emit PriceUpdated(token, price, mcap, liquidity);
    }

    /// @notice Batch update prices. Platform bot only (manages many markets).
    function updatePriceBatch(
        address[] calldata tokens,
        uint256[] calldata prices,
        uint256[] calldata mcaps,
        uint256[] calldata liquidities
    ) external onlyPlatformBot {
        require(
            tokens.length == prices.length &&
            prices.length == mcaps.length &&
            mcaps.length  == liquidities.length,
            "FFXOracle: length mismatch"
        );
        for (uint256 i = 0; i < tokens.length; i++) {
            require(prices[i] > 0, "FFXOracle: zero price");
            feeds[tokens[i]] = PriceFeed(prices[i], mcaps[i], liquidities[i], block.timestamp);
            emit PriceUpdated(tokens[i], prices[i], mcaps[i], liquidities[i]);
        }
    }

    function getPrice(address token) external view returns (uint256) {
        PriceFeed memory f = feeds[token];
        require(f.updatedAt > 0, "FFXOracle: no price feed");
        require(block.timestamp - f.updatedAt <= STALENESS_PERIOD, "FFXOracle: price stale");
        return f.price;
    }

    function getMcap(address token) external view returns (uint256) {
        return feeds[token].mcap;
    }

    function getFeed(address token) external view returns (
        uint256 price, uint256 mcap, uint256 liquidity, uint256 updatedAt, bool isStale
    ) {
        PriceFeed memory f = feeds[token];
        return (f.price, f.mcap, f.liquidity, f.updatedAt, block.timestamp - f.updatedAt > STALENESS_PERIOD);
    }

    function isFresh(address token) external view returns (bool) {
        return block.timestamp - feeds[token].updatedAt <= STALENESS_PERIOD;
    }

    function initiatePlatformBotTransfer(address newBot) external onlyPlatformBot {
        require(newBot != address(0), "FFXOracle: zero address");
        pendingPlatformBot = newBot;
        emit PlatformBotTransferInitiated(newBot);
    }

    function acceptPlatformBotTransfer() external {
        require(msg.sender == pendingPlatformBot, "FFXOracle: not pending");
        platformBot = pendingPlatformBot;
        pendingPlatformBot = address(0);
        emit PlatformBotTransferAccepted(platformBot);
    }
}
