import { drizzle } from "drizzle-orm/node-postgres";
import { eq, desc, and, inArray, not, isNotNull } from "drizzle-orm";
import pg from "pg";
import {
  users, markets, tradeHistory, adminLogs,
  type User, type Market, type Trade, type AdminLog,
  type InsertMarket, type InsertTrade,
} from "@shared/schema";
import { randomUUID } from "crypto";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool);

// ── Status is always derived from vault fields ────────────────────────────────
// PAUSED is the only status a creator can manually set.
// Everything else is computed from vault state.
type MarketStatus = "PENDING" | "LIVE" | "VAULT_UNLOCK" | "FROZEN" | "PAUSED" | "REJECTED";
export function computeMarketStatus(m: Market): MarketStatus {
  if (m.status === "PAUSED") return "PAUSED";                              // creator override
  if (!m.vaultDepositedAt)   return "PENDING";                            // vault never deposited
  if ((m.vaultBalance ?? 0) <= 0) return "FROZEN";                       // vault withdrawn
  if (m.vaultUnlocksAt && new Date(m.vaultUnlocksAt) <= new Date()) return "VAULT_UNLOCK"; // lock expired
  return "LIVE";                                                           // vault funded & locked
}

function applyStatus(m: Market): Market {
  return { ...m, status: computeMarketStatus(m) };
}
// ─────────────────────────────────────────────────────────────────────────────

export const storage = {
  // ── Users ──────────────────────────────────────────────────
  async getUser(walletAddress: string): Promise<User | undefined> {
    const rows = await db.select().from(users).where(eq(users.walletAddress, walletAddress.toLowerCase()));
    return rows[0];
  },

  async upsertUser(walletAddress: string): Promise<User> {
    const addr = walletAddress.toLowerCase();
    const existing = await this.getUser(addr);
    if (existing) return existing;
    const inserted = await db.insert(users).values({ walletAddress: addr, nonce: randomUUID() }).returning();
    return inserted[0];
  },

  async setNonce(walletAddress: string, nonce: string): Promise<void> {
    await db.update(users).set({ nonce }).where(eq(users.walletAddress, walletAddress.toLowerCase()));
  },

  async getUserByNonce(walletAddress: string): Promise<User | undefined> {
    return this.getUser(walletAddress);
  },

  // ── Markets ────────────────────────────────────────────────
  async createMarket(data: InsertMarket): Promise<Market> {
    const inserted = await db.insert(markets).values(data).returning();
    return applyStatus(inserted[0]);
  },

  async getMarket(id: string): Promise<Market | undefined> {
    const rows = await db.select().from(markets).where(eq(markets.id, id));
    return rows[0] ? applyStatus(rows[0]) : undefined;
  },

  async getMarketByToken(tokenAddress: string): Promise<Market | undefined> {
    const rows = await db.select().from(markets).where(eq(markets.tokenAddress, tokenAddress.toLowerCase()));
    return rows[0] ? applyStatus(rows[0]) : undefined;
  },

  async getMarketsByOwner(ownerWallet: string): Promise<Market[]> {
    const rows = await db.select().from(markets)
      .where(eq(markets.ownerWallet, ownerWallet.toLowerCase()))
      .orderBy(desc(markets.createdAt));
    return rows.map(applyStatus);
  },

  async getAllLiveMarkets(): Promise<Market[]> {
    // Fetch all non-PAUSED markets, then apply computed status and filter to tradeable ones
    const rows = await db.select().from(markets)
      .where(not(eq(markets.status, "PAUSED")))
      .orderBy(desc(markets.createdAt));
    return rows.map(applyStatus).filter(m => m.status === "LIVE" || m.status === "VAULT_UNLOCK");
  },

  async getAllActiveMarkets(): Promise<Market[]> {
    // For price-bot: ONLY markets with deployed FFX contracts AND strictly LIVE status.
    // contractVault IS NOT NULL ensures we never push to old/stale oracle entries.
    const rows = await db.select().from(markets)
      .where(and(
        eq(markets.status, "LIVE"),
        isNotNull(markets.contractVault),
        isNotNull(markets.contractPerps),
      ))
      .orderBy(desc(markets.createdAt));
    return rows.map(applyStatus).filter(m => m.status === "LIVE");
  },

  async getAllMarkets(): Promise<Market[]> {
    const rows = await db.select().from(markets).orderBy(desc(markets.createdAt));
    return rows.map(applyStatus);
  },

  async deleteMarket(id: string): Promise<void> {
    await db.delete(markets).where(eq(markets.id, id));
  },

  async updateMarket(id: string, data: Partial<Market>): Promise<Market> {
    const updated = await db.update(markets).set(data).where(eq(markets.id, id)).returning();
    return applyStatus(updated[0]);
  },

  // ── Trades ────────────────────────────────────────────────
  async createTrade(data: InsertTrade): Promise<Trade> {
    const inserted = await db.insert(tradeHistory).values(data).returning();
    return inserted[0];
  },

  async getTradesByMarket(marketId: string, limit = 100): Promise<Trade[]> {
    return db.select().from(tradeHistory)
      .where(eq(tradeHistory.marketId, marketId))
      .orderBy(desc(tradeHistory.openedAt))
      .limit(limit);
  },

  async getOpenTradesByMarket(marketId: string): Promise<Trade[]> {
    return db.select().from(tradeHistory)
      .where(and(eq(tradeHistory.marketId, marketId), eq(tradeHistory.status, "OPEN")));
  },

  async getTradesByWallet(traderWallet: string, limit = 100): Promise<Trade[]> {
    return db.select().from(tradeHistory)
      .where(eq(tradeHistory.traderWallet, traderWallet.toLowerCase()))
      .orderBy(desc(tradeHistory.openedAt))
      .limit(limit);
  },

  async updateTrade(id: string, data: Partial<Trade>): Promise<Trade> {
    const updated = await db.update(tradeHistory).set(data).where(eq(tradeHistory.id, id)).returning();
    return updated[0];
  },

  // ── Admin Logs ─────────────────────────────────────────────
  async createAdminLog(actorWallet: string, action: string, targetId?: string, detail?: string): Promise<void> {
    await db.insert(adminLogs).values({ actorWallet: actorWallet.toLowerCase(), action, targetId, detail });
  },

  async getAdminLogs(limit = 50): Promise<AdminLog[]> {
    return db.select().from(adminLogs).orderBy(desc(adminLogs.createdAt)).limit(limit);
  },
};
