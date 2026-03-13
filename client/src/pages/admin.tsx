import { useState, useCallback } from "react";
import { ethers } from "ethers";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { WalletButton } from "@/components/wallet-button";
import { WalletModal } from "@/components/wallet-modal";
import { useWallet } from "@/hooks/use-wallet";
import logoImg from "@assets/flapfutureslogo_nobg.png";
import { Link, useParams } from "wouter";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Activity,
  Shield,
  Wallet,
  Copy,
  ExternalLink,
  Settings,
  Clock,
  Zap,
  Lock,
  Globe,
  AlertCircle,
  Bot,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Layers,
  CheckCircle2,
  Circle,
  PlayCircle,
  Wrench,
  Key,
  Link2,
  Coins,
  Power,
  Loader2,
} from "lucide-react";

const MOCK_TOKEN = {
  name: "FlapCoin",
  symbol: "FLAP",
  pair: "FLAP/USDT",
  pairType: "usdt",
  contractAddress: "0x1234...abcd",
  status: "live",
  listedDate: "2026-02-20",
  maxLeverage: 5,
};

const MOCK_STATS = {
  totalVolume24h: "$128,450",
  totalVolumeAll: "$2.4M",
  openInterest: "$45,200",
  activeTraders: 34,
  longOI: "$28,100",
  shortOI: "$17,100",
  totalTrades: 1247,
  totalLiquidations: 23,
  feesEarned24h: "$384.12",
  feesEarnedAll: "$7,240",
  fundingRate: "0.0100%",
  markPrice: "$0.04823",
  indexPrice: "$0.04810",
  insuranceFund: "$1,240",
  vaultLiquidity: "$50,000",
  vaultLocked: "$12,300",
};

const MOCK_CONTRACTS = [
  { name: "Vault", address: "0xAb12...3cDe", status: "active" },
  { name: "Oracle", address: "0xFf45...6gHi", status: "active" },
  { name: "Perps", address: "0xJk78...9LmN", status: "active" },
  { name: "Funding", address: "0xOp01...2qRs", status: "active" },
  { name: "Liquidation", address: "0xTu34...5vWx", status: "active" },
  { name: "Insurance", address: "0xYz67...8AbC", status: "active" },
];

const MOCK_RECENT_TRADES = [
  { trader: "0x7F...3a2B", side: "Long", size: "$250", leverage: "5x", entry: "$0.04812", pnl: "+$12.50", time: "2m ago" },
  { trader: "0xAc...9dEf", side: "Short", size: "$180", leverage: "3x", entry: "$0.04835", pnl: "-$4.20", time: "8m ago" },
  { trader: "0xBd...1gHi", side: "Long", size: "$500", leverage: "5x", entry: "$0.04790", pnl: "+$34.80", time: "15m ago" },
  { trader: "0xCe...2jKl", side: "Short", size: "$120", leverage: "2x", entry: "$0.04850", pnl: "+$8.10", time: "22m ago" },
  { trader: "0xDf...3mNo", side: "Long", size: "$350", leverage: "4x", entry: "$0.04800", pnl: "-$18.50", time: "35m ago" },
  { trader: "0xEg...4pQr", side: "Long", size: "$200", leverage: "5x", entry: "$0.04815", pnl: "+$6.40", time: "1h ago" },
];

const MOCK_LIQUIDATIONS = [
  { trader: "0xFh...5sTu", side: "Long", collateral: "$100", markPrice: "$0.04200", time: "3h ago" },
  { trader: "0xGi...6vWx", side: "Short", collateral: "$80", markPrice: "$0.05100", time: "8h ago" },
  { trader: "0xHj...7yZa", side: "Long", collateral: "$200", markPrice: "$0.04150", time: "1d ago" },
];

const PERPS_SETUP_ABI = [
  "function setVault(address _vault) external",
  "function setOracle(address _oracle) external",
  "function setFunding(address _funding) external",
  "function setLiquidation(address _liquidation) external",
  "function setBotWallet(address _bot) external",
  "function unpause() external",
  "function pause() external",
  "function setMaxLeverage(uint256 _max) external",
  "function setTradingFeeBps(uint256 _bps) external",
];
const FUNDING_SETUP_ABI = ["function initializeFunding() external"];
const USDT_ABI = ["function approve(address spender, uint256 amount) external returns (bool)"];

async function getSigner() {
  const w = window as any;
  if (!w.ethereum) throw new Error("No wallet found");
  await w.ethereum.request({ method: "eth_requestAccounts" });
  const provider = new ethers.BrowserProvider(w.ethereum);
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== 56) {
    await w.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x38" }] });
    return new ethers.BrowserProvider(w.ethereum).getSigner();
  }
  return provider.getSigner();
}

export default function Admin({ embedded = false, embeddedTokenId }: { embedded?: boolean; embeddedTokenId?: string }) {
  const params = useParams<{ tokenId: string }>();
  const tokenId = embeddedTokenId || params?.tokenId;
  const { address, connect, pendingWallet, approvePendingWallet, rejectPendingWallet } = useWallet();
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  const [contracts, setContracts] = useState({ vault: "", oracle: "", funding: "", liquidation: "", perps: "", bot: "" });
  const [setupStatus, setSetupStatus] = useState<Record<string, string>>({});
  const [setupLoading, setSetupLoading] = useState<Record<string, boolean>>({});

  const runSetup = useCallback(async (key: string, fn: () => Promise<void>) => {
    setSetupLoading((p) => ({ ...p, [key]: true }));
    setSetupStatus((p) => ({ ...p, [key]: "Confirm in wallet..." }));
    try {
      await fn();
      setSetupStatus((p) => ({ ...p, [key]: "Done!" }));
      setTimeout(() => setSetupStatus((p) => ({ ...p, [key]: "" })), 4000);
    } catch (e: any) {
      const msg = e.reason || e.shortMessage || e.message || "Failed";
      setSetupStatus((p) => ({ ...p, [key]: msg.includes("user rejected") ? "Rejected" : msg.slice(0, 60) }));
      setTimeout(() => setSetupStatus((p) => ({ ...p, [key]: "" })), 5000);
    } finally {
      setSetupLoading((p) => ({ ...p, [key]: false }));
    }
  }, []);

  return (
    <div className="min-h-screen bg-background" data-testid="page-admin">
      {!embedded && (
        <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" asChild className="w-8 h-8" data-testid="button-back-home">
                <Link href="/dashboard">
                  <ArrowLeft className="w-4 h-4" />
                </Link>
              </Button>
              <Link href="/" className="flex items-center gap-2">
                <img src={logoImg} alt="Flap Futures" className="w-7 h-7" />
                <span className="font-heading font-bold text-sm text-white hidden sm:inline">FLAP FUTURES</span>
              </Link>
              <span className="text-border mx-2 hidden sm:inline">/</span>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-[10px] font-mono font-bold text-primary">{MOCK_TOKEN.symbol.charAt(0)}</span>
                </div>
                <span className="font-heading font-semibold text-sm text-white">{MOCK_TOKEN.symbol} Admin</span>
                <Badge variant="secondary" className="text-[10px] font-mono bg-green-500/10 text-green-400 border-green-500/20" data-testid="badge-status">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1 inline-block animate-pulse" />
                  Live
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="text-xs hidden sm:inline-flex" asChild data-testid="button-view-trading">
                <Link href="/dashboard#perps">
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                  View Trading
                </Link>
              </Button>
              {address ? <WalletButton /> : (
                <Button size="sm" className="text-xs h-8" onClick={() => setWalletModalOpen(true)}>
                  <Wallet className="w-3.5 h-3.5 mr-1.5" />Connect
                </Button>
              )}
            </div>
          </div>
        </header>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {[
            { label: "24h Volume", value: MOCK_STATS.totalVolume24h, icon: BarChart3, color: "text-primary" },
            { label: "Open Interest", value: MOCK_STATS.openInterest, icon: Activity, color: "text-blue-400" },
            { label: "Active Traders", value: MOCK_STATS.activeTraders, icon: Users, color: "text-green-400" },
            { label: "24h Fees", value: MOCK_STATS.feesEarned24h, icon: DollarSign, color: "text-yellow-400" },
            { label: "Mark Price", value: MOCK_STATS.markPrice, icon: TrendingUp, color: "text-white" },
            { label: "Funding Rate", value: MOCK_STATS.fundingRate, icon: Zap, color: "text-green-400" },
          ].map((stat) => (
            <Card key={stat.label} className="bg-card/50 border-border/30 p-3 sm:p-4" data-testid={`card-stat-${stat.label.toLowerCase().replace(/\s/g, "-")}`}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <stat.icon className={`w-3 h-3 ${stat.color}`} />
                <span className="text-[10px] text-muted-foreground">{stat.label}</span>
              </div>
              <p className={`font-mono text-sm sm:text-base font-semibold ${stat.color}`}>{stat.value}</p>
            </Card>
          ))}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-secondary/50 mb-6 flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="overview" className="text-xs" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="trades" className="text-xs" data-testid="tab-trades">Trades</TabsTrigger>
            <TabsTrigger value="contracts" className="text-xs" data-testid="tab-contracts">Contracts</TabsTrigger>
            <TabsTrigger value="setup" className="text-xs" data-testid="tab-setup">
              <Wrench className="w-3 h-3 mr-1" />
              Market Setup
            </TabsTrigger>
            <TabsTrigger value="settings" className="text-xs" data-testid="tab-settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid lg:grid-cols-3 gap-4 sm:gap-6">
              <div className="lg:col-span-2 space-y-4 sm:space-y-6">
                <Card className="bg-card/50 border-border/30 p-5 sm:p-6" data-testid="card-market-overview">
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="font-heading font-semibold text-base text-white">Market Overview</h3>
                    <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" data-testid="button-refresh">
                      <RefreshCw className="w-3 h-3 mr-1" />
                      Refresh
                    </Button>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total Volume (All Time)</span>
                        <span className="font-mono text-white">{MOCK_STATS.totalVolumeAll}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total Trades</span>
                        <span className="font-mono text-white">{MOCK_STATS.totalTrades}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total Liquidations</span>
                        <span className="font-mono text-red-400">{MOCK_STATS.totalLiquidations}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Index Price</span>
                        <span className="font-mono text-white">{MOCK_STATS.indexPrice}</span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Long OI</span>
                        <span className="font-mono text-green-400">{MOCK_STATS.longOI}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Short OI</span>
                        <span className="font-mono text-red-400">{MOCK_STATS.shortOI}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Max Leverage</span>
                        <span className="font-mono text-white">{MOCK_TOKEN.maxLeverage}x</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Listed</span>
                        <span className="font-mono text-muted-foreground">{MOCK_TOKEN.listedDate}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-border/20">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-muted-foreground">Long / Short Ratio</span>
                      <span className="text-xs font-mono text-white">62% / 38%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-secondary overflow-hidden flex">
                      <div className="h-full bg-green-500 rounded-l-full" style={{ width: "62%" }} />
                      <div className="h-full bg-red-500 rounded-r-full" style={{ width: "38%" }} />
                    </div>
                  </div>
                </Card>

                <Card className="bg-card/50 border-border/30 p-5 sm:p-6" data-testid="card-recent-trades">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-heading font-semibold text-base text-white">Recent Trades</h3>
                    <Badge variant="secondary" className="text-[10px] font-mono">
                      {MOCK_RECENT_TRADES.length} trades
                    </Badge>
                  </div>

                  <div className="overflow-x-auto -mx-5 sm:-mx-6 px-5 sm:px-6">
                    <table className="w-full min-w-[550px]">
                      <thead>
                        <tr className="text-[10px] text-muted-foreground border-b border-border/20">
                          <th className="text-left pb-2 font-medium">Trader</th>
                          <th className="text-left pb-2 font-medium">Side</th>
                          <th className="text-right pb-2 font-medium">Size</th>
                          <th className="text-right pb-2 font-medium">Leverage</th>
                          <th className="text-right pb-2 font-medium">Entry</th>
                          <th className="text-right pb-2 font-medium">PnL</th>
                          <th className="text-right pb-2 font-medium">Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {MOCK_RECENT_TRADES.map((trade, i) => (
                          <tr key={i} className="border-b border-border/10 last:border-0" data-testid={`row-trade-${i}`}>
                            <td className="py-2.5 font-mono text-xs text-white">{trade.trader}</td>
                            <td className="py-2.5">
                              <span className={`text-xs font-medium ${trade.side === "Long" ? "text-green-400" : "text-red-400"}`}>
                                {trade.side}
                              </span>
                            </td>
                            <td className="py-2.5 text-right font-mono text-xs text-white">{trade.size}</td>
                            <td className="py-2.5 text-right font-mono text-xs text-muted-foreground">{trade.leverage}</td>
                            <td className="py-2.5 text-right font-mono text-xs text-white">{trade.entry}</td>
                            <td className={`py-2.5 text-right font-mono text-xs ${trade.pnl.startsWith("+") ? "text-green-400" : "text-red-400"}`}>
                              {trade.pnl}
                            </td>
                            <td className="py-2.5 text-right text-xs text-muted-foreground">{trade.time}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>

              <div className="space-y-4 sm:space-y-6">
                <Card className="bg-card/50 border-border/30 p-5" data-testid="card-fees">
                  <h3 className="font-heading font-semibold text-base text-white mb-4">Fee Revenue</h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between items-end mb-1">
                        <span className="text-xs text-muted-foreground">24h Fees</span>
                        <span className="font-mono text-lg font-bold text-green-400">{MOCK_STATS.feesEarned24h}</span>
                      </div>
                      <div className="w-full h-1 rounded-full bg-secondary">
                        <div className="h-full bg-green-500 rounded-full" style={{ width: "45%" }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between items-end mb-1">
                        <span className="text-xs text-muted-foreground">All Time Fees</span>
                        <span className="font-mono text-lg font-bold text-white">{MOCK_STATS.feesEarnedAll}</span>
                      </div>
                    </div>
                    <div className="pt-3 border-t border-border/20 text-xs text-muted-foreground">
                      Fee share model and claiming will be available after platform launch.
                    </div>
                  </div>
                </Card>

                <Card className="bg-card/50 border-border/30 p-5" data-testid="card-vault-health">
                  <h3 className="font-heading font-semibold text-base text-white mb-4">Vault Health</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Liquidity</span>
                      <span className="font-mono text-white">{MOCK_STATS.vaultLiquidity}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Locked</span>
                      <span className="font-mono text-yellow-400">{MOCK_STATS.vaultLocked}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Insurance Fund</span>
                      <span className="font-mono text-green-400">{MOCK_STATS.insuranceFund}</span>
                    </div>
                    <div className="pt-3 border-t border-border/20">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-muted-foreground">Utilization</span>
                        <span className="text-xs font-mono text-white">24.6%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: "24.6%" }} />
                      </div>
                    </div>
                  </div>
                </Card>

                <Card className="bg-card/50 border-border/30 p-5" data-testid="card-recent-liquidations">
                  <h3 className="font-heading font-semibold text-base text-white mb-4">Recent Liquidations</h3>
                  <div className="space-y-3">
                    {MOCK_LIQUIDATIONS.map((liq, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-border/10 last:border-0" data-testid={`row-liq-${i}`}>
                        <div>
                          <p className="font-mono text-xs text-white">{liq.trader}</p>
                          <p className={`text-[10px] ${liq.side === "Long" ? "text-green-400" : "text-red-400"}`}>{liq.side} • {liq.collateral}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono text-xs text-red-400">{liq.markPrice}</p>
                          <p className="text-[10px] text-muted-foreground">{liq.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="trades">
            <Card className="bg-card/50 border-border/30 p-5 sm:p-6" data-testid="card-all-trades">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-heading font-semibold text-base text-white">All Trades</h3>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px] font-mono">{MOCK_STATS.totalTrades} total</Badge>
                </div>
              </div>
              <div className="overflow-x-auto -mx-5 sm:-mx-6 px-5 sm:px-6">
                <table className="w-full min-w-[600px]">
                  <thead>
                    <tr className="text-[10px] text-muted-foreground border-b border-border/20">
                      <th className="text-left pb-2 font-medium">Trader</th>
                      <th className="text-left pb-2 font-medium">Side</th>
                      <th className="text-right pb-2 font-medium">Size</th>
                      <th className="text-right pb-2 font-medium">Leverage</th>
                      <th className="text-right pb-2 font-medium">Entry</th>
                      <th className="text-right pb-2 font-medium">PnL</th>
                      <th className="text-right pb-2 font-medium">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MOCK_RECENT_TRADES.concat(MOCK_RECENT_TRADES).map((trade, i) => (
                      <tr key={i} className="border-b border-border/10 last:border-0" data-testid={`row-all-trade-${i}`}>
                        <td className="py-2.5 font-mono text-xs text-white">{trade.trader}</td>
                        <td className="py-2.5">
                          <span className={`text-xs font-medium ${trade.side === "Long" ? "text-green-400" : "text-red-400"}`}>
                            {trade.side}
                          </span>
                        </td>
                        <td className="py-2.5 text-right font-mono text-xs text-white">{trade.size}</td>
                        <td className="py-2.5 text-right font-mono text-xs text-muted-foreground">{trade.leverage}</td>
                        <td className="py-2.5 text-right font-mono text-xs text-white">{trade.entry}</td>
                        <td className={`py-2.5 text-right font-mono text-xs ${trade.pnl.startsWith("+") ? "text-green-400" : "text-red-400"}`}>
                          {trade.pnl}
                        </td>
                        <td className="py-2.5 text-right text-xs text-muted-foreground">{trade.time}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="contracts">
            <Card className="bg-card/50 border-border/30 p-5 sm:p-6" data-testid="card-deployed-contracts">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-heading font-semibold text-base text-white">Deployed Contracts</h3>
                <Badge variant="secondary" className="text-[10px] font-mono">BSC Mainnet</Badge>
              </div>

              <div className="space-y-3">
                {MOCK_CONTRACTS.map((c) => (
                  <Card key={c.name} className="bg-secondary/30 border-border/20 p-4 flex items-center justify-between" data-testid={`card-contract-${c.name.toLowerCase()}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center">
                        {c.name === "Vault" && <Lock className="w-4 h-4 text-primary" />}
                        {c.name === "Oracle" && <Globe className="w-4 h-4 text-primary" />}
                        {c.name === "Perps" && <BarChart3 className="w-4 h-4 text-primary" />}
                        {c.name === "Funding" && <Zap className="w-4 h-4 text-primary" />}
                        {c.name === "Liquidation" && <AlertCircle className="w-4 h-4 text-primary" />}
                        {c.name === "Insurance" && <Shield className="w-4 h-4 text-primary" />}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{c.name}</p>
                        <p className="font-mono text-xs text-muted-foreground">{c.address}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px] font-mono bg-green-500/10 text-green-400 border-green-500/20">
                        Active
                      </Badge>
                      <Button variant="ghost" size="icon" className="w-7 h-7" aria-label={`View ${c.name} on BSCScan`} data-testid={`button-view-${c.name.toLowerCase()}`}>
                        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" className="w-7 h-7" aria-label={`Copy ${c.name} address`} data-testid={`button-copy-${c.name.toLowerCase()}`}>
                        <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  </Card>
                ))}

                <Card className="bg-secondary/30 border-border/20 p-4 flex items-center justify-between" data-testid="card-contract-bot">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center">
                      <Bot className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Bot Wallet</p>
                      <p className="font-mono text-xs text-muted-foreground">0xBo12...3tWl</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px] font-mono bg-green-500/10 text-green-400 border-green-500/20">
                      Running
                    </Badge>
                    <Button variant="ghost" size="icon" className="w-7 h-7" aria-label="View bot wallet" data-testid="button-view-bot">
                      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                </Card>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="setup">
            <div className="space-y-4 sm:space-y-6">
              {!address && (
                <Card className="bg-yellow-500/10 border-yellow-500/30 p-4 flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-400 shrink-0" />
                  <p className="text-sm text-yellow-400">Connect your dev wallet to run setup transactions on BSC.</p>
                </Card>
              )}

              <Card className="bg-card/50 border-border/30 p-5 sm:p-6" data-testid="card-setup-addresses">
                <h3 className="font-heading font-semibold text-base text-white mb-1">Contract Addresses</h3>
                <p className="text-xs text-muted-foreground mb-5">Enter your deployed FFX contract addresses then run each setup step in order.</p>
                <div className="grid sm:grid-cols-2 gap-4">
                  {[
                    { key: "perps", label: "FFXPerps Address", placeholder: "0x..." },
                    { key: "vault", label: "FFXVault Address", placeholder: "0x..." },
                    { key: "oracle", label: "FFXOracle Address", placeholder: "0x..." },
                    { key: "funding", label: "FFXFunding Address", placeholder: "0x..." },
                    { key: "liquidation", label: "FFXLiquidation Address", placeholder: "0x..." },
                    { key: "bot", label: "Bot Wallet Address", placeholder: "0x..." },
                  ].map(({ key, label, placeholder }) => (
                    <div key={key}>
                      <label className="text-xs text-muted-foreground mb-1.5 block">{label}</label>
                      <Input
                        placeholder={placeholder}
                        value={contracts[key as keyof typeof contracts]}
                        onChange={(e) => setContracts((p) => ({ ...p, [key]: e.target.value }))}
                        className="h-8 text-xs font-mono bg-background/50"
                        data-testid={`input-addr-${key}`}
                      />
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="bg-card/50 border-border/30 p-5 sm:p-6" data-testid="card-setup-steps">
                <h3 className="font-heading font-semibold text-base text-white mb-5">Setup Steps</h3>
                <div className="space-y-3">
                  {[
                    {
                      step: 1, key: "linkVault", label: "Link Vault → Perps",
                      desc: "Calls setVault() on FFXPerps so it knows where collateral lives.",
                      icon: Lock, ready: !!(contracts.perps && contracts.vault),
                      action: async () => {
                        const s = await getSigner();
                        const perps = new ethers.Contract(contracts.perps, PERPS_SETUP_ABI, s);
                        const tx = await perps.setVault(contracts.vault);
                        await tx.wait();
                      },
                    },
                    {
                      step: 2, key: "linkOracle", label: "Link Oracle → Perps",
                      desc: "Calls setOracle() so Perps can read the mark price.",
                      icon: Globe, ready: !!(contracts.perps && contracts.oracle),
                      action: async () => {
                        const s = await getSigner();
                        const perps = new ethers.Contract(contracts.perps, PERPS_SETUP_ABI, s);
                        const tx = await perps.setOracle(contracts.oracle);
                        await tx.wait();
                      },
                    },
                    {
                      step: 3, key: "linkFunding", label: "Link Funding → Perps",
                      desc: "Calls setFunding() so funding rate is applied to open positions.",
                      icon: Zap, ready: !!(contracts.perps && contracts.funding),
                      action: async () => {
                        const s = await getSigner();
                        const perps = new ethers.Contract(contracts.perps, PERPS_SETUP_ABI, s);
                        const tx = await perps.setFunding(contracts.funding);
                        await tx.wait();
                      },
                    },
                    {
                      step: 4, key: "linkLiquidation", label: "Link Liquidation → Perps",
                      desc: "Calls setLiquidation() so undercollateralised positions can be closed.",
                      icon: AlertCircle, ready: !!(contracts.perps && contracts.liquidation),
                      action: async () => {
                        const s = await getSigner();
                        const perps = new ethers.Contract(contracts.perps, PERPS_SETUP_ABI, s);
                        const tx = await perps.setLiquidation(contracts.liquidation);
                        await tx.wait();
                      },
                    },
                    {
                      step: 5, key: "setBot", label: "Set Bot Wallet",
                      desc: "Whitelists the bot wallet to push prices, trigger funding & liquidations.",
                      icon: Bot, ready: !!(contracts.perps && contracts.bot),
                      action: async () => {
                        const s = await getSigner();
                        const perps = new ethers.Contract(contracts.perps, PERPS_SETUP_ABI, s);
                        const tx = await perps.setBotWallet(contracts.bot);
                        await tx.wait();
                      },
                    },
                    {
                      step: 6, key: "approveUsdt", label: "Approve USDT for Vault",
                      desc: "Max-approves USDT so the Vault can receive trader deposits.",
                      icon: Coins, ready: !!(contracts.vault),
                      action: async () => {
                        const s = await getSigner();
                        const usdt = new ethers.Contract("0x55d398326f99059fF775485246999027B3197955", USDT_ABI, s);
                        const tx = await usdt.approve(contracts.vault, ethers.MaxUint256);
                        await tx.wait();
                      },
                    },
                    {
                      step: 7, key: "initFunding", label: "Init Funding Rate",
                      desc: "Calls initializeFunding() on FFXFunding to start the funding clock.",
                      icon: Zap, ready: !!(contracts.funding),
                      action: async () => {
                        const s = await getSigner();
                        const funding = new ethers.Contract(contracts.funding, FUNDING_SETUP_ABI, s);
                        const tx = await funding.initializeFunding();
                        await tx.wait();
                      },
                    },
                    {
                      step: 8, key: "goLive", label: "Go Live (Unpause)",
                      desc: "Calls unpause() on FFXPerps — market is now open for trading.",
                      icon: Power, ready: !!(contracts.perps),
                      action: async () => {
                        const s = await getSigner();
                        const perps = new ethers.Contract(contracts.perps, PERPS_SETUP_ABI, s);
                        const tx = await perps.unpause();
                        await tx.wait();
                      },
                    },
                  ].map(({ step, key, label, desc, icon: Icon, ready, action }) => (
                    <Card key={key} className={`bg-secondary/30 border-border/20 p-4 ${setupStatus[key] === "Done!" ? "border-green-500/30" : ""}`} data-testid={`card-setup-${key}`}>
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-mono font-bold ${setupStatus[key] === "Done!" ? "bg-green-500/20 text-green-400" : "bg-primary/10 text-primary"}`}>
                            {setupStatus[key] === "Done!" ? <CheckCircle2 className="w-4 h-4" /> : step}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                              <p className="text-sm font-medium text-white">{label}</p>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">{desc}</p>
                            {setupStatus[key] && setupStatus[key] !== "Done!" && (
                              <p className="text-xs text-primary mt-1">{setupStatus[key]}</p>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant={setupStatus[key] === "Done!" ? "outline" : "default"}
                          className={`text-xs shrink-0 ${setupStatus[key] === "Done!" ? "border-green-500/30 text-green-400" : ""}`}
                          disabled={!address || !ready || setupLoading[key]}
                          onClick={() => runSetup(key, action)}
                          data-testid={`button-setup-${key}`}
                        >
                          {setupLoading[key] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : setupStatus[key] === "Done!" ? "Done" : !address ? "Connect First" : !ready ? "Fill Address" : "Run"}
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="settings">
            <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
              <Card className="bg-card/50 border-border/30 p-5 sm:p-6" data-testid="card-token-settings">
                <h3 className="font-heading font-semibold text-base text-white mb-5">Token Settings</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b border-border/10">
                    <div>
                      <p className="text-sm text-white">Token Name</p>
                      <p className="text-xs text-muted-foreground">{MOCK_TOKEN.name}</p>
                    </div>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border/10">
                    <div>
                      <p className="text-sm text-white">Symbol</p>
                      <p className="text-xs text-muted-foreground font-mono">{MOCK_TOKEN.symbol}</p>
                    </div>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border/10">
                    <div>
                      <p className="text-sm text-white">Trading Pair</p>
                      <p className="text-xs text-muted-foreground font-mono">{MOCK_TOKEN.pair}</p>
                    </div>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border/10">
                    <div>
                      <p className="text-sm text-white">Contract Address</p>
                      <p className="text-xs text-muted-foreground font-mono">{MOCK_TOKEN.contractAddress}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="w-7 h-7" aria-label="Copy token address" data-testid="button-copy-token-addr">
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <div>
                      <p className="text-sm text-white">Max Leverage</p>
                      <p className="text-xs text-muted-foreground">{MOCK_TOKEN.maxLeverage}x</p>
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="bg-card/50 border-border/30 p-5 sm:p-6" data-testid="card-admin-actions">
                <h3 className="font-heading font-semibold text-base text-white mb-5">Admin Actions</h3>
                <div className="space-y-3">
                  <Card className="bg-secondary/30 border-border/20 p-4" data-testid="card-action-pause">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-white">Pause Trading</p>
                        <p className="text-xs text-muted-foreground">Temporarily halt all new positions</p>
                      </div>
                      <Button variant="outline" size="sm" className="border-yellow-500/30 text-yellow-400 text-xs" data-testid="button-pause-trading">
                        Pause
                      </Button>
                    </div>
                  </Card>

                  <Card className="bg-secondary/30 border-border/20 p-4" data-testid="card-action-oracle">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-white">Manual Price Update</p>
                        <p className="text-xs text-muted-foreground">Override oracle price (emergency)</p>
                      </div>
                      <Button variant="outline" size="sm" className="border-red-500/30 text-red-400 text-xs" data-testid="button-manual-price">
                        Set Price
                      </Button>
                    </div>
                  </Card>

                  <Card className="bg-secondary/30 border-border/20 p-4" data-testid="card-action-liquidity">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-white">Manage Vault Liquidity</p>
                        <p className="text-xs text-muted-foreground">Deposit or withdraw vault funds</p>
                      </div>
                      <Button variant="outline" size="sm" className="border-primary/30 text-primary text-xs" data-testid="button-manage-vault">
                        Manage
                      </Button>
                    </div>
                  </Card>

                  <Card className="bg-secondary/30 border-border/20 p-4" data-testid="card-action-fees">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-white">Update Fee Settings</p>
                        <p className="text-xs text-muted-foreground">Adjust trading / spread fees</p>
                      </div>
                      <Button variant="outline" size="sm" className="border-primary/30 text-primary text-xs" data-testid="button-update-fees">
                        Configure
                      </Button>
                    </div>
                  </Card>
                </div>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <WalletModal
        isOpen={walletModalOpen}
        onClose={() => setWalletModalOpen(false)}
        onConnect={(provider) => { setWalletModalOpen(false); connect(provider); }}
      />
    </div>
  );
}
