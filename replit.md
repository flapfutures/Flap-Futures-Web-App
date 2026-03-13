# Flap Futures (FFX)

Perpetual trading platform on BNB Smart Chain. Brand ticker: **FFX**. Users go long/short with leverage on USDT collateral. Market openers register tokens, deposit vault + insurance, and earn spread fees. All params driven by live market cap.

**Production:** `flapfutures.com` → VPS `104.207.70.184`, PM2 process `flapfutures`, dist at `/root/flapfutures/dist/index.cjs`

## Architecture

- **Frontend**: React 18 + TypeScript, Vite, TailwindCSS, Wouter routing, Framer Motion
- **Backend**: Express 5 + TypeScript (`tsx` in dev, compiled CJS in prod)
- **Database**: PostgreSQL via Drizzle ORM — 6 tables: `users`, `markets`, `trade_history`, `user_sessions`, `visitor_sessions`, `page_views`
- **Auth**: Wallet-based sign-in (sign message → session in PG via connect-pg-simple)
- **Smart Contracts**: 7 contracts — FlapPlatform, FlapFactory, FlapOracle, FlapFunding, FlapVault (per-market), FlapPerps (per-market), lib/FlapParams

## Key Addresses & Constants

- USDT on BSC: `0x55d398326f99059fF775485246999027B3197955` (18 decimals)
- Dev bypass wallet: `0x3F99B2A75bD2ad2091a793A682afdEC07E2947F8`
- ORACLE: `0xBB4859…fDAD6F`, FUNDING: `0x551355…36bfE`, FACTORY: `0xb86D9a…34CE`
- PLATFORM: `0xfEE26f…7EA5`, VAULT_IMPL: `0x082d30…d9db`, PERPS_IMPL: `0xcf0c15…5828`
- Platform bot wallet: `0xd8AE9A69FD6Fe0e1B3D40F32D6E2E4A10894e118`

## VPS / Deploy

```bash
# Build + deploy to VPS
npm run build
tar -czf /tmp/ffx-dist.tar.gz dist/
SSHPASS='23CJkG0qw928obJdKP' sshpass -e scp -o StrictHostKeyChecking=no /tmp/ffx-dist.tar.gz root@104.207.70.184:/tmp/
SSHPASS='23CJkG0qw928obJdKP' sshpass -e ssh -o StrictHostKeyChecking=no root@104.207.70.184 \
  'cd /root/flapfutures && tar -xzf /tmp/ffx-dist.tar.gz && pm2 restart flapfutures'
```

- VPS DB: `PGPASSWORD=FlapDB2026! psql -U flapapp -d flapfutures -h 127.0.0.1`
- **NEVER run `drizzle-kit push` on VPS** — schema changes must be raw SQL or Replit-side push
- PM2 does NOT auto-read `.env` — env vars are embedded in the ecosystem config

## Per-Market Bot Wallets

- Each market gets its own bot wallet generated at registration time
- `marketBotPrivkey` stored in DB, **stripped from all non-`/api/admin/` responses** via middleware
- Dev88 shows privkey masked by default with eye-icon reveal + copy button
- `POST /api/admin/markets/:id/regen-bot-wallet` — regenerate bot wallet for a market

## Traffic Analytics

- **Tables**: `visitor_sessions` (fingerprint, country, page, first/last seen), `page_views` (per-view log)
- **Server**: `server/analytics.ts` — IP geolocation via ip-api.com (free), fingerprint = hash(IP+UA), `trackPageView()`, `heartbeat()`, `getAnalytics()`
- **Client**: `client/src/hooks/useAnalytics.ts` — fires track on every page nav + 30s heartbeat
- **API**: `POST /api/analytics/track`, `POST /api/analytics/heartbeat`, `GET /api/admin/analytics`
- **Dev88 Traffic tab**: Online Now, 30-day daily chart, Top Pages table, Recent Visitors with country flags

## Dev88 Admin Panel (`/dev88`)

Password: `@Gooddev123`

Tabs:
1. **Markets** — stats grid, contract architecture, all markets table (with bot wallet addr, contracts, privkey reveal, deploy/approve/pause/gen-bot actions)
2. **Traffic** — live visitor count, daily chart, top pages, recent visitors

Header: global bot start/stop toggle (green/red pulsing dot)

## Flex Params System (no tiers)

Parameters calculated from live mcap on every trade. Same formula on-chain (FlapParams.sol) and off-chain.

| MCap | Spread | Max Lev | Max Pos | Max OI |
|------|--------|---------|---------|--------|
| < $50k | 0.50% | 1x | $20 | $1,000 |
| $50k–$100k | 0.45% | 5x | $35 | $2,500 |
| $100k–$200k | 0.40% | 7x | $50 | $6,000 |
| $300k–$1M | 0.35% | 7x | $75 | $15,000 |
| $1M–$5M | 0.20–0.25% | 10x | $100 | $40,000 |
| $5M+ | 0.10% | 10x | $100 | $100,000 |

## Fee Split

- Spread: 80% → opener's `pendingFees` (claimable), 20% → FlapPlatform
- Liquidation: 50% → vault.receiveInsurance(), 30% → liquidator bot, 20% → platform
- Funding: 10% platform

## Insurance Model

Insurance is **per-market and creator-owned** — lives inside FlapVault alongside vault collateral. Both locked until `vaultUnlocksAt`. Creator calls `vault.withdrawInsurance(amount)` only after unlock.

## Lock Duration & Trust Badges

Openers choose vault lock on registration: 7d (none), 30d (Silver), 90d (Gold), 180d (Platinum).

## Gas Deposit System

Creator chooses oracle refresh interval (1m/5m/10m/30m/1h). BNB gas cost computed at registration:
- Formula: `(oraclePushes × 40k gas + fundingSettles × 60k gas) × 1.5 Gwei × 1.20 buffer`
- Creator sends BNB to bot wallet; admin confirms via "Gas ✓" button in dev88

## Project Structure

```
client/src/
  pages/      home, perps, apply, dashboard, market-detail, admin, dev88
  components/ UI components (Radix UI + shadcn)
  hooks/      use-wallet.ts, use-auth.ts, useAnalytics.ts
  lib/        flex-params.ts, perps-contracts.ts
server/
  index.ts    Entry point (port 5000)
  routes.ts   All API routes
  storage.ts  Drizzle ORM storage layer
  analytics.ts Traffic tracking (sessions, page views, geo lookup)
  bot-onchain.ts  On-chain oracle/funding bot
  price-bot.ts    Price feed bot
shared/
  schema.ts   Drizzle schema — all 6 tables
contracts/
  FlapPlatform.sol, FlapFactory.sol, FlapOracle.sol, FlapFunding.sol
  FlapVault.sol, FlapPerps.sol, lib/FlapParams.sol
```

## Dashboard Shell — Routing & Layout

All non-home pages live inside `/dashboard` route rendered by `client/src/pages/dashboard-shell.tsx`.

| Hash | Page |
|------|------|
| `#perps` (default) | perps.tsx |
| `#apply` | apply.tsx |
| `#markets` | dashboard.tsx |
| `#market-{id}` | market-detail.tsx |
| `#admin-{symbol}` | admin.tsx |
| `#dev88` | dev88.tsx |

Old routes (`/perps`, `/apply`, `/dev88`, etc.) redirect automatically via App.tsx.
Dev Panel sidebar link only visible when connected wallet = `0x3F99B2A75bD2ad2091a793A682afdEC07E2947F8`.

## Secrets

| Secret | Status | Purpose |
|--------|--------|---------|
| `DATABASE_URL` | ✅ Set | Replit PostgreSQL |
| `BOT_PRIVATE_KEY` | ✅ Set | Platform-level bot wallet key |
| `MORALIS_API_KEY` | ✅ Set | Token data lookups |
| `BSCSCAN_API_KEY` | Hardcoded | `NRR6JC838WJQHHC1ME1ANR4X7DWGIT4CCP` |
| `SESSION_SECRET` | Optional | Change in production |

## Development

```bash
npm run dev      # Dev server on port 5000
npm run build    # Build for production
npm run db:push  # Sync schema to Replit PostgreSQL (NOT VPS)
```

## Brand

- Purple: `#7a33fa`, Lime: `#d5f704`, Dark bg: `#0a0614`
- Font: heading font-heading, mono for addresses/numbers
