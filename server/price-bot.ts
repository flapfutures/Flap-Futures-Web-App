/**
 * Platform Price Bot
 * Runs every 5 minutes, fetches fresh DexScreener data for every live market,
 * recalculates flex params, and (when contracts are deployed) pushes oracle
 * prices on-chain, settles funding, and scans for liquidatable positions.
 *
 * Safety rules (enforced here + in storage.getAllActiveMarkets):
 *   - Only markets with status=LIVE AND deployed FFX contracts receive on-chain calls.
 *   - PAUSED / PENDING / FROZEN / DELETED markets are never pushed to the oracle.
 *   - Global pause (setBotPaused) halts ALL ticks without killing the process.
 */

import { storage } from "./storage";
import { log } from "./index";

// ── Global bot pause state ─────────────────────────────────────────────────────
let _botPaused = false;
export function setBotPaused(paused: boolean) {
  _botPaused = paused;
  log(`[price-bot] ${paused ? "⏸  PAUSED — no oracle pushes until resumed" : "▶️  RESUMED — price refresh active"}`, "bot");
}
export function isBotPaused(): boolean { return _botPaused; }

// ── On-chain market cap: price × totalSupply() (burn-adjusted) ────────────────
const BSC_RPC = "https://bsc-dataseed.binance.org";
const ERC20_SUPPLY_ABI = [
  "function totalSupply() view returns (uint256)",
  "function decimals() view returns (uint8)",
];
async function onChainMcap(ca: string, priceUsd: number): Promise<number | null> {
  try {
    const provider = new ethers.JsonRpcProvider(BSC_RPC);
    const token = new ethers.Contract(ca, ERC20_SUPPLY_ABI, provider);
    const [supply, decimals]: [bigint, number] = await Promise.all([
      token.totalSupply(),
      token.decimals(),
    ]);
    const humanSupply = Number(supply) / Math.pow(10, decimals);
    return priceUsd * humanSupply;
  } catch {
    return null;
  }
}
// ─────────────────────────────────────────────────────────────────────────────

// ── Mirrors FlapParams.sol exactly — DO NOT change without updating the contract ──────

function calcSpread(mcap: number): number {
  if (mcap < 50_000)    return 0.50;
  if (mcap < 100_000)   return 0.45;
  if (mcap < 200_000)   return 0.40;
  if (mcap < 400_000)   return 0.35;
  if (mcap < 800_000)   return 0.30;
  if (mcap < 1_500_000) return 0.25;
  if (mcap < 3_000_000) return 0.20;
  if (mcap < 7_000_000) return 0.15;
  return 0.10;
}

function calcMaxLeverage(mcap: number): number {
  if (mcap < 50_000)  return 1;
  if (mcap < 100_000) return 5;
  if (mcap < 300_000) return 7;
  return 10;
}

function calcMaxPosition(mcap: number): number {
  if (mcap < 50_000)    return 20;
  if (mcap < 100_000)   return 35;
  if (mcap < 300_000)   return 50;
  if (mcap < 1_000_000) return 75;
  return 100;
}

function calcMaxOI(mcap: number): number {
  if (mcap < 50_000)    return 1_000;
  if (mcap < 100_000)   return 2_500;
  if (mcap < 300_000)   return 6_000;
  if (mcap < 1_000_000) return 15_000;
  if (mcap < 5_000_000) return 40_000;
  return 100_000;
}

function recomputeFlexParams(mcap: number, vaultBalance: number) {
  const vault = Math.max(vaultBalance, 1);
  return {
    spread:      Math.max(calcSpread(mcap),      0.50 * (100 / vault)),
    maxLeverage: Math.min(calcMaxLeverage(mcap), Math.max(1, Math.floor(vault / 25))),
    maxPosition: Math.min(calcMaxPosition(mcap), vault * 2),
    maxOI:       Math.min(calcMaxOI(mcap),       vault * 10),
  };
}

// ── Bot tick: every 5 minutes — checks per-market interval before refreshing ──
// A market is skipped if (now − lastRefreshed) < market.refreshInterval.
// Minimum meaningful interval is therefore 5 min (the bot tick itself).

const BOT_TICK_MS = 5 * 60 * 1000;      // tick every 5 min
const DS_DELAY_MS = 1_200;              // ~1.2 s between DexScreener calls to avoid 429

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function refreshAllLiveMarkets() {
  // ── Global pause guard ──────────────────────────────────────────────────────
  if (_botPaused) {
    log("[price-bot] ⏸  bot paused — skipping tick", "bot");
    return;
  }

  let liveMarkets: Awaited<ReturnType<typeof storage.getAllActiveMarkets>>;
  try {
    // getAllActiveMarkets() only returns LIVE markets with contractVault set.
    // PAUSED, PENDING, FROZEN and markets without FFX contracts are excluded.
    liveMarkets = await storage.getAllActiveMarkets();
  } catch (err) {
    log(`[price-bot] DB error fetching live markets: ${err}`, "bot");
    return;
  }

  if (liveMarkets.length === 0) return;

  const nowMs = Date.now();

  // Filter to markets that are actually due this tick
  const due = liveMarkets.filter((m) => {
    const intervalMs = (m.refreshInterval ?? 300) * 1000;
    const lastMs     = m.lastRefreshed ? new Date(m.lastRefreshed).getTime() : 0;
    return (nowMs - lastMs) >= intervalMs;
  });

  if (due.length === 0) return;

  log(`[price-bot] ${due.length}/${liveMarkets.length} market(s) due for refresh…`, "bot");
  let ok = 0, fail = 0;

  for (const market of due) {
    try {
      const res = await fetch(
        `https://api.dexscreener.com/latest/dex/tokens/${market.tokenAddress}`,
        { signal: AbortSignal.timeout(10_000) },
      );

      if (!res.ok) throw new Error(`DexScreener HTTP ${res.status}`);

      const ds      = await res.json() as any;
      const pairs   = (ds.pairs || []) as any[];
      const bscPairs = pairs.filter((p: any) => p.chainId === "bsc");
      if (bscPairs.length === 0) throw new Error("no BSC pair found");

      const bestPair  = bscPairs.sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
      const priceUsd  = parseFloat(bestPair.priceUsd || "0");
      const dexMcap   = bestPair.marketCap || bestPair.fdv || 0;
      const chainMcap = await onChainMcap(market.tokenAddress, priceUsd);
      const mcap      = chainMcap ?? dexMcap;
      const liquidity = bestPair.liquidity?.usd || 0;
      const volume24h = bestPair.volume?.h24 || 0;

      const flexed = recomputeFlexParams(mcap, market.vaultBalance || 0);

      await storage.updateMarket(market.id, {
        mcap, liquidity, priceUsd, volume24h,
        ...flexed,
        lastRefreshed: new Date(),
      });

      // ── On-chain ops: ONLY for LIVE markets with deployed FFX contracts ──────
      // (getAllActiveMarkets already enforces this, but double-check here)
      const vaultAddr = (market as any).contractVault  || "";
      const perpsAddr = (market as any).contractPerps  || "";
      const botKey    = (market as any).marketBotPrivkey || undefined;

      if (market.status === "LIVE" && vaultAddr && perpsAddr) {
        await pushOraclePrice(market.tokenAddress, priceUsd, mcap, liquidity, botKey);
        await settleFunding(perpsAddr);
        await scanAndLiquidate(perpsAddr);
        await executeTpSlPositions(perpsAddr, priceUsd);
        await executeLimitOrders(perpsAddr, priceUsd);
      } else {
        log(`[price-bot] skipping on-chain ops for ${market.tokenSymbol} — status=${market.status}, vault=${vaultAddr ? "ok" : "missing"}, perps=${perpsAddr ? "ok" : "missing"}`, "bot");
      }

      ok++;
    } catch (err: any) {
      log(`[price-bot] failed for ${market.tokenSymbol} (${market.id}): ${err?.message ?? err}`, "bot");
      fail++;
    }

    // Polite delay between tokens — avoids DexScreener rate-limiting
    await sleep(DS_DELAY_MS);
  }

  log(`[price-bot] done — ${ok} updated, ${fail} failed`, "bot");
}

export function startPriceBot() {
  refreshAllLiveMarkets();
  setInterval(refreshAllLiveMarkets, BOT_TICK_MS);
  log(`[price-bot] started — ticking every 1 min, respecting per-market refresh intervals`, "bot");
}
