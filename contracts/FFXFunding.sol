// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title FFXFunding — shared 8-hour funding rate settlement for all FFX markets
contract FFXFunding {

    address public platformBot;
    address public platformFeeWallet;
    address public platformContract;
    address public factory;   // FFXFactory — allowed to register markets

    uint256 public constant FUNDING_INTERVAL = 8 hours;
    uint256 public constant BASE_RATE_BPS    = 1;
    uint256 public constant PLATFORM_CUT_BPS = 1000;  // 10% of funding to platform
    uint256 public constant BPS              = 10_000;

    struct MarketFunding {
        uint256 lastSettled;
        bool    registered;
    }

    mapping(address => MarketFunding) public markets; // perps address => funding state

    event FundingSettled(
        address indexed perps,
        uint256 longRatio,
        int256  longFPU,
        int256  shortFPU
    );
    event MarketRegistered(address indexed perps);
    event FactorySet(address indexed factory);

    modifier onlyBot() {
        require(
            msg.sender == platformBot ||
            (platformContract != address(0) && msg.sender == platformContract),
            "FFXFunding: not authorized"
        );
        _;
    }

    /// Platform bot OR factory may register markets.
    modifier onlyBotOrFactory() {
        require(
            msg.sender == platformBot ||
            (factory != address(0) && msg.sender == factory) ||
            (platformContract != address(0) && msg.sender == platformContract),
            "FFXFunding: unauthorized"
        );
        _;
    }

    constructor(address _platformBot, address _platformFeeWallet) {
        require(_platformBot != address(0) && _platformFeeWallet != address(0), "FFXFunding: zero");
        platformBot       = _platformBot;
        platformFeeWallet = _platformFeeWallet;
    }

    function setFactory(address _factory) external {
        require(msg.sender == platformBot, "FFXFunding: not bot");
        require(_factory != address(0), "FFXFunding: zero factory");
        factory = _factory;
        emit FactorySet(_factory);
    }

    function setPlatformContract(address _p) external {
        require(msg.sender == platformBot, "FFXFunding: not bot");
        platformContract = _p;
    }

    /// @notice Register a perps contract for 8-hour funding settlement.
    ///         Called by FFXFactory when a market is created, or by platform bot directly.
    function registerMarket(address perps) external onlyBotOrFactory {
        require(perps != address(0), "FFXFunding: zero");
        require(!markets[perps].registered, "FFXFunding: registered");
        markets[perps] = MarketFunding(block.timestamp, true);
        emit MarketRegistered(perps);
    }

    function settle(address perps) external onlyBot {
        MarketFunding storage mf = markets[perps];
        require(mf.registered, "FFXFunding: not registered");
        require(block.timestamp >= mf.lastSettled + FUNDING_INTERVAL, "FFXFunding: too early");

        uint256 longRatio = IFFXPerps(perps).getLongRatio();
        uint256 totalOI   = IFFXPerps(perps).getTotalOI();

        (int256 longFPU, int256 shortFPU) = _calcFunding(longRatio, totalOI);

        mf.lastSettled = block.timestamp;

        IFFXPerps(perps).applyFunding(longFPU, shortFPU);

        emit FundingSettled(perps, longRatio, longFPU, shortFPU);
    }

    function _calcFunding(uint256 longRatio, uint256 totalOI) internal pure returns (
        int256 longFPU, int256 shortFPU
    ) {
        if (totalOI == 0) return (0, 0);

        uint256 imbalance;
        bool longsPayShorts;
        if (longRatio >= 50) {
            imbalance      = longRatio - 50;
            longsPayShorts = true;
        } else {
            imbalance      = 50 - longRatio;
            longsPayShorts = false;
        }

        uint256 totalFunding = (totalOI * imbalance * BASE_RATE_BPS) / BPS;
        uint256 net          = totalFunding - (totalFunding * PLATFORM_CUT_BPS / BPS);

        uint256 longOI  = (totalOI * longRatio)         / 100;
        uint256 shortOI = (totalOI * (100 - longRatio)) / 100;

        if (longsPayShorts) {
            longFPU  = longOI  > 0 ? -int256(totalFunding * 1e18 / longOI)  : int256(0);
            shortFPU = shortOI > 0 ?  int256(net          * 1e18 / shortOI) : int256(0);
        } else {
            shortFPU = shortOI > 0 ? -int256(totalFunding * 1e18 / shortOI) : int256(0);
            longFPU  = longOI  > 0 ?  int256(net          * 1e18 / longOI)  : int256(0);
        }
    }
}

interface IFFXPerps {
    function getLongRatio() external view returns (uint256);
    function getTotalOI()   external view returns (uint256);
    function applyFunding(int256 longFPU, int256 shortFPU) external;
}
