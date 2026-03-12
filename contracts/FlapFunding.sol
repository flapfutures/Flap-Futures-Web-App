// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IFlapPerpsForFunding {
    function getLongRatio() external view returns (uint256);
    function getTotalOI() external view returns (uint256);
    function applyFunding(int256 longFundingPerUnit, int256 shortFundingPerUnit) external;
}

interface IERC20Transfer {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract FlapFunding {

    address public botOperator;
    address public platformFeeWallet;
    address public collateralToken;
    address public platformContract;

    uint256 public constant FUNDING_INTERVAL  = 8 hours;
    uint256 public constant BASE_RATE_BPS     = 1;
    uint256 public constant PLATFORM_CUT_BPS  = 1000;
    uint256 public constant BPS_DENOM         = 10_000;

    struct MarketFunding {
        uint256 lastSettled;
        bool    registered;
    }

    mapping(address => MarketFunding) public markets;

    event FundingSettled(
        address indexed perps,
        uint256 longRatio,
        int256  longFundingPerUnit,
        int256  shortFundingPerUnit,
        uint256 platformFee
    );
    event MarketRegistered(address indexed perps);

    modifier onlyBot() {
        require(msg.sender == botOperator, "FlapFunding: not bot operator");
        _;
    }

    modifier onlyBotOrPlatform() {
        require(
            msg.sender == botOperator ||
            (platformContract != address(0) && msg.sender == platformContract),
            "FlapFunding: not authorized"
        );
        _;
    }

    constructor(address _botOperator, address _platformFeeWallet, address _collateralToken) {
        require(_botOperator       != address(0), "FlapFunding: zero operator");
        require(_platformFeeWallet != address(0), "FlapFunding: zero fee wallet");
        require(_collateralToken   != address(0), "FlapFunding: zero token");
        botOperator       = _botOperator;
        platformFeeWallet = _platformFeeWallet;
        collateralToken   = _collateralToken;
    }

    function registerMarket(address perps) external {
        require(perps != address(0), "FlapFunding: zero perps");
        require(!markets[perps].registered, "FlapFunding: already registered");
        markets[perps] = MarketFunding(block.timestamp, true);
        emit MarketRegistered(perps);
    }

    function _calcFunding(uint256 longRatio, uint256 totalOI) internal pure returns (
        int256 longFPU,
        int256 shortFPU,
        uint256 platformFee
    ) {
        uint256 imbalance;
        bool longsPayShorts;
        if (longRatio >= 50) {
            imbalance      = longRatio - 50;
            longsPayShorts = true;
        } else {
            imbalance      = 50 - longRatio;
            longsPayShorts = false;
        }

        uint256 totalFunding = (totalOI * imbalance * BASE_RATE_BPS) / BPS_DENOM;
        platformFee          = (totalFunding * PLATFORM_CUT_BPS) / BPS_DENOM;
        uint256 netFunding   = totalFunding - platformFee;

        uint256 longOI  = (totalOI * longRatio)         / 100;
        uint256 shortOI = (totalOI * (100 - longRatio)) / 100;

        if (longsPayShorts) {
            longFPU  = longOI  > 0 ? -int256(totalFunding / (longOI  / 1e18)) : int256(0);
            shortFPU = shortOI > 0 ?  int256(netFunding   / (shortOI / 1e18)) : int256(0);
        } else {
            shortFPU = shortOI > 0 ? -int256(totalFunding / (shortOI / 1e18)) : int256(0);
            longFPU  = longOI  > 0 ?  int256(netFunding   / (longOI  / 1e18)) : int256(0);
        }
    }

    function settle(address perps) external onlyBot {
        MarketFunding storage mf = markets[perps];
        require(mf.registered, "FlapFunding: market not registered");
        require(block.timestamp >= mf.lastSettled + FUNDING_INTERVAL, "FlapFunding: too early");

        uint256 longRatio = IFlapPerpsForFunding(perps).getLongRatio();
        uint256 totalOI   = IFlapPerpsForFunding(perps).getTotalOI();

        if (totalOI == 0) {
            mf.lastSettled = block.timestamp;
            return;
        }

        (int256 longFPU, int256 shortFPU, uint256 platformFee) = _calcFunding(longRatio, totalOI);

        IFlapPerpsForFunding(perps).applyFunding(longFPU, shortFPU);

        if (platformFee > 0) {
            uint256 available = IERC20Transfer(collateralToken).balanceOf(perps);
            uint256 toSend    = platformFee < available ? platformFee : available;
            if (toSend > 0) {
                IERC20Transfer(collateralToken).transferFrom(perps, platformFeeWallet, toSend);
            }
        }

        mf.lastSettled = block.timestamp;

        emit FundingSettled(perps, longRatio, longFPU, shortFPU, platformFee);
    }

    function nextSettlementTime(address perps) external view returns (uint256) {
        return markets[perps].lastSettled + FUNDING_INTERVAL;
    }

    function canSettle(address perps) external view returns (bool) {
        return block.timestamp >= markets[perps].lastSettled + FUNDING_INTERVAL;
    }

    function setPlatformContract(address _platform) external onlyBot {
        require(platformContract == address(0), "FlapFunding: platform already set");
        require(_platform != address(0), "FlapFunding: zero platform");
        platformContract = _platform;
    }

    function setBotOperator(address newBot) external onlyBotOrPlatform {
        require(newBot != address(0), "FlapFunding: zero address");
        botOperator = newBot;
    }

    function setPlatformFeeWallet(address newWallet) external onlyBotOrPlatform {
        require(newWallet != address(0), "FlapFunding: zero address");
        platformFeeWallet = newWallet;
    }
}
