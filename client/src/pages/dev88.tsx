import { useState, useEffect, useCallback } from "react";
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
} from "lucide-react";

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

export default function Dev88() {
  const [markets, setMarkets]           = useState<Market[]>([]);
  const [fees, setFees]                 = useState<PlatformFees | null>(null);
  const [loading, setLoading]           = useState(true);
  const [actionId, setActionId]         = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [mRes, fRes] = await Promise.all([
        fetch("/api/admin/markets"),
        fetch("/api/admin/platform-fees"),
      ]);
      if (mRes.ok) setMarkets(await mRes.json());
      if (fRes.ok) setFees(await fRes.json());
    } catch {}
    setLoading(false);
  }, []);

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

  const live   = markets.filter(m => m.status === "LIVE").length;
  const paused = markets.filter(m => m.status === "PAUSED").length;
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
          <Button variant="ghost" size="sm" onClick={load} disabled={loading} className="text-xs text-white/50">
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Live Markets",   value: live,                          icon: CheckCircle, color: "text-green-400" },
            { label: "Paused",         value: paused,                        icon: Clock,       color: "text-yellow-400" },
            { label: "24h Volume",     value: fmt(totalVol),                 icon: BarChart3,   color: "text-blue-400" },
            { label: "Platform Fees",  value: fmt(fees?.totalPlatformFees ?? 0), icon: DollarSign,  color: "text-[#d5f704]" },
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

        {/* Markets table */}
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
                    <th className="text-right px-3 py-3 font-medium">Mcap</th>
                    <th className="text-right px-3 py-3 font-medium">Vault</th>
                    <th className="text-right px-3 py-3 font-medium">Platform Fees</th>
                    <th className="text-center px-3 py-3 font-medium">Gas BNB</th>
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
                        <td className="px-3 py-3 text-right font-mono text-xs text-white/70">{fmt(m.mcap || 0)}</td>
                        <td className="px-3 py-3 text-right font-mono text-xs text-white/70">{fmt(m.vaultBalance || 0)}</td>
                        <td className="px-3 py-3 text-right font-mono text-xs text-[#d5f704]">{fmt(m.platformFees || 0)}</td>
                        <td className="px-3 py-3 text-center">
                          {m.gasBnbRequired && m.gasBnbRequired > 0 ? (
                            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full border ${m.gasBnbPaid ? "text-green-400 border-green-500/30 bg-green-500/10" : "text-amber-400 border-amber-500/30 bg-amber-500/10"}`}>
                              {m.gasBnbRequired} BNB {m.gasBnbPaid ? "✓" : "pending"}
                            </span>
                          ) : (
                            <span className="text-white/20 text-[10px]">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center"><StatusBadge status={m.status} /></td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
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
