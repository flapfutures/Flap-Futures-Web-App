// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library FlapParams {
    uint256 internal constant MCAP_50K    = 50_000e18;
    uint256 internal constant MCAP_100K   = 100_000e18;
    uint256 internal constant MCAP_200K   = 200_000e18;
    uint256 internal constant MCAP_300K   = 300_000e18;
    uint256 internal constant MCAP_400K   = 400_000e18;
    uint256 internal constant MCAP_800K   = 800_000e18;
    uint256 internal constant MCAP_1M     = 1_000_000e18;
    uint256 internal constant MCAP_1P5M   = 1_500_000e18;
    uint256 internal constant MCAP_3M     = 3_000_000e18;
    uint256 internal constant MCAP_5M     = 5_000_000e18;
    uint256 internal constant MCAP_7M     = 7_000_000e18;
    uint256 internal constant MIN_POSITION    = 5e18;
    uint256 internal constant MIN_VAULT       = 1e18; // floor only — real minimum is creator config
    uint256 internal constant VAULT_WARN_BPS  = 3000;
    uint256 internal constant VAULT_FREEZE_BPS = 1500;

    function calcSpread(uint256 m) internal pure returns (uint256) {
        if (m < MCAP_50K)  return 50;
        if (m < MCAP_100K) return 45;
        if (m < MCAP_200K) return 40;
        if (m < MCAP_400K) return 35;
        if (m < MCAP_800K) return 30;
        if (m < MCAP_1P5M) return 25;
        if (m < MCAP_3M)   return 20;
        if (m < MCAP_7M)   return 15;
        return 10;
    }

    function calcMaxLeverage(uint256 m) internal pure returns (uint8) {
        if (m < MCAP_50K)  return 1;
        if (m < MCAP_100K) return 5;
        if (m < MCAP_300K) return 7;
        return 10;
    }

    function calcMaxPosition(uint256 m) internal pure returns (uint256) {
        if (m < MCAP_50K)  return 20e18;
        if (m < MCAP_100K) return 35e18;
        if (m < MCAP_300K) return 50e18;
        if (m < MCAP_1M)   return 75e18;
        return 100e18;
    }

    function calcMaxOI(uint256 m) internal pure returns (uint256) {
        if (m < MCAP_50K)  return 1_000e18;
        if (m < MCAP_100K) return 2_500e18;
        if (m < MCAP_300K) return 6_000e18;
        if (m < MCAP_1M)   return 15_000e18;
        if (m < MCAP_5M)   return 40_000e18;
        return 100_000e18;
    }

    function calcMinInsurance(uint256 m) internal pure returns (uint256) {
        uint256 x = calcMaxOI(m) / 10;
        return x < 100e18 ? 100e18 : x;
    }

    function vaultHealth(uint256 bal, uint256 maxOI) internal pure returns (uint8) {
        if (maxOI == 0) return 0;
        uint256 r = (bal * 10_000) / maxOI;
        if (r >= VAULT_WARN_BPS)   return 0;
        if (r >= VAULT_FREEZE_BPS) return 1;
        return 2;
    }
}
