# FlapPlatform — Contract Notes

## What Is It?

`FlapPlatform.sol` is the **central platform governance contract** for Flap Futures.
It plays three roles:

1. **Platform fee wallet** — receives 20% of spread fees, 20% of liquidation
   penalties, and 10% of funding flows from every market, passively.
2. **Admin hub** — manages admin and bot-operator roles, and can push role
   changes to FlapFactory, FlapOracle, and FlapFunding in one transaction.
3. **Market controls** — can lock params or emergency-pause/unpause any
   FlapPerps market.

---

## Deployment

Deploy FlapPlatform **before** FlapFactory. Pass its address as `platformFeeWallet`
in FlapFactory's constructor. All fee transfers from FlapPerps and FlapFunding will
then automatically land in FlapPlatform without any push/pull call.

```
Deployment order:
  1. FlapOracle(botOperator)
  2. FlapFunding(botOperator, flapPlatformAddress)
  3. FlapPlatform(admin, botOperator, USDT, factory=0, oracle, funding)
  4. FlapFactory(botOperator, flapPlatformAddress, USDT, oracle, funding)
  5. FlapPlatform.setFactory(factoryAddress)  ← link factory after it's deployed
```

---

## State Variables

| Variable | Type | Description |
|---|---|---|
| `admin` | address | Current platform admin. Can do everything. |
| `pendingAdmin` | address | Nominated next admin. Must call `acceptAdmin()` to take over. |
| `botOperator` | address | Bot wallet. Can pause markets but cannot withdraw fees. |
| `collateralToken` | address | USDT BEP-20 (18 decimals) on BSC. |
| `factory` | address | FlapFactory address — used when propagating bot operator changes. |
| `oracle` | address | FlapOracle address — same. |
| `funding` | address | FlapFunding address — same. |
| `totalFeesWithdrawn` | uint256 | Lifetime USDT withdrawn by admin. |

---

## Functions

### Fee Management

#### `pendingFees() → uint256`
Returns the current USDT balance held by this contract.
This is the live amount available to withdraw.
Fees accumulate here passively every time FlapPerps or FlapFunding call
`USDT.transfer(platformFeeWallet, amount)`.

#### `lifetimeFees() → uint256`
Returns `totalFeesWithdrawn + pendingFees()`.
Gives the total USDT ever received as platform revenue.

#### `withdrawFees(address to)`
Withdraws **all** accumulated USDT to `to`.
Only callable by `admin`.
Updates `totalFeesWithdrawn` and emits `FeesWithdrawn`.
Use this for bulk sweeps to a treasury or multisig.

#### `withdrawFeesPartial(address to, uint256 amount)`
Withdraws a **specific amount** of USDT to `to`.
Only callable by `admin`.
Use this when you want to distribute a portion without sweeping everything
(e.g. send 50% to a burn wallet, keep 50% for ops).

---

### Admin Transfer (two-step)

#### `transferAdmin(address newAdmin)`
Step 1 — current admin nominates a new admin.
The transfer does NOT take effect until the new admin calls `acceptAdmin()`.
This prevents accidentally handing control to a wrong or unreachable address.
Emits `AdminTransferInitiated`.

#### `acceptAdmin()`
Step 2 — the nominated address claims the admin role.
Only callable by the address stored in `pendingAdmin`.
Emits `AdminTransferAccepted`.

---

### Bot Operator

#### `setBotOperator(address newBot)`
Replaces the bot operator in **this contract AND** in FlapFactory, FlapOracle,
and FlapFunding in a single transaction.
This keeps all global contracts in sync without needing 4 separate calls.
Only callable by `admin`.
Emits `BotOperatorUpdated`.

---

### Platform Fee Wallet Migration

#### `migratePlatformFeeWallet(address newWallet)`
If this FlapPlatform contract is being replaced (e.g. upgraded), call this to
redirect all future fee flows to the new address.
Updates `platformFeeWallet` inside FlapFactory and FlapFunding.
After calling this, fees from existing and new markets will go to `newWallet`.
Only callable by `admin`.

---

### Market Admin Controls

#### `setMarketParamsLocked(address perps, bool locked)`
Locks or unlocks automatic parameter refresh for a specific market.
- `locked = true` → backend will NOT auto-refresh spread/leverage/OI even if mcap changes.
  Used for markets that need manual tuning or are under investigation.
- `locked = false` → params update automatically on the next backend refresh.
Calls `FlapPerps.setParamsLocked(locked)` on the target contract.
Only callable by `admin`.
Emits `MarketParamsLocked`.

#### `emergencyPauseMarket(address perps)`
Blocks ALL new position opens on a market.
Existing open positions are NOT touched — traders can still close normally.
Callable by **admin OR bot operator** so the bot can react instantly to anomalous
activity without waiting for a human.
Emits `MarketPaused`.

#### `emergencyUnpauseMarket(address perps)`
Re-enables new position opens after the issue is resolved.
Only callable by `admin` (NOT bot) — deliberate: only a human should re-open
a market after a pause.
Emits `MarketUnpaused`.

---

### Global Contract Address Updates

#### `setFactory(address newFactory)`
Updates the `factory` pointer stored in this contract.
Does NOT affect already-deployed markets. Only changes where bot-operator
propagation calls go in `setBotOperator()`.

#### `setOracle(address newOracle)`
Updates the `oracle` pointer.

#### `setFunding(address newFunding)`
Updates the `funding` pointer.

---

## Fee Flow Diagram

```
Every FlapPerps market:
  openPosition()  → spread fee → 80% to opener (pendingOpenerFees)
                               → 20% USDT.transfer → FlapPlatform ✓
  closePosition() → spread fee → same split
  liquidate()     → 20% penalty → USDT.transfer → FlapPlatform ✓
                 → 30% penalty → bot operator wallet
                 → 50% penalty → vault insurance fund

FlapFunding (every 8h):
  settle()        → 10% of total funding flow → FlapPlatform ✓

FlapPlatform:
  admin calls withdrawFees(treasury) → USDT sent to treasury
```

---

## Access Control Summary

| Function | Admin | Bot | Public |
|---|---|---|---|
| `withdrawFees` | ✓ | | |
| `withdrawFeesPartial` | ✓ | | |
| `transferAdmin` | ✓ | | |
| `acceptAdmin` | | | ✓ (pending only) |
| `setBotOperator` | ✓ | | |
| `migratePlatformFeeWallet` | ✓ | | |
| `setMarketParamsLocked` | ✓ | | |
| `emergencyPauseMarket` | ✓ | ✓ | |
| `emergencyUnpauseMarket` | ✓ | | |
| `setFactory` | ✓ | | |
| `setOracle` | ✓ | | |
| `setFunding` | ✓ | | |
| `pendingFees` | ✓ | ✓ | ✓ (view) |
| `lifetimeFees` | ✓ | ✓ | ✓ (view) |

---

## Events

| Event | When |
|---|---|
| `FeesWithdrawn(to, amount)` | Any fee withdrawal |
| `AdminTransferInitiated(pendingAdmin)` | `transferAdmin()` called |
| `AdminTransferAccepted(newAdmin)` | `acceptAdmin()` called |
| `BotOperatorUpdated(newBot)` | `setBotOperator()` called |
| `FactoryUpdated(newFactory)` | `setFactory()` called |
| `OracleUpdated(newOracle)` | `setOracle()` called |
| `FundingUpdated(newFunding)` | `setFunding()` called |
| `MarketParamsLocked(perps, locked)` | `setMarketParamsLocked()` called |
| `MarketPaused(perps)` | `emergencyPauseMarket()` called |
| `MarketUnpaused(perps)` | `emergencyUnpauseMarket()` called |
