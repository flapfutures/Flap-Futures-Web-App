# FlapFactory — Contract Notes

## What Is It?

`FlapFactory.sol` is the **global market registry and deployer**.
When a market registration is approved by the platform, the bot operator calls
`createMarket()`. The factory deploys a pair of contracts — FlapVault + FlapPerps —
links them together, and registers the new market with FlapFunding.

One FlapFactory is deployed globally. It keeps a registry of all markets ever created.

---

## Deployment

```
constructor(botOperator, platformFeeWallet, collateralToken, oracleAddress, fundingAddress)
```

`platformFeeWallet` should be the FlapPlatform contract address.
After deploying FlapFactory, call `FlapPlatform.setFactory(factoryAddress)` to link them.

---

## State Variables

| Variable | Type | Description |
|---|---|---|
| `botOperator` | address | Only bot can call `createMarket()` |
| `platformFeeWallet` | address | FlapPlatform — passed to new FlapPerps as fee recipient |
| `collateralToken` | address | USDT BEP-20 — passed to new FlapVault and FlapPerps |
| `oracleAddress` | address | FlapOracle — passed to new contracts |
| `fundingAddress` | address | FlapFunding — passed to new FlapPerps + registerMarket() called |
| `markets[token]` | MarketAddresses | Registry of all markets by token address |
| `allTokens[]` | address[] | Ordered list of all token addresses with markets |

### MarketAddresses Struct

| Field | Type | Description |
|---|---|---|
| `vault` | address | FlapVault contract for this market |
| `perps` | address | FlapPerps contract for this market |
| `opener` | address | Market opener wallet |
| `createdAt` | uint256 | Block timestamp of creation |
| `exists` | bool | True if market has been created |

---

## Functions

### `createMarket(tokenAddress, openerWallet, lockDays)`
The main function. Only callable by the bot operator.
Called once per approved market registration.

**Validation:**
- `tokenAddress` must be non-zero
- `openerWallet` must be non-zero
- Market must not already exist for this token
- `lockDays` must be 7, 30, 90, or 180

**What happens:**

Step 1 — Deploy FlapVault
```
new FlapVault(openerWallet, tokenAddress, collateralToken, oracleAddress, address(this), lockDuration)
```
Factory passes `address(this)` as the factory parameter so the vault knows
who is allowed to call `setPerps()`.

Step 2 — Deploy FlapPerps
```
new FlapPerps(tokenAddress, collateralToken, vaultAddress, oracleAddress, fundingAddress,
              openerWallet, platformFeeWallet, botOperator)
```

Step 3 — Link vault to perps
```
newVault.setPerps(address(newPerps))
```
This resolves the circular dependency: vault needs perps address, perps needs vault address.
Factory deploys both and wires them up.

Step 4 — Register with FlapFunding
```
IFlapFundingRegistry(fundingAddress).registerMarket(address(newPerps))
```
FlapFunding starts tracking this market for 8-hour funding settlements.

Step 5 — Store in registry
Saves vault, perps, opener, timestamp to `markets[tokenAddress]`.
Appends token to `allTokens[]`.

Emits `MarketCreated(token, opener, vault, perps, lockDuration)`.

---

### Registry Views

#### `getMarket(token) → MarketAddresses`
Returns the full address struct for a token's market.
Use this to look up vault and perps addresses for a given token.

#### `marketExists(token) → bool`
Returns true if a market has been created for the given token.

#### `totalMarkets() → uint256`
Returns how many markets have been created total.

#### `getMarkets(offset, limit) → (tokens[], addresses[])`
Paginated list of all markets.
Returns the token address array and MarketAddresses array for the requested range.
Use `offset=0, limit=totalMarkets()` to get everything (for small sets).
For large sets, paginate in batches.

---

### Admin

#### `setBotOperator(newBot)`
Replaces the bot operator. Only callable by current bot operator.
FlapPlatform calls this as part of its `setBotOperator()` to keep everything in sync.
Emits `BotOperatorUpdated`.

#### `setPlatformFeeWallet(newWallet)`
Updates where platform fees go for any NEW markets created after this call.
Does NOT update existing FlapPerps contracts — they have `platformFeeWallet` as immutable.
Only callable by bot operator.
FlapPlatform calls this via `migratePlatformFeeWallet()` if upgrading.
Emits `PlatformFeeWalletUpdated`.

---

## Lock Days to Seconds (internal)

`_lockDaysToSeconds(days_)` converts 7/30/90/180 to seconds.
Reverts on any other value. This ensures only the four approved lock durations
can ever be created.

---

## Events

| Event | When |
|---|---|
| `MarketCreated(token, opener, vault, perps, lockDuration)` | `createMarket()` succeeds |
| `BotOperatorUpdated(newOperator)` | `setBotOperator()` |
| `PlatformFeeWalletUpdated(newWallet)` | `setPlatformFeeWallet()` |

---

## Why Is the Factory the Only One Who Can Call setPerps?

FlapVault needs to link to FlapPerps after both are deployed, but FlapPerps is
deployed after FlapVault (it needs the vault address in its constructor). The vault
stores the factory address as an immutable and checks `msg.sender == factory` in
`setPerps()`. This way no one else can ever swap out the perps link after creation.
