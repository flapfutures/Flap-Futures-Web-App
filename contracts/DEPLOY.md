# Flap Futures — Contract Deployment Guide

## Addresses to prepare before deploying

| Role | Address | Status |
|------|---------|--------|
| Admin / fee withdrawer | `0xbcE2B70e158F3F4c0f7368909FA7aD7dBfeF7941` | ✅ set |
| Bot operator | `0xd8AE9A69FD6Fe0e1B3D40F32D6E2E4A10894e118` | ✅ set |
| BSC USDT (collateral) | `0x55d398326f99059fF775485246999027B3197955` | ✅ fixed |

The **bot wallet** `0xd8AE9A69FD6Fe0e1B3D40F32D6E2E4A10894e118` runs automatically from the server:
- Pushes oracle prices every 5 min via `FlapOracle.updatePrice()` — fires on every DexScreener refresh
- Calls `FlapFunding.settle(perpsAddress)` when `canSettle()` returns true
- Calls `FlapPerps.liquidate(positionId)` on underwater positions (earns 30% of liquidation penalty)
- Private key is stored in `BOT_PRIVATE_KEY` Replit secret (encrypted, never logged)

> ⚠️ **Keep at least 0.5–1 BNB in the bot wallet at all times.**
> All gas is paid from this wallet. Oracle updates + funding settlements cost ~$0.50–1.00/day per market.
> Liquidations are self-funding (30% of remaining margin >> gas cost), but price pushes are a running cost.
> If BNB runs out, oracle stops updating and liquidations stop — markets go stale.

---

## Deploy order — Remix / Hardhat / Foundry

### Step 1 — FlapPlatform.sol

> Deploy first. Its address becomes `platformFeeWallet` in all other contracts.
> 20% of every trade fee accumulates here. Admin withdraws via `withdrawFees()`.

Constructor args:
```
_admin:           0xbcE2B70e158F3F4c0f7368909FA7aD7dBfeF7941
_botOperator:     <BOT_WALLET>
_collateralToken: 0x55d398326f99059fF775485246999027B3197955
_factory:         0x0000000000000000000000000000000000000000
_oracle:          0x0000000000000000000000000000000000000000
_funding:         0x0000000000000000000000000000000000000000
```

> Factory / Oracle / Funding can be zero — you link them after all 4 contracts are deployed.

**Save the deployed address → call it `PLATFORM_ADDRESS`**

---

### Step 2 — FlapOracle.sol

Constructor args:
```
_botOperator: <BOT_WALLET>
```

**Save the deployed address → call it `ORACLE_ADDRESS`**

---

### Step 3 — FlapFunding.sol

Constructor args:
```
_botOperator:      <BOT_WALLET>
_platformFeeWallet: PLATFORM_ADDRESS   ← the contract from Step 1
_collateralToken:   0x55d398326f99059fF775485246999027B3197955
```

**Save the deployed address → call it `FUNDING_ADDRESS`**

---

### Step 4 — FlapFactory.sol

Constructor args (6 params — must be in this exact order):
```
_botOperator:       <BOT_WALLET>
_platform:          PLATFORM_ADDRESS   ← FlapPlatform from Step 1
_platformFeeWallet: PLATFORM_ADDRESS   ← same as above (platform IS the fee wallet)
_collateralToken:   0x55d398326f99059fF775485246999027B3197955
_oracleAddress:     ORACLE_ADDRESS
_fundingAddress:    FUNDING_ADDRESS
```

**Save the deployed address → call it `FACTORY_ADDRESS`**

---

### Step 5 — Link contracts in FlapPlatform

Call these 3 functions on the deployed FlapPlatform **from the admin wallet**:

```
FlapPlatform.setFactory(FACTORY_ADDRESS)
FlapPlatform.setOracle(ORACLE_ADDRESS)
FlapPlatform.setFunding(FUNDING_ADDRESS)
```

---

### Step 5b — Wire FlapPlatform into FlapFunding

Call this **from the bot wallet**:

```
FlapFunding.setPlatformContract(PLATFORM_ADDRESS)
```

This allows FlapPlatform to propagate bot operator and fee wallet changes to FlapFunding in the future.

---

### Step 6 — Set server env vars (Replit Secrets)

Add these two secrets so the server bot can sign on-chain transactions:

| Key | Value |
|-----|-------|
| `FFX_ORACLE` | `ORACLE_ADDRESS` |
| `FFX_FUNDING` | `FUNDING_ADDRESS` |

The bot reads these at runtime. The `BOT_PRIVATE_KEY` is already set.

---

### Step 7 — Update perps-contracts.ts

After deployment, fill in `FFX_CONTRACTS` in `client/src/lib/perps-contracts.ts`:

```ts
export const BOT_WALLET = "<BOT_WALLET>";

export const FFX_CONTRACTS = {
  PLATFORM: "PLATFORM_ADDRESS",
  ORACLE:   "ORACLE_ADDRESS",
  FUNDING:  "FUNDING_ADDRESS",
  FACTORY:  "FACTORY_ADDRESS",
  VAULT:    "",   // filled per-market after createMarket()
  PERPS:    "",   // filled per-market after createMarket()
};
```

Also flip the deployment flag:
```ts
export const CONTRACTS_DEPLOYED = true;  // in perps.tsx
```

---

## Per-market creation (after all 4 contracts deployed)

When a market is approved, the **bot** calls:
```
FlapFactory.createMarket(
    tokenAddress,   // the FLAP token contract address
    openerWallet,   // the market creator's wallet
    lockDays        // 7 | 30 | 90 | 180
)
```

This deploys a `FlapVault` + `FlapPerps` pair. Save those two addresses and store them in the market DB record (`contractVault`, `contractPerps`).

---

## Fee flow summary

```
Trader opens/closes position
    → FlapPerps collects fee (min $1, 0.1% of notional)
    → 80% → market opener's pendingOpenerFees (claimable via claimFees())
    → 20% → FlapPlatform contract  (accumulates)
              └── admin calls withdrawFees(0xbcE2...) to collect
```

---

## Recommended: use Remix (remix.ethereum.org)

1. Paste each `.sol` file into Remix
2. Compile with Solidity `0.8.24`, EVM `paris`
3. Set environment to **Injected Provider — MetaMask** (BSC Mainnet)
4. Deploy in order: FlapPlatform → FlapOracle → FlapFunding → FlapFactory
5. Run `FlapPlatform.setFactory/setOracle/setFunding` (admin wallet) to link all contracts
6. Run `FlapFunding.setPlatformContract(PLATFORM_ADDRESS)` (bot wallet) to enable admin propagation
