# FlapOracle — Contract Notes

## What Is It?

`FlapOracle.sol` is the **global price feed** for Flap Futures.
One contract, shared by all markets. The bot operator pushes the latest
price, market cap, and liquidity for each token. FlapPerps reads these
values on every position open/close/liquidation to get a fresh price.

---

## Deployment

Deployed once globally. Pass its address to FlapFunding and FlapFactory constructors.
Each FlapPerps and FlapVault stores its address as an immutable.

```
constructor(address _botOperator)
```

---

## Staleness Period

```solidity
uint256 public constant STALENESS_PERIOD = 5 minutes;
```

If a price has not been updated in the last 5 minutes, it is considered **stale**.
- `getPrice()` will revert on stale prices.
- `openPosition` and `closePosition` in FlapPerps use the `priceIsFresh` modifier,
  which calls `isFresh()` before allowing any trade.
- This prevents trades at outdated prices during downtime.

The bot is designed to push prices every 30 seconds, so staleness is only triggered
during bot downtime or network issues.

---

## State Variables

| Variable | Type | Description |
|---|---|---|
| `botOperator` | address | Only address allowed to push prices |
| `pendingOperator` | address | Nominated next operator (two-step transfer) |
| `STALENESS_PERIOD` | constant | 5 minutes — max age of a valid price |

The price data itself is stored in a private mapping `feeds[tokenAddress] => PriceFeed`.

### PriceFeed Struct
| Field | Type | Description |
|---|---|---|
| `price` | uint256 | USD price with 18 decimals (e.g. $0.001 = 1e15) |
| `mcap` | uint256 | USD market cap with 18 decimals (e.g. $50,000 = 50_000e18) |
| `liquidity` | uint256 | USD liquidity with 18 decimals |
| `updatedAt` | uint256 | block.timestamp of last update |

---

## Functions

### Price Updates (bot only)

#### `updatePrice(token, price, mcap, liquidity)`
Pushes a single token's price, mcap, and liquidity.
Called by the bot every ~30 seconds per token.
Overwrites the previous feed entry entirely.
Emits `PriceUpdated`.

#### `updatePriceBatch(tokens[], prices[], mcaps[], liquidities[])`
Pushes prices for multiple tokens in a single transaction.
All arrays must be the same length.
More gas-efficient than calling `updatePrice` separately for each token.
Used when the bot needs to update many markets at once.

---

### Price Reads

#### `getPrice(token) → uint256`
Returns the current USD price with 18 decimals.
**Reverts** if:
- No feed exists for the token yet.
- The last update was more than 5 minutes ago (stale).

This is the function called by FlapPerps for every trade.

#### `getMcap(token) → uint256`
Returns the current market cap with 18 decimals.
**No staleness check** — mcap is used for parameter lookups
(spread, leverage, OI cap) which can tolerate slightly old data.
If no feed exists, returns 0 (FlapParams will then use the lowest tier).

#### `getFeed(token) → (price, mcap, liquidity, updatedAt, isStale)`
Returns the full feed struct plus a boolean `isStale` flag.
Used by the frontend and off-chain tools to display current data.

#### `isFresh(token) → bool`
Returns `true` if the price was updated within the last 5 minutes.
Used by the `priceIsFresh` modifier in FlapPerps.

---

### Operator Transfer (two-step)

#### `initiateOperatorTransfer(newOperator)`
Step 1 — current bot operator nominates a new operator.
Does not take effect until the new operator calls `acceptOperatorTransfer()`.
Emits `OperatorTransferInitiated`.

#### `acceptOperatorTransfer()`
Step 2 — nominated operator accepts and becomes the new bot operator.
Only callable by the address set in `initiateOperatorTransfer()`.
Emits `OperatorTransferAccepted`.

---

## Events

| Event | When |
|---|---|
| `PriceUpdated(token, price, mcap, liquidity)` | Every price push |
| `OperatorTransferInitiated(newOperator)` | `initiateOperatorTransfer()` called |
| `OperatorTransferAccepted(newOperator)` | `acceptOperatorTransfer()` called |
