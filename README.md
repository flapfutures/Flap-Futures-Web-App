<div align="center">
  <img src="client/src/assets/flapfutureslogo_nobg.png" alt="Flap Futures" width="80" />
  <h1>FLAP FUTURES</h1>
  <p><strong>Perpetual Trading Infrastructure for the FLAP.SH Ecosystem</strong></p>

  <p>
    <img src="https://img.shields.io/badge/Chain-BNB%20Smart%20Chain-F0B90B?logo=binance&logoColor=white" />
    <img src="https://img.shields.io/badge/Collateral-USDT%20BEP--20-26A17B?logo=tether&logoColor=white" />
    <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white" />
    <img src="https://img.shields.io/badge/Node.js-20-339933?logo=node.js&logoColor=white" />
    <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" />
    <img src="https://img.shields.io/badge/License-MIT-7a33fa" />
  </p>

  <p>
    <a href="https://flapfutures.com">Live App</a> ·
    <a href="https://flapfutures.com/whitepaper">Whitepaper</a> ·
    <a href="https://flap.sh/bnb/board">FLAP.SH</a>
  </p>
</div>

---

## Overview

**Flap Futures (FFX)** is a non-custodial, fully on-chain perpetual futures protocol built on BNB Smart Chain. It enables any token listed on [flap.sh](https://flap.sh/bnb/board) to instantly launch its own isolated leveraged market — no order books, no custodial risk, no gatekeeping.

| Feature | Detail |
|---|---|
| **Collateral** | USDT (BEP-20) |
| **Leverage** | Dynamic — scales with vault size |
| **Market creation** | Permissionless via FlapFactory |
| **Flexibel Fee** | Creator Fee |
| **Settlement** | Fully on-chain, no admin required |
| **Price feed** | DexScreener (public on-chain data) |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     FLAP FUTURES                        │
│                                                         │
│  FlapParams (singleton)                                 │
│  └─ Global fee rates, leverage formulas, OI limits      │
│                                                         │
│  FlapFactory                                            │
│  └─ Deploys EIP-1167 clone pairs per market             │
│      ├─ FlapVault  (per-market USDT treasury)           │
│      └─ FlapPerps  (per-market trading engine)          │
│                                                         │
│  Oracle Service   → price feeds → FlapOracle (BSC)     │
│  Funding Service  → funding rates → FlapFunding (BSC)  │
│  Bot Service      → liquidations, freezes              │
└─────────────────────────────────────────────────────────┘
```

### Contract Layer

| Contract | Role |
|---|---|
| `FlapParams` | Global parameter registry (fees, formulas) |
| `FlapFactory` | Deploys vault + perps clone pairs |
| `FlapVaultImpl` | Per-market USDT insurance vault |
| `FlapPerpsImpl` | Per-market perpetuals engine (open/close/liquidate) |
| `FlapPlatform` | Platform registry & fee routing |
| `FlapOracle` | On-chain price store (updated by oracle bot) |
| `FlapFunding` | On-chain funding rate store |

### Vault States

```
Pending → Live → Paused
                └→ VaultUnlocked
                └→ Frozen (emergency — close only)
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS + shadcn/ui |
| Animations | Framer Motion |
| Web3 | ethers.js v6 |
| Wallet | MetaMask, Trust Wallet, OKX, WalletConnect |
| Backend | Node.js + Express |
| Database | PostgreSQL (via Drizzle ORM) |
| Contracts | Solidity 0.8.x (BNB Smart Chain) |
| Bot Services | Node.js (price oracle, funding, liquidations) |

---

## Project Structure

```
flap-futures/
├── client/                    # React frontend
│   ├── src/
│   │   ├── pages/             # Route pages (home, dashboard, whitepaper, …)
│   │   ├── components/        # Shared UI components
│   │   ├── lib/               # Contract ABIs, helpers
│   │   └── hooks/             # React hooks
│   └── public/                # Static assets
│
├── server/                    # Express backend
│   ├── index.ts               # Entry point
│   ├── routes.ts              # API routes
│   ├── storage.ts             # DB access layer
│   ├── bot-onchain.ts         # On-chain bot (oracle, funding, liquidations)
│   └── price-bot.ts           # Price feed service
│
├── contracts/                 # Solidity source & deployment docs
│   ├── local/                 # Deployable contracts
│   │   ├── FlapFactory.sol
│   │   ├── FlapVaultImpl.sol
│   │   ├── FlapPerpsImpl.sol
│   │   └── FlapParams.sol
│   └── *.sol                  # Platform contracts
│
├── shared/
│   └── schema.ts              # Drizzle DB schema (shared server/client)
│
└── scripts/
    └── deployFactory.mjs      # Factory deployment script
```

---

## Getting Started

### Prerequisites

- Node.js ≥ 20
- PostgreSQL ≥ 14
- A BNB Smart Chain wallet with BNB (for deployment)

### Installation

```bash
# Clone the repository
git clone https://github.com/flapfutures/Flap-Futures-Web-App.git
cd Flap-Futures-Web-App

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# → Edit .env with your values

# Set up the database
npm run db:push

# Start development server
npm run dev
```

### Production Build

```bash
npm run build
node dist/index.cjs
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```env
# ── Database ───────────────────────────────────────────────
DATABASE_URL=postgresql://user:password@localhost:5432/flapfutures
SESSION_SECRET=change-this-to-a-long-random-string

# ── On-chain Bot ───────────────────────────────────────────
BOT_PRIVATE_KEY=0x...          # Wallet that signs oracle/funding txs
MORALIS_API_KEY=               # Moralis API key (token metadata)

# ── Contract Addresses ─────────────────────────────────────
FFX_ORACLE=0x...               # FlapOracle deployed address
FFX_FUNDING=0x...              # FlapFunding deployed address
FFX_FACTORY=0x...              # FlapFactory deployed address

# ── App ────────────────────────────────────────────────────
NODE_ENV=production
PORT=5000
```

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `SESSION_SECRET` | ✅ | Express session secret (random 64-char string) |
| `BOT_PRIVATE_KEY` | ✅ | Private key for the oracle/funding bot wallet |
| `MORALIS_API_KEY` | ✅ | [Moralis](https://moralis.io) API key for token data |
| `FFX_ORACLE` | ✅ | Deployed FlapOracle contract address |
| `FFX_FUNDING` | ✅ | Deployed FlapFunding contract address |
| `FFX_FACTORY` | ✅ | Deployed FlapFactory contract address |

---

## Deploying Contracts

All contracts live in `contracts/local/`. Use the deployment script after filling in your `.env`:

```bash
node scripts/deployFactory.mjs
```

This compiles and deploys `FlapVaultImpl`, `FlapPerpsImpl`, and `FlapFactory` in sequence. Copy the output addresses into your `.env`.

See [`contracts/DEPLOY.md`](contracts/DEPLOY.md) for step-by-step deployment instructions.

---

## Pages & Routes

| Route | Description |
|---|---|
| `/` | Marketing home page |
| `/whitepaper` | Protocol whitepaper (document viewer) |
| `/dashboard` | Trading dashboard — markets, positions, vault |
| `/dashboard/market/:id` | Individual market detail page |
| `/dev88` | Admin panel (market creation, fee claims) |

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/markets` | List all markets |
| `GET` | `/api/markets/:id` | Market detail + live stats |
| `GET` | `/api/positions/:wallet` | Open positions for a wallet |
| `GET` | `/api/leaderboard` | Top traders by PnL |
| `POST` | `/api/markets` | Create a new market (authenticated) |
| `GET` | `/api/price/:tokenAddress` | Token price from oracle |

---

## Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feat/your-feature`
3. Commit your changes: `git commit -m 'feat: add your feature'`
4. Push to the branch: `git push origin feat/your-feature`
5. Open a Pull Request

---

## Brand

| Color | Hex | Usage |
|---|---|---|
| Primary Purple | `#7a33fa` | Accents, gradients, CTA |
| Lime | `#d5f704` | Highlights, badges |
| Dark BG | `#0a0614` | Page background |

Logo asset: `client/src/assets/flapfutureslogo_nobg.png`

---

## License

MIT © 2026 [Flap Futures](https://flapfutures.com)

---

<div align="center">
  <sub>Built on BNB Smart Chain · Powered by flap.sh · Non-custodial perpetual trading</sub>
</div>
