import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import logoImg from "@assets/flapfutureslogo_nobg.png";
import { Link, useLocation } from "wouter";
import {
  Plus, TrendingUp, TrendingDown, BarChart3, Wallet, LogOut, ExternalLink,
  RefreshCw, AlertTriangle, CheckCircle, PauseCircle, Loader2, ArrowRight,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  calcSpread, calcMaxLeverage, calcMaxPosition, calcMaxOI,
  vaultHealth, vaultHealthLabel, vaultHealthColor, vaultHealthBg,
} from "@/lib/flex-params";

interface Market {
  id: string; tokenName: string; tokenSymbol: string; tokenLogo: string | null;
  status: string; vaultBalance: number; insuranceBalance: number;
  openInterest: number; longRatio: number; feesEarned: number; volume24h: number;
  mcap: number; createdAt: string; tokenAddress: string;
  spread: number | null; maxLeverage: number | null; maxPosition: number | null; maxOI: number | null;
}

interface Trade {
  id: string; marketId: string; side: string; status: string; size: number;
  leverage: number; entryPrice: number; exitPrice: number | null; pnl: number | null;
  feeOpen: number | null; openedAt: string; closedAt: string | null;
}

function fmt(n: number) {
  if (!n) return "$0";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

function shortAddr(addr: string) {
  return addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "";
}

function statusBadge(status: string) {
  if (status === "LIVE")         return <Badge className="bg-green-500/15 text-green-400 border border-green-500/30 text-xs">● Live</Badge>;
  if (status === "VAULT_UNLOCK") return <Badge className="bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 text-xs">🔓 Unlock</Badge>;
  if (status === "FROZEN")       return <Badge className="bg-blue-500/15 text-blue-400 border border-blue-500/30 text-xs">❄ Frozen</Badge>;
  if (status === "PAUSED")       return <Badge className="bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 text-xs">⏸ Paused</Badge>;
  if (status === "PENDING")      return <Badge className="bg-white/10 text-white/40 border border-white/10 text-xs">⏳ Pending</Badge>;
  return <Badge className="bg-white/10 text-white/40 border border-white/10 text-xs">{status}</Badge>;
}

function VaultHealthDot({ vaultBalance, maxOI }: { vaultBalance: number; maxOI: number }) {
  const h = vaultHealth(vaultBalance, maxOI);
  const label = vaultHealthLabel(h);
  const color = vaultHealthColor(h);
  const bg = vaultHealthBg(h);
  return (
    <Badge className={`${bg} ${color} border text-xs`}>
      ● {label}
    </Badge>
  );
}

export default function Dashboard({ embedded = false }: { embedded?: boolean }) {
  const [, navigate] = useLocation();
  const go = (path: string, hash?: string) => embedded && hash ? (window.location.hash = hash) : navigate(path);
  const { authenticated, walletAddress, loading: authLoading, signIn, signOut, signing } = useAuth();
  const { toast } = useToast();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loadingMarkets, setLoadingMarkets] = useState(false);
  const [loadingTrades, setLoadingTrades] = useState(false);

  useEffect(() => {
    if (authenticated) { loadMarkets(); loadTrades(); }
  }, [authenticated]);

  async function loadMarkets() {
    setLoadingMarkets(true);
    try {
      const res = await fetch("/api/markets/mine", { credentials: "include" });
      const data = await res.json();
      if (Array.isArray(data)) setMarkets(data);
    } catch {}
    setLoadingMarkets(false);
  }

  async function loadTrades() {
    setLoadingTrades(true);
    try {
      const res = await fetch("/api/trades/mine", { credentials: "include" });
      const data = await res.json();
      if (Array.isArray(data)) setTrades(data);
    } catch {}
    setLoadingTrades(false);
  }

  const totalVault      = markets.reduce((s, m) => s + (m.vaultBalance || 0), 0);
  const totalFeesEarned = markets.reduce((s, m) => s + (m.feesEarned || 0), 0);
  const openTrades      = trades.filter(t => t.status === "OPEN");
  const closedTrades    = trades.filter(t => t.status === "CLOSED");
  const totalPnl        = closedTrades.reduce((s, t) => s + (t.pnl || 0), 0);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0a0614] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#7a33fa] animate-spin" />
      </div>
    );
  }

  return (
    <div className={embedded ? "min-h-full" : "min-h-screen bg-[#0a0614]"} style={embedded ? {} : { backgroundImage: "radial-gradient(ellipse at top, rgba(122,51,250,0.10) 0%, transparent 60%)" }}>
      {!embedded && (
        <nav className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer">
              <img src={logoImg} alt="Flap Futures" className="h-7 w-auto" />
              <span className="text-white font-bold text-lg">FLAP <span className="text-[#7a33fa]">FUTURES</span></span>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/dashboard#futures"><Button variant="ghost" className="text-white/60 hover:text-white text-sm">Futures</Button></Link>
            {authenticated && walletAddress && (
              <div className="flex items-center gap-2">
                <span className="text-white/40 text-sm">{shortAddr(walletAddress)}</span>
                <Button onClick={signOut} variant="ghost" className="text-white/40 hover:text-red-400 p-2">
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </nav>
      )}

      <div className="max-w-5xl mx-auto px-4 py-8">
        {!authenticated ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-full bg-[#7a33fa]/20 flex items-center justify-center mb-6">
              <Wallet className="w-8 h-8 text-[#7a33fa]" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Connect Your Wallet</h1>
            <p className="text-white/50 mb-8 max-w-sm">Sign in with your wallet to manage your markets, view trades, and monitor your earnings.</p>
            <Button onClick={() => signIn()} disabled={signing} className="bg-[#7a33fa] hover:bg-[#6620e0] text-white px-8 h-12 gap-2 text-base">
              {signing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wallet className="w-5 h-5" />}
              Connect & Sign In
            </Button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-start justify-between mb-8">
              <div>
                <h1 className="text-2xl font-bold text-white">My Dashboard</h1>
                <p className="text-white/40 text-sm mt-1">{shortAddr(walletAddress || "")}</p>
              </div>
              <Button onClick={() => go("/apply", "apply")} className="bg-[#7a33fa] hover:bg-[#6620e0] text-white gap-2">
                <Plus className="w-4 h-4" /> Launch Market
              </Button>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {[
                { label: "Total Markets",  value: markets.length.toString(),                                       sub: `${markets.filter(m => m.status === "LIVE").length} live` },
                { label: "Total Vault",    value: fmt(totalVault),                                                 sub: "deposited" },
                { label: "Fees Earned",    value: fmt(totalFeesEarned),                                            sub: "all time" },
                { label: "My Trades",      value: trades.length.toString(),                                        sub: `${openTrades.length} open` },
              ].map(stat => (
                <Card key={stat.label} className="bg-white/5 border-white/10 p-4">
                  <div className="text-white/40 text-xs mb-1">{stat.label}</div>
                  <div className="text-white font-bold text-xl">{stat.value}</div>
                  <div className="text-white/30 text-xs mt-0.5">{stat.sub}</div>
                </Card>
              ))}
            </div>

            {/* Tabs */}
            <Tabs defaultValue="markets">
              <TabsList className="bg-white/5 border border-white/10 mb-6">
                <TabsTrigger value="markets" className="data-[state=active]:bg-[#7a33fa] data-[state=active]:text-white text-white/50">
                  My Markets ({markets.length})
                </TabsTrigger>
                <TabsTrigger value="trades" className="data-[state=active]:bg-[#7a33fa] data-[state=active]:text-white text-white/50">
                  My Trades ({trades.length})
                </TabsTrigger>
              </TabsList>

              {/* Markets Tab */}
              <TabsContent value="markets">
                {loadingMarkets ? (
                  <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-[#7a33fa] animate-spin" /></div>
                ) : markets.length === 0 ? (
                  <div className="text-center py-16">
                    <BarChart3 className="w-12 h-12 text-white/20 mx-auto mb-4" />
                    <div className="text-white/40 mb-2">No markets yet</div>
                    <div className="text-white/20 text-sm mb-6">Launch your first perpetuals market</div>
                    <Button onClick={() => go("/apply", "apply")} className="bg-[#7a33fa] hover:bg-[#6620e0] text-white gap-2">
                      <Plus className="w-4 h-4" /> Launch Market
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {markets.map(market => {
                      const mcap      = market.mcap || 0;
                      const maxOI     = market.maxOI     ?? calcMaxOI(mcap);
                      const maxLev    = market.maxLeverage ?? calcMaxLeverage(mcap);
                      const spread    = market.spread    ?? calcSpread(mcap);
                      const maxPos    = market.maxPosition ?? calcMaxPosition(mcap);
                      const health    = vaultHealth(market.vaultBalance || 0, maxOI);
                      const oiPct     = maxOI > 0 ? Math.min(100, ((market.openInterest || 0) / maxOI) * 100) : 0;

                      return (
                        <motion.div key={market.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="group">
                          <Card className="bg-white/5 border-white/10 hover:border-[#7a33fa]/40 transition-colors p-4">
                            <div className="flex items-center gap-4">
                              {/* Logo + name */}
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                {market.tokenLogo ? (
                                  <img src={market.tokenLogo} alt="" className="w-10 h-10 rounded-full flex-shrink-0" />
                                ) : (
                                  <div className="w-10 h-10 rounded-full bg-[#7a33fa]/20 flex items-center justify-center flex-shrink-0 text-[#7a33fa] font-bold text-sm">
                                    {market.tokenSymbol?.slice(0, 2)}
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <div className="text-white font-semibold">{market.tokenSymbol}/USDT</div>
                                  <div className="text-white/40 text-xs truncate">{market.tokenName}</div>
                                </div>
                              </div>

                              {/* Health + status badges */}
                              <div className="flex items-center gap-2 flex-wrap">
                                <VaultHealthDot vaultBalance={market.vaultBalance || 0} maxOI={maxOI} />
                                {statusBadge(market.status)}
                              </div>

                              {/* Flex params + stats */}
                              <div className="hidden md:flex items-center gap-5 text-sm">
                                <div className="text-right">
                                  <div className="text-white/40 text-xs">Spread</div>
                                  <div className="text-[#d5f704] font-mono">{spread.toFixed(2)}%</div>
                                </div>
                                <div className="text-right">
                                  <div className="text-white/40 text-xs">Max Lev</div>
                                  <div className="text-white font-mono">{maxLev}x</div>
                                </div>
                                <div className="text-right">
                                  <div className="text-white/40 text-xs">Max Pos</div>
                                  <div className="text-white font-mono">${maxPos}</div>
                                </div>
                                <div className="text-right min-w-[80px]">
                                  <div className="text-white/40 text-xs mb-1">OI {fmt(market.openInterest || 0)} / {fmt(maxOI)}</div>
                                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${oiPct > 80 ? "bg-red-500" : oiPct > 50 ? "bg-yellow-500" : "bg-[#7a33fa]"}`}
                                      style={{ width: `${oiPct}%` }}
                                    />
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-white/40 text-xs">Fees</div>
                                  <div className="text-[#d5f704]">{fmt(market.feesEarned || 0)}</div>
                                </div>
                              </div>

                              {/* Action */}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => go(`/dashboard/market/${market.id}`, `market-${market.id}`)}
                                className="text-[#7a33fa] hover:bg-[#7a33fa]/10 gap-1 flex-shrink-0"
                              >
                                Manage <ArrowRight className="w-3 h-3" />
                              </Button>
                            </div>
                          </Card>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              {/* Trades Tab */}
              <TabsContent value="trades">
                {loadingTrades ? (
                  <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-[#7a33fa] animate-spin" /></div>
                ) : trades.length === 0 ? (
                  <div className="text-center py-16">
                    <TrendingUp className="w-12 h-12 text-white/20 mx-auto mb-4" />
                    <div className="text-white/40 mb-2">No trades yet</div>
                    <div className="text-white/20 text-sm mb-6">Start trading on any live market</div>
                    <Button onClick={() => go("/dashboard#futures", "futures")} className="bg-[#7a33fa] hover:bg-[#6620e0] text-white gap-2">
                      Open Trading <ExternalLink className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div>
                    {/* Summary */}
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <Card className="bg-white/5 border-white/10 p-4">
                        <div className="text-white/40 text-xs mb-1">Total PnL</div>
                        <div className={`font-bold text-lg ${totalPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {totalPnl >= 0 ? "+" : ""}{fmt(totalPnl)}
                        </div>
                      </Card>
                      <Card className="bg-white/5 border-white/10 p-4">
                        <div className="text-white/40 text-xs mb-1">Win Rate</div>
                        <div className="text-white font-bold text-lg">
                          {closedTrades.length > 0
                            ? `${Math.round(closedTrades.filter(t => (t.pnl || 0) > 0).length / closedTrades.length * 100)}%`
                            : "—"}
                        </div>
                      </Card>
                      <Card className="bg-white/5 border-white/10 p-4">
                        <div className="text-white/40 text-xs mb-1">Open Positions</div>
                        <div className="text-white font-bold text-lg">{openTrades.length}</div>
                      </Card>
                    </div>

                    {/* Trade list */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-white/30 text-xs border-b border-white/10">
                            <th className="text-left pb-3 pl-3">Pair</th>
                            <th className="text-left pb-3">Side</th>
                            <th className="text-right pb-3">Size</th>
                            <th className="text-right pb-3">Lev</th>
                            <th className="text-right pb-3">Entry</th>
                            <th className="text-right pb-3">Exit</th>
                            <th className="text-right pb-3">PnL</th>
                            <th className="text-right pb-3">Status</th>
                            <th className="text-right pb-3 pr-3">Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {trades.map(trade => (
                            <tr key={trade.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                              <td className="py-3 pl-3 text-white/70">{trade.marketId.slice(0, 8)}...</td>
                              <td className="py-3">
                                <span className={`font-medium ${trade.side === "LONG" ? "text-green-400" : "text-red-400"}`}>
                                  {trade.side}
                                </span>
                              </td>
                              <td className="py-3 text-right text-white">{fmt(trade.size)}</td>
                              <td className="py-3 text-right text-white/70">{trade.leverage}x</td>
                              <td className="py-3 text-right text-white/70">${trade.entryPrice?.toFixed(6)}</td>
                              <td className="py-3 text-right text-white/70">{trade.exitPrice ? `$${trade.exitPrice.toFixed(6)}` : "—"}</td>
                              <td className={`py-3 text-right font-medium ${!trade.pnl ? "text-white/30" : trade.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                                {trade.pnl != null ? `${trade.pnl >= 0 ? "+" : ""}${fmt(trade.pnl)}` : "—"}
                              </td>
                              <td className="py-3 text-right">
                                {trade.status === "OPEN"       && <Badge className="bg-blue-500/15 text-blue-400 border border-blue-500/30 text-xs">Open</Badge>}
                                {trade.status === "CLOSED"     && <Badge className="bg-white/10 text-white/50 border border-white/10 text-xs">Closed</Badge>}
                                {trade.status === "LIQUIDATED" && <Badge className="bg-red-500/15 text-red-400 border border-red-500/30 text-xs">Liq.</Badge>}
                              </td>
                              <td className="py-3 text-right pr-3 text-white/30 text-xs">
                                {new Date(trade.openedAt).toLocaleDateString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
}
