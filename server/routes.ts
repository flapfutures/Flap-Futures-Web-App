import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { randomUUID } from "crypto";
import { ethers } from "ethers";

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

// ── GeckoTerminal OHLCV in-memory cache ───────────────────────────────────────
interface CacheEntry { candles: any[]; ts: number; }
const ohlcvCache   = new Map<string, CacheEntry>();   // key = pairAddr:tf
const orientCache  = new Map<string, "base" | "quote">(); // key = pairAddr — orientation never changes
const CACHE_TTL: Record<string, number> = {
  "1m": 30_000, "5m": 60_000, "15m": 90_000,
  "1H": 5 * 60_000, "4H": 10 * 60_000, "1D": 30 * 60_000, "1W": 60 * 60_000,
};

async function geckoFetch(url: string): Promise<number[][]> {
  const r = await fetch(url, { headers: { accept: "application/json" } });
  if (r.status === 429) return null as any;          // rate-limited → caller checks null
  const data = await r.json();
  return (data?.data?.attributes?.ohlcv_list ?? []) as number[][];
}
// ─────────────────────────────────────────────────────────────────────────────

// ── Flex Params (mirrors FlapParams.sol and client/src/lib/flex-params.ts) ──

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

function calcMinInsurance(mcap: number): number {
  return Math.max(100, calcMaxOI(mcap) * 0.10);
}

// Re-computes all flex params from mcap + actual vault balance.
// Mirrors the formula used on the client and in the register route.
function recomputeFlexParams(mcap: number, vaultBalance: number) {
  const vault = Math.max(vaultBalance, 1);
  return {
    spread:      Math.max(calcSpread(mcap),      0.50 * (100 / vault)),
    maxLeverage: Math.min(calcMaxLeverage(mcap), Math.max(1, Math.floor(vault / 25))),
    maxPosition: Math.min(calcMaxPosition(mcap), vault * 2),
    maxOI:       Math.min(calcMaxOI(mcap),       vault * 10),
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

declare module "express-session" {
  interface SessionData {
    walletAddress?: string;
    dev88Authed?: boolean;
  }
}

function requireAuth(req: Request, res: Response, next: () => void) {
  if (!req.session?.walletAddress) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  next();
}

const POOL_PATTERNS = ["pancake", "swap", "pool", "liquidity", "pair", "router", "burn", "dead", "0x000000000000", "0xdead"];
function looksLikeContract(addr: string) {
  return POOL_PATTERNS.some(p => addr.toLowerCase().includes(p));
}

const VALID_LOCK_DAYS = [7, 30, 90, 180];
function lockDaysToSeconds(days: number): number {
  if (!VALID_LOCK_DAYS.includes(days)) throw new Error("lockDays must be 7, 30, 90, or 180");
  return days * 24 * 60 * 60;
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {

  // ── Security: strip marketBotPrivkey from every JSON response ─────────────
  // The private key is stored in DB for the price-bot only — it must never
  // reach any client (browser, curl, etc.)
  app.use((_req, res, next) => {
    const origJson = res.json.bind(res);
    res.json = function (data: unknown) {
      const scrub = (obj: unknown): unknown => {
        if (Array.isArray(obj)) return obj.map(scrub);
        if (obj && typeof obj === "object") {
          const out: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
            if (k === "marketBotPrivkey") continue;
            out[k] = scrub(v);
          }
          return out;
        }
        return obj;
      };
      return origJson(scrub(data));
    };
    next();
  });

  // ── Auth ───────────────────────────────────────────────────────────────────

  app.post("/api/auth/nonce", async (req, res) => {
    const { walletAddress } = req.body;
    if (!walletAddress || !/^0x[0-9a-fA-F]{40}$/.test(walletAddress)) {
      return res.status(400).json({ error: "Invalid wallet address" });
    }
    const user = await storage.upsertUser(walletAddress);
    const nonce = randomUUID();
    await storage.setNonce(walletAddress, nonce);
    return res.json({ nonce, message: `Sign this message to login to Flap Futures.\n\nNonce: ${nonce}` });
  });

  app.post("/api/auth/verify", async (req, res) => {
    const { walletAddress, signature, message } = req.body;
    if (!walletAddress || !signature || !message) {
      return res.status(400).json({ error: "walletAddress, signature, and message required" });
    }
    try {
      const user = await storage.getUser(walletAddress);
      if (!user || !user.nonce) return res.status(401).json({ error: "Request a nonce first" });

      const recovered = ethers.verifyMessage(message, signature);
      if (recovered.toLowerCase() !== walletAddress.toLowerCase()) {
        return res.status(401).json({ error: "Signature does not match wallet" });
      }

      const freshNonce = randomUUID();
      await storage.setNonce(walletAddress, freshNonce);

      req.session.walletAddress = walletAddress.toLowerCase();
      return res.json({ success: true, walletAddress: walletAddress.toLowerCase() });
    } catch (err: any) {
      return res.status(401).json({ error: "Signature verification failed" });
    }
  });

  app.get("/api/auth/me", (req, res) => {
    if (!req.session?.walletAddress) return res.json({ authenticated: false });
    return res.json({ authenticated: true, walletAddress: req.session.walletAddress });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {});
    return res.json({ success: true });
  });

  // ── Token Verification ────────────────────────────────────────────────────

  app.get("/api/verify-token", async (req, res) => {
    const ca = (req.query.ca as string || "").trim().toLowerCase();
    if (!ca || !/^0x[0-9a-f]{40}$/.test(ca)) {
      return res.status(400).json({ error: "Invalid contract address" });
    }
    try {
      const dsRes = await fetch(
        `https://api.dexscreener.com/latest/dex/tokens/${ca}`,
        { headers: { "Accept": "application/json" }, signal: AbortSignal.timeout(8000) }
      );
      if (!dsRes.ok) throw new Error("DexScreener fetch failed");
      const ds = await dsRes.json() as any;
      const pairs: any[] = ds.pairs || [];

      const ALLOWED_QUOTE_SYMBOLS = ["USDT", "WBNB", "BNB"];
      const ALLOWED_QUOTE_ADDRS   = [
        "0x55d398326f99059ff775485246999027b3197955", // BSC-USDT
        "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c", // WBNB
      ];

      const bscPairs = pairs.filter((p: any) => p.chainId === "bsc");

      const isAllowedQuote = (p: any) => {
        const qSym  = (p.quoteToken?.symbol || "").toUpperCase();
        const qAddr = (p.quoteToken?.address || "").toLowerCase();
        return ALLOWED_QUOTE_SYMBOLS.includes(qSym) || ALLOWED_QUOTE_ADDRS.includes(qAddr);
      };

      const pancakePairs = bscPairs.filter((p: any) => p.dexId === "pancakeswap" && isAllowedQuote(p));

      // Prefer USDT pairs for best USD price accuracy, fall back to WBNB pairs
      const usdtPairs = pancakePairs.filter((p: any) => {
        const qSym  = (p.quoteToken?.symbol || "").toUpperCase();
        const qAddr = (p.quoteToken?.address || "").toLowerCase();
        return qSym === "USDT" || qAddr === "0x55d398326f99059ff775485246999027b3197955";
      });
      const bnbPairs  = pancakePairs.filter((p: any) => {
        const qSym = (p.quoteToken?.symbol || "").toUpperCase();
        return qSym === "WBNB" || qSym === "BNB";
      });

      const preferredPool = usdtPairs.length ? usdtPairs : bnbPairs;

      const v2Pair = preferredPool
        .filter((p: any) => Array.isArray(p.labels) && p.labels.some((l: string) => l.toLowerCase() === "v2"))
        .sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];

      const v3Pair = preferredPool
        .filter((p: any) => Array.isArray(p.labels) && p.labels.some((l: string) => l.toLowerCase() === "v3"))
        .sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];

      const bestPair = v2Pair || v3Pair || preferredPool.sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];

      if (!bestPair) {
        return res.json({ found: false, error: "Token not found. Make sure it has a PancakeSwap USDT or BNB pair on BSC." });
      }

      const name        = bestPair.baseToken?.name || "";
      const symbol      = bestPair.baseToken?.symbol || "";
      let logo = bestPair.info?.imageUrl || "";
      let flapPageConfirmed = false;
      if (!logo) {
        try {
          // Scrape the flap.sh token page to get Pinata/IPFS logo and confirm origin
          const flapPage = await fetch(`https://flap.sh/bnb/${ca}`, { signal: AbortSignal.timeout(6000) });
          if (flapPage.ok) {
            const html = await flapPage.text();
            const pinataMatch = html.match(/https:\/\/[a-zA-Z0-9.-]*pinata\.cloud\/ipfs\/([a-zA-Z0-9]+)/);
            if (pinataMatch) { logo = pinataMatch[0]; flapPageConfirmed = true; }
          }
        } catch { /* ignore */ }
      }
      if (!logo) {
        // Last resort: flap.sh static token image
        try {
          const r = await fetch(`https://flap.sh/token-images/${ca}.png`, { method: "HEAD", signal: AbortSignal.timeout(3000) });
          if (r.ok) { logo = `https://flap.sh/token-images/${ca}.png`; flapPageConfirmed = true; }
        } catch { /* ignore */ }
      }
      const priceUsd    = parseFloat(bestPair.priceUsd || "0");
      const dexMcap     = bestPair.marketCap || bestPair.fdv || 0;
      const chainMcap   = await onChainMcap(ca, priceUsd);
      const mcap        = chainMcap ?? dexMcap;
      const liquidity   = bestPair.liquidity?.usd || 0;
      const pairAddress = bestPair.pairAddress || "";
      const volume24h   = bestPair.volume?.h24 || 0;

      // flapOrigin: CA ending check (fast) OR confirmed via flap.sh page
      const isFlapOrigin = ca.endsWith("7777") || ca.endsWith("8888") || flapPageConfirmed;

      const checks = {
        flapOrigin:  isFlapOrigin,
        pancakeV2:   !!(v2Pair || v3Pair),
        hasName:     !!(name && symbol),
        hasLogo:     !!logo,
        fixedSupply: true,
        marketCapOk: mcap >= 25_000,
        liquidityOk: liquidity >= 5_000,
      };
      const allPassed = Object.values(checks).every(Boolean);

      const flexParams = allPassed ? {
        spread:      calcSpread(mcap),
        maxLeverage: calcMaxLeverage(mcap),
        maxPosition: calcMaxPosition(mcap),
        maxOI:       calcMaxOI(mcap),
        minInsurance: calcMinInsurance(mcap),
        minVault:    500,
      } : null;

      return res.json({ found: true, address: ca, name, symbol, logo, priceUsd, mcap, liquidity, volume24h, pairAddress, checks, allPassed, flexParams });
    } catch (err: any) {
      return res.status(500).json({ error: "Failed to verify token. Please try again." });
    }
  });

  app.get("/api/verify-wallet", async (req, res) => {
    const ca     = (req.query.ca     as string || "").trim().toLowerCase();
    const wallet = (req.query.wallet as string || "").trim().toLowerCase();
    if (!/^0x[0-9a-f]{40}$/.test(ca))     return res.status(400).json({ error: "Invalid contract address" });
    if (!/^0x[0-9a-f]{40}$/.test(wallet)) return res.status(400).json({ error: "Invalid wallet address" });

    const apiKey = process.env.BSCSCAN_API_KEY || "";
    const base   = "https://api.bscscan.com/api";
    try {
      const creatorRes = await fetch(`${base}?module=contract&action=getcontractcreation&contractaddresses=${ca}&apikey=${apiKey}`, { signal: AbortSignal.timeout(8000) });
      const creatorData = await creatorRes.json() as any;
      if (creatorData.status === "1" && Array.isArray(creatorData.result) && creatorData.result.length > 0) {
        const deployer = (creatorData.result[0].contractCreator || "").toLowerCase();
        if (deployer && deployer === wallet) {
          return res.json({ eligible: true, reason: "deployer", message: "Verified as token deployer." });
        }
      }
      if (!apiKey) {
        return res.json({ eligible: false, reason: "not_deployer", message: "Wallet is not the token deployer." });
      }
      const holdersRes = await fetch(`${base}?module=token&action=tokenholderlist&contractaddress=${ca}&page=1&offset=15&apikey=${apiKey}`, { signal: AbortSignal.timeout(8000) });
      const holdersData = await holdersRes.json() as any;
      if (holdersData.status === "1" && Array.isArray(holdersData.result)) {
        const topHolders = holdersData.result.filter((h: any) => !looksLikeContract(h.TokenHolderAddress)).slice(0, 10).map((h: any) => (h.TokenHolderAddress || "").toLowerCase());
        const rank = topHolders.indexOf(wallet);
        if (rank !== -1) return res.json({ eligible: true, reason: "top_holder", message: `Verified as top-${rank + 1} holder.` });
        return res.json({ eligible: false, reason: "not_eligible", message: "Wallet is not the deployer or a top-10 holder." });
      }
      return res.json({ eligible: false, reason: "lookup_failed", message: "Could not retrieve holder data." });
    } catch (err: any) {
      return res.status(500).json({ error: "Verification failed. Please try again." });
    }
  });

  // ── Markets ────────────────────────────────────────────────────────────────

  app.post("/api/markets/register", async (req, res) => {
    const wallet = req.session?.walletAddress;
    if (!wallet) return res.status(401).json({ error: "Not authenticated" });

    const { tokenAddress, tokenName, tokenSymbol, tokenLogo, pairAddress, mcap, liquidity, priceUsd, volume24h, lockDays, minVault, refreshInterval, gasBnbRequired } = req.body;
    if (!tokenAddress || !tokenName || !tokenSymbol) {
      return res.status(400).json({ error: "tokenAddress, tokenName, tokenSymbol required" });
    }

    const lockDaysNum = VALID_LOCK_DAYS.includes(Number(lockDays)) ? Number(lockDays) : 7;
    const lockDurationSec = lockDaysToSeconds(lockDaysNum);

    const existing = await storage.getMarketByToken(tokenAddress);
    if (existing) return res.status(409).json({ error: "A market for this token already exists." });

    const mcapNum     = mcap || 0;
    const minVaultNum = Math.max(1, parseFloat(minVault) || 500);

    // All parameters flex with vault — mirrors client-side logic exactly
    const spread      = Math.max(calcSpread(mcapNum),       0.50 * (100 / minVaultNum));
    const maxLeverage = Math.min(calcMaxLeverage(mcapNum),  Math.max(1, Math.floor(minVaultNum / 25)));
    const maxPosition = Math.min(calcMaxPosition(mcapNum),  minVaultNum * 2);
    const maxOI       = Math.min(calcMaxOI(mcapNum),        minVaultNum * 10);

    const now = new Date();

    // Generate a dedicated per-market bot wallet immediately so the creator can
    // fund it with BNB right away — private key stored in DB only, never in code/GitHub
    const { generateMarketBotWallet } = await import("./bot-onchain");
    const { address: botWalletAddr, privateKey: botPrivkey } = generateMarketBotWallet();

    const market = await storage.createMarket({
      ownerWallet: wallet,
      tokenAddress: tokenAddress.toLowerCase(),
      tokenName,
      tokenSymbol,
      tokenLogo: tokenLogo || null,
      pairAddress: pairAddress || null,
      status: "PENDING",
      mcap: mcapNum,
      liquidity: liquidity || 0,
      priceUsd: priceUsd || 0,
      spread,
      maxLeverage,
      maxPosition,
      maxOI,
      minVault: minVaultNum,
      vaultBalance: 0,
      insuranceBalance: 0,
      vaultDepositedAt: null,
      vaultUnlocksAt: null,
      openInterest: 0,
      longRatio: 50,
      fundingRate: 0,
      volume24h: volume24h || 0,
      feesEarned: 0,
      pendingFees: 0,
      lockDuration: lockDurationSec,
      refreshInterval: [60, 300, 600, 1800, 3600].includes(Number(refreshInterval)) ? Number(refreshInterval) : 300,
      gasBnbRequired: parseFloat(gasBnbRequired) || 0,
      gasBnbPaid: false,
      contractVault: null,
      contractOracle: null,
      contractPerps: null,
      contractFunding: null,
      contractLiquidation: null,
      contractInsurance: null,
      paramsLockedByAdmin: false,
      lastRefreshed: now,
      marketBotWallet: botWalletAddr,
      marketBotPrivkey: botPrivkey,
    });

    await storage.createAdminLog(wallet, "MARKET_REGISTERED", market.id, `${tokenName} (${tokenSymbol}) registered — ${lockDaysNum}d lock, spread ${(spread * 100).toFixed(0)}bps, ${maxLeverage}x max leverage`);
    return res.json({ success: true, market });
  });

  app.get("/api/markets", async (req, res) => {
    const markets = await storage.getAllLiveMarkets();
    return res.json(markets);
  });

  app.get("/api/markets/mine", async (req, res) => {
    const wallet = req.session?.walletAddress;
    if (!wallet) return res.status(401).json({ error: "Not authenticated" });
    const markets = await storage.getMarketsByOwner(wallet);
    return res.json(markets);
  });

  app.get("/api/markets/:id", async (req, res) => {
    const market = await storage.getMarket(req.params.id);
    if (!market) return res.status(404).json({ error: "Market not found" });
    return res.json(market);
  });

  app.patch("/api/markets/:id", async (req, res) => {
    const wallet = req.session?.walletAddress;
    if (!wallet) return res.status(401).json({ error: "Not authenticated" });

    const market = await storage.getMarket(req.params.id);
    if (!market) return res.status(404).json({ error: "Market not found" });
    if (market.ownerWallet !== wallet) return res.status(403).json({ error: "Not your market" });

    const allowed = ["status", "vaultBalance", "insuranceBalance", "vaultDepositedAt", "vaultUnlocksAt",
      "contractVault", "contractOracle", "contractPerps", "contractFunding", "contractLiquidation"];
    const updates: Record<string, any> = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const updated = await storage.updateMarket(req.params.id, updates);
    return res.json({ success: true, market: updated });
  });

  app.post("/api/markets/:id/vault-deposit", async (req, res) => {
    const wallet = req.session?.walletAddress;
    if (!wallet) return res.status(401).json({ error: "Not authenticated" });

    const market = await storage.getMarket(req.params.id);
    if (!market) return res.status(404).json({ error: "Market not found" });
    if (market.ownerWallet !== wallet) return res.status(403).json({ error: "Not your market" });

    const { amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: "Amount required" });

    const now = new Date();
    const lockSec = market.lockDuration || 7 * 24 * 60 * 60;

    const currentUnlock = market.vaultUnlocksAt ? new Date(market.vaultUnlocksAt) : null;
    const lockStillActive = currentUnlock && currentUnlock > now;

    const unlockDate = lockStillActive
      ? currentUnlock
      : new Date(now.getTime() + lockSec * 1000);

    const newVaultBalance = (market.vaultBalance || 0) + amount;
    const flexed = recomputeFlexParams(market.mcap || 0, newVaultBalance);

    const updated = await storage.updateMarket(req.params.id, {
      vaultBalance: newVaultBalance,
      vaultDepositedAt: now,
      vaultUnlocksAt: unlockDate,
      status: "LIVE",
      ...flexed,
    });

    await storage.createAdminLog(wallet, "VAULT_DEPOSIT", req.params.id, `+$${amount} USDT, unlocks ${unlockDate.toISOString()}`);
    return res.json({ success: true, market: updated });
  });

  app.post("/api/markets/:id/vault-withdraw", async (req, res) => {
    const wallet = req.session?.walletAddress;
    if (!wallet) return res.status(401).json({ error: "Not authenticated" });

    const market = await storage.getMarket(req.params.id);
    if (!market) return res.status(404).json({ error: "Market not found" });
    if (market.ownerWallet !== wallet) return res.status(403).json({ error: "Not your market" });

    const { amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: "Amount required" });

    const now = new Date();
    if (market.vaultUnlocksAt && new Date(market.vaultUnlocksAt) > now) {
      const remaining = Math.ceil((new Date(market.vaultUnlocksAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return res.status(403).json({ error: `Vault is locked for ${remaining} more day(s). Unlocks on ${new Date(market.vaultUnlocksAt).toDateString()}.` });
    }

    const newBalance = (market.vaultBalance || 0) - amount;
    if (newBalance < 0) return res.status(400).json({ error: "Insufficient vault balance" });

    // Force-close all open positions before allowing vault withdrawal
    const openTrades = await storage.getOpenTradesByMarket(req.params.id);
    if (openTrades.length > 0) {
      const closePrice = market.priceUsd || 0;
      const closedAt = new Date();
      await Promise.all(openTrades.map(trade => {
        const priceDelta = closePrice - trade.entryPrice;
        const pnl = trade.side === "LONG"
          ? (priceDelta / trade.entryPrice) * trade.size
          : (-priceDelta / trade.entryPrice) * trade.size;
        return storage.updateTrade(trade.id, {
          status: "CLOSED",
          exitPrice: closePrice,
          pnl: parseFloat(pnl.toFixed(6)),
          closedAt,
        });
      }));
      await storage.createAdminLog(wallet, "FORCE_CLOSE_ALL", req.params.id,
        `${openTrades.length} position(s) force-closed at $${closePrice} before vault withdrawal`);
    }

    const flexed = recomputeFlexParams(market.mcap || 0, newBalance);
    // If vault fully withdrawn, freeze the market
    const newStatus = newBalance <= 0 ? "FROZEN" : undefined;
    const updated = await storage.updateMarket(req.params.id, {
      vaultBalance: newBalance,
      ...flexed,
      ...(newStatus ? { status: newStatus } : {}),
    });
    await storage.createAdminLog(wallet, "VAULT_WITHDRAW", req.params.id, `-$${amount} USDT`);
    return res.json({ success: true, market: updated, forceClosed: openTrades.length });
  });

  app.post("/api/markets/:id/insurance-deposit", async (req, res) => {
    const wallet = req.session?.walletAddress;
    if (!wallet) return res.status(401).json({ error: "Not authenticated" });

    const market = await storage.getMarket(req.params.id);
    if (!market) return res.status(404).json({ error: "Market not found" });
    if (market.ownerWallet !== wallet) return res.status(403).json({ error: "Not your market" });

    const { amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: "Amount required" });

    const updated = await storage.updateMarket(req.params.id, { insuranceBalance: (market.insuranceBalance || 0) + amount });
    await storage.createAdminLog(wallet, "INSURANCE_DEPOSIT", req.params.id, `+$${amount} USDT`);
    return res.json({ success: true, market: updated });
  });

  app.post("/api/markets/:id/insurance-withdraw", async (req, res) => {
    const wallet = req.session?.walletAddress;
    if (!wallet) return res.status(401).json({ error: "Not authenticated" });

    const market = await storage.getMarket(req.params.id);
    if (!market) return res.status(404).json({ error: "Market not found" });
    if (market.ownerWallet !== wallet) return res.status(403).json({ error: "Not your market" });

    // Insurance is locked until the same time as the vault
    const unlocksAt = market.vaultUnlocksAt ? new Date(market.vaultUnlocksAt) : null;
    if (!unlocksAt || unlocksAt > new Date()) {
      const unlockMsg = unlocksAt
        ? `Insurance is locked until ${unlocksAt.toISOString()}`
        : "Insurance is locked — vault has not been deposited yet";
      return res.status(400).json({ error: unlockMsg });
    }

    const { amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: "Amount required" });

    const newBalance = (market.insuranceBalance || 0) - amount;
    if (newBalance < 0) return res.status(400).json({ error: "Insufficient insurance balance" });

    const updated = await storage.updateMarket(req.params.id, { insuranceBalance: newBalance });
    await storage.createAdminLog(wallet, "INSURANCE_WITHDRAW", req.params.id, `-$${amount} USDT`);
    return res.json({ success: true, market: updated });
  });

  // ── Trades ─────────────────────────────────────────────────────────────────

  app.get("/api/trades/market/:id", async (req, res) => {
    const trades = await storage.getTradesByMarket(req.params.id);
    return res.json(trades);
  });

  app.get("/api/trades/mine", async (req, res) => {
    const wallet = req.session?.walletAddress;
    if (!wallet) return res.status(401).json({ error: "Not authenticated" });
    const trades = await storage.getTradesByWallet(wallet);
    return res.json(trades);
  });

  app.post("/api/trades", async (req, res) => {
    const wallet = req.session?.walletAddress;
    if (!wallet) return res.status(401).json({ error: "Not authenticated" });

    const { marketId, side, size, leverage, entryPrice, txHashOpen } = req.body;
    if (!marketId || !side || !size || !leverage || !entryPrice) {
      return res.status(400).json({ error: "marketId, side, size, leverage, entryPrice required" });
    }

    const market = await storage.getMarket(marketId);
    if (!market) return res.status(404).json({ error: "Market not found" });

    // Only LIVE allows new position opens
    if (market.status !== "LIVE") {
      const msg: Record<string, string> = {
        PENDING:      "Vault not funded yet. The creator must deposit the vault before trading opens.",
        VAULT_UNLOCK: "Vault lock expired — new positions are blocked. You can still close existing positions.",
        FROZEN:       "Market is frozen. The vault has been withdrawn — new positions are blocked.",
        PAUSED:       "Market is paused by the creator. You can still close existing positions.",
      };
      return res.status(400).json({ error: msg[market.status] || "Market is not available for trading." });
    }

    // Guard: creator must have deposited vault liquidity
    const vaultBal = market.vaultBalance ?? 0;
    const minVault = market.minVault ?? 500;
    if (vaultBal < minVault) {
      return res.status(400).json({
        error: "Market has insufficient vault liquidity. The creator must deposit at least $" + minVault + " USDT before trading can begin.",
      });
    }

    // Guard: creator must have funded the insurance pool
    const insBal = market.insuranceBalance ?? 0;
    if (insBal <= 0) {
      return res.status(400).json({
        error: "Market has no insurance fund. The creator must deposit insurance before trading can begin.",
      });
    }

    // Guard: position size must not exceed 50% of vault (ensure payouts are always covered)
    if (size > vaultBal * 0.5) {
      return res.status(400).json({
        error: "Position size exceeds 50% of vault balance. Maximum position: $" + (vaultBal * 0.5).toFixed(2),
      });
    }

    // Flat 0.1% trade fee, minimum $1 per side
    const feeOpen     = Math.max(size * 0.001, 1.0);
    const openerCut   = feeOpen * 0.80;
    const platformCut = feeOpen * 0.20;

    await storage.updateMarket(marketId, {
      pendingFees:  (market.pendingFees  || 0) + openerCut,
      platformFees: (market.platformFees || 0) + platformCut,
    });

    const trade = await storage.createTrade({
      marketId,
      traderWallet: wallet,
      side,
      status: "OPEN",
      size,
      leverage,
      entryPrice,
      exitPrice: null,
      pnl: null,
      feeOpen,
      feeClose: null,
      txHashOpen: txHashOpen || null,
      txHashClose: null,
      closedAt: null,
    });

    return res.json({ success: true, trade });
  });

  app.patch("/api/trades/:id/close", async (req, res) => {
    const wallet = req.session?.walletAddress;
    if (!wallet) return res.status(401).json({ error: "Not authenticated" });

    const { exitPrice, txHashClose } = req.body;
    if (!exitPrice) return res.status(400).json({ error: "exitPrice required" });

    const trades = await storage.getTradesByWallet(wallet);
    const trade = trades.find(t => t.id === req.params.id);
    if (!trade) return res.status(404).json({ error: "Trade not found or not yours" });
    if (trade.status !== "OPEN") return res.status(400).json({ error: "Trade is already closed" });

    const market      = await storage.getMarket(trade.marketId);
    // Flat 0.1% trade fee, minimum $1 per side
    const feeClose    = Math.max(trade.size * 0.001, 1.0);
    const openerCut   = feeClose * 0.80;
    const platformCut = feeClose * 0.20;

    if (market) {
      await storage.updateMarket(trade.marketId, {
        pendingFees:  (market.pendingFees  || 0) + openerCut,
        platformFees: (market.platformFees || 0) + platformCut,
      });
    }

    const priceDiff = trade.side === "LONG" ? exitPrice - trade.entryPrice : trade.entryPrice - exitPrice;
    const pnl = (priceDiff / trade.entryPrice) * trade.size * trade.leverage - (trade.feeOpen || 0) - feeClose;

    const updated = await storage.updateTrade(req.params.id, {
      status: "CLOSED",
      exitPrice,
      pnl,
      feeClose,
      closedAt: new Date(),
      txHashClose: txHashClose || null,
    });

    return res.json({ success: true, trade: updated });
  });

  // ── Refresh Params ─────────────────────────────────────────────────────────

  async function refreshMarketParams(req: Request<{ id: string }>, res: Response) {
    const wallet = req.session?.walletAddress;
    if (!wallet) return res.status(401).json({ error: "Not authenticated" });

    const market = await storage.getMarket(req.params.id);
    if (!market) return res.status(404).json({ error: "Market not found" });
    if (market.ownerWallet !== wallet) return res.status(403).json({ error: "Not your market" });
    if (market.paramsLockedByAdmin) return res.status(403).json({ error: "Parameters are locked by admin" });

    try {
      const dsRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${market.tokenAddress}`, { signal: AbortSignal.timeout(8000) });
      const ds = await dsRes.json() as any;
      const pairs: any[] = ds.pairs || [];
      const bscPairs = pairs.filter((p: any) => p.chainId === "bsc");
      const bestPair = bscPairs.sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
      if (!bestPair) return res.status(400).json({ error: "Token not found on DexScreener" });

      const priceUsd  = parseFloat(bestPair.priceUsd || "0");
      const dexMcap   = bestPair.marketCap || bestPair.fdv || 0;
      const chainMcap = await onChainMcap(market.tokenAddress || "", priceUsd);
      const mcap      = chainMcap ?? dexMcap;
      const liquidity = bestPair.liquidity?.usd || 0;
      const volume24h = bestPair.volume?.h24 || 0;

      // Recompute params using both new mcap AND current vault balance
      const { spread, maxLeverage, maxPosition, maxOI } = recomputeFlexParams(mcap, market.vaultBalance || 0);

      const updated = await storage.updateMarket(market.id, {
        mcap, liquidity, priceUsd, volume24h,
        spread, maxLeverage, maxPosition, maxOI,
        lastRefreshed: new Date(),
      });

      await storage.createAdminLog(wallet, "PARAMS_REFRESHED", market.id, `mcap $${mcap.toLocaleString()} → spread ${(spread * 100).toFixed(0)}bps, ${maxLeverage}x lev, ${maxOI} maxOI`);
      return res.json({ success: true, market: updated });
    } catch (err: any) {
      return res.status(500).json({ error: "Failed to fetch price data" });
    }
  }

  app.post("/api/markets/:id/refresh-params", refreshMarketParams);
  app.post("/api/markets/:id/refresh-tier", refreshMarketParams);

  // ── Owner Settings (refresh interval) ──────────────────────────────────────

  app.patch("/api/markets/:id/settings", async (req, res) => {
    const wallet = req.session?.walletAddress;
    if (!wallet) return res.status(401).json({ error: "Not authenticated" });

    const market = await storage.getMarket(req.params.id);
    if (!market) return res.status(404).json({ error: "Market not found" });
    if (market.ownerWallet?.toLowerCase() !== wallet.toLowerCase())
      return res.status(403).json({ error: "Not your market" });

    const VALID_INTERVALS = [60, 300, 600, 1800, 3600];
    const { refreshInterval } = req.body;

    if (refreshInterval !== undefined) {
      const val = Number(refreshInterval);
      if (!VALID_INTERVALS.includes(val))
        return res.status(400).json({ error: "Invalid interval. Choose: 60, 300, 600, 1800 or 3600 seconds." });

      const updated = await storage.updateMarket(req.params.id, { refreshInterval: val });
      await storage.createAdminLog(wallet, "SETTINGS_CHANGED", req.params.id,
        `Creator changed refresh interval to ${val}s`);
      return res.json({ success: true, market: updated });
    }

    return res.status(400).json({ error: "Nothing to update" });
  });

  // ── Regenerate bot wallet for a market (admin only, for existing markets) ────
  app.post("/api/admin/markets/:id/regen-bot-wallet", async (req, res) => {
    if (!req.session?.dev88Authed) return res.status(403).json({ error: "Forbidden" });
    const market = await storage.getMarket(req.params.id);
    if (!market) return res.status(404).json({ error: "Market not found" });

    const { generateMarketBotWallet } = await import("./bot-onchain");
    const { address: botWalletAddr, privateKey: botPrivkey } = generateMarketBotWallet();

    const updated = await storage.updateMarket(req.params.id, {
      marketBotWallet:  botWalletAddr,
      marketBotPrivkey: botPrivkey,
    } as any);

    await storage.createAdminLog(
      req.session?.walletAddress || "admin",
      "BOT_WALLET_REGEN", req.params.id,
      `New bot wallet generated: ${botWalletAddr}`,
    );
    return res.json({ success: true, market: updated });
  });

  // ── Deploy Per-Market Contracts (for creators who skipped at registration) ──

  app.post("/api/markets/:id/deploy-contracts", async (req, res) => {
    const wallet = req.session?.walletAddress;
    if (!wallet) return res.status(401).json({ error: "Not authenticated" });

    const market = await storage.getMarket(req.params.id);
    if (!market) return res.status(404).json({ error: "Market not found" });
    if (market.ownerWallet?.toLowerCase() !== wallet.toLowerCase())
      return res.status(403).json({ error: "Not your market" });
    if (market.contractVault)
      return res.status(400).json({ error: "Contracts already deployed" });

    const { deployMarketContracts } = await import("./bot-onchain");
    const lockDays    = market.lockDuration ? Math.round(market.lockDuration / 86400) : 30;
    const minVaultUsd = market.minVault ?? 50;

    // Reuse the bot wallet generated at registration time (so creator's BNB deposit stays valid)
    const result = await deployMarketContracts(
      market.tokenAddress,
      market.ownerWallet,
      lockDays,
      minVaultUsd,
      (market as any).marketBotWallet  ?? undefined,
      (market as any).marketBotPrivkey ?? undefined,
    );

    if (!result) {
      return res.status(503).json({
        error: "Contract deployment failed or platform contracts not yet live. Try again after mainnet launch.",
      });
    }

    const updated = await storage.updateMarket(req.params.id, {
      contractVault:    result.vault,
      contractPerps:    result.perps,
      marketBotWallet:  result.botWallet,
      // Persist privkey if freshly generated (no-op if market already had one)
      ...(result.botPrivkey ? { marketBotPrivkey: result.botPrivkey } : {}),
    });
    await storage.createAdminLog(wallet, "CONTRACTS_DEPLOYED", req.params.id,
      `Vault=${result.vault} Perps=${result.perps} BotWallet=${result.botWallet}`);
    return res.json({ success: true, market: updated });
  });

  // ── Claim Fees ─────────────────────────────────────────────────────────────

  app.post("/api/markets/:id/claim-fees", async (req, res) => {
    const wallet = req.session?.walletAddress;
    if (!wallet) return res.status(401).json({ error: "Not authenticated" });

    const market = await storage.getMarket(req.params.id);
    if (!market) return res.status(404).json({ error: "Market not found" });
    if (market.ownerWallet !== wallet) return res.status(403).json({ error: "Not your market" });

    const pending = market.pendingFees || 0;
    if (pending <= 0) return res.status(400).json({ error: "No pending fees to claim" });

    const updated = await storage.updateMarket(req.params.id, {
      pendingFees: 0,
      feesEarned: (market.feesEarned || 0) + pending,
    });

    await storage.createAdminLog(wallet, "FEES_CLAIMED", req.params.id, `Claimed $${pending.toFixed(4)} USDT`);
    return res.json({ success: true, claimed: pending, market: updated });
  });

  // ── Spot: OHLCV candle data via GeckoTerminal (free, no key) ─────────────
  app.get("/api/spot/ohlcv/:pairAddress", async (req, res) => {
    const { pairAddress } = req.params;
    const addr = pairAddress.toLowerCase();
    const tf   = (req.query.tf as string) ?? "15m";
    const tfMap: Record<string, { period: string; agg: number; limit: number }> = {
      "1m":  { period: "minute", agg: 1,  limit: 1000 },
      "5m":  { period: "minute", agg: 5,  limit: 1000 },
      "15s": { period: "minute", agg: 1,  limit: 1000 },
      "15m": { period: "minute", agg: 15, limit: 1000 },
      "1H":  { period: "hour",   agg: 1,  limit: 1000 },
      "4H":  { period: "hour",   agg: 4,  limit: 1000 },
      "1D":  { period: "day",    agg: 1,  limit: 365  },
      "1W":  { period: "day",    agg: 1,  limit: 730  },  // will be re-aggregated to 7-day below
    };
    const cfg        = tfMap[tf] ?? tfMap["15m"];
    const priceHint  = parseFloat(req.query.priceHint as string ?? "0") || 0;
    const cacheKey   = `${addr}:${tf}`;
    const ttl        = CACHE_TTL[tf] ?? 90_000;

    // ── Serve from cache if fresh ─────────────────────────────────────────
    const cached = ohlcvCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < ttl) {
      res.set("Cache-Control", "public, max-age=30");
      return res.json({ candles: cached.candles, cached: true });
    }

    const buildUrl = (token: "base" | "quote") =>
      `https://api.geckoterminal.com/api/v2/networks/bsc/pools/${addr}/ohlcv/${cfg.period}?aggregate=${cfg.agg}&limit=${cfg.limit}&currency=usd&token=${token}`;

    try {
      // ── Determine orientation (cached or freshly detected) ────────────
      let orient = orientCache.get(addr);        // "base" | "quote" | undefined

      let raw: number[][] | null = null;

      if (orient) {
        // Orientation already known — one fetch only
        raw = await geckoFetch(buildUrl(orient));
      } else {
        // First time: fetch base to check orientation against priceHint
        raw = await geckoFetch(buildUrl("base"));
        if (raw === null) {
          // Rate-limited on first fetch — return stale cache or empty
          if (cached) return res.json({ candles: cached.candles, stale: true });
          return res.json({ candles: [], rateLimited: true });
        }
        if (priceHint > 0 && raw.length > 0) {
          const lastClose = raw[raw.length - 1]?.[4] ?? 0;
          const ratio = lastClose > 0
            ? Math.max(priceHint, lastClose) / Math.min(priceHint, lastClose)
            : 9999;
          if (ratio > 5) {
            // Wrong orientation — try quote (only this one extra call, then cache result)
            const altRaw = await geckoFetch(buildUrl("quote"));
            if (altRaw && altRaw.length > 0) {
              const altClose = altRaw[altRaw.length - 1]?.[4] ?? 0;
              const altRatio = altClose > 0
                ? Math.max(priceHint, altClose) / Math.min(priceHint, altClose)
                : 9999;
              if (altRatio < ratio) {
                raw   = altRaw;
                orient = "quote";
              } else {
                orient = "base";
              }
            } else {
              orient = "base";
            }
          } else {
            orient = "base";
          }
        } else {
          orient = "base";
        }
        orientCache.set(addr, orient);
      }

      // ── Rate-limited on known-orientation fetch — serve stale / empty ─
      if (raw === null) {
        if (cached) return res.json({ candles: cached.candles, stale: true });
        return res.json({ candles: [], rateLimited: true });
      }

      // ── Normalise timestamps & deduplicate ────────────────────────────
      const seenTs = new Set<number>();
      let candles = raw
        .map(([t, o, h, l, c, v]) => ({
          time:   t > 1e12 ? Math.floor(t / 1000) : Math.floor(t),
          open: o, high: h, low: l, close: c, volume: v,
        }))
        .sort((a, b) => a.time - b.time)
        .filter((c) => { if (seenTs.has(c.time)) return false; seenTs.add(c.time); return true; });

      // ── Aggregate daily → weekly for 1W timeframe ─────────────────────
      if (tf === "1W" && candles.length > 0) {
        const WEEK = 7 * 86400;
        const firstMon = candles[0].time - ((candles[0].time % WEEK + 86400 * 3) % WEEK);
        const buckets = new Map<number, { open:number; high:number; low:number; close:number; volume:number }>();
        for (const c of candles) {
          const wk = firstMon + Math.floor((c.time - firstMon) / WEEK) * WEEK;
          const b  = buckets.get(wk);
          if (!b) { buckets.set(wk, { open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume }); }
          else    { b.high = Math.max(b.high, c.high); b.low = Math.min(b.low, c.low); b.close = c.close; b.volume += c.volume; }
        }
        candles = Array.from(buckets.entries())
          .sort(([a], [b]) => a - b)
          .map(([time, b]) => ({ time, ...b }));
      }

      // ── Store in cache ────────────────────────────────────────────────
      ohlcvCache.set(cacheKey, { candles, ts: Date.now() });

      res.set("Cache-Control", "public, max-age=30");
      return res.json({ candles });
    } catch (e: any) {
      // On unexpected error, serve stale cache if available
      if (cached) return res.json({ candles: cached.candles, stale: true });
      return res.status(500).json({ error: e?.message ?? String(e) });
    }
  });

  // ── Spot: token logo proxy (avoids browser CORS / CDN redirects) ─────────
  app.get("/api/spot/logo/:address", async (req, res) => {
    const addr = req.params.address.toLowerCase();
    const sources = [
      `https://dd.dexscreener.com/ds-data/tokens/bsc/${addr}.png`,
      `https://assets.trustwallet.com/blockchains/smartchain/assets/${req.params.address}/logo.png`,
      `https://tokens.pancakeswap.finance/images/${req.params.address}.png`,
    ];
    for (const url of sources) {
      try {
        const r = await fetch(url, { redirect: "follow" });
        if (r.ok && (r.headers.get("content-type") ?? "").startsWith("image/")) {
          res.set("Content-Type", r.headers.get("content-type")!);
          res.set("Cache-Control", "public, max-age=86400");
          const buf = Buffer.from(await r.arrayBuffer());
          return res.send(buf);
        }
      } catch { /* try next */ }
    }
    return res.status(404).end();
  });

  // ── Spot: Moralis-powered token pair lookup ──────────────────────────────
  app.get("/api/spot/token/:address", async (req, res) => {
    const { address } = req.params;
    const apiKey = process.env.MORALIS_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "MORALIS_API_KEY not configured" });

    try {
      // Step 1: ask Moralis for the token price — it returns the exact pair address
      const mRes = await fetch(
        `https://deep-index.moralis.io/api/v2.2/erc20/${address}/price?chain=0x38&include=percent_change`,
        { headers: { "X-API-Key": apiKey, accept: "application/json" } },
      );
      const mData = await mRes.json();
      const pairAddress: string | undefined = mData?.pairAddress;

      if (pairAddress) {
        // Step 2: fetch full pair data from DexScreener using that exact pair address
        const dsRes = await fetch(`https://api.dexscreener.com/latest/dex/pairs/bsc/${pairAddress}`);
        const dsData = await dsRes.json();
        const pair = dsData?.pairs?.[0] ?? null;
        if (pair) return res.json({ pair, source: "moralis+dexscreener" });
      }

      // Fallback: DexScreener token search (handles flap.sh / unknown tokens)
      const fbRes  = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`);
      const fbData = await fbRes.json();
      const bsc = ((fbData?.pairs ?? []) as any[])
        .filter((p: any) => p.chainId === "bsc")
        .sort((a: any, b: any) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));
      return res.json({ pair: bsc[0] ?? null, source: "dexscreener-fallback" });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message ?? String(e) });
    }
  });

  // ── Admin Market Management ────────────────────────────────────────────────

  // All markets (including non-live) for admin view
  app.get("/api/admin/markets", async (req, res) => {
    const wallet = req.session?.walletAddress;
    if (!wallet) return res.status(401).json({ error: "Not authenticated" });
    const all = await storage.getAllMarkets();
    return res.json(all);
  });

  // Pause a market
  app.post("/api/admin/markets/:id/pause", async (req, res) => {
    const wallet = req.session?.walletAddress;
    if (!wallet) return res.status(401).json({ error: "Not authenticated" });
    const market = await storage.getMarket(req.params.id);
    if (!market) return res.status(404).json({ error: "Market not found" });
    const updated = await storage.updateMarket(req.params.id, { status: "PAUSED" });
    await storage.createAdminLog(wallet, "ADMIN_PAUSE", req.params.id, `Market paused by admin`);
    return res.json({ success: true, market: updated });
  });

  // Resume a paused market
  app.post("/api/admin/markets/:id/resume", async (req, res) => {
    const wallet = req.session?.walletAddress;
    if (!wallet) return res.status(401).json({ error: "Not authenticated" });
    const market = await storage.getMarket(req.params.id);
    if (!market) return res.status(404).json({ error: "Market not found" });
    const updated = await storage.updateMarket(req.params.id, { status: "LIVE" });
    await storage.createAdminLog(wallet, "ADMIN_RESUME", req.params.id, `Market resumed by admin`);
    return res.json({ success: true, market: updated });
  });

  // Confirm gas BNB received from creator
  app.post("/api/admin/markets/:id/confirm-gas", async (req, res) => {
    const wallet = req.session?.walletAddress;
    if (!wallet) return res.status(401).json({ error: "Not authenticated" });
    const market = await storage.getMarket(req.params.id);
    if (!market) return res.status(404).json({ error: "Market not found" });
    const updated = await storage.updateMarket(req.params.id, { gasBnbPaid: true });
    await storage.createAdminLog(wallet, "GAS_CONFIRMED", req.params.id, `BNB gas deposit confirmed — ${market.gasBnbRequired ?? 0} BNB`);
    return res.json({ success: true, market: updated });
  });

  // Delete a market (irreversible)
  app.delete("/api/admin/markets/:id", async (req, res) => {
    const wallet = req.session?.walletAddress;
    if (!wallet) return res.status(401).json({ error: "Not authenticated" });
    const market = await storage.getMarket(req.params.id);
    if (!market) return res.status(404).json({ error: "Market not found" });
    await storage.createAdminLog(wallet, "ADMIN_DELETE", req.params.id, `Market ${market.tokenSymbol} deleted by admin`);
    await storage.deleteMarket(req.params.id);
    return res.json({ success: true });
  });

  // ── Admin Logs ─────────────────────────────────────────────────────────────

  app.get("/api/admin/logs", async (req, res) => {
    const wallet = req.session?.walletAddress;
    if (!wallet) return res.status(401).json({ error: "Not authenticated" });
    const logs = await storage.getAdminLogs(100);
    return res.json(logs);
  });

  // ── Post-deploy: wire Oracle + Funding factory pointers ──────────────────────
  // Call once after all FFX platform contracts are deployed on BSC mainnet.
  app.post("/api/admin/setup-platform-links", async (req, res) => {
    if (!req.session?.dev88Authed) return res.status(403).json({ error: "Forbidden" });
    const missing = ["FFX_ORACLE", "FFX_FUNDING", "FFX_FACTORY"].filter(k => !process.env[k]);
    if (missing.length) {
      return res.status(503).json({ error: `Missing env vars: ${missing.join(", ")} — set them in .env and restart` });
    }
    try {
      const { setupPlatformLinks } = await import("./bot-onchain");
      await setupPlatformLinks();
      await storage.createAdminLog(
        req.session?.walletAddress || "admin",
        "SETUP_PLATFORM_LINKS", undefined,
        "oracle.setFactory + funding.setFactory + factory.setPlatformContract"
      );
      return res.json({ success: true, message: "Platform links wired — check bot logs." });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || "Failed" });
    }
  });

  // ── Bot price-refresh start / stop / status ──────────────────────────────────
  app.get("/api/admin/bot/status", async (req, res) => {
    if (!req.session?.dev88Authed) return res.status(403).json({ error: "Forbidden" });
    const { isBotPaused } = await import("./price-bot");
    return res.json({ paused: isBotPaused() });
  });

  app.post("/api/admin/bot/stop", async (req, res) => {
    if (!req.session?.dev88Authed) return res.status(403).json({ error: "Forbidden" });
    const { setBotPaused } = await import("./price-bot");
    setBotPaused(true);
    await storage.createAdminLog(
      req.session?.walletAddress || "admin",
      "BOT_STOPPED", undefined, "Oracle price-refresh bot paused by admin"
    );
    return res.json({ success: true, paused: true });
  });

  app.post("/api/admin/bot/start", async (req, res) => {
    if (!req.session?.dev88Authed) return res.status(403).json({ error: "Forbidden" });
    const { setBotPaused } = await import("./price-bot");
    setBotPaused(false);
    await storage.createAdminLog(
      req.session?.walletAddress || "admin",
      "BOT_STARTED", undefined, "Oracle price-refresh bot resumed by admin"
    );
    return res.json({ success: true, paused: false });
  });

  // Platform-wide fee summary for admin dashboard
  app.get("/api/admin/platform-fees", async (req, res) => {
    const wallet = req.session?.walletAddress;
    if (!wallet) return res.status(401).json({ error: "Not authenticated" });

    const liveMarkets = await storage.getAllLiveMarkets();
    const totalPlatformFees   = liveMarkets.reduce((s, m) => s + (m.platformFees || 0), 0);
    const totalOpenerFeesPaid = liveMarkets.reduce((s, m) => s + (m.feesEarned   || 0), 0);

    const breakdown = liveMarkets.map(m => ({
      id:           m.id,
      symbol:       m.tokenSymbol,
      platformFees: m.platformFees || 0,
      openerFeesEarned: m.feesEarned || 0,
      openerFeesPending: m.pendingFees || 0,
    }));

    return res.json({ totalPlatformFees, totalOpenerFeesPaid, breakdown });
  });

  // ── Dev88 Password Gate ────────────────────────────────────────────────────

  app.get("/api/dev88/check", (req, res) => {
    return res.json({ authed: req.session?.dev88Authed === true });
  });

  app.post("/api/dev88/auth", (req, res) => {
    const { password } = req.body as { password?: string };
    const correct = process.env.DEV88_PASSWORD || "";
    if (!correct) return res.status(500).json({ error: "DEV88_PASSWORD not configured" });
    if (password !== correct) return res.status(401).json({ error: "Wrong password" });
    req.session.dev88Authed = true;
    return res.json({ authed: true });
  });

  app.post("/api/dev88/logout", (req, res) => {
    req.session.dev88Authed = false;
    return res.json({ ok: true });
  });

  return httpServer;
}
