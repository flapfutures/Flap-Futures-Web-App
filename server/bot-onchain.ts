/**
 * FFX Bot On-Chain Module
 *
 * Architecture:
 *   Platform bot (BOT_PRIVATE_KEY) — admin tasks:
 *     - deployMarketContracts()  deploy FFXVault + FFXPerps via FFXFactory
 *     - generateMarketBotWallet() create a fresh wallet for each market
 *     - settleFunding()          FFXFunding.settle() every 8h per market
 *     - scanAndLiquidate()       FFXPerps.liquidate() for underwater positions
 *     - executeTpSl()            FFXPerps.executeTpSl() when price hits TP/SL
 *     - executeLimitOrders()     FFXPerps.executeLimitOrder() when price hits limit
 *
 *   Per-market bot (stored in DB as marketBotPrivkey) — oracle only:
 *     - pushOraclePrice()        FFXOracle.updatePrice() at creator's chosen interval
 *
 * All functions are no-ops when FFX_FACTORY env var is not set.
 */

import { ethers } from "ethers";
import { log } from "./index";

// ── Constants ──────────────────────────────────────────────────────────────────

const BSC_RPC  = "https://bsc-dataseed1.binance.org";
const BSC_RPCS = [
  "https://bsc-dataseed1.binance.org",
  "https://bsc-dataseed2.binance.org",
  "https://bsc-dataseed3.binance.org",
];

// ── Minimal ABIs ──────────────────────────────────────────────────────────────

const ORACLE_ABI = [
  "function updatePrice(address token, uint256 price, uint256 mcap, uint256 liquidity) external",
  "function isFresh(address token) external view returns (bool)",
  "function platformBot() external view returns (address)",
  "function tokenBot(address token) external view returns (address)",
  "function setFactory(address factory) external",
  "function setTokenBot(address token, address bot) external",
  "function factory() external view returns (address)",
];

const FUNDING_ABI = [
  "function settle(address perps) external",
  "function markets(address perps) external view returns (uint256 lastSettled, bool registered)",
  "function registerMarket(address perps) external",
  "function setFactory(address factory) external",
  "function factory() external view returns (address)",
];

const FACTORY_ABI = [
  "function createMarket(address token, address opener, address botWallet, uint256 lockDuration, uint256 minVault) external returns (address vault, address perps)",
  "function markets(address token) external view returns (address vault, address perps, address botWallet, bool exists)",
  "function setPlatformContract(address p) external",
  "event MarketCreated(address indexed token, address indexed opener, address vault, address perps, address botWallet)",
];

const PERPS_ABI = [
  "function nextPositionId() external view returns (uint256)",
  "function nextLimitOrderId() external view returns (uint256)",
  "function getPosition(uint256 positionId) external view returns (address trader, uint256 margin, uint8 leverage, bool isLong, uint256 entryPrice, uint256 size, uint256 openedAt, bool isOpen, int256 fundingAccrued, uint8 marginMode, uint256 tpPrice, uint256 slPrice)",
  "function isLiquidatable(uint256 positionId) external view returns (bool)",
  "function liquidate(uint256 positionId) external",
  "function executeTpSl(uint256 positionId) external",
  "function getLimitOrder(uint256 orderId) external view returns (address trader, uint256 margin, uint8 leverage, bool isLong, uint256 limitPrice, uint8 marginMode, uint256 tpPrice, uint256 slPrice, bool filled, bool cancelled, uint256 createdAt)",
  "function executeLimitOrder(uint256 orderId) external",
  "function openPositionCount() external view returns (uint256)",
];

// ── Provider helpers ───────────────────────────────────────────────────────────

function getProvider(): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(BSC_RPC);
}

function getProviderWithFallback(): ethers.FallbackProvider {
  const providers = BSC_RPCS.map(rpc => new ethers.JsonRpcProvider(rpc));
  return new ethers.FallbackProvider(providers, 1);
}

// ── Platform bot wallet (lazy-init) ───────────────────────────────────────────

let _platformWallet: ethers.Wallet | null = null;

export function getPlatformWallet(): ethers.Wallet | null {
  if (_platformWallet) return _platformWallet;
  const pk = process.env.BOT_PRIVATE_KEY;
  if (!pk) {
    log("[bot-onchain] BOT_PRIVATE_KEY not set — skipping on-chain actions", "bot");
    return null;
  }
  try {
    const provider = getProvider();
    _platformWallet = new ethers.Wallet(pk, provider);
    log(`[bot-onchain] platform wallet ready — ${_platformWallet.address}`, "bot");
    return _platformWallet;
  } catch (err: any) {
    log(`[bot-onchain] invalid BOT_PRIVATE_KEY: ${err?.message}`, "bot");
    return null;
  }
}

// ── Platform contract addresses (from env) ────────────────────────────────────

function platformAddrs() {
  return {
    oracle:  process.env.FFX_ORACLE  || "",
    funding: process.env.FFX_FUNDING || "",
    factory: process.env.FFX_FACTORY || "",
  };
}

// ── Per-market bot wallet generation ──────────────────────────────────────────

/**
 * Generate a fresh Ethereum wallet for a new market.
 * Returns { address, privateKey } — store privateKey encrypted in DB.
 */
export function generateMarketBotWallet(): { address: string; privateKey: string } {
  const wallet = ethers.Wallet.createRandom();
  log(`[bot-onchain] generated market bot wallet — ${wallet.address}`, "bot");
  return { address: wallet.address, privateKey: wallet.privateKey };
}

/**
 * Get a signer for a per-market bot wallet using its stored private key.
 */
function getMarketBotWallet(privateKey: string): ethers.Wallet | null {
  try {
    const provider = getProvider();
    return new ethers.Wallet(privateKey, provider);
  } catch (err: any) {
    log(`[bot-onchain] invalid market bot key: ${err?.message}`, "bot");
    return null;
  }
}

// ── 1. Deploy per-market contracts via FFXFactory ─────────────────────────────

/**
 * Deploy FFXVault + FFXPerps for a new market.
 * Automatically generates a per-market bot wallet.
 *
 * @param tokenAddress  Token address for the market
 * @param openerWallet  Creator wallet address
 * @param lockDays      Vault lock duration (7, 30, 90, 180)
 * @param minVaultUsdt  Minimum vault in USDT (e.g. 50 for $50)
 * @returns { vault, perps, botWallet, botPrivkey } or null on failure
 */
export async function deployMarketContracts(
  tokenAddress: string,
  openerWallet: string,
  lockDays: number,
  minVaultUsdt: number = 50,
  existingBotWallet?: string,
  existingBotPrivkey?: string,
): Promise<{ vault: string; perps: string; botWallet: string; botPrivkey: string } | null> {
  const { factory } = platformAddrs();
  if (!factory) {
    log("[bot-onchain] FFX_FACTORY not set — cannot deploy market contracts", "bot");
    return null;
  }

  const platformWallet = getPlatformWallet();
  if (!platformWallet) return null;

  const readContract = new ethers.Contract(factory, FACTORY_ABI, platformWallet.provider);

  // Check if contracts already exist on-chain (recovery path)
  try {
    const existing = await readContract.markets(tokenAddress);
    if (existing.exists) {
      const vault     = existing.vault     as string;
      const perps     = existing.perps     as string;
      const botWallet = existing.botWallet as string;
      log(`[bot-onchain] market already on-chain for ${tokenAddress.slice(0,8)}… — reusing vault=${vault.slice(0,8)}… perps=${perps.slice(0,8)}…`, "bot");
      // We can't recover the private key from on-chain, return without privkey
      return { vault, perps, botWallet, botPrivkey: existingBotPrivkey ?? "" };
    }
  } catch {
    // getter failed — proceed with fresh deployment
  }

  // Reuse the wallet generated at market creation time, or generate a new one if missing
  let botWallet: string;
  let botPrivkey: string;
  if (existingBotWallet && existingBotPrivkey) {
    botWallet  = existingBotWallet;
    botPrivkey = existingBotPrivkey;
    log(`[bot-onchain] reusing pre-generated bot wallet ${botWallet.slice(0,8)}… for ${tokenAddress.slice(0,8)}…`, "bot");
  } else {
    const fresh = generateMarketBotWallet();
    botWallet  = fresh.address;
    botPrivkey = fresh.privateKey;
  }

  // lockDuration in seconds
  const lockSeconds = BigInt(lockDays * 86400);
  const minVaultWei = ethers.parseUnits(minVaultUsdt.toString(), 18);

  try {
    const contract = new ethers.Contract(factory, FACTORY_ABI, platformWallet);
    log(`[bot-onchain] deploying FFXVault+FFXPerps for ${tokenAddress.slice(0,8)}… botWallet=${botWallet.slice(0,8)}…`, "bot");

    const tx = await contract.createMarket(
      tokenAddress,
      openerWallet,
      botWallet,
      lockSeconds,
      minVaultWei,
      { gasLimit: 4_000_000 }
    );
    const receipt = await tx.wait();

    // Parse MarketCreated event
    const iface = new ethers.Interface(FACTORY_ABI);
    for (const log_ of receipt.logs) {
      try {
        const parsed = iface.parseLog(log_);
        if (parsed && parsed.name === "MarketCreated") {
          const vault = parsed.args.vault as string;
          const perps = parsed.args.perps as string;
          log(`[bot-onchain] deployed — vault=${vault.slice(0,8)}… perps=${perps.slice(0,8)}… bot=${botWallet.slice(0,8)}…`, "bot");
          // Auto-verify both clones on BSCScan (fire-and-forget)
          bscscanVerifyProxy(vault).catch(() => {});
          bscscanVerifyProxy(perps).catch(() => {});
          return { vault, perps, botWallet, botPrivkey };
        }
      } catch {}
    }

    log("[bot-onchain] createMarket tx succeeded but MarketCreated event not found", "bot");
    return null;
  } catch (err: any) {
    // Revert — try recovery one more time
    try {
      const existing = await readContract.markets(tokenAddress);
      if (existing.exists) {
        const vault     = existing.vault     as string;
        const perps     = existing.perps     as string;
        const existBot  = existing.botWallet as string;
        log(`[bot-onchain] createMarket reverted but market exists — recovering vault=${vault.slice(0,8)}…`, "bot");
        return { vault, perps, botWallet: existBot, botPrivkey: "" };
      }
    } catch {}
    const msg = err?.reason || err?.shortMessage || err?.message || String(err);
    log(`[bot-onchain] deployMarketContracts failed: ${msg.slice(0, 120)}`, "bot");
    return null;
  }
}

// ── 2. Push oracle price (per-market bot) ─────────────────────────────────────

/**
 * Push price to FFXOracle using the per-market bot wallet.
 * Falls back to platform wallet if per-market wallet is not available.
 *
 * @param tokenAddress   Token address
 * @param priceUsd       USD price (float)
 * @param mcap           Market cap USD
 * @param liquidityUsd   Liquidity USD
 * @param marketBotPrivkey  Per-market bot wallet private key (stored in DB)
 */
export async function pushOraclePrice(
  tokenAddress: string,
  priceUsd: number,
  mcap: number,
  liquidityUsd: number,
  marketBotPrivkey?: string,
): Promise<void> {
  const { oracle } = platformAddrs();
  if (!oracle) return;

  // Use per-market bot if key available, else fall back to platform bot
  let signer: ethers.Wallet | null = null;
  if (marketBotPrivkey) {
    signer = getMarketBotWallet(marketBotPrivkey);
  }
  if (!signer) {
    signer = getPlatformWallet();
  }
  if (!signer) return;

  try {
    const contract = new ethers.Contract(oracle, ORACLE_ABI, signer);

    const priceWei     = ethers.parseUnits(priceUsd.toFixed(18), 18);
    const mcapWei      = BigInt(Math.floor(mcap));
    const liquidityWei = BigInt(Math.floor(liquidityUsd));

    const tx = await contract.updatePrice(tokenAddress, priceWei, mcapWei, liquidityWei, {
      gasLimit: 150_000,
    });
    log(`[bot-onchain] oracle.updatePrice ${tokenAddress.slice(0,8)}… tx ${tx.hash.slice(0,10)}… (${signer.address.slice(0,8)}…)`, "bot");
  } catch (err: any) {
    const msg = err?.reason || err?.shortMessage || err?.message || String(err);
    log(`[bot-onchain] oracle.updatePrice failed: ${msg.slice(0, 120)}`, "bot");
  }
}

// ── 3. Settle funding (platform bot) ─────────────────────────────────────────

export async function settleFunding(perpsAddress: string): Promise<void> {
  const { funding } = platformAddrs();
  if (!funding || !perpsAddress) return;

  const wallet = getPlatformWallet();
  if (!wallet) return;

  try {
    const contract = new ethers.Contract(funding, FUNDING_ABI, wallet);
    const mf = await contract.markets(perpsAddress);
    if (!mf.registered) return;

    const FUNDING_INTERVAL = 8 * 3600;
    const now = Math.floor(Date.now() / 1000);
    if (now < Number(mf.lastSettled) + FUNDING_INTERVAL) return;

    const tx = await contract.settle(perpsAddress, { gasLimit: 250_000 });
    log(`[bot-onchain] funding.settle ${perpsAddress.slice(0,8)}… tx ${tx.hash.slice(0,10)}…`, "bot");
  } catch (err: any) {
    const msg = err?.reason || err?.shortMessage || err?.message || String(err);
    log(`[bot-onchain] funding.settle failed: ${msg.slice(0, 120)}`, "bot");
  }
}

// ── 4. Scan and liquidate (platform bot) ─────────────────────────────────────

export async function scanAndLiquidate(perpsAddress: string): Promise<void> {
  if (!perpsAddress) return;

  const wallet = getPlatformWallet();
  if (!wallet) return;

  try {
    const contract = new ethers.Contract(perpsAddress, PERPS_ABI, wallet);
    const nextId   = Number(await contract.nextPositionId());
    if (nextId === 0) return;

    const startId = Math.max(0, nextId - 500);
    let liquidated = 0;

    for (let posId = startId; posId < nextId; posId++) {
      try {
        const pos = await contract.getPosition(BigInt(posId));
        if (!pos.isOpen) continue;
        const eligible = await contract.isLiquidatable(BigInt(posId));
        if (!eligible) continue;
        const tx = await contract.liquidate(BigInt(posId), { gasLimit: 300_000 });
        log(`[bot-onchain] liquidated posId=${posId} on ${perpsAddress.slice(0,8)}… tx ${tx.hash.slice(0,10)}…`, "bot");
        liquidated++;
        await new Promise(r => setTimeout(r, 500));
      } catch {}
    }

    if (liquidated > 0) {
      log(`[bot-onchain] ${liquidated} position(s) liquidated on ${perpsAddress.slice(0,8)}…`, "bot");
    }
  } catch (err: any) {
    const msg = err?.reason || err?.shortMessage || err?.message || String(err);
    log(`[bot-onchain] scanAndLiquidate failed for ${perpsAddress}: ${msg.slice(0, 120)}`, "bot");
  }
}

// ── 5. Execute TP/SL (platform bot) ──────────────────────────────────────────

/**
 * Scan open positions for TP/SL hits and execute them.
 * Run on every price tick for each LIVE market.
 */
export async function executeTpSlPositions(
  perpsAddress: string,
  currentPrice: number,
): Promise<void> {
  if (!perpsAddress) return;

  const wallet = getPlatformWallet();
  if (!wallet) return;

  try {
    const contract = new ethers.Contract(perpsAddress, PERPS_ABI, wallet);
    const nextId   = Number(await contract.nextPositionId());
    if (nextId === 0) return;

    const startId = Math.max(0, nextId - 500);
    const priceWei = BigInt(Math.floor(currentPrice * 1e18));

    for (let posId = startId; posId < nextId; posId++) {
      try {
        const pos = await contract.getPosition(BigInt(posId));
        if (!pos.isOpen) continue;

        const tp = BigInt(pos.tpPrice);
        const sl = BigInt(pos.slPrice);
        if (tp === 0n && sl === 0n) continue;

        let shouldTrigger = false;
        if (tp > 0n) {
          if (pos.isLong  && priceWei >= tp) shouldTrigger = true;
          if (!pos.isLong && priceWei <= tp) shouldTrigger = true;
        }
        if (sl > 0n) {
          if (pos.isLong  && priceWei <= sl) shouldTrigger = true;
          if (!pos.isLong && priceWei >= sl) shouldTrigger = true;
        }

        if (shouldTrigger) {
          const tx = await contract.executeTpSl(BigInt(posId), { gasLimit: 300_000 });
          log(`[bot-onchain] executeTpSl posId=${posId} on ${perpsAddress.slice(0,8)}… tx ${tx.hash.slice(0,10)}…`, "bot");
          await new Promise(r => setTimeout(r, 300));
        }
      } catch {}
    }
  } catch (err: any) {
    const msg = err?.reason || err?.shortMessage || err?.message || String(err);
    log(`[bot-onchain] executeTpSl failed for ${perpsAddress}: ${msg.slice(0, 120)}`, "bot");
  }
}

// ── 6. Execute limit orders (platform bot) ────────────────────────────────────

/**
 * Scan pending limit orders and execute any that match current price.
 * Run on every price tick for each LIVE market.
 */
export async function executeLimitOrders(
  perpsAddress: string,
  currentPrice: number,
): Promise<void> {
  if (!perpsAddress) return;

  const wallet = getPlatformWallet();
  if (!wallet) return;

  try {
    const contract = new ethers.Contract(perpsAddress, PERPS_ABI, wallet);
    const nextOrderId = Number(await contract.nextLimitOrderId());
    if (nextOrderId === 0) return;

    const startId  = Math.max(0, nextOrderId - 200);
    const priceWei = BigInt(Math.floor(currentPrice * 1e18));

    for (let orderId = startId; orderId < nextOrderId; orderId++) {
      try {
        const lo = await contract.getLimitOrder(BigInt(orderId));
        if (lo.filled || lo.cancelled) continue;

        const limitPrice = BigInt(lo.limitPrice);
        let shouldExecute = false;
        // Long: execute when market price <= limit (buy low)
        if (lo.isLong  && priceWei <= limitPrice) shouldExecute = true;
        // Short: execute when market price >= limit (sell high)
        if (!lo.isLong && priceWei >= limitPrice) shouldExecute = true;

        if (shouldExecute) {
          const tx = await contract.executeLimitOrder(BigInt(orderId), { gasLimit: 400_000 });
          log(`[bot-onchain] executeLimitOrder orderId=${orderId} on ${perpsAddress.slice(0,8)}… tx ${tx.hash.slice(0,10)}…`, "bot");
          await new Promise(r => setTimeout(r, 300));
        }
      } catch {}
    }
  } catch (err: any) {
    const msg = err?.reason || err?.shortMessage || err?.message || String(err);
    log(`[bot-onchain] executeLimitOrders failed for ${perpsAddress}: ${msg.slice(0, 120)}`, "bot");
  }
}

// ── 7. One-time post-deploy setup ─────────────────────────────────────────────

/**
 * Wire factory address into Oracle + Funding after initial platform deployment.
 * Run ONCE after all platform contracts are deployed on mainnet.
 * Safe to re-run — each call is idempotent (checks current value first).
 *
 * Required env vars: FFX_ORACLE, FFX_FUNDING, FFX_FACTORY, FFX_PLATFORM
 */
export async function setupPlatformLinks(): Promise<void> {
  const { oracle, funding, factory } = platformAddrs();
  const platform = process.env.FFX_PLATFORM || "";

  if (!oracle || !funding || !factory) {
    log("[bot-onchain] setupPlatformLinks: missing env vars (FFX_ORACLE / FFX_FUNDING / FFX_FACTORY)", "bot");
    return;
  }

  const wallet = getPlatformWallet();
  if (!wallet) return;

  const oracleContract  = new ethers.Contract(oracle,  ORACLE_ABI,  wallet);
  const fundingContract = new ethers.Contract(funding, FUNDING_ABI, wallet);
  const factoryContract = new ethers.Contract(factory, FACTORY_ABI, wallet);

  try {
    // 1. oracle.setFactory(factory) — allows factory to call setTokenBot
    const currentOracleFactory = await oracleContract.factory();
    if (currentOracleFactory.toLowerCase() !== factory.toLowerCase()) {
      const tx = await oracleContract.setFactory(factory, { gasLimit: 100_000 });
      await tx.wait();
      log(`[bot-onchain] oracle.setFactory(${factory.slice(0,8)}…) done`, "bot");
    } else {
      log("[bot-onchain] oracle.factory already set — skipping", "bot");
    }
  } catch (err: any) {
    log(`[bot-onchain] oracle.setFactory failed: ${err?.message?.slice(0, 80)}`, "bot");
  }

  try {
    // 2. funding.setFactory(factory) — allows factory to call registerMarket
    const currentFundingFactory = await fundingContract.factory();
    if (currentFundingFactory.toLowerCase() !== factory.toLowerCase()) {
      const tx = await fundingContract.setFactory(factory, { gasLimit: 100_000 });
      await tx.wait();
      log(`[bot-onchain] funding.setFactory(${factory.slice(0,8)}…) done`, "bot");
    } else {
      log("[bot-onchain] funding.factory already set — skipping", "bot");
    }
  } catch (err: any) {
    log(`[bot-onchain] funding.setFactory failed: ${err?.message?.slice(0, 80)}`, "bot");
  }

  if (platform) {
    try {
      // 3. factory.setPlatformContract(platform) — allows platform to pause/drain markets
      const tx = await factoryContract.setPlatformContract(platform, { gasLimit: 100_000 });
      await tx.wait();
      log(`[bot-onchain] factory.setPlatformContract(${platform.slice(0,8)}…) done`, "bot");
    } catch (err: any) {
      // May revert if already set — that is fine
      log(`[bot-onchain] factory.setPlatformContract: ${err?.message?.slice(0, 80)} (may already be set)`, "bot");
    }
  }

  log("[bot-onchain] setupPlatformLinks complete", "bot");
}

// ── 8. BSCScan proxy auto-verification ───────────────────────────────────────

/**
 * Notify BSCScan that `address` is an EIP-1167 proxy.
 * Once the implementation is verified, BSCScan will instantly link and
 * show full Read/Write tabs for every clone.
 * Requires BSCSCAN_API_KEY env var.
 */
export async function bscscanVerifyProxy(address: string): Promise<void> {
  const apiKey = process.env.BSCSCAN_API_KEY;
  if (!apiKey) return;

  try {
    const params = new URLSearchParams({
      module:  "contract",
      action:  "verifyproxycontract",
      address,
      apikey:  apiKey,
    });
    const res  = await fetch(`https://api.etherscan.io/v2/api?chainid=56`, {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    params.toString(),
    });
    const json = await res.json() as any;
    const guid = json?.result || "";
    if (!guid || json?.status !== "1") {
      log(`[bot-onchain] bscscan proxy verify submit failed for ${address.slice(0,8)}…: ${json?.result}`, "bot");
      return;
    }
    // Poll once after 12 s
    await new Promise(r => setTimeout(r, 12_000));
    const poll = await fetch(
      `https://api.etherscan.io/v2/api?chainid=56&module=contract&action=checkproxyverification&guid=${guid}&apikey=${apiKey}`
    );
    const pollJson = await poll.json() as any;
    log(`[bot-onchain] bscscan proxy verify ${address.slice(0,8)}…: ${pollJson?.result?.slice(0, 80)}`, "bot");
  } catch (err: any) {
    log(`[bot-onchain] bscscan proxy verify error: ${err?.message?.slice(0, 80)}`, "bot");
  }
}

// ── Startup check ──────────────────────────────────────────────────────────────

export function initBotWallet(): void {
  getPlatformWallet();
}
