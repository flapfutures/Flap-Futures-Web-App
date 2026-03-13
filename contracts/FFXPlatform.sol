// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title FFXPlatform — platform admin contract for managing all FFX markets
contract FFXPlatform {

    address public admin;
    address public oracle;
    address public funding;
    address public factory;

    event MarketPaused(address indexed perps);
    event MarketUnpaused(address indexed perps);
    event EmergencyWithdrawAll(address indexed to, uint256 vaults, uint256 perps);
    event OracleUpdated(address indexed oracle);
    event FundingUpdated(address indexed funding);
    event FactoryUpdated(address indexed factory);
    event AdminTransferred(address indexed newAdmin);

    modifier onlyAdmin() {
        require(msg.sender == admin, "FFXPlatform: not admin");
        _;
    }

    constructor(address _admin, address _oracle, address _funding, address _factory) {
        require(_admin != address(0), "FFXPlatform: zero admin");
        admin   = _admin;
        oracle  = _oracle;
        funding = _funding;
        factory = _factory;
    }

    function pauseMarket(address perps) external onlyAdmin {
        IFFXPerpsAdmin(perps).emergencyPause();
        emit MarketPaused(perps);
    }

    function unpauseMarket(address perps) external onlyAdmin {
        IFFXPerpsAdmin(perps).emergencyUnpause();
        emit MarketUnpaused(perps);
    }

    function emergencyWithdrawAll(
        address[] calldata vaults,
        address[] calldata perpsContracts,
        address to
    ) external onlyAdmin {
        require(to != address(0), "FFXPlatform: zero to");
        for (uint256 i = 0; i < vaults.length; i++) {
            if (vaults[i] != address(0)) IFFXVaultAdmin(vaults[i]).emergencyWithdraw(to);
        }
        for (uint256 i = 0; i < perpsContracts.length; i++) {
            if (perpsContracts[i] != address(0)) IFFXPerpsAdmin(perpsContracts[i]).emergencyDrain(to);
        }
        emit EmergencyWithdrawAll(to, vaults.length, perpsContracts.length);
    }

    function setOracle(address _o) external onlyAdmin {
        require(_o != address(0), "FFXPlatform: zero");
        oracle = _o;
        emit OracleUpdated(_o);
    }

    function setFunding(address _f) external onlyAdmin {
        require(_f != address(0), "FFXPlatform: zero");
        funding = _f;
        emit FundingUpdated(_f);
    }

    function setFactory(address _f) external onlyAdmin {
        require(_f != address(0), "FFXPlatform: zero");
        factory = _f;
        emit FactoryUpdated(_f);
    }

    function transferAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "FFXPlatform: zero");
        admin = newAdmin;
        emit AdminTransferred(newAdmin);
    }
}

interface IFFXPerpsAdmin {
    function emergencyPause()   external;
    function emergencyUnpause() external;
    function emergencyDrain(address to) external;
}

interface IFFXVaultAdmin {
    function emergencyWithdraw(address to) external;
}
