# FlapFunding — Contract Notes

## What Is It?

`FlapFunding.sol` is the **global funding rate engine** for Flap Futures.
One contract, shared by all markets. The bot calls `settle(perpsAddress)`
every 8 hours per market to apply funding payments between longs and shorts.

Funding acts as a balancing force: when longs heavily outweigh shorts, longs
pay shorts (and vice versa), discouraging one-sided markets. The platform
takes 10% of the total funding flow.

---

## Deployment

```
constructor(address _botOperator, address _platformFeeWallet, address _collateralToken)
```

`_platformFeeWallet` should be the FlapPlatform contract address.
`_collateralToken` is USDT BEP-20 on BSC.

After deployment, FlapFactory calls `registerMarket(perpsAddress)` for each new market.

---

## Constants

| Constant | Value | Meaning |
|---|---|---|
| `FUNDING_INTERVAL` | 8 hours | How often settlements can run |
| `BASE_RATE_BPS` | 1 | 0.01% per 1% imbalance per 8h |
| `PLATFORM_CUT_BPS` | 1000 | 10% of total funding goes to platform |
| `BPS_DENOM` | 10,000 | Basis point denominator |

---

## State Variables

| Variable | Type | Description |
|---|---|---|
| `botOperator` | address | Only bot can call `settle()` |
| `platformFeeWallet` | address | FlapPlatform — receives 10% of funding |
| `collateralToken` | address | USDT BEP-20 |
| `markets[perps]` | MarketFunding | Per-market funding state |

### MarketFunding Struct
| Field | Type | Description |
|---|---|---|
| `lastSettled` | uint256 | Timestamp of last successful settlement |
| `registered` | bool | Whether this market has been registered |

---

## Funding Rate Formula

```
imbalance    = abs(longRatio - 50)          // in percentage points
rateBps      = imbalance * BASE_RATE_BPS    // = imbalance * 0.01%
totalFunding = totalOI * rateBps / 10,000
```

**Example:** 70% longs, 30% shorts, $10,000 total OI
- imbalance = 20
- rateBps = 20 * 1 = 20 bps = 0.20%
- totalFunding = $10,000 * 0.20% = $20 per 8h

The $20 is then split:
- 10% ($2) → FlapPlatform
- Remaining $18 distributed to shorts proportionally
- Longs lose a proportional share of $20 from their margin

---

## Functions

### `registerMarket(perps)`
Called by FlapFactory when a new market is created.
Records the perps address and sets `lastSettled = now`.
Only callable once per perps address (reverts if already registered).
Emits `MarketRegistered`.

---

### `settle(perps)`
The main function. Bot calls this every 8 hours per market.

**Steps:**
1. Check market is registered and 8 hours have passed since last settlement.
2. Read `getLongRatio()` and `getTotalOI()` from FlapPerps.
3. Skip if `totalOI == 0` (no open positions).
4. Calculate imbalance, rate, and total funding pool.
5. Split funding pool: 10% → platform, 90% → balanced side.
6. Calculate per-unit funding rates (positive = receive, negative = pay).
7. Call `FlapPerps.applyFunding(longPerUnit, shortPerUnit)` to update cumulative rates.
8. Transfer platform fee via `USDT.transferFrom(perps, platformFeeWallet, platformFee)`.
9. Update `lastSettled = now`.
10. Emit `FundingSettled`.

**Important:** The platform fee is pulled directly from the FlapPerps contract's USDT
balance (which holds trader margins). This is why FlapPerps must pre-approve FlapFunding
for USDT transfers, or the settlement will revert.

**When longs pay shorts:**
- `longFundingPerUnit` = negative (each long position loses USDT per unit of size)
- `shortFundingPerUnit` = positive (each short position gains USDT per unit of size)

**When shorts pay longs:** opposite signs.

---

### `nextSettlementTime(perps) → uint256`
Returns the earliest timestamp at which `settle()` can next be called.
`= lastSettled + 8 hours`

### `canSettle(perps) → bool`
Returns true if 8 hours have passed since the last settlement.
Bot uses this to know when to trigger settlement.

---

### Admin

#### `setBotOperator(newBot)`
Replaces the bot operator. Only callable by current bot operator.
(FlapPlatform can cascade this via `setBotOperator` which calls all global contracts.)

#### `setPlatformFeeWallet(newWallet)`
Updates where 10% funding fees are sent.
Only callable by bot operator.
(FlapPlatform calls this via `migratePlatformFeeWallet` if the platform contract is upgraded.)

---

## Events

| Event | When |
|---|---|
| `FundingSettled(perps, longRatio, longPerUnit, shortPerUnit, platformFee)` | Every settlement |
| `MarketRegistered(perps)` | New market registered |
