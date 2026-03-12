export const BSC_CHAIN_ID = 56;
export const BSC_RPC = "https://bsc-dataseed1.binance.org";
export const BSC_RPCS = [
  BSC_RPC,
  "https://bsc-dataseed2.binance.org",
  "https://bsc-dataseed3.binance.org",
  "https://bsc-dataseed4.binance.org",
];

export const USDT_ADDRESS = "0x55d398326f99059fF775485246999027B3197955";

// ── Deployment state ────────────────────────────────────────────────────────
export const CONTRACTS_DEPLOYED = true;

// Global platform contracts — all live on BSC mainnet
export const FLAP_PLATFORM_ADDRESS  = "0xFcB317630C77bB730C52A81e6ACbD6456DB69930"; // FlapPlatform.sol
export const FLAP_ORACLE_ADDRESS    = "0x04e6D0C5c6b4BB583345c2980b8122f36BdA8144"; // FlapOracle.sol
export const FLAP_FUNDING_ADDRESS   = "0x8eaeafdad4710585d5ad2446de3d4106023f19cf"; // FlapFunding.sol
export const FLAP_FACTORY_ADDRESS   = "0x1dc8F38d5FC5D51F5cff93a0658655F05651E990"; // FlapFactory.sol
// Implementation contracts (EIP-1167 clone targets — do not interact directly)
export const FLAP_VAULT_IMPL        = "0x8c99C89D6557ef8ed7F112f20dB7B27f811656ae"; // FlapVaultImpl
export const FLAP_PERPS_IMPL        = "0x1Ecb2DbC9b5Ef60CF83d7556337266CECEFC8EE3"; // FlapPerpsImpl

// PancakeSwap v2 pair for FLAP/USDT — used for DexScreener OHLCV chart
export const FLAP_PANCAKE_POOL = "";

// ── Contract architecture ──────────────────────────────────────────────────────
//
//  GLOBAL (deployed once by platform owner):
//  ┌─────────────────────────────────────────────────────────────────────────┐
//  │ FlapPlatform  — admin wallet + receives 20% of trade fees and 20% of   │
//  │                 liquidation penalties.                                  │
//  │ FlapOracle    — botOperator pushes live DexScreener prices here.        │
//  │                 PerpMarket reads from this on every open/close.         │
//  │ FlapFunding   — bot calls settle() every 8 hours per market.            │
//  │                 Charges the heavier side (longs vs shorts) a funding    │
//  │                 rate, pays the lighter side. 10% of funding → platform. │
//  │ FlapFactory   — deploys FlapVault + FlapPerps pair per market.          │
//  └─────────────────────────────────────────────────────────────────────────┘
//
//  PER-MARKET (deployed by FlapFactory.register() per token):
//  ┌─────────────────────────────────────────────────────────────────────────┐
//  │ FlapVault     — holds TWO balances for one market:                      │
//  │                 (1) vaultBalance    — backs trader payouts              │
//  │                 (2) insuranceBalance — creator-owned backstop,          │
//  │                     auto-topped by liquidation 50% cut,                 │
//  │                     locked until vaultUnlocksAt (same as vault),        │
//  │                     withdrawable by creator after unlock.               │
//  │                 Insurance is NOT a separate contract — it lives here.   │
//  │ FlapPerps     — trading engine. open/close/liquidate, PnL, funding,     │
//  │                 distributes 80% fee to opener, 20% to platform.         │
//  └─────────────────────────────────────────────────────────────────────────┘
//
// Deploy order:
//   1. FlapPlatform(adminWallet, botWallet, USDT, factory=0, oracle=0, funding=0)  ← deploy first; its address = platformFeeWallet everywhere
//   2. FlapOracle(botWallet)
//   3. FlapFunding(botWallet, platformAddress, USDT)
//   4. FlapFactory(botWallet, platformAddress, adminWallet, USDT, oracleAddr, fundingAddr)
//   5. FlapPlatform.setFactory(factoryAddr) + .setOracle(oracleAddr) + .setFunding(fundingAddr)  [from admin wallet]
//   6. FlapFunding.setPlatformContract(platformAddr)  [from bot wallet]  ← enables FlapPlatform to propagate admin changes
export const FFX_CONTRACTS = {
  PLATFORM:   "0xFcB317630C77bB730C52A81e6ACbD6456DB69930", // FlapPlatform.sol
  ORACLE:     "0x04e6D0C5c6b4BB583345c2980b8122f36BdA8144", // FlapOracle.sol
  FUNDING:    "0x8eaeafdad4710585d5ad2446de3d4106023f19cf", // FlapFunding.sol
  FACTORY:    "0x1dc8F38d5FC5D51F5cff93a0658655F05651E990", // FlapFactory.sol
  VAULT_IMPL: "0x8c99C89D6557ef8ed7F112f20dB7B27f811656ae", // FlapVaultImpl (clone target)
  PERPS_IMPL: "0x1Ecb2DbC9b5Ef60CF83d7556337266CECEFC8EE3", // FlapPerpsImpl (clone target)
  // Per-market vault/perps addresses come from DB (set by FlapFactory on createMarket)
} as const;

// Bot operator wallet — pushes oracle prices, calls liquidate(), settle()
// Receives 30% of liquidation penalties as gas incentive
export const BOT_WALLET = "0xd8AE9A69FD6Fe0e1B3D40F32D6E2E4A10894e118";

// ── ABIs matched exactly to contracts/FlapPerps.sol + FlapVault.sol etc. ──────

export const USDT_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function transfer(address to, uint256 amount) external returns (bool)",
];

// FlapVault.sol — per-market vault, creator deposits/withdraws here
// Insurance is creator-owned and locked until vaultUnlocksAt (same gate as vault)
export const VAULT_ABI = [
  // Creator actions
  "function depositVault(uint256 amount) external",
  "function depositInsurance(uint256 amount) external",
  "function requestWithdrawal() external",       // initiates withdrawal (vault + insurance)
  "function completeWithdrawal() external",      // callable only after vaultLockedUntil
  "function checkHealth() external",
  // Called by FlapPerps.liquidate() — routes 50% of remaining margin into insurance
  "function addToInsurance(uint256 amount) external",
  // Platform admin emergency recovery — bypasses lock, closes market permanently
  "function emergencyWithdraw(address to) external",
  // Platform wiring (set once by factory; enables FlapPlatform master access)
  "function setPlatformContract(address _platform) external",
  // State reads
  "function vaultBalance() external view returns (uint256)",
  "function insuranceBalance() external view returns (uint256)",
  "function vaultLockedUntil() external view returns (uint256)",
  "function insuranceLockedUntil() external view returns (uint256)",
  "function lockDuration() external view returns (uint256)",
  "function marketClosed() external view returns (bool)",
  "function isFrozen() external view returns (bool)",
  "function isWithdrawable() external view returns (bool)",
  "function isWithdrawalBlocked() external view returns (bool)",
  "function withdrawalRequested() external view returns (bool)",
  "function getHealth() external view returns (uint8)",
  "function trustBadge() external view returns (uint8)",
  "function trustBadgeName() external view returns (string)",
  "function opener() external view returns (address)",
  "function platformAdmin() external view returns (address)",
  "function platformContract() external view returns (address)",
  "function frozenAt() external view returns (uint256)",
];

// FlapPerps.sol — per-market trading engine
export const PERPS_ABI = [
  // Trader actions — margin first, then leverage (uint8), then direction
  "function openPosition(uint256 margin, uint8 leverage, bool isLong) external",
  "function closePosition(uint256 positionId) external",
  "function liquidate(uint256 positionId) external",
  // Opener action
  "function claimFees() external",
  // Position reads
  "function positions(uint256 positionId) external view returns (address trader, uint256 margin, uint8 leverage, bool isLong, uint256 entryPrice, uint256 size, uint256 openedAt, bool isOpen, int256 fundingAccrued)",
  "function traderPositions(address trader) external view returns (uint256[])",
  "function getPosition(uint256 positionId) external view returns (address trader, uint256 margin, uint8 leverage, bool isLong, uint256 entryPrice, uint256 size, uint256 openedAt, bool isOpen, int256 fundingAccrued)",
  "function getUnrealizedPnl(uint256 positionId) external view returns (int256)",
  "function isLiquidatable(uint256 positionId) external view returns (bool)",
  // Market stats
  "function getCurrentParams() external view returns (uint256 spread, uint8 maxLeverage, uint256 maxPosition, uint256 maxOI, uint256 currentOI)",
  "function getLongRatio() external view returns (uint256)",
  "function getTotalOI() external view returns (uint256)",
  "function getOpenPositionCount() external view returns (uint256)",
  "function pendingOpenerFees() external view returns (uint256)",
  "function totalLongOI() external view returns (uint256)",
  "function totalShortOI() external view returns (uint256)",
  "function openPositionCount() external view returns (uint256)",
  "function nextPositionId() external view returns (uint256)",
  // Config reads
  "function opener() external view returns (address)",
  "function platformFeeWallet() external view returns (address)",
  "function botOperator() external view returns (address)",
  "function emergencyPaused() external view returns (bool)",
  "function paramsLocked() external view returns (bool)",
  // Platform admin emergency recovery — drains all USDT from this contract
  "function emergencyDrain(address to) external",
  // Platform wiring (set once by factory; enables FlapPlatform master access)
  "function setPlatformContract(address _platform) external",
  "function platformContract() external view returns (address)",
  "function factory() external view returns (address)",
  "function TRADE_FEE_BPS() external view returns (uint256)",
  "function MIN_TRADE_FEE() external view returns (uint256)",
  "function LIQ_THRESHOLD_BPS() external view returns (uint256)",
];

// FlapOracle.sol — global, botOperator pushes prices
export const ORACLE_ABI = [
  "function updatePrice(address token, uint256 price, uint256 mcap, uint256 liquidity) external",
  "function updatePriceBatch(address[] calldata tokens, uint256[] calldata prices, uint256[] calldata mcaps, uint256[] calldata liquidities) external",
  "function getPrice(address token) external view returns (uint256)",
  "function getMcap(address token) external view returns (uint256)",
  "function getFeed(address token) external view returns (uint256 price, uint256 mcap, uint256 liquidity, uint256 updatedAt, bool isStale)",
  "function isFresh(address token) external view returns (bool)",
  "function botOperator() external view returns (address)",
  "function initiateOperatorTransfer(address newOperator) external",
  "function acceptOperatorTransfer() external",
];

// FlapFunding.sol — global, botOperator calls settle() per market
export const FUNDING_ABI = [
  "function settle(address perps) external",
  "function registerMarket(address perps) external",
  "function nextSettlementTime(address perps) external view returns (uint256)",
  "function canSettle(address perps) external view returns (bool)",
  "function botOperator() external view returns (address)",
  "function platformFeeWallet() external view returns (address)",
  "function platformContract() external view returns (address)",
  // Called once by bot after FlapPlatform is deployed — enables FlapPlatform to propagate admin changes
  "function setPlatformContract(address _platform) external",
  "function setBotOperator(address newBot) external",
  "function setPlatformFeeWallet(address newWallet) external",
];

// NOTE: No separate FlapLiquidation contract — liquidation split is handled inside
// FlapPerps.liquidate(positionId): 50% → vault.addToInsurance(), 30% → caller (bot), 20% → platformFeeWallet

// FlapPlatform.sol — admin contract, fee management + market controls
export const PLATFORM_ABI = [
  // Fee withdrawal
  "function withdrawFees(address to) external",
  "function withdrawFeesPartial(address to, uint256 amount) external",
  // Market controls
  "function emergencyPauseMarket(address perps) external",
  "function emergencyUnpauseMarket(address perps) external",
  "function setMarketParamsLocked(address perps, bool locked) external",
  // Nuclear recovery — pulls ALL USDT from every vault + perps in one tx (bypasses locks)
  "function emergencyWithdrawAll(address[] calldata vaults, address[] calldata perpsContracts, address to) external",
  // Bot operator
  "function setBotOperator(address newBot) external",
  // Address updates
  "function setFactory(address newFactory) external",
  "function setOracle(address newOracle) external",
  "function setFunding(address newFunding) external",
  "function migratePlatformFeeWallet(address newWallet) external",
  // Admin transfer (two-step)
  "function transferAdmin(address newAdmin) external",
  "function acceptAdmin() external",
  // Market launch (creator entry point)
  "function launchMarket(address tokenAddress, uint256 lockDays, uint256 vaultAmount, uint256 insuranceAmount, uint256 refreshInterval) external payable returns (address vault, address perps)",
  // Views
  "function admin() external view returns (address)",
  "function pendingAdmin() external view returns (address)",
  "function botOperator() external view returns (address)",
  "function factory() external view returns (address)",
  "function oracle() external view returns (address)",
  "function funding() external view returns (address)",
  "function collateralToken() external view returns (address)",
  "function pendingFees() external view returns (uint256)",
  "function lifetimeFees() external view returns (uint256)",
  "function totalFeesWithdrawn() external view returns (uint256)",
];
