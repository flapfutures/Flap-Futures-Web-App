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

    uint256 internal constant MIN_POSITION = 5e18;
    uint256 internal constant MIN_VAULT    = 500e18;
    uint256 internal constant VAULT_WARN_BPS     = 3000;
    uint256 internal constant VAULT_FREEZE_BPS   = 1500;

    // Returns spread in basis points (50 = 0.50%, 10 = 0.10%)
    function calcSpread(uint256 mcap) internal pure returns (uint256) {
        if (mcap < MCAP_50K)   return 50;
        if (mcap < MCAP_100K)  return 45;
        if (mcap < MCAP_200K)  return 40;
        if (mcap < MCAP_400K)  return 35;
        if (mcap < MCAP_800K)  return 30;
        if (mcap < MCAP_1P5M)  return 25;
        if (mcap < MCAP_3M)    return 20;
        if (mcap < MCAP_7M)    return 15;
        return 10;
    }

    // Returns max leverage multiplier (1, 5, 7, or 10)
    function calcMaxLeverage(uint256 mcap) internal pure returns (uint8) {
        if (mcap < MCAP_50K)   return 1;
        if (mcap < MCAP_100K)  return 5;
        if (mcap < MCAP_300K)  return 7;
        return 10;
    }

    // Returns max position size in USDT (18 decimals)
    function calcMaxPosition(uint256 mcap) internal pure returns (uint256) {
        if (mcap < MCAP_50K)   return 20e18;
        if (mcap < MCAP_100K)  return 35e18;
        if (mcap < MCAP_300K)  return 50e18;
        if (mcap < MCAP_1M)    return 75e18;
        return 100e18;
    }

    // Returns max open interest in USDT (18 decimals) — mcap based, NOT vault based
    function calcMaxOI(uint256 mcap) internal pure returns (uint256) {
        if (mcap < MCAP_50K)   return 1_000e18;
        if (mcap < MCAP_100K)  return 2_500e18;
        if (mcap < MCAP_300K)  return 6_000e18;
        if (mcap < MCAP_1M)    return 15_000e18;
        if (mcap < MCAP_5M)    return 40_000e18;
        return 100_000e18;
    }

    // Returns minimum insurance required in USDT (18 decimals)
    function calcMinInsurance(uint256 mcap) internal pure returns (uint256) {
        uint256 maxOI = calcMaxOI(mcap);
        uint256 tenPercent = maxOI / 10;
        return tenPercent < 100e18 ? 100e18 : tenPercent;
    }

    // Vault health: 0 = green, 1 = warning, 2 = frozen, 3 = critical
    function vaultHealth(uint256 vaultBalance, uint256 maxOI) internal pure returns (uint8) {
        if (maxOI == 0) return 0;
        uint256 ratio = (vaultBalance * 10_000) / maxOI;
        if (ratio >= VAULT_WARN_BPS)   return 0;
        if (ratio >= VAULT_FREEZE_BPS) return 1;
        return 2;
    }
}
