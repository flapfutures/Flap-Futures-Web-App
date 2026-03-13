import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, real, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const marketStatusEnum = pgEnum("market_status", ["PENDING", "LIVE", "PAUSED", "REJECTED", "VAULT_UNLOCK", "FROZEN"]);
export const positionSideEnum = pgEnum("position_side", ["LONG", "SHORT"]);
export const tradeStatusEnum = pgEnum("trade_status", ["OPEN", "CLOSED", "LIQUIDATED"]);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  walletAddress: text("wallet_address").notNull().unique(),
  nonce: text("nonce"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const markets = pgTable("markets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ownerWallet: text("owner_wallet").notNull(),
  tokenAddress: text("token_address").notNull().unique(),
  tokenName: text("token_name").notNull(),
  tokenSymbol: text("token_symbol").notNull(),
  tokenLogo: text("token_logo"),
  pairAddress: text("pair_address"),

  status: marketStatusEnum("status").default("PENDING").notNull(),
  mcap: real("mcap").default(0),
  liquidity: real("liquidity").default(0),
  priceUsd: real("price_usd").default(0),

  // Flexible params — computed from mcap, stored for quick reads
  spread: real("spread").default(0.50),
  maxLeverage: integer("max_leverage").default(1),
  maxPosition: real("max_position").default(20),
  maxOI: real("max_oi").default(500),

  minVault: real("min_vault").default(500),

  // Vault & insurance (safety backstop — not an OI cap)
  vaultBalance: real("vault_balance").default(0),
  insuranceBalance: real("insurance_balance").default(0),
  vaultDepositedAt: timestamp("vault_deposited_at"),
  vaultUnlocksAt: timestamp("vault_unlocks_at"),

  // Live market state
  openInterest: real("open_interest").default(0),
  longRatio: real("long_ratio").default(50),
  fundingRate: real("funding_rate").default(0),
  volume24h: real("volume_24h").default(0),
  feesEarned: real("fees_earned").default(0),

  // Contract addresses (set after deployment)
  contractVault: text("contract_vault"),
  contractOracle: text("contract_oracle"),
  contractPerps: text("contract_perps"),
  contractFunding: text("contract_funding"),
  contractLiquidation: text("contract_liquidation"),
  contractInsurance: text("contract_insurance"),

  lockDuration: integer("lock_duration").default(604800),

  // Oracle refresh interval (seconds): how often bot pushes price on-chain
  refreshInterval: integer("refresh_interval").default(300),
  // Pre-computed BNB the creator must send to fund bot gas
  gasBnbRequired: real("gas_bnb_required").default(0),
  gasBnbPaid: boolean("gas_bnb_paid").default(false),

  pendingFees: real("pending_fees").default(0),
  platformFees: real("platform_fees").default(0),

  paramsLockedByAdmin: boolean("params_locked_by_admin").default(false),
  lastRefreshed: timestamp("last_refreshed"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tradeHistory = pgTable("trade_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  marketId: varchar("market_id").notNull(),
  traderWallet: text("trader_wallet").notNull(),
  side: positionSideEnum("side").notNull(),
  status: tradeStatusEnum("status").default("OPEN").notNull(),
  size: real("size").notNull(),
  leverage: integer("leverage").notNull(),
  entryPrice: real("entry_price").notNull(),
  exitPrice: real("exit_price"),
  pnl: real("pnl"),
  feeOpen: real("fee_open"),
  feeClose: real("fee_close"),
  openedAt: timestamp("opened_at").defaultNow().notNull(),
  closedAt: timestamp("closed_at"),
  txHashOpen: text("tx_hash_open"),
  txHashClose: text("tx_hash_close"),
});

export const adminLogs = pgTable("admin_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  actorWallet: text("actor_wallet").notNull(),
  action: text("action").notNull(),
  targetId: text("target_id"),
  detail: text("detail"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({ walletAddress: true });
export const insertMarketSchema = createInsertSchema(markets).omit({ id: true, createdAt: true });
export const insertTradeSchema = createInsertSchema(tradeHistory).omit({ id: true, openedAt: true });

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Market = typeof markets.$inferSelect;
export type InsertMarket = z.infer<typeof insertMarketSchema>;
export type Trade = typeof tradeHistory.$inferSelect;
export type InsertTrade = z.infer<typeof insertTradeSchema>;
export type AdminLog = typeof adminLogs.$inferSelect;
