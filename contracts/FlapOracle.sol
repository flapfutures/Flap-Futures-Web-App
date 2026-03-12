// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract FlapOracle {

    address public botOperator;
    address public pendingOperator;

    uint256 public constant STALENESS_PERIOD = 5 minutes;

    struct PriceFeed {
        uint256 price;      // USD price with 18 decimals (e.g. $0.001 = 1e15)
        uint256 mcap;       // USD market cap with 18 decimals (e.g. $50,000 = 50_000e18)
        uint256 liquidity;  // USD liquidity with 18 decimals
        uint256 updatedAt;  // block.timestamp of last update
    }

    mapping(address => PriceFeed) private feeds;

    event PriceUpdated(address indexed token, uint256 price, uint256 mcap, uint256 liquidity);
    event OperatorTransferInitiated(address indexed newOperator);
    event OperatorTransferAccepted(address indexed newOperator);

    modifier onlyBot() {
        require(msg.sender == botOperator, "FlapOracle: not bot operator");
        _;
    }

    constructor(address _botOperator) {
        require(_botOperator != address(0), "FlapOracle: zero address");
        botOperator = _botOperator;
    }

    function updatePrice(
        address token,
        uint256 price,
        uint256 mcap,
        uint256 liquidity
    ) external onlyBot {
        require(token != address(0), "FlapOracle: zero token");
        require(price > 0, "FlapOracle: zero price");
        feeds[token] = PriceFeed(price, mcap, liquidity, block.timestamp);
        emit PriceUpdated(token, price, mcap, liquidity);
    }

    function updatePriceBatch(
        address[] calldata tokens,
        uint256[] calldata prices,
        uint256[] calldata mcaps,
        uint256[] calldata liquidities
    ) external onlyBot {
        require(
            tokens.length == prices.length &&
            prices.length == mcaps.length &&
            mcaps.length == liquidities.length,
            "FlapOracle: length mismatch"
        );
        for (uint256 i = 0; i < tokens.length; i++) {
            require(prices[i] > 0, "FlapOracle: zero price");
            feeds[tokens[i]] = PriceFeed(prices[i], mcaps[i], liquidities[i], block.timestamp);
            emit PriceUpdated(tokens[i], prices[i], mcaps[i], liquidities[i]);
        }
    }

    function getPrice(address token) external view returns (uint256) {
        PriceFeed memory f = feeds[token];
        require(f.updatedAt > 0, "FlapOracle: no price feed");
        require(block.timestamp - f.updatedAt <= STALENESS_PERIOD, "FlapOracle: price stale");
        return f.price;
    }

    function getMcap(address token) external view returns (uint256) {
        return feeds[token].mcap;
    }

    function getFeed(address token) external view returns (
        uint256 price,
        uint256 mcap,
        uint256 liquidity,
        uint256 updatedAt,
        bool isStale
    ) {
        PriceFeed memory f = feeds[token];
        return (
            f.price,
            f.mcap,
            f.liquidity,
            f.updatedAt,
            block.timestamp - f.updatedAt > STALENESS_PERIOD
        );
    }

    function isFresh(address token) external view returns (bool) {
        return block.timestamp - feeds[token].updatedAt <= STALENESS_PERIOD;
    }

    function initiateOperatorTransfer(address newOperator) external onlyBot {
        require(newOperator != address(0), "FlapOracle: zero address");
        pendingOperator = newOperator;
        emit OperatorTransferInitiated(newOperator);
    }

    function acceptOperatorTransfer() external {
        require(msg.sender == pendingOperator, "FlapOracle: not pending operator");
        botOperator = pendingOperator;
        pendingOperator = address(0);
        emit OperatorTransferAccepted(botOperator);
    }
}
