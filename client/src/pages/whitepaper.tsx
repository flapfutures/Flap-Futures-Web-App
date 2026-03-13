import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import logoImg from "@assets/flapfutureslogo_nobg.png";
import { Download, ArrowLeft, ChevronRight } from "lucide-react";

const SECTIONS = [
  { id: "abstract",       label: "Abstract" },
  { id: "introduction",   label: "1. Introduction" },
  { id: "problem",        label: "2. Problem Statement" },
  { id: "solution",       label: "3. Solution Overview" },
  { id: "architecture",   label: "4. Architecture" },
  { id: "market-lifecycle", label: "5. Market Lifecycle" },
  { id: "trading",        label: "6. Trading Mechanics" },
  { id: "fees",           label: "7. Fee Structure" },
  { id: "risk",           label: "8. Risk & Safety" },
  { id: "oracle",         label: "9. Oracle & Pricing" },
  { id: "parameters",     label: "10. Flex Parameters" },
  { id: "security",       label: "11. Security Model" },
  { id: "disclaimer",     label: "12. Disclaimer" },
];

function useActiveSection() {
  const [active, setActive] = useState("abstract");
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => { if (e.isIntersecting) setActive(e.target.id); });
      },
      { rootMargin: "-30% 0px -65% 0px" }
    );
    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);
  return active;
}

export default function Whitepaper() {
  const active = useActiveSection();

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-[#0a0614] font-sans">
      {/* Top bar */}
      <div
        className="sticky top-0 z-50 border-b border-white/10 backdrop-blur-md"
        style={{ background: "rgba(10,6,20,0.92)" }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/" className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white/80 transition-colors shrink-0">
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </Link>
            <span className="text-white/20 hidden sm:inline">|</span>
            <div className="hidden sm:flex items-center gap-2">
              <img src={logoImg} alt="Flap Futures" className="w-5 h-5" />
              <span className="font-bold text-sm text-white tracking-wide">
                FLAP <span style={{ color: "#7a33fa" }}>FUTURES</span>
              </span>
              <span className="text-white/30 text-sm">·</span>
              <span className="text-white/40 text-xs font-mono">Whitepaper v1.0 — 2026</span>
            </div>
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-white/20 text-white/60 hover:text-white hover:border-white/40 transition-colors shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            Save PDF
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex gap-8 xl:gap-12">
        {/* Sidebar TOC */}
        <aside className="hidden lg:block w-52 xl:w-60 shrink-0">
          <div className="sticky top-24">
            <p className="text-[10px] font-semibold tracking-widest text-white/30 uppercase mb-4">
              Contents
            </p>
            <nav className="space-y-0.5">
              {SECTIONS.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => scrollTo(id)}
                  className={`w-full text-left px-3 py-1.5 rounded text-xs transition-all flex items-center gap-1.5 ${
                    active === id
                      ? "text-white bg-white/8 font-semibold"
                      : "text-white/40 hover:text-white/70"
                  }`}
                >
                  {active === id && (
                    <ChevronRight className="w-3 h-3 shrink-0" style={{ color: "#d5f704" }} />
                  )}
                  <span className={active === id ? "" : "ml-[18px]"}>{label}</span>
                </button>
              ))}
            </nav>
          </div>
        </aside>

        {/* Paper */}
        <main className="flex-1 min-w-0">
          <div
            className="mx-auto rounded-xl overflow-hidden"
            style={{
              maxWidth: 780,
              background: "#ffffff",
              boxShadow: "0 8px 80px rgba(0,0,0,0.7), 0 2px 8px rgba(0,0,0,0.4)",
            }}
          >
            {/* Cover strip */}
            <div
              className="px-12 py-14 text-white"
              style={{
                background: "linear-gradient(135deg, #0a0614 0%, #1a0a3d 60%, #2a0a5e 100%)",
              }}
            >
              <div className="flex items-center gap-3 mb-10">
                <img src={logoImg} alt="Flap Futures" className="w-10 h-10" />
                <span className="font-bold text-xl tracking-widest uppercase">
                  Flap <span style={{ color: "#7a33fa" }}>Futures</span>
                </span>
              </div>
              <h1
                className="font-bold leading-tight mb-4"
                style={{ fontSize: "clamp(26px, 4vw, 38px)" }}
              >
                Perpetual Trading Infrastructure
                <br />
                for the FLAP.SH Ecosystem
              </h1>
              <p className="text-white/50 text-sm mb-8 max-w-lg leading-relaxed">
                A decentralized, non-custodial perpetuals protocol enabling any token listed on
                flap.sh to launch its own leveraged futures market on BNB Smart Chain.
              </p>
              <div className="flex flex-wrap gap-6 text-xs text-white/40 border-t border-white/10 pt-6">
                <span><strong className="text-white/60">Version</strong> · 1.0</span>
                <span><strong className="text-white/60">Date</strong> · March 2026</span>
                <span><strong className="text-white/60">Chain</strong> · BNB Smart Chain</span>
                <span><strong className="text-white/60">Collateral</strong> · USDT (BEP-20)</span>
              </div>
            </div>

            {/* Document body */}
            <div
              className="px-8 sm:px-12 py-12 text-gray-800 leading-relaxed"
              style={{ fontFamily: "'Georgia', 'Times New Roman', serif", fontSize: 15 }}
            >
              {/* ── Abstract ── */}
              <Section id="abstract">
                <SectionTitle>Abstract</SectionTitle>
                <p>
                  Flap Futures is a permissionless perpetual futures protocol built on BNB Smart
                  Chain. It enables any token listed on the <ExternalLink href="https://flap.sh/bnb/board">flap.sh</ExternalLink> launchpad to
                  host its own isolated leveraged market — without centralized gatekeeping,
                  order books, or custodial risk.
                </p>
                <p className="mt-4">
                  The protocol consists of three smart contract layers: a shared parameter
                  registry (<code>FlapParams</code>), a per-market vault and insurance fund
                  (<code>FlapVault</code>), and a per-market perpetuals engine
                  (<code>FlapPerps</code>). A factory contract (<code>FlapFactory</code>)
                  deploys matched vault–perps pairs as minimal proxy clones, making market
                  creation gas-efficient and deterministic.
                </p>
                <p className="mt-4">
                  All collateral is denominated in USDT. Traders use USDT to open long or
                  short positions; profits are paid out in USDT directly from the market vault.
                  Token creators provide an initial USDT insurance deposit to activate trading.
                  Every parameter — leverage cap, position size, open interest limit, and
                  funding rate — adjusts automatically in proportion to vault size and token
                  market capitalisation.
                </p>
              </Section>

              <Divider />

              {/* ── 1. Introduction ── */}
              <Section id="introduction">
                <SectionTitle>1. Introduction</SectionTitle>
                <p>
                  Decentralised Finance (DeFi) has dramatically lowered the barrier to token
                  issuance. Platforms such as flap.sh allow any project to launch a tradeable
                  BEP-20 token within minutes. However, the secondary market experience for
                  these tokens has remained limited to simple spot trading: buy and hold, or
                  sell. Sophisticated instruments like perpetual futures — which allow traders
                  to express directional conviction with leverage, hedge spot exposure, or earn
                  funding payments — have been unavailable for long-tail tokens.
                </p>
                <p className="mt-4">
                  Flap Futures closes this gap. By deploying a self-contained, fully on-chain
                  perpetual market for any flap.sh token, the protocol gives traders
                  institutional-grade instruments while giving token projects a powerful
                  liquidity signal and community engagement mechanism.
                </p>
                <p className="mt-4">
                  The platform is non-custodial by design. No user funds are ever held by a
                  platform multisig or admin key. Smart contracts enforce all rules, and all
                  settlement occurs on-chain without human intervention.
                </p>
              </Section>

              <Divider />

              {/* ── 2. Problem Statement ── */}
              <Section id="problem">
                <SectionTitle>2. Problem Statement</SectionTitle>
                <SubTitle>2.1 Long-Tail Token Markets Lack Depth</SubTitle>
                <p>
                  Centralised exchanges only list tokens with significant market capitalisation
                  and proven liquidity. Decentralised perpetuals protocols (dYdX, GMX, Gains
                  Network) likewise focus on blue-chip assets. Long-tail tokens — which
                  represent the vast majority of on-chain activity — have no access to
                  perpetuals infrastructure.
                </p>
                <SubTitle>2.2 Existing Protocols Are Monolithic</SubTitle>
                <p>
                  Most perpetuals protocols pool all assets into a single liquidity layer,
                  meaning the risk of one market contaminates every other. A large loss event
                  in one asset drains shared reserves. Flap Futures uses fully isolated
                  per-market vaults, so each market's risk is completely ring-fenced.
                </p>
                <SubTitle>2.3 Custody Risk Remains Prevalent</SubTitle>
                <p>
                  Centralised perpetual exchanges (Binance Futures, Bybit, etc.) require users
                  to deposit funds onto the exchange, creating counterparty risk. Flap Futures
                  requires no deposit into a platform-level account: your wallet signs trades
                  directly with on-chain contracts.
                </p>
              </Section>

              <Divider />

              {/* ── 3. Solution Overview ── */}
              <Section id="solution">
                <SectionTitle>3. Solution Overview</SectionTitle>
                <p>
                  Flap Futures provides a turnkey perpetual market for any flap.sh token. The
                  core value proposition is summarised as follows:
                </p>
                <ul className="mt-4 space-y-3 list-none pl-0">
                  {[
                    ["Permissionless Market Creation", "Any flap.sh token creator can deploy a perpetual market by submitting a USDT insurance deposit. No approval process, no whitelist."],
                    ["Isolated Risk", "Each market has its own vault. A liquidation cascade or vault drain in one market cannot affect another."],
                    ["USDT Collateral Only", "All positions are collateralised in USDT (BEP-20), the most stable and liquid asset on BNB Smart Chain."],
                    ["Automated Parameter Flexing", "Leverage caps, position limits, and open-interest ceilings are computed from on-chain data (vault size, market cap) and update automatically."],
                    ["Transparent Pricing", "Price feeds are sourced from DexScreener's public on-chain data — auditable by anyone, with no privileged price-setter."],
                    ["Creator Revenue Share", "Market creators earn 80% of all trading spread fees, providing a direct financial incentive to grow their market's vault."],
                  ].map(([title, desc]) => (
                    <li key={title as string} className="flex gap-3">
                      <span
                        className="mt-1 w-2 h-2 rounded-full shrink-0"
                        style={{ background: "#7a33fa" }}
                      />
                      <span>
                        <strong>{title}.</strong>{" "}{desc}
                      </span>
                    </li>
                  ))}
                </ul>
              </Section>

              <Divider />

              {/* ── 4. Architecture ── */}
              <Section id="architecture">
                <SectionTitle>4. Architecture</SectionTitle>
                <p>
                  The protocol is composed of four distinct smart contract components, each
                  with a clearly scoped responsibility.
                </p>

                <SubTitle>4.1 FlapParams — Global Parameter Registry</SubTitle>
                <p>
                  <code>FlapParams</code> is a singleton contract that stores all
                  platform-level configuration: fee rates, spread percentages, funding rate
                  bounds, minimum insurance requirements, and the formulas used to derive
                  per-market limits. It is owned by the platform and functions as a
                  governance layer for system-wide constants.
                </p>
                <p className="mt-3">
                  Key parameters stored in <code>FlapParams</code> include:
                </p>
                <TableWrap>
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr style={{ background: "#f5f3ff" }}>
                        <Th>Parameter</Th>
                        <Th>Description</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ["spreadFee", "Percentage charged on each trade open/close"],
                        ["creatorShare", "Portion of spread fee distributed to market creator (80%)"],
                        ["platformShare", "Portion of spread fee retained by platform (20%)"],
                        ["fundingRateBounds", "Min/max annualised funding rate"],
                        ["minInsurance(mcap)", "Formula: minimum vault insurance as a function of token market cap"],
                        ["maxLeverage(vault)", "Formula: maximum leverage derived from vault size"],
                        ["maxOI(vault, mcap)", "Formula: maximum open interest derived from vault + mcap"],
                      ].map(([p, d]) => (
                        <tr key={p as string} className="border-b border-gray-100">
                          <Td mono>{p}</Td>
                          <Td>{d}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableWrap>

                <SubTitle>4.2 FlapVault — Per-Market Treasury</SubTitle>
                <p>
                  Each market has its own <code>FlapVault</code> instance. The vault holds:
                </p>
                <ul className="mt-3 space-y-2 list-disc pl-6">
                  <li>
                    <strong>Insurance Fund:</strong> USDT deposited by the token creator.
                    This is the reserve that backs trader profits and covers liquidation
                    shortfalls.
                  </li>
                  <li>
                    <strong>Trader Margin:</strong> USDT posted by traders when opening
                    leveraged positions.
                  </li>
                  <li>
                    <strong>Unrealised PnL Reserve:</strong> The vault dynamically tracks
                    aggregate unrealised profit owed to open positions.
                  </li>
                </ul>
                <p className="mt-3">
                  The vault exposes deposit, withdraw, and settlement functions callable
                  exclusively by its paired <code>FlapPerps</code> contract. This strict
                  access control prevents any external party from moving funds.
                </p>
                <p className="mt-3">
                  Vault status transitions are deterministic and publicly readable:
                </p>
                <TableWrap>
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr style={{ background: "#f5f3ff" }}>
                        <Th>Status</Th>
                        <Th>Meaning</Th>
                        <Th>Allowed Actions</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ["Pending", "Created, insurance not yet met", "Creator deposits only"],
                        ["Live", "Insurance threshold met", "Full trading, open/close/liquidate"],
                        ["Paused", "Creator paused the market", "Close existing positions only"],
                        ["VaultUnlocked", "Creator withdrew insurance", "Close existing positions only"],
                        ["Frozen", "Unsafe: OI > vault", "Emergency close only"],
                      ].map(([s, m, a]) => (
                        <tr key={s as string} className="border-b border-gray-100">
                          <Td mono>{s}</Td>
                          <Td>{m}</Td>
                          <Td>{a}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableWrap>

                <SubTitle>4.3 FlapPerps — Perpetuals Engine</SubTitle>
                <p>
                  <code>FlapPerps</code> is the trading contract. It handles:
                </p>
                <ul className="mt-3 space-y-2 list-disc pl-6">
                  <li>Opening and closing leveraged long/short positions</li>
                  <li>Mark price consumption from the oracle layer</li>
                  <li>PnL calculation and settlement against the vault</li>
                  <li>Funding rate accrual between longs and shorts</li>
                  <li>Liquidation logic and liquidator reward distribution</li>
                  <li>Spread fee collection and routing to creator/platform addresses</li>
                </ul>
                <p className="mt-3">
                  Each <code>FlapPerps</code> instance is paired one-to-one with a
                  <code> FlapVault</code>. The perps contract holds no funds directly;
                  all USDT flows through the vault.
                </p>

                <SubTitle>4.4 FlapFactory — Clone Deployer</SubTitle>
                <p>
                  <code>FlapFactory</code> deploys matched vault–perps pairs using the
                  EIP-1167 minimal proxy (clone) pattern. This means the bytecode of the
                  implementation contracts is written once; new markets cost only a fraction
                  of the gas required to deploy fresh contracts.
                </p>
                <p className="mt-3">
                  When a token creator calls <code>createMarket()</code> on the factory,
                  the following steps occur atomically:
                </p>
                <ol className="mt-3 space-y-2 list-decimal pl-6">
                  <li>A new <code>FlapVault</code> clone is deployed and initialised with the token address, creator address, and minimum insurance amount.</li>
                  <li>A new <code>FlapPerps</code> clone is deployed and initialised pointing to the vault.</li>
                  <li>The vault registers the perps contract as its sole authorised caller.</li>
                  <li>The market record is published to the platform's registry.</li>
                </ol>
              </Section>

              <Divider />

              {/* ── 5. Market Lifecycle ── */}
              <Section id="market-lifecycle">
                <SectionTitle>5. Market Lifecycle</SectionTitle>
                <p>
                  Every Flap Futures market moves through a well-defined lifecycle. Transitions
                  are triggered by on-chain events, not by admin action.
                </p>

                <SubTitle>5.1 Creation</SubTitle>
                <p>
                  A token project submits a market creation transaction through the Flap
                  Futures dashboard. The platform UI validates that the token is listed on
                  flap.sh and computes the minimum insurance requirement from the token's
                  current market capitalisation. Once submitted, the factory deploys the
                  vault–perps pair and the market appears in the <em>Pending</em> state.
                </p>

                <SubTitle>5.2 Activation</SubTitle>
                <p>
                  The creator deposits USDT into the vault until the insurance threshold is
                  met. The threshold is calculated by the formula in <code>FlapParams</code>:
                  a percentage of the token's market cap with an absolute minimum floor.
                  Once the threshold is satisfied, the vault transitions to <em>Live</em>
                  and trading is enabled.
                </p>

                <SubTitle>5.3 Live Trading</SubTitle>
                <p>
                  In the <em>Live</em> state, any wallet can open long or short positions up
                  to the maximum leverage and position size allowed by the current vault size
                  and market cap. The creator may add more USDT to the vault at any time,
                  which increases parameter headroom.
                </p>

                <SubTitle>5.4 Pause and Unlock</SubTitle>
                <p>
                  The creator may pause the market at any time, preventing new position opens
                  while allowing existing positions to be closed. If the creator withdraws
                  their insurance below the threshold, the vault enters the
                  <em> VaultUnlocked</em> state — new opens are blocked and the community is
                  signalled that the creator has reduced their commitment.
                </p>

                <SubTitle>5.5 Frozen State</SubTitle>
                <p>
                  If aggregate open interest exceeds the available vault reserves — which can
                  occur if the token price moves sharply against a dominant position — the
                  vault is automatically set to <em>Frozen</em>. In this state only emergency
                  position closes are permitted. The oracle bot monitors this condition and
                  triggers the state change on-chain.
                </p>
              </Section>

              <Divider />

              {/* ── 6. Trading Mechanics ── */}
              <Section id="trading">
                <SectionTitle>6. Trading Mechanics</SectionTitle>

                <SubTitle>6.1 Positions</SubTitle>
                <p>
                  A position is defined by:
                </p>
                <ul className="mt-3 space-y-1 list-disc pl-6">
                  <li><strong>Direction:</strong> Long (profit when price rises) or Short (profit when price falls)</li>
                  <li><strong>Margin:</strong> USDT collateral posted by the trader</li>
                  <li><strong>Leverage:</strong> Multiplier applied to margin, capped per market</li>
                  <li><strong>Entry Price:</strong> The mark price at position open</li>
                  <li><strong>Size:</strong> Margin × Leverage, denominated in USDT notional</li>
                </ul>

                <SubTitle>6.2 Profit & Loss</SubTitle>
                <p>
                  PnL is calculated against the current mark price at close time:
                </p>
                <Callout>
                  PnL = (exitPrice − entryPrice) / entryPrice × size &nbsp;[Long]
                  <br />
                  PnL = (entryPrice − exitPrice) / entryPrice × size &nbsp;[Short]
                </Callout>
                <p className="mt-3">
                  Profitable trades are settled from the vault's insurance fund. Losing trades
                  return the margin loss to the vault. In all cases, a spread fee is deducted
                  before settlement.
                </p>

                <SubTitle>6.3 Leverage & Limits</SubTitle>
                <p>
                  Maximum leverage and maximum position size are derived from the vault's USDT
                  balance and the token's market capitalisation. As the vault grows, limits
                  expand. As the vault shrinks, limits contract. This mechanic automatically
                  prevents over-leveraged positions from exceeding the vault's capacity to pay
                  out profits.
                </p>
                <p className="mt-3">
                  Open interest (the sum of all position notional values) is also capped.
                  This prevents any single side (all longs or all shorts) from creating
                  uncovered liability larger than the vault can absorb.
                </p>

                <SubTitle>6.4 Liquidation</SubTitle>
                <p>
                  A position is eligible for liquidation when its remaining margin — after
                  unrealised loss and accrued funding — falls below a maintenance margin
                  threshold. Any wallet may trigger liquidation and earns a liquidator reward
                  (a portion of the remaining margin) in exchange for the gas cost.
                </p>
                <p className="mt-3">
                  Liquidations are always executable regardless of market status. This ensures
                  that insolvent positions can always be closed to protect the vault's solvency.
                </p>

                <SubTitle>6.5 Funding Rate</SubTitle>
                <p>
                  A continuous funding payment balances the open interest between longs and
                  shorts. When longs dominate, longs pay shorts. When shorts dominate, shorts
                  pay longs. The rate is bounded by the min/max values in
                  <code> FlapParams</code> and computed proportionally to the OI imbalance.
                  Funding accrues continuously and is settled at position close.
                </p>
              </Section>

              <Divider />

              {/* ── 7. Fee Structure ── */}
              <Section id="fees">
                <SectionTitle>7. Fee Structure</SectionTitle>
                <p>
                  Flap Futures charges a single spread fee on each trade (at open and at
                  close). There are no hidden fees, no rollover fees beyond funding, and no
                  withdrawal fees.
                </p>
                <TableWrap>
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr style={{ background: "#f5f3ff" }}>
                        <Th>Fee Type</Th>
                        <Th>Rate</Th>
                        <Th>Destination</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ["Spread (open)", "0.1% of position notional", "80% creator · 20% platform"],
                        ["Spread (close)", "0.1% of position notional", "80% creator · 20% platform"],
                        ["Funding", "Variable (OI-balanced)", "Paid between longs & shorts"],
                        ["Liquidation reward", "Portion of residual margin", "Liquidating wallet"],
                        ["Insurance deposit", "Configurable minimum", "Stays in vault"],
                      ].map(([t, r, d]) => (
                        <tr key={t as string} className="border-b border-gray-100">
                          <Td>{t}</Td>
                          <Td mono>{r}</Td>
                          <Td>{d}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableWrap>
                <p className="mt-4">
                  Creator fees accumulate on-chain and are claimable at any time through the
                  admin dashboard. Platform fees are routed to the platform treasury address.
                  No fee revenue is locked or time-delayed.
                </p>
              </Section>

              <Divider />

              {/* ── 8. Risk & Safety ── */}
              <Section id="risk">
                <SectionTitle>8. Risk &amp; Safety</SectionTitle>

                <SubTitle>8.1 Vault Isolation</SubTitle>
                <p>
                  Because every market has its own vault, a catastrophic outcome in one market
                  (e.g., rapid token depreciation causing mass liquidations) cannot drain
                  reserves belonging to another market. Traders in Market A are never exposed
                  to the solvency of Market B.
                </p>

                <SubTitle>8.2 Insurance-Backed Markets</SubTitle>
                <p>
                  The creator's insurance deposit is the first line of defence. If trader
                  profits in aggregate exceed the margin returned by losing positions, the
                  shortfall is drawn from the insurance fund. This gives the market a
                  meaningful buffer beyond simple margin coverage.
                </p>

                <SubTitle>8.3 Dynamic Parameter Contraction</SubTitle>
                <p>
                  If the insurance fund is partially depleted, the computed maximum leverage
                  and OI limits automatically contract. This makes it progressively harder to
                  open large new positions as the vault shrinks, reducing the rate of further
                  drawdown without any manual intervention.
                </p>

                <SubTitle>8.4 Freeze Mechanism</SubTitle>
                <p>
                  The oracle bot continuously monitors each market's aggregate unrealised PnL
                  versus the vault balance. If the vault would be insolvent at current prices,
                  it triggers an on-chain freeze, preventing any new positions from
                  exacerbating the shortfall while allowing all existing positions to be
                  emergency-closed.
                </p>

                <SubTitle>8.5 Exit Guarantee</SubTitle>
                <p>
                  Regardless of market status — Live, Paused, VaultUnlocked, or Frozen —
                  traders can always close their open positions. The protocol guarantees this
                  exit path at the smart contract level; no admin action is required and none
                  can block it.
                </p>
              </Section>

              <Divider />

              {/* ── 9. Oracle & Pricing ── */}
              <Section id="oracle">
                <SectionTitle>9. Oracle &amp; Pricing</SectionTitle>
                <p>
                  Mark prices for each market are sourced from <ExternalLink href="https://dexscreener.com">DexScreener</ExternalLink>,
                  which aggregates on-chain DEX trade data for BEP-20 pairs. DexScreener's
                  data is derived entirely from public blockchain state and is not under the
                  control of Flap Futures or any market creator.
                </p>
                <p className="mt-4">
                  An oracle service operated by the platform refreshes prices on-chain for each
                  active market on a regular cadence. The on-chain price is stored in a
                  dedicated oracle contract and consumed by <code>FlapPerps</code> at the
                  moment of each trade and liquidation check.
                </p>
                <p className="mt-4">
                  The price posted is the last trade price of the token/USDT pair on BNB Smart
                  Chain DEXes as reported by DexScreener. Because this data reflects actual
                  settled on-chain trades, it is resistant to off-chain data manipulation.
                </p>
                <p className="mt-4">
                  Funding rates are computed separately by a funding service, also operated by
                  the platform, which reads live open interest from each market and derives the
                  imbalance-adjusted funding rate, posting it on-chain for transparent accrual.
                </p>
              </Section>

              <Divider />

              {/* ── 10. Flex Parameters ── */}
              <Section id="parameters">
                <SectionTitle>10. Flex Parameters</SectionTitle>
                <p>
                  One of the most distinctive features of Flap Futures is that every
                  risk parameter for every market is computed from observable on-chain inputs
                  rather than set manually by an admin. We call this system
                  <strong> Flex Parameters</strong>.
                </p>
                <p className="mt-4">
                  The two primary inputs are:
                </p>
                <ul className="mt-3 space-y-2 list-disc pl-6">
                  <li>
                    <strong>Vault Balance (V):</strong> The total USDT held in the market's
                    vault, including creator insurance and all outstanding trader margins.
                  </li>
                  <li>
                    <strong>Market Capitalisation (M):</strong> The token's USD market cap as
                    reported by the oracle at the last price update.
                  </li>
                </ul>
                <p className="mt-4">
                  From these two inputs, the protocol derives all trading limits:
                </p>
                <TableWrap>
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr style={{ background: "#f5f3ff" }}>
                        <Th>Parameter</Th>
                        <Th>Formula Basis</Th>
                        <Th>Effect</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ["Max Leverage", "f(V)", "Higher vault → higher max leverage"],
                        ["Max Position Size", "f(V)", "Higher vault → larger single positions"],
                        ["Max Open Interest", "f(V, M)", "Capped relative to vault + mcap"],
                        ["Min Insurance", "f(M)", "Scales with token's market cap"],
                        ["Liquidation Threshold", "Fixed margin %", "Constant regardless of vault"],
                      ].map(([p, f, e]) => (
                        <tr key={p as string} className="border-b border-gray-100">
                          <Td>{p}</Td>
                          <Td mono>{f}</Td>
                          <Td>{e}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableWrap>
                <p className="mt-4">
                  This design means no human admin can grant special trading privileges to
                  favoured parties or artificially inflate a market's headroom. Every limit is
                  auditable by anyone who knows the vault balance and the token's market cap —
                  both of which are publicly readable from the blockchain.
                </p>
              </Section>

              <Divider />

              {/* ── 11. Security Model ── */}
              <Section id="security">
                <SectionTitle>11. Security Model</SectionTitle>

                <SubTitle>11.1 Access Control</SubTitle>
                <p>
                  Smart contracts use OpenZeppelin's <code>Ownable</code> pattern scoped to the
                  minimum necessary authority. The platform owner can update
                  <code> FlapParams</code> values but cannot move funds from any vault.
                  The market creator can pause/unpause their market and deposit/withdraw
                  insurance, but cannot access trader margins or profits.
                </p>

                <SubTitle>11.2 Reentrancy Protection</SubTitle>
                <p>
                  All state-changing functions in <code>FlapVault</code> and
                  <code> FlapPerps</code> employ the checks-effects-interactions pattern and
                  OpenZeppelin's <code>ReentrancyGuard</code>, preventing reentrancy attacks
                  regardless of the ERC-20 token implementation used for USDT.
                </p>

                <SubTitle>11.3 Clone Isolation</SubTitle>
                <p>
                  Minimal proxy clones share implementation bytecode but have completely
                  independent storage. A storage collision or initialisation bug in one market
                  cannot propagate to another. Each clone is initialised exactly once through
                  an <code>initialised</code> guard, preventing re-initialisation attacks.
                </p>

                <SubTitle>11.4 Oracle Freshness</SubTitle>
                <p>
                  The on-chain oracle stores a timestamp alongside each price update. If the
                  price is stale beyond a configured staleness threshold, the
                  <code> FlapPerps</code> contract reverts trade requests rather than executing
                  at a potentially outdated mark price. This protects traders from adverse
                  fills during oracle downtime.
                </p>

                <SubTitle>11.5 No Admin Drain Path</SubTitle>
                <p>
                  There is no function in any Flap Futures contract that allows the platform
                  owner or any third party to withdraw USDT from a vault that belongs to trader
                  margins or unrealised profits. The vault's only outbound paths are: (a) trader
                  profit settlement via <code>FlapPerps</code>, (b) creator insurance
                  withdrawal up to their contributed amount, and (c) spread fee distribution
                  to pre-configured fee recipient addresses.
                </p>
              </Section>

              <Divider />

              {/* ── 12. Disclaimer ── */}
              <Section id="disclaimer">
                <SectionTitle>12. Disclaimer</SectionTitle>
                <p>
                  This whitepaper is provided for informational purposes only. It does not
                  constitute financial advice, investment advice, or a solicitation to buy or
                  sell any asset. Perpetual trading involves significant risk, including the
                  loss of the entirety of your deposited collateral. Past performance of any
                  market or token is not indicative of future results.
                </p>
                <p className="mt-4">
                  Smart contracts, like all software, may contain bugs. While the Flap Futures
                  contracts are written to the best of the team's ability and follow established
                  security patterns, no guarantee is made as to their correctness. Users
                  interact with the protocol at their own risk.
                </p>
                <p className="mt-4">
                  Regulatory status of decentralised derivatives trading varies by jurisdiction.
                  It is the user's responsibility to ensure compliance with applicable local
                  laws before using this platform.
                </p>
                <p className="mt-4">
                  The information in this document reflects the state of the protocol as of
                  March 2026 and may be updated without notice as the protocol evolves.
                </p>
              </Section>

              {/* Footer strip */}
              <div
                className="mt-16 pt-8 border-t flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                style={{ borderColor: "#e5e7eb", fontSize: 12, color: "#9ca3af" }}
              >
                <span>© 2026 Flap Futures · All rights reserved</span>
                <span>Built on BNB Smart Chain · Collateral: USDT (BEP-20)</span>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body { background: #fff !important; }
          .sticky, aside, [class*="top-0"] { display: none !important; }
          main { padding: 0 !important; }
          div[style*="box-shadow"] { box-shadow: none !important; border-radius: 0 !important; }
        }
      `}</style>
    </div>
  );
}

function Section({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 mb-2">
      {children}
    </section>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="font-bold mb-5 mt-2 tracking-tight"
      style={{
        fontFamily: "'Georgia', serif",
        fontSize: 22,
        color: "#0a0614",
        borderBottom: "2px solid #7a33fa22",
        paddingBottom: 10,
      }}
    >
      {children}
    </h2>
  );
}

function SubTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3
      className="font-bold mt-8 mb-3"
      style={{ fontFamily: "'Georgia', serif", fontSize: 16, color: "#1a0a3d" }}
    >
      {children}
    </h3>
  );
}

function Divider() {
  return <hr className="my-12" style={{ borderColor: "#e5e7eb" }} />;
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="my-4 px-5 py-4 rounded-lg text-sm"
      style={{
        background: "#f5f3ff",
        borderLeft: "3px solid #7a33fa",
        fontFamily: "monospace",
        color: "#3b0764",
        lineHeight: 1.7,
      }}
    >
      {children}
    </div>
  );
}

function TableWrap({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="my-5 rounded-lg overflow-hidden"
      style={{ border: "1px solid #e5e7eb" }}
    >
      {children}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      className="px-4 py-3 text-left font-semibold"
      style={{ fontSize: 12, color: "#4b5563", fontFamily: "sans-serif" }}
    >
      {children}
    </th>
  );
}

function Td({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <td
      className="px-4 py-2.5 align-top"
      style={{
        fontFamily: mono ? "monospace" : "inherit",
        fontSize: mono ? 12 : 14,
        color: "#374151",
      }}
    >
      {children}
    </td>
  );
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: "#7a33fa", textDecoration: "underline" }}
    >
      {children}
    </a>
  );
}
