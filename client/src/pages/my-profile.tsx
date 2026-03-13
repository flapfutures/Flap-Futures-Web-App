import { useEffect, useState } from "react";
import { useWalletContext } from "@/components/WalletProvider";
import { Loader2, Copy, ExternalLink, TrendingUp, Wallet, BarChart3, ShieldCheck, CheckCheck, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

interface Trade {
  id: string; marketId: string; direction: string; size: number;
  leverage: number; entryPrice: number; exitPrice?: number;
  pnl?: number; status: string; feeOpen?: number; feeClose?: number;
  createdAt: string; closedAt?: string;
}

interface Market {
  id: string; tokenName: string; tokenSymbol: string; tokenLogo?: string;
  vaultBalance: number; feesEarned: number; status: string; pendingFees?: number;
}

const fmt = (n: number) =>
  n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toFixed(2)}`;

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="p-4 rounded-xl border border-white/10 bg-white/5 space-y-1">
      <div className="text-white/40 text-xs">{label}</div>
      <div className={`text-xl font-bold ${color ?? "text-white"}`}>{value}</div>
      {sub && <div className="text-white/30 text-xs">{sub}</div>}
    </div>
  );
}

export default function MyProfile({ embedded = false }: { embedded?: boolean }) {
  const { address } = useWalletContext();
  const [trades, setTrades]   = useState<Trade[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied]   = useState(false);

  useEffect(() => {
    if (!address) { setLoading(false); return; }
    Promise.all([
      fetch("/api/trades/mine",   { credentials: "include" }).then(r => r.json()),
      fetch("/api/markets/mine",  { credentials: "include" }).then(r => r.json()),
    ]).then(([t, m]) => {
      if (Array.isArray(t)) setTrades(t);
      if (Array.isArray(m)) setMarkets(m);
    }).finally(() => setLoading(false));
  }, [address]);

  const openTrades   = trades.filter(t => t.status === "OPEN");
  const closedTrades = trades.filter(t => t.status === "CLOSED");
  const totalPnl     = closedTrades.reduce((s, t) => s + (t.pnl ?? 0), 0);
  const totalFeesPaid = trades.reduce((s, t) => s + (t.feeOpen ?? 0) + (t.feeClose ?? 0), 0);
  const isCreator    = markets.length > 0;
  const totalVault   = markets.reduce((s, m) => s + (m.vaultBalance ?? 0), 0);
  const totalFeesEarned = markets.reduce((s, m) => s + (m.feesEarned ?? 0), 0);

  function copyAddr() {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (!address) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-white/40">
        <Wallet className="w-10 h-10" />
        <p className="text-sm">Connect your wallet to view your profile</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-7 h-7 text-[#7a33fa] animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">

      {/* ── Wallet identity ─────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4 p-5 rounded-2xl border border-white/10 bg-white/5"
      >
        <div
          className="w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-lg"
          style={{ background: "linear-gradient(135deg, #7a33fa 0%, #d5f704 100%)", color: "#0a0614" }}
        >
          {address.slice(2, 4).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white font-mono text-sm truncate">
              {address.slice(0, 10)}…{address.slice(-6)}
            </span>
            <button
              onClick={copyAddr}
              className="flex items-center gap-1 text-white/30 hover:text-white/70 transition-colors"
              title="Copy address"
            >
              {copied ? <CheckCheck className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            <a
              href={`https://bscscan.com/address/${address}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-white/30 hover:text-[#d5f704] transition-colors"
              title="View on BSCScan"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#7a33fa]/20 text-[#b07cff]">Trader</span>
            {isCreator && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#d5f704]/15 text-[#d5f704]">Market Creator</span>
            )}
            <span className="text-white/25 text-xs">BSC BEP-20</span>
          </div>
        </div>
      </motion.div>

      {/* ── Trader Panel ─────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-[#7a33fa]" />
          <span className="text-white font-semibold text-sm">Trader Stats</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total Trades"    value={trades.length.toString()}   sub={`${openTrades.length} open`} />
          <StatCard label="Closed Trades"   value={closedTrades.length.toString()} />
          <StatCard
            label="Total P&L"
            value={totalPnl === 0 ? "$0.00" : (totalPnl >= 0 ? "+" : "") + fmt(Math.abs(totalPnl))}
            color={totalPnl > 0 ? "text-green-400" : totalPnl < 0 ? "text-red-400" : "text-white"}
          />
          <StatCard label="Fees Paid"       value={fmt(totalFeesPaid)} />
        </div>

        {/* Trade history table */}
        {trades.length > 0 && (
          <div className="mt-4 rounded-xl border border-white/10 overflow-hidden">
            <div className="grid grid-cols-5 text-xs text-white/30 px-4 py-2 border-b border-white/5 bg-white/3">
              <span>Pair</span><span>Dir</span><span>Size</span><span>P&L</span><span>Status</span>
            </div>
            <div className="divide-y divide-white/5 max-h-48 overflow-y-auto">
              {trades.slice(0, 20).map(t => {
                const pnl = t.pnl ?? 0;
                return (
                  <div key={t.id} className="grid grid-cols-5 text-xs px-4 py-2.5 text-white/70 hover:bg-white/3">
                    <span className="text-white/90 font-medium truncate">{t.marketId?.slice(0,8)}…</span>
                    <span className={t.direction === "LONG" ? "text-green-400" : "text-red-400"}>{t.direction}</span>
                    <span>{fmt(t.size)}</span>
                    <span className={t.status === "OPEN" ? "text-white/40" : pnl >= 0 ? "text-green-400" : "text-red-400"}>
                      {t.status === "OPEN" ? "—" : (pnl >= 0 ? "+" : "") + fmt(Math.abs(pnl))}
                    </span>
                    <span className={t.status === "OPEN" ? "text-blue-400" : "text-white/30"}>{t.status}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {trades.length === 0 && (
          <div className="mt-4 text-center text-white/25 text-sm py-6 rounded-xl border border-white/5">
            No trades yet — head to Futures or Spot to start trading
          </div>
        )}
      </motion.div>

      {/* ── Market Creator Panel ─────────────────────── */}
      {isCreator && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="w-4 h-4 text-[#d5f704]" />
            <span className="text-white font-semibold text-sm">Market Creator Stats</span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 mb-4">
            <StatCard label="Markets Launched" value={markets.length.toString()} />
            <StatCard label="Total Vault"       value={fmt(totalVault)} />
            <StatCard label="Fees Earned"       value={fmt(totalFeesEarned)} />
          </div>

          {/* Markets list */}
          <div className="rounded-xl border border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-white/5 bg-white/3 text-xs text-white/30">
              Your Markets
            </div>
            {markets.map(m => (
              <button
                key={m.id}
                onClick={() => { window.location.hash = `market-${m.id}`; }}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
              >
                <div className="flex items-center gap-3">
                  {m.tokenLogo
                    ? <img src={m.tokenLogo} className="w-7 h-7 rounded-full" alt="" />
                    : <div className="w-7 h-7 rounded-full bg-[#7a33fa]/30 flex items-center justify-center text-xs text-[#b07cff] font-bold">{m.tokenSymbol?.[0]}</div>
                  }
                  <div className="text-left">
                    <div className="text-white text-sm font-medium">{m.tokenSymbol}/USDT</div>
                    <div className="text-white/30 text-xs">{m.tokenName}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-right">
                  <div>
                    <div className="text-white/40">Vault</div>
                    <div className="text-white">{fmt(m.vaultBalance ?? 0)}</div>
                  </div>
                  <div>
                    <div className="text-white/40">Status</div>
                    <div className={m.status === "LIVE" ? "text-green-400" : "text-orange-400"}>{m.status}</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/20" />
                </div>
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {!isCreator && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="rounded-xl border border-white/5 bg-white/3 p-5 flex items-center gap-4"
        >
          <BarChart3 className="w-8 h-8 text-white/15 flex-shrink-0" />
          <div>
            <div className="text-white/50 text-sm font-medium">Want to earn as a Market Creator?</div>
            <div className="text-white/25 text-xs mt-0.5">Launch your own perpetuals market and earn fees from every trade.</div>
          </div>
          <button
            onClick={() => { window.location.hash = "apply"; }}
            className="ml-auto flex-shrink-0 text-xs px-3 py-1.5 rounded-lg border border-[#7a33fa]/40 text-[#b07cff] hover:bg-[#7a33fa]/10 transition-colors"
          >
            Launch Market →
          </button>
        </motion.div>
      )}
    </div>
  );
}
