# FlapVault — Contract Notes

## What Is It?

`FlapVault.sol` is the **per-market collateral contract**. One instance is deployed
per token market by FlapFactory. It holds two pools of money:

1. **Vault** — the opener's main deposit. Used to pay out winning traders.
2. **Insurance** — a smaller buffer. Used only when the vault is depleted.

The opener deposits into both before the market goes live. The vault is locked for
a chosen duration (7/30/90/180 days) as a trust commitment to traders.

FlapVault also monitors market health — if the vault gets too low relative to the
mcap-based max OI, the market freezes and eventually force-closes.

---

## Deployment

Deployed by FlapFactory as part of `createMarket()`.
After deployment, factory calls `setPerps(perpsAddress)` once to link it to its
corresponding FlapPerps. This two-step linking avoids a circular dependency.

```
constructor(opener, token, collateral, oracle, factory, lockDuration)
```

---

## State Variables

| Variable | Type | Description |
|---|---|---|
| `opener` | address immutable | Market opener — only they can deposit/withdraw |
| `token` | address immutable | The perps token address (used for param lookups via oracle) |
| `collateral` | address immutable | USDT BEP-20 on BSC |
| `oracle` | address immutable | FlapOracle address |
| `factory` | address immutable | FlapFactory — only it can call `setPerps()` |
| `perps` | address | FlapPerps for this market (set once after deployment) |
| `vaultBalance` | uint256 | Current vault balance (18-decimal USDT) |
| `insuranceBalance` | uint256 | Current insurance balance |
| `vaultLockedUntil` | uint256 | Timestamp when vault lock expires |
| `insuranceLockedUntil` | uint256 | Timestamp when insurance lock expires |
| `lockDuration` | uint256 | Chosen lock duration in seconds |
| `frozenAt` | uint256 | Timestamp when market entered frozen state (0 = not frozen) |
| `withdrawalRequested` | bool | True after opener calls `requestWithdrawal()` |
| `marketClosed` | bool | True after vault completes withdrawal or force-close |
| `trustBadge` | uint8 | 0=None, 1=Silver, 2=Gold, 3=Platinum (based on lockDuration) |

---

## Lock Duration & Trust Badges

The opener chooses their lock duration at market creation. This signals commitment
to traders — a longer lock means the opener can't pull liquidity suddenly.

| Lock Duration | Trust Badge |
|---|---|
| 7 days | None |
| 30 days | Silver |
| 90 days | Gold |
| 180 days | Platinum |

Top-up deposits do NOT reset the lock — they use the existing `vaultLockedUntil`.
A new lock only starts if the current lock has already expired.

---

## Functions

### Setup

#### `setPerps(perpsAddress)`
Called once by FlapFactory right after FlapPerps is deployed.
Links this vault to its paired FlapPerps contract.
Only callable by the factory, only callable once.

---

### Deposits (opener only)

#### `depositVault(amount)`
Opener deposits USDT into the vault.
- Minimum deposit: vault balance after deposit must be >= $500
- Starts a new lock if current lock is expired; otherwise keeps existing lock
- Calls `_checkAndUpdateHealth()` to re-evaluate market state after deposit
- Emits `VaultDeposited(opener, amount, unlocksAt)`

#### `depositInsurance(amount)`
Opener deposits USDT into the insurance fund.
- Minimum: insurance balance after deposit must be >= `calcMinInsurance(mcap)` = max($100, 10% of maxOI)
- Starts a new lock if current lock is expired
- Emits `InsuranceDeposited(opener, amount, unlocksAt)`

---

### Withdrawal Flow (opener only, two steps)

Withdrawal is a two-step process to protect traders with open positions.

#### `requestWithdrawal()`
Step 1 — opener initiates the withdrawal.
Requirements:
- Current time >= `vaultLockedUntil` (lock must be expired)
- `withdrawalRequested` must be false

What happens:
- Sets `withdrawalRequested = true` — this immediately blocks new positions in FlapPerps
  (via `isWithdrawalBlocked()` check in `marketActive` modifier)
- Calls `FlapPerps.forceCloseAll()` — closes all open positions at current price,
  paying out traders from the vault
- Emits `VaultWithdrawalRequested`

#### `completeWithdrawal()`
Step 2 — opener claims remaining vault + insurance balances.
Requirements:
- `withdrawalRequested` must be true
- `FlapPerps.getOpenPositionCount()` must be 0 (all positions closed)

What happens:
- Zeros out `vaultBalance` and `insuranceBalance`
- Sets `marketClosed = true` permanently
- Transfers remaining USDT to opener
- Emits `VaultWithdrawn`

---

### Trader Payouts (called by FlapPerps only)

#### `payTrader(trader, amount)`
FlapPerps calls this when a trader closes with profit.
Payout priority:
1. **Vault first** — if vault has enough, pay from vault
2. **Insurance if vault depleted** — insurance covers the shortfall
3. **Pro-rata haircut if both depleted** — pay whatever is available, haircut the rest

After paying, calls `_checkAndUpdateHealth()` to re-evaluate frozen state.
Emits `TraderRefunded`.

#### `addToInsurance(amount)`
FlapPerps calls this when distributing the liquidation penalty.
50% of the remaining margin from a liquidated position goes here.

#### `addToVault(amount)`
FlapPerps calls this when a trader loses — the lost margin stays in the vault
to pay future winners.

---

### Health Monitoring

#### `checkHealth()`
Public function — anyone can call to trigger a health check.
Internally calls `_checkAndUpdateHealth()`.

#### `_checkAndUpdateHealth()` (internal)
Runs on every deposit, payout, and explicit health check:
1. Fetches current mcap from oracle (soft-fail if oracle unreachable)
2. Calls `FlapParams.calcMaxOI(mcap)` to get the current OI cap
3. Calls `FlapParams.vaultHealth(vaultBalance, maxOI)` to get health state
4. Emits `VaultHealthUpdated(health)`
5. If health == 2 (Frozen):
   - If `frozenAt == 0`: records freeze timestamp, emits `MarketFrozen`
   - If frozen for > 3 days: calls `_triggerForceClose()`
6. If health recovered: resets `frozenAt = 0`

#### `_triggerForceClose()` (internal)
Called when grace period expires.
- Calls `FlapPerps.forceCloseAll()`
- Sets `marketClosed = true`
- Emits `MarketForceClosedByHealth`

---

### Views

#### `getHealth() → uint8`
Returns 0/1/2 based on current vaultBalance vs maxOI.
0 = Healthy, 1 = Warning, 2 = Frozen.

#### `isFrozen() → bool`
Returns true if vault health is 2 (frozen).
Checked by FlapPerps before every `openPosition` call.

#### `isWithdrawalBlocked() → bool`
Returns true if `withdrawalRequested` or `marketClosed`.
Checked by FlapPerps `marketActive` modifier — blocks new positions.

#### `isWithdrawable() → bool`
Returns true if the current time >= `vaultLockedUntil`.

#### `trustBadgeName() → string`
Returns "None", "Silver", "Gold", or "Platinum".

---

## Health State Summary

| State | Condition | Market Behavior |
|---|---|---|
| Green (0) | vault >= 30% of maxOI | Fully open |
| Warning (1) | vault 15–30% of maxOI | Fully open, opener should top up |
| Frozen (2) | vault < 15% of maxOI | No new positions, 3-day grace period |
| Force Closed | frozen for > 3 days | All positions force-closed, market closed |

---

## Events

| Event | When |
|---|---|
| `VaultDeposited(opener, amount, unlocksAt)` | `depositVault()` |
| `InsuranceDeposited(opener, amount, unlocksAt)` | `depositInsurance()` |
| `VaultWithdrawalRequested(opener)` | `requestWithdrawal()` |
| `VaultWithdrawn(opener, vaultAmount, insuranceAmount)` | `completeWithdrawal()` |
| `TraderRefunded(trader, amount)` | `payTrader()` |
| `MarketFrozen(frozenAt)` | Health drops to frozen |
| `MarketForceClosedByHealth()` | Grace period expires |
| `VaultHealthUpdated(health)` | Any health check |
