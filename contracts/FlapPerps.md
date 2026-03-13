# FlapPerps — Contract Notes

## What Is It?

`FlapPerps.sol` is the **per-market perpetuals engine**. One instance deployed per
token market. It handles everything related to trading:
- Opening and closing positions
- PnL calculation
- Liquidations
- Spread fee collection and distribution
- Funding rate application
- Platform emergency controls

All amounts are in 18-decimal USDT. Prices come from FlapOracle.
Risk parameters (leverage, spread, OI cap) come from FlapParams library using live mcap.

---

## Deployment

Deployed by FlapFactory as part of `createMarket()`. FlapVault is deployed first,
then FlapPerps is deployed with the vault address, then FlapVault.setPerps() is called.

```
constructor(token, collateral, vault, oracle, funding, opener, platformFeeWallet, botOperator)
```

`platformFeeWallet` should be the FlapPlatform contract address.

---

## Fee Constants

| Constant | Value | Meaning |
|---|---|---|
| `OPENER_FEE_SHARE` | 8000 | 80% of spread fee → opener's pendingOpenerFees |
| `PLATFORM_FEE_SHARE` | 2000 | 20% of spread fee → FlapPlatform (sent immediately) |
| `BPS_DENOM` | 10,000 | Basis point denominator |

## Liquidation Constants

| Constant | Value | Meaning |
|---|---|---|
| `LIQ_THRESHOLD_BPS` | 8000 | Liquidate at 80% loss of margin |
| `LIQ_INSURANCE_SHARE` | 5000 | 50% of remaining margin → vault insurance |
| `LIQ_BOT_SHARE` | 3000 | 30% of remaining margin → liquidator (bot or public) |
| `LIQ_PLATFORM_SHARE` | 2000 | 20% of remaining margin → FlapPlatform |

---

## Position Struct

| Field | Type | Description |
|---|---|---|
| `trader` | address | Who opened the position |
| `margin` | uint256 | Collateral deposited (18-decimal USDT) |
| `leverage` | uint8 | Leverage multiplier (1–10) |
| `isLong` | bool | true = long, false = short |
| `entryPrice` | uint256 | Oracle price at open (18 decimals) |
| `size` | uint256 | Notional = margin × leverage |
| `openedAt` | uint256 | Block timestamp |
| `isOpen` | bool | false once closed or liquidated |
| `fundingAccrued` | int256 | Cumulative funding index at open time |

---

## State Variables

| Variable | Description |
|---|---|
| `positions[id]` | All positions by ID |
| `traderPositions[trader]` | List of position IDs per trader |
| `nextPositionId` | Auto-increments from 1 |
| `totalLongOI` | Total notional on long side |
| `totalShortOI` | Total notional on short side |
| `openPositionCount` | Number of currently open positions |
| `pendingOpenerFees` | Accumulated spread fees claimable by opener |
| `emergencyPaused` | If true, `openPosition` is blocked |
| `paramsLocked` | Signal for backend: skip auto-refresh if true |
| `cumulativeLongFunding` | Running sum of per-unit long funding (signed) |
| `cumulativeShortFunding` | Running sum of per-unit short funding (signed) |

---

## Modifiers

| Modifier | Condition |
|---|---|
| `onlyFunding` | msg.sender == funding contract |
| `onlyBotOrAnyone(permissionless)` | If not permissionless, must be bot operator |
| `onlyPlatform` | msg.sender == platformFeeWallet (FlapPlatform) |
| `marketActive` | Market not closed, withdrawal not in progress |
| `priceIsFresh` | Oracle price is less than 5 minutes old |

---

## Functions

### `openPosition(margin, leverage, isLong)`
Opens a new leveraged position for the caller.

**Pre-checks (all must pass):**
1. `marketActive` — market not closed, no withdrawal in progress
2. `priceIsFresh` — oracle price is fresh
3. `!emergencyPaused` — platform hasn't emergency-paused this market
4. `!vault.isFrozen()` — vault health is not frozen

**Parameter checks (from live mcap):**
- `leverage` must be 1 to `calcMaxLeverage(mcap)`
- `margin` must be $5 to `calcMaxPosition(mcap)`
- `totalLongOI + totalShortOI + notional` must be <= `calcMaxOI(mcap)`

**Fee collection:**
- `spreadFee = margin * calcSpread(mcap) / 10000`
- Trader pays `margin + spreadFee`
- 80% of spreadFee → `pendingOpenerFees`
- 20% of spreadFee → FlapPlatform (immediate transfer)

**Position recording:**
- Margin transferred to FlapVault
- Position stored with entry price from oracle
- Long/short OI updated
- Emits `PositionOpened`

---

### `closePosition(positionId)`
Trader closes their own open position.
Requires fresh oracle price.

Internally calls `_closePosition(posId, currentPrice, isForced=false)`:
1. Calculates spread fee on close (same rate as open)
2. Calculates PnL: `(currentPrice - entryPrice) / entryPrice * size` (negated for shorts)
3. Applies accumulated funding delta since position opened
4. `netPayout = margin + pnl - closeFee`
5. If netPayout > 0: vault pays trader via `FlapVault.payTrader()`
6. If netPayout <= 0: margin stays in vault (loss already there)
7. Distributes close fee: 80% opener, 20% platform
8. Updates OI, marks position closed
9. Emits `PositionClosed`

---

### `forceCloseAll()`
Called by FlapVault when:
- Opener calls `requestWithdrawal()`
- Health grace period expires

Closes every open position at the current (or last known) price.
Force-closed positions do NOT pay spread fees (close fee is skipped).
Only callable by the vault contract.

---

### `liquidate(positionId)`
Permissionless — anyone can call, but the bot does it fastest (and earns 30%).
Requires fresh oracle price.

**Liquidation condition:** position loss >= 80% of margin.
- Long liquidated when: `currentPrice <= entryPrice * (1 - 0.8 / leverage)`
- Short liquidated when: `currentPrice >= entryPrice * (1 + 0.8 / leverage)`

**Remaining margin** = 20% of original margin (the part not yet lost).
Split:
- 50% → vault insurance (`FlapVault.addToInsurance()`)
- 30% → liquidator (`msg.sender`) — bot or anyone
- 20% → FlapPlatform

Position is marked closed. Emits `PositionLiquidated`.

---

### `applyFunding(longFundingPerUnit, shortFundingPerUnit)`
Called by FlapFunding every 8 hours.
Adds per-unit funding rates to the cumulative accumulators.
When a position is closed, the delta from open-time to close-time is applied to PnL.
Emits `FundingApplied`.
Only callable by the funding contract.

---

### `claimFees()`
Opener calls to withdraw their accumulated spread fee share.
Transfers the full `pendingOpenerFees` balance to the opener.
Only callable by the opener address.
Emits `FeesClaimed`.

---

### Platform Admin Controls (FlapPlatform only)

#### `setParamsLocked(locked)`
Sets `paramsLocked` flag. When true, the backend skips auto-refreshing spread/lev/OI
for this market. The flag is read off-chain — it does NOT affect on-chain enforcement
(FlapParams.sol is always used for every trade regardless).

#### `emergencyPause()`
Sets `emergencyPaused = true`.
Immediately blocks all new `openPosition` calls.
Existing positions can still be closed normally.

#### `emergencyUnpause()`
Sets `emergencyPaused = false`.
Re-enables position opens.
Only the platform admin (not bot) can unpause.

---

### Views

| Function | Returns |
|---|---|
| `getLongRatio()` | Long % of total OI (0–100). Returns 50 if no OI. |
| `getTotalOI()` | Total notional (long + short) |
| `getTotalOpenInterest()` | Same as `getTotalOI()` (alias for FlapVault interface) |
| `getOpenPositionCount()` | Number of currently open positions |
| `getPosition(id)` | Full Position struct |
| `getTraderPositions(trader)` | Array of position IDs for a trader |
| `getUnrealizedPnl(id)` | Current unrealized PnL for an open position |
| `isLiquidatable(id)` | Whether a position has hit its liquidation price |
| `getCurrentParams()` | spread, maxLeverage, maxPosition, maxOI, currentOI from live mcap |

---

## Events

| Event | When |
|---|---|
| `PositionOpened(id, trader, isLong, margin, leverage, entryPrice, spreadFee)` | `openPosition()` |
| `PositionClosed(id, trader, pnl, exitPrice, spreadFee)` | `closePosition()` or `_closePosition()` |
| `PositionLiquidated(id, trader, liquidationPrice, remainingMargin)` | `liquidate()` |
| `FeesClaimed(opener, amount)` | `claimFees()` |
| `FundingApplied(longPerUnit, shortPerUnit)` | `applyFunding()` |

---

## PnL Formula

```
priceMove = currentPrice - entryPrice
pnl       = priceMove * notional / entryPrice
           (negated for shorts)
netPayout = margin + pnl + fundingDelta - closeFee
```

If `netPayout` is positive, the vault pays the trader.
If `netPayout` is zero or negative, the trader gets nothing; their margin stays in the vault.
