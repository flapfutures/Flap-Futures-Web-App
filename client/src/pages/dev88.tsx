import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import logoImg from "@assets/flapfutureslogo_nobg.png";
import { Link } from "wouter";
import {
  ArrowLeft,
  BarChart3,
  DollarSign,
  Activity,
  CheckCircle,
  Clock,
  Trash2,
  Pause,
  Play,
  Loader2,
  RefreshCw,
  ExternalLink,
  Fuel,
  Lock,
  Eye,
  EyeOff,
  Shield,
  Layers,
  Cpu,
  Bot,
  ChevronRight,
  Copy,
} from "lucide-react";
import { FFX_CONTRACTS } from "@/lib/perps-contracts";

interface Market {
  id: string;
  tokenName: string;
  tokenSymbol: string;
  tokenLogo: string | null;
  tokenAddress: string;
  pairAddress: string | null;
  ownerWallet: string;
  status: string;
  mcap: number;
  liquidity: number;
  priceUsd: number;
  volume24h: number;
  openInterest: number;
  vaultBalance: number;
  pendingFees: number;
  platformFees: number;
  feesEarned: number;
  spread: number;
  maxLeverage: number;
  createdAt: string;
  lastRefreshed: string | null;
  refreshInterval: number | null;
  gasBnbRequired: number | null;
  gasBnbPaid: boolean | null;
  marketBotWallet: string | null;
  marketBotPrivkey: string | null;
  contractVault: string | null;
  contractPerps: string | null;
}

interface PlatformFees {
  totalPlatformFees: number;
  totalOpenerFeesPaid: number;
  breakdown: { id: string; symbol: string; platformFees: number }[];
}

const fmt = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M`
  : n >= 1_000   ? `$${(n / 1_000).toFixed(1)}k`
  : `$${n.toFixed(2)}`;

function StatusBadge({ status }: { status: string }) {
  const cfg =
    status === "LIVE"   ? "bg-green-500/15 text-green-400 border-green-500/30" :
    status === "PAUSED" ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" :
                          "bg-white/10 text-white/50 border-white/10";
  return (
    <Badge variant="secondary" className={`text-[10px] font-mono border ${cfg}`}>
      {status === "LIVE" && <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1 inline-block animate-pulse" />}
      {status}
    </Badge>
  );
}

// ── Contract address row ─────────────────────────────────────────────────────
function AddrRow({ label, addr, note }: { label: string; addr: string; note?: string }) {
  const deployed = Boolean(addr);
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
      <div className="flex items-center gap-2 min-w-0">
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${deployed ? "bg-green-400" : "bg-red-400/60"}`} />
        <span className="text-xs font-mono text-white/70 flex-shrink-0">{label}</span>
        {note && <span className="text-[10px] text-white/30 hidden sm:inline truncate">{note}</span>}
      </div>
      {deployed ? (
        <a
          href={`https://bscscan.com/address/${addr}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 font-mono text-[11px] text-[#7a33fa] hover:text-[#9a53ff] transition-colors flex-shrink-0 ml-3"
        >
          {addr.slice(0, 6)}…{addr.slice(-4)}
          <ExternalLink className="w-2.5 h-2.5" />
        </a>
      ) : (
        <span className="text-[10px] text-red-400/60 font-mono flex-shrink-0 ml-3">not deployed</span>
      )}
    </div>
  );
}

// ── Per-market contract row (template, no real address) ──────────────────────
function MarketContractRow({ label, note }: { label: string; note: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400/60 flex-shrink-0" />
        <span className="text-xs font-mono text-white/70">{label}</span>
      </div>
      <span className="text-[10px] text-blue-300/50 ml-3 hidden sm:inline">{note}</span>
    </div>
  );
}

// ── Contract Architecture Panel ───────────────────────────────────────────────
function ContractArchitecture() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

      {/* ── PLATFORM MASTER CONTRACTS ────────────────────────────────── */}
      <Card className="bg-white/5 border-[#7a33fa]/30">
        <div className="p-4 border-b border-[#7a33fa]/20 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#7a33fa]/15 flex items-center justify-center flex-shrink-0">
            <Shield className="w-3.5 h-3.5 text-[#7a33fa]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Platform Master Contracts</p>
            <p className="text-[10px] text-white/40">Deployed once · shared by all markets · full admin control</p>
          </div>
          <Badge variant="secondary" className="ml-auto text-[9px] bg-[#7a33fa]/15 text-[#7a33fa] border-[#7a33fa]/30">6 contracts</Badge>
        </div>
        <div className="p-4 space-y-0">
          <AddrRow
            label="FFXOracle"
            addr={FFX_CONTRACTS.ORACLE}
            note="Shared price feed · platform bot pushes all, market bots push own token"
          />
          <AddrRow
            label="FFXFunding"
            addr={FFX_CONTRACTS.FUNDING}
            note="8h funding rate settlement across all markets"
          />
          <AddrRow
            label="FFXFactory"
            addr={FFX_CONTRACTS.FACTORY}
            note="Deploys vault + perps clone pair per creator market"
          />
          <AddrRow
            label="FFXPlatform"
            addr={FFX_CONTRACTS.PLATFORM}
            note="Admin control — pause, unpause, emergency withdraw any market"
          />
          <AddrRow
            label="FFXVault (impl)"
            addr={FFX_CONTRACTS.VAULT_IMPL}
            note="Clone template — deployed once, cloned for every market"
          />
          <AddrRow
            label="FFXPerps (impl)"
            addr={FFX_CONTRACTS.PERPS_IMPL}
            note="Clone template — deployed once, cloned for every market"
          />
        </div>

        {/* Control flow */}
        <div className="px-4 pb-4">
          <div className="rounded-lg bg-[#7a33fa]/8 border border-[#7a33fa]/15 p-3 space-y-1.5">
            <p className="text-[10px] text-[#7a33fa] font-semibold uppercase tracking-wide">Platform Admin Powers</p>
            <div className="space-y-1">
              {[
                "Pause / unpause any market instantly",
                "Emergency drain any market vault",
                "Set price for any token via platform bot",
                "Collect platform fees from all markets",
                "Update oracle, funding, factory addresses",
              ].map(p => (
                <div key={p} className="flex items-center gap-1.5">
                  <ChevronRight className="w-3 h-3 text-[#7a33fa]/60 flex-shrink-0" />
                  <span className="text-[10px] text-white/50">{p}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* ── PER-MARKET CONTRACTS ──────────────────────────────────────── */}
      <Card className="bg-white/5 border-blue-500/20">
        <div className="p-4 border-b border-blue-500/15 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
            <Layers className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Per-Market Contracts</p>
            <p className="text-[10px] text-white/40">Auto-deployed by FFXFactory when a creator launches a market</p>
          </div>
          <Badge variant="secondary" className="ml-auto text-[9px] bg-blue-500/10 text-blue-400 border-blue-500/20">per market</Badge>
        </div>
        <div className="p-4 space-y-0">
          <MarketContractRow
            label="FFXVault  (clone)"
            note="Holds USDT collateral · opener + insurance deposits"
          />
          <MarketContractRow
            label="FFXPerps  (clone)"
            note="All trading logic — positions, leverage, TP/SL, limits"
          />
          <MarketContractRow
            label="Price slot in FFXOracle"
            note="Token-specific feed — only this market's bot can write it"
          />
          <MarketContractRow
            label="Dedicated Bot Wallet"
            note="1 wallet per market — generated by platform at market creation"
          />
        </div>

        {/* Market lifecycle */}
        <div className="px-4 pb-4 space-y-2">
          <div className="rounded-lg bg-blue-500/8 border border-blue-500/15 p-3 space-y-1.5">
            <p className="text-[10px] text-blue-400 font-semibold uppercase tracking-wide">Market Lifecycle</p>
            <div className="space-y-1">
              {[
                { step: "1", txt: "Creator submits market + deposits BNB gas" },
                { step: "2", txt: "Platform runs FFXFactory.createMarket()" },
                { step: "3", txt: "Factory clones Vault + Perps, registers bot in Oracle" },
                { step: "4", txt: "Creator deposits USDT vault + insurance" },
                { step: "5", txt: "Market bot starts pushing prices → market goes LIVE" },
              ].map(({ step, txt }) => (
                <div key={step} className="flex items-start gap-2">
                  <span className="text-[9px] font-mono text-blue-400/70 w-3 flex-shrink-0 mt-0.5">{step}.</span>
                  <span className="text-[10px] text-white/50">{txt}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg bg-white/3 border border-white/8 p-3">
            <p className="text-[10px] text-white/30 font-semibold uppercase tracking-wide mb-1.5">Market Bot Restrictions</p>
            <div className="space-y-1">
              {[
                "Can only push price for its own token",
                "Cannot touch other markets' vaults or perps",
                "Platform bot can override any market's price",
              ].map(r => (
                <div key={r} className="flex items-center gap-1.5">
                  <span className="text-[10px] text-white/20">—</span>
                  <span className="text-[10px] text-white/40">{r}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Architecture note */}
        <div className="px-4 pb-4">
          <div className="flex items-start gap-2 rounded-lg bg-[#d5f704]/5 border border-[#d5f704]/15 p-3">
            <Cpu className="w-3.5 h-3.5 text-[#d5f704]/60 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] text-[#d5f704]/80 font-semibold mb-0.5">EIP-1167 Clone Architecture</p>
              <p className="text-[10px] text-white/35 leading-relaxed">
                Vault and Perps are cheap proxy clones of the single verified implementation. Every market shares the same logic — only the state (collateral, positions, OI) is isolated per clone.
              </p>
            </div>
          </div>
        </div>
      </Card>

    </div>
  );
}

function Dev88Panel({ onLockOut }: { onLockOut: () => void }) {
  const [markets, setMarkets]             = useState<Market[]>([]);
  const [fees, setFees]                   = useState<PlatformFees | null>(null);
  const [loading, setLoading]             = useState(true);
  const [actionId, setActionId]           = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [linkingPlatform, setLinkingPlatform] = useState(false);
  const [linkMsg, setLinkMsg]             = useState<string | null>(null);
  const [botPaused, setBotPaused]         = useState(false);
  const [botToggling, setBotToggling]     = useState(false);
  const [revealedPrivkeys, setRevealedPrivkeys] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [mRes, fRes, bRes] = await Promise.all([
        fetch("/api/admin/markets"),
        fetch("/api/admin/platform-fees"),
        fetch("/api/admin/bot/status"),
      ]);
      if (mRes.ok) setMarkets(await mRes.json());
      if (fRes.ok) setFees(await fRes.json());
      if (bRes.ok) { const b = await bRes.json(); setBotPaused(b.paused); }
    } catch {}
    setLoading(false);
  }, []);

  const toggleBot = async () => {
    setBotToggling(true);
    try {
      const endpoint = botPaused ? "/api/admin/bot/start" : "/api/admin/bot/stop";
      const r = await fetch(endpoint, { method: "POST" });
      if (r.ok) { const j = await r.json(); setBotPaused(j.paused); }
    } catch {}
    setBotToggling(false);
  };

  const regenBotWallet = async (id: string) => {
    setActionId(id);
    try {
      const r = await fetch(`/api/admin/markets/${id}/regen-bot-wallet`, { method: "POST" });
      if (r.ok) { await load(); }
    } catch {}
    setActionId(null);
  };

  useEffect(() => { load(); }, [load]);

  const pause = async (id: string) => {
    setActionId(id);
    await fetch(`/api/admin/markets/${id}/pause`, { method: "POST" });
    await load();
    setActionId(null);
  };

  const resume = async (id: string) => {
    setActionId(id);
    await fetch(`/api/admin/markets/${id}/resume`, { method: "POST" });
    await load();
    setActionId(null);
  };

  const confirmGas = async (id: string) => {
    setActionId(id);
    await fetch(`/api/admin/markets/${id}/confirm-gas`, { method: "POST" });
    await load();
    setActionId(null);
  };

  const del = async (id: string) => {
    setActionId(id);
    await fetch(`/api/admin/markets/${id}`, { method: "DELETE" });
    setConfirmDelete(null);
    await load();
    setActionId(null);
  };

  const setupLinks = async () => {
    setLinkingPlatform(true);
    setLinkMsg(null);
    try {
      const r = await fetch("/api/admin/setup-platform-links", { method: "POST" });
      const j = await r.json();
      setLinkMsg(j.message || j.error || (r.ok ? "Done — check bot logs." : "Failed"));
    } catch (e: any) {
      setLinkMsg(e?.message || "Error");
    } finally {
      setLinkingPlatform(false);
    }
  };

  const live     = markets.filter(m => m.status === "LIVE").length;
  const paused   = markets.filter(m => m.status === "PAUSED").length;
  const totalVol = markets.reduce((s, m) => s + (m.volume24h || 0), 0);

  return (
    <div className="min-h-screen bg-background text-white">
      <header className="sticky top-0 z-50 bg-background/90 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/">
                <ArrowLeft className="w-4 h-4" />
              </Link>
            </Button>
            <Link href="/" className="flex items-center gap-2">
              <img src={logoImg} alt="FFX" className="w-7 h-7" />
              <span className="font-heading font-bold text-sm text-white hidden sm:inline">FFX FUTURES</span>
            </Link>
            <span className="text-white/20 mx-1 hidden sm:inline">/</span>
            <Badge variant="secondary" className="text-[10px] font-mono bg-red-500/10 text-red-400 border-red-500/20">
              Admin · dev88
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {/* Bot price-refresh toggle */}
            <Button
              variant="ghost" size="sm"
              onClick={toggleBot}
              disabled={botToggling}
              className={`text-xs ${botPaused ? "text-red-400/80 hover:text-red-300" : "text-green-400/80 hover:text-green-300"}`}
              title={botPaused ? "Oracle bot PAUSED — click to resume price refresh" : "Oracle bot RUNNING — click to pause price refresh"}
            >
              {botToggling
                ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                : botPaused
                  ? <><span className="w-2 h-2 rounded-full bg-red-400 mr-1.5 animate-pulse inline-block" />Bot Paused</>
                  : <><span className="w-2 h-2 rounded-full bg-green-400 mr-1.5 animate-pulse inline-block" />Bot Running</>
              }
            </Button>
            <Button
              variant="ghost" size="sm"
              onClick={setupLinks}
              disabled={linkingPlatform}
              className="text-xs text-violet-400/70 hover:text-violet-300"
              title="Wire oracle.setFactory + funding.setFactory + factory.setPlatformContract (run once after mainnet deploy)"
            >
              {linkingPlatform
                ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                : <Activity className="w-3.5 h-3.5 mr-1.5" />}
              Setup Links
            </Button>
            <Button variant="ghost" size="sm" onClick={load} disabled={loading} className="text-xs text-white/50">
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              variant="ghost" size="sm"
              onClick={onLockOut}
              className="text-xs text-white/30 hover:text-white/60"
              title="Lock panel"
            >
              <Lock className="w-3.5 h-3.5" />
            </Button>
          </div>
          {linkMsg && (
            <div className="absolute top-14 right-4 text-xs px-3 py-1.5 rounded bg-violet-500/20 border border-violet-500/30 text-violet-300 z-50">
              {linkMsg}
            </div>
          )}
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Live Markets",  value: live,                              icon: CheckCircle, color: "text-green-400" },
            { label: "Paused",        value: paused,                            icon: Clock,       color: "text-yellow-400" },
            { label: "24h Volume",    value: fmt(totalVol),                     icon: BarChart3,   color: "text-blue-400" },
            { label: "Platform Fees", value: fmt(fees?.totalPlatformFees ?? 0), icon: DollarSign,  color: "text-[#d5f704]" },
          ].map(s => (
            <Card key={s.label} className="bg-white/5 border-white/10 p-4">
              <div className="flex items-center gap-1.5 mb-1.5">
                <s.icon className={`w-3.5 h-3.5 ${s.color}`} />
                <span className="text-[10px] text-white/40 uppercase tracking-wide">{s.label}</span>
              </div>
              <p className={`font-mono text-lg font-semibold ${s.color}`}>{s.value}</p>
            </Card>
          ))}
        </div>

        {/* Contract Architecture */}
        <ContractArchitecture />

        <Card className="bg-white/5 border-white/10">
          <div className="p-5 border-b border-white/10 flex items-center justify-between">
            <h2 className="font-heading font-semibold text-white">All Markets ({markets.length})</h2>
            <Activity className="w-4 h-4 text-white/30" />
          </div>

          {loading && markets.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-white/30 gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading markets…
            </div>
          ) : markets.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-white/30 text-sm">No markets yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px]">
                <thead>
                  <tr className="text-[10px] text-white/30 uppercase tracking-wide border-b border-white/10">
                    <th className="text-left px-5 py-3 font-medium">Token</th>
                    <th className="text-left px-3 py-3 font-medium">Owner</th>
                    <th className="text-left px-3 py-3 font-medium">Market Bot</th>
                    <th className="text-left px-3 py-3 font-medium">Contracts</th>
                    <th className="text-right px-3 py-3 font-medium">Vault $</th>
                    <th className="text-right px-3 py-3 font-medium">Fees</th>
                    <th className="text-center px-3 py-3 font-medium">Status</th>
                    <th className="text-right px-5 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {markets.map(m => {
                    const busy = actionId === m.id;
                    return (
                      <tr key={m.id} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2.5">
                            {m.tokenLogo ? (
                              <img src={m.tokenLogo} alt={m.tokenSymbol} className="w-8 h-8 rounded-full" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-[#7a33fa]/20 flex items-center justify-center text-xs font-bold text-[#7a33fa]">
                                {m.tokenSymbol.charAt(0)}
                              </div>
                            )}
                            <div>
                              <p className="text-sm font-semibold text-white">{m.tokenName}</p>
                              <p className="text-[10px] font-mono text-white/40">{m.tokenSymbol}/USDT</p>
                            </div>
                          </div>
                        </td>
                        {/* Owner wallet */}
                        <td className="px-3 py-3">
                          <a
                            href={`https://bscscan.com/address/${m.ownerWallet}`}
                            target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 font-mono text-[11px] text-white/50 hover:text-white transition-colors"
                          >
                            {m.ownerWallet.slice(0, 6)}…{m.ownerWallet.slice(-4)}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </td>

                        {/* Per-market bot wallet + privkey */}
                        <td className="px-3 py-3 min-w-[140px]">
                          {m.marketBotWallet ? (
                            <div className="space-y-1">
                              {/* Wallet address */}
                              <a
                                href={`https://bscscan.com/address/${m.marketBotWallet}`}
                                target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1 font-mono text-[11px] text-blue-400/80 hover:text-blue-300 transition-colors"
                                title={m.marketBotWallet}
                              >
                                <Bot className="w-3 h-3 flex-shrink-0" />
                                {m.marketBotWallet.slice(0, 6)}…{m.marketBotWallet.slice(-4)}
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                              {/* Private key row */}
                              {m.marketBotPrivkey ? (
                                <div className="flex items-center gap-1">
                                  <span className="font-mono text-[10px] text-white/30">
                                    {revealedPrivkeys.has(m.id)
                                      ? m.marketBotPrivkey
                                      : "••••••••••••••••"}
                                  </span>
                                  <button
                                    onClick={() => setRevealedPrivkeys(prev => {
                                      const s = new Set(prev);
                                      s.has(m.id) ? s.delete(m.id) : s.add(m.id);
                                      return s;
                                    })}
                                    className="text-white/20 hover:text-white/60 transition-colors"
                                    title={revealedPrivkeys.has(m.id) ? "Hide private key" : "Reveal private key"}
                                  >
                                    {revealedPrivkeys.has(m.id)
                                      ? <EyeOff className="w-3 h-3" />
                                      : <Eye className="w-3 h-3" />}
                                  </button>
                                  {revealedPrivkeys.has(m.id) && (
                                    <button
                                      onClick={() => { navigator.clipboard.writeText(m.marketBotPrivkey!); }}
                                      className="text-white/20 hover:text-white/60 transition-colors"
                                      title="Copy private key"
                                    >
                                      <Copy className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[10px] text-white/15 font-mono">no privkey</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] text-white/20 font-mono">no bot</span>
                          )}
                        </td>

                        {/* Contract addresses (vault + perps) */}
                        <td className="px-3 py-3">
                          <div className="space-y-0.5">
                            {m.contractVault ? (
                              <a
                                href={`https://bscscan.com/address/${m.contractVault}`}
                                target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1 font-mono text-[10px] text-[#7a33fa]/70 hover:text-[#7a33fa] transition-colors"
                                title={`Vault: ${m.contractVault}`}
                              >
                                <span className="text-white/30">V:</span>{m.contractVault.slice(0, 6)}…{m.contractVault.slice(-4)}
                                <ExternalLink className="w-2 h-2" />
                              </a>
                            ) : (
                              <span className="text-[10px] text-white/15 font-mono">no vault</span>
                            )}
                            {m.contractPerps ? (
                              <a
                                href={`https://bscscan.com/address/${m.contractPerps}`}
                                target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1 font-mono text-[10px] text-[#d5f704]/60 hover:text-[#d5f704] transition-colors"
                                title={`Perps: ${m.contractPerps}`}
                              >
                                <span className="text-white/30">P:</span>{m.contractPerps.slice(0, 6)}…{m.contractPerps.slice(-4)}
                                <ExternalLink className="w-2 h-2" />
                              </a>
                            ) : (
                              <span className="text-[10px] text-white/15 font-mono">no perps</span>
                            )}
                          </div>
                        </td>

                        <td className="px-3 py-3 text-right font-mono text-xs text-white/70">{fmt(m.vaultBalance || 0)}</td>
                        <td className="px-3 py-3 text-right font-mono text-xs text-[#d5f704]">{fmt(m.platformFees || 0)}</td>
                        <td className="px-3 py-3 text-center"><StatusBadge status={m.status} /></td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Regen bot wallet — for markets missing one (pre-existing) */}
                            {!m.marketBotWallet && (
                              <Button
                                variant="ghost" size="sm"
                                className="h-7 px-2 text-xs text-blue-400 hover:bg-blue-500/10"
                                onClick={() => regenBotWallet(m.id)}
                                disabled={busy}
                                title="Generate a dedicated bot wallet for this market"
                              >
                                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />}
                                <span className="ml-1 hidden sm:inline">Gen Bot</span>
                              </Button>
                            )}
                            {m.gasBnbRequired && m.gasBnbRequired > 0 && !m.gasBnbPaid && (
                              <Button
                                variant="ghost" size="sm"
                                className="h-7 px-2 text-xs text-[#d5f704] hover:bg-[#d5f704]/10"
                                onClick={() => confirmGas(m.id)}
                                disabled={busy}
                                title="Confirm BNB gas received"
                              >
                                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Fuel className="w-3.5 h-3.5" />}
                                <span className="ml-1 hidden sm:inline">Gas ✓</span>
                              </Button>
                            )}
                            {m.status === "LIVE" ? (
                              <Button
                                variant="ghost" size="sm"
                                className="h-7 px-2 text-xs text-yellow-400 hover:bg-yellow-500/10"
                                onClick={() => pause(m.id)}
                                disabled={busy}
                              >
                                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Pause className="w-3.5 h-3.5" />}
                                <span className="ml-1 hidden sm:inline">Pause</span>
                              </Button>
                            ) : m.status === "PAUSED" ? (
                              <Button
                                variant="ghost" size="sm"
                                className="h-7 px-2 text-xs text-green-400 hover:bg-green-500/10"
                                onClick={() => resume(m.id)}
                                disabled={busy}
                              >
                                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                                <span className="ml-1 hidden sm:inline">Resume</span>
                              </Button>
                            ) : null}

                            {confirmDelete === m.id ? (
                              <div className="flex items-center gap-1">
                                <Button
                                  size="sm"
                                  className="h-7 px-2 text-xs bg-red-600 hover:bg-red-700 text-white"
                                  onClick={() => del(m.id)}
                                  disabled={busy}
                                >
                                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Confirm"}
                                </Button>
                                <Button
                                  variant="ghost" size="sm"
                                  className="h-7 px-2 text-xs text-white/40"
                                  onClick={() => setConfirmDelete(null)}
                                >
                                  Cancel
                                </Button>
                              </div>
                            ) : (
                              <Button
                                variant="ghost" size="sm"
                                className="h-7 px-2 text-xs text-red-400 hover:bg-red-500/10"
                                onClick={() => setConfirmDelete(m.id)}
                                disabled={busy}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span className="ml-1 hidden sm:inline">Delete</span>
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

      </div>
    </div>
  );
}

export default function Dev88() {
  const [authed,    setAuthed]    = useState(false);
  const [checking,  setChecking]  = useState(true);
  const [pw,        setPw]        = useState("");
  const [pwError,   setPwError]   = useState("");
  const [showPw,    setShowPw]    = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const pwInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/dev88/check", { credentials: "include" })
      .then(r => r.json())
      .then((d: { authed: boolean }) => { setAuthed(d.authed); setChecking(false); })
      .catch(() => setChecking(false));
  }, []);

  useEffect(() => {
    if (!checking && !authed) setTimeout(() => pwInputRef.current?.focus(), 80);
  }, [checking, authed]);

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pw.trim()) return;
    setPwLoading(true);
    setPwError("");
    try {
      const res = await fetch("/api/dev88/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password: pw }),
      });
      if (res.ok) {
        setAuthed(true);
        setPw("");
      } else {
        setPwError("Incorrect password.");
        setPw("");
        setTimeout(() => pwInputRef.current?.focus(), 50);
      }
    } catch {
      setPwError("Network error. Try again.");
    }
    setPwLoading(false);
  };

  const lockOut = async () => {
    await fetch("/api/dev88/logout", { method: "POST", credentials: "include" });
    setAuthed(false);
    setPw("");
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-white/40" />
      </div>
    );
  }

  if (authed) {
    return <Dev88Panel onLockOut={lockOut} />;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="w-full max-w-sm bg-white/5 border-white/10 p-8 space-y-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
            <Lock className="w-5 h-5 text-purple-400" />
          </div>
          <div className="text-center">
            <p className="font-heading font-bold text-white text-lg">dev88 — Admin</p>
            <p className="text-xs text-white/40 mt-1">Enter password to continue</p>
          </div>
        </div>
        <form onSubmit={submitPassword} className="space-y-4">
          <div className="relative">
            <input
              ref={pwInputRef}
              type={showPw ? "text" : "password"}
              value={pw}
              onChange={e => { setPw(e.target.value); setPwError(""); }}
              placeholder="Password"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 pr-10 text-sm text-white placeholder-white/30 outline-none focus:border-purple-500/50 transition-colors"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPw(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
              tabIndex={-1}
            >
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {pwError && <p className="text-xs text-red-400">{pwError}</p>}
          <Button
            type="submit"
            disabled={!pw.trim() || pwLoading}
            className="w-full bg-purple-600 hover:bg-purple-500 text-white"
          >
            {pwLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Unlock"}
          </Button>
        </form>
        <div className="text-center">
          <Link href="/" className="text-xs text-white/30 hover:text-white/60 transition-colors">← Back to home</Link>
        </div>
      </Card>
    </div>
  );
}
