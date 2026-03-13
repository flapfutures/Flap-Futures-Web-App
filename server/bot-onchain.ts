/**
 * Bot On-Chain Module
 *
 * Uses BOT_PRIVATE_KEY to sign and broadcast transactions on BSC:
 *   1. pushOraclePrice()  — FlapOracle.updatePrice() after every DexScreener refresh
 *   2. settleFunding()    — FlapFunding.settle(perpsAddr) each funding interval
 *   3. scanAndLiquidate() — FlapPerps.liquidate(posId) for every underwater position
 *
 * All functions are no-ops when contracts are not deployed yet (empty addresses).
 */

import { ethers } from "ethers";
import { log } from "./index";

// ── Constants (mirrors client/src/lib/perps-contracts.ts) ─────────────────────

const BSC_RPC     = "https://bsc-dataseed1.binance.org";
const USDT_BSC    = "0x55d398326f99059fF775485246999027B3197955";
const BOT_ADDRESS = "0xd8AE9A69FD6Fe0e1B3D40F32D6E2E4A10894e118";

// ── Minimal ABIs needed by the bot ────────────────────────────────────────────

const ORACLE_ABI = [
  "function updatePrice(address token, uint256 price, uint256 mcap, uint256 liquidity) external",
  "function isFresh(address token) external view returns (bool)",
  "function botOperator() external view returns (address)",
];

const FUNDING_ABI = [
  "function settle(address perps) external",
  "function canSettle(address perps) external view returns (bool)",
];

const PERPS_ABI = [
  "function nextPositionId() external view returns (uint256)",
  "function positions(uint256 positionId) external view returns (address trader, uint256 margin, uint8 leverage, bool isLong, uint256 entryPrice, uint256 size, uint256 openedAt, bool isOpen, int256 fundingAccrued)",
  "function isLiquidatable(uint256 positionId) external view returns (bool)",
  "function liquidate(uint256 positionId) external",
  "function openPositionCount() external view returns (uint256)",
];

const FACTORY_ABI = [
  "function createMarket(address tokenAddress, address openerWallet, uint256 lockDays) external returns (address vault, address perps)",
  "event MarketCreated(address indexed token, address indexed opener, address vault, address perps, uint256 lockDuration)",
];

// ── Shared provider + wallet (lazy-init) ──────────────────────────────────────

let _wallet: ethers.Wallet | null = null;

function getWallet(): ethers.Wallet | null {
  if (_wallet) return _wallet;
  const pk = process.env.BOT_PRIVATE_KEY;
  if (!pk) {
    log("[bot-onchain] BOT_PRIVATE_KEY not set — skipping all on-chain actions", "bot");
    return null;
  }
  try {
    const provider = new ethers.JsonRpcProvider(BSC_RPC);
    _wallet = new ethers.Wallet(pk, provider);
    // Verify the address matches expected
    if (_wallet.address.toLowerCase() !== BOT_ADDRESS.toLowerCase()) {
      log(`[bot-onchain] WARNING — private key address ${_wallet.address} does not match expected ${BOT_ADDRESS}`, "bot");
    } else {
      log(`[bot-onchain] wallet ready — ${BOT_ADDRESS}`, "bot");
    }
    return _wallet;
  } catch (err: any) {
    log(`[bot-onchain] invalid BOT_PRIVATE_KEY: ${err?.message}`, "bot");
    return null;
  }
}

// ── Addresses read from env at runtime (set after contracts are deployed) ──────
// These are populated server-side via env vars; the client perps-contracts.ts
// has the same values for display-only. Keep them in sync after deployment.

function contractAddresses() {
  return {
    oracle:   process.env.FFX_ORACLE   || "",
    funding:  process.env.FFX_FUNDING  || "",
    factory:  process.env.FFX_FACTORY  || "",
  };
}

// ── 4. Deploy per-market contracts via FlapFactory ─────────────────────────────

/**
 * Bot calls FlapFactory.createMarket() on behalf of a creator who skipped payment.
 * Deploys FlapVault + FlapPerps for the token, returns contract addresses.
 *
 * @param tokenAddress  Token address for the market
 * @param openerWallet  Creator's wallet address
 * @param lockDays      Vault lock duration (7, 30, 90, or 180)
 */
export async function deployMarketContracts(
  tokenAddress: string,
  openerWallet: string,
  lockDays: number,
): Promise<{ vault: string; perps: string } | null> {
  const { factory } = contractAddresses();
  if (!factory) {
    log("[bot-onchain] FFX_FACTORY not set — cannot deploy market contracts", "bot");
    return null;
  }

  const wallet = getWallet();
  if (!wallet) return null;

  try {
    const contract = new ethers.Contract(factory, FACTORY_ABI, wallet);
    log(`[bot-onchain] deploying contracts for ${tokenAddress.slice(0, 8)}… opener=${openerWallet.slice(0, 8)}…`, "bot");

    const tx = await contract.createMarket(tokenAddress, openerWallet, BigInt(lockDays), {
      gasLimit: 3_000_000,
    });
    const receipt = await tx.wait();

    // Parse MarketCreated event to get vault + perps addresses
    const iface = new ethers.Interface(FACTORY_ABI);
    for (const log_ of receipt.logs) {
      try {
        const parsed = iface.parseLog(log_);
        if (parsed && parsed.name === "MarketCreated") {
          const vault = parsed.args.vault as string;
          const perps = parsed.args.perps as string;
          log(`[bot-onchain] contracts deployed — vault=${vault.slice(0, 8)}… perps=${perps.slice(0, 8)}…`, "bot");
          return { vault, perps };
        }
      } catch {}
    }

    log(`[bot-onchain] createMarket tx succeeded but MarketCreated event not found in receipt`, "bot");
    return null;
  } catch (err: any) {
    const msg = err?.reason || err?.shortMessage || err?.message || String(err);
    log(`[bot-onchain] deployMarketContracts failed: ${msg.slice(0, 120)}`, "bot");
    return null;
  }
}

// ── 1. Push oracle price ───────────────────────────────────────────────────────

/**
 * Push a fresh price into FlapOracle for a given token.
 * Called after every successful DexScreener fetch in price-bot.ts.
 *
 * @param tokenAddress  Token contract address (BSC)
 * @param priceUsd      Price in USD (floating-point, e.g. 0.0001804)
 * @param mcap          Market cap in USD
 * @param liquidityUsd  Liquidity in USD
 */
export async function pushOraclePrice(
  tokenAddress: string,
  priceUsd: number,
  mcap: number,
  liquidityUsd: number,
): Promise<void> {
  const { oracle } = contractAddresses();
  if (!oracle) return; // contracts not deployed yet

  const wallet = getWallet();
  if (!wallet) return;

  try {
    const contract = new ethers.Contract(oracle, ORACLE_ABI, wallet);

    // Convert to 18-decimal fixed-point integers
    const priceWei     = ethers.parseUnits(priceUsd.toFixed(18),  18);
    const mcapWei      = ethers.parseUnits(Math.floor(mcap).toString(), 0);
    const liquidityWei = ethers.parseUnits(Math.floor(liquidityUsd).toString(), 0);

    const tx = await contract.updatePrice(tokenAddress, priceWei, mcapWei, liquidityWei, {
      gasLimit: 150_000,
    });
    log(`[bot-onchain] oracle.updatePrice ${tokenAddress.slice(0, 8)}… tx ${tx.hash.slice(0, 10)}…`, "bot");
    // Don't await confirmation — fire-and-forget for speed
  } catch (err: any) {
    const msg = err?.reason || err?.shortMessage || err?.message || String(err);
    log(`[bot-onchain] oracle.updatePrice failed: ${msg.slice(0, 120)}`, "bot");
  }
}

// ── 2. Settle funding for a market ────────────────────────────────────────────

/**
 * Settle accumulated funding for a single market.
 * Call this after every price-bot refresh cycle if canSettle() returns true.
 *
 * @param perpsAddress  FlapPerps contract address for the market
 */
export async function settleFunding(perpsAddress: string): Promise<void> {
  const { funding } = contractAddresses();
  if (!funding || !perpsAddress) return;

  const wallet = getWallet();
  if (!wallet) return;

  try {
    const contract = new ethers.Contract(funding, FUNDING_ABI, wallet);
    const can = await contract.canSettle(perpsAddress);
    if (!can) return;

    const tx = await contract.settle(perpsAddress, { gasLimit: 200_000 });
    log(`[bot-onchain] funding.settle ${perpsAddress.slice(0, 8)}… tx ${tx.hash.slice(0, 10)}…`, "bot");
  } catch (err: any) {
    const msg = err?.reason || err?.shortMessage || err?.message || String(err);
    log(`[bot-onchain] funding.settle failed: ${msg.slice(0, 120)}`, "bot");
  }
}

// ── 3. Scan and liquidate underwater positions ─────────────────────────────────

/**
 * Scan all open positions in a FlapPerps market and liquidate any that are
 * eligible. The bot earns 30% of the remaining margin for each liquidation.
 *
 * @param perpsAddress  FlapPerps contract address for the market
 */
export async function scanAndLiquidate(perpsAddress: string): Promise<void> {
  if (!perpsAddress) return;

  const wallet = getWallet();
  if (!wallet) return;

  try {
    const contract   = new ethers.Contract(perpsAddress, PERPS_ABI, wallet);
    const nextId     = await contract.nextPositionId() as bigint;
    const totalIds   = Number(nextId);

    if (totalIds === 0) return;

    let liquidated = 0;

    // Scan last 500 positions max per cycle (older ones likely already closed/liquidated)
    const startId = Math.max(0, totalIds - 500);

    for (let posId = startId; posId < totalIds; posId++) {
      try {
        const pos = await contract.positions(BigInt(posId));
        if (!pos.isOpen) continue;

        const eligible = await contract.isLiquidatable(BigInt(posId));
        if (!eligible) continue;

        const tx = await contract.liquidate(BigInt(posId), { gasLimit: 300_000 });
        log(`[bot-onchain] liquidated posId=${posId} on ${perpsAddress.slice(0, 8)}… tx ${tx.hash.slice(0, 10)}…`, "bot");
        liquidated++;

        // Small delay between liquidations to avoid nonce collisions
        await new Promise(r => setTimeout(r, 500));
      } catch {
        // Individual position errors are non-fatal
      }
    }

    if (liquidated > 0) {
      log(`[bot-onchain] ${liquidated} position(s) liquidated on ${perpsAddress.slice(0, 8)}…`, "bot");
    }
  } catch (err: any) {
    const msg = err?.reason || err?.shortMessage || err?.message || String(err);
    log(`[bot-onchain] scanAndLiquidate failed for ${perpsAddress}: ${msg.slice(0, 120)}`, "bot");
  }
}

// ── Startup check ─────────────────────────────────────────────────────────────

export function initBotWallet(): void {
  getWallet(); // triggers address verification log on startup
}
