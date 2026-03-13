import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { ethers } from "ethers";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { calcLevButtons, calcMaxLeverage, calcMaxPosition } from "@/lib/flex-params";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import logoImg from "@assets/flapfutureslogo_nobg.png";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Star,
  Settings,
  Wallet,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Clock,
  X,
  Search,
  Menu,
  Loader2,
} from "lucide-react";
import { Link } from "wouter";
import { TradingChart } from "@/components/trading-chart";
import { useWalletContext } from "@/components/WalletProvider";
import { WalletModal } from "@/components/wallet-modal";
import { WalletButton } from "@/components/wallet-button";
import {
  BSC_CHAIN_ID,
  BSC_RPC,
  BSC_RPCS,
  USDT_ADDRESS,
  FFX_CONTRACTS,
  FLAP_PANCAKE_POOL,
  USDT_ABI,
  VAULT_ABI,
  PERPS_ABI,
  ORACLE_ABI,
  FUNDING_ABI,
} from "@/lib/perps-contracts";

const CONTRACTS_DEPLOYED = FFX_CONTRACTS.PERPS !== "";

interface MarketPair {
  id: string;
  contractAddress: string;
  symbol: string;
  pair: string;
  price: number;
  mcap: number;
  volume24h: number;
  openInterest: number;
  longRatio: number;
  fundingRate: number;
  status: string;
  contractPerps: string | null;
  contractVault: string | null;
  contractOracle: string | null;
  pairAddress: string | null;
  tokenLogo: string | null;
}

const fmt18 = (val: bigint): number => Number(ethers.formatEther(val));
const to18 = (val: number): bigint => ethers.parseEther(val.toFixed(18));

const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T> =>
  Promise.race([promise, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`Timeout ${ms}ms`)), ms))]);

function getReadProvider(): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(BSC_RPC);
}

async function ensureBSC(): Promise<ethers.BrowserProvider> {
  const w = window as any;
  if (!w.ethereum) throw new Error("No wallet found");
  await w.ethereum.request({ method: "eth_requestAccounts" });
  const provider = new ethers.BrowserProvider(w.ethereum);
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== BSC_CHAIN_ID) {
    try {
      await w.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x38" }] });
    } catch (e: any) {
      if (e.code === 4902) {
        await w.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{ chainId: "0x38", chainName: "BNB Smart Chain", nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 }, rpcUrls: [BSC_RPC], blockExplorerUrls: ["https://bscscan.com"] }],
        });
      } else throw new Error("Please switch to BSC in your wallet");
    }
    return new ethers.BrowserProvider(w.ethereum);
  }
  return provider;
}

async function getSigner(): Promise<ethers.Signer> {
  const provider = await ensureBSC();
  return provider.getSigner();
}

async function fetchDexScreenerPrice(): Promise<number | null> {
  if (!FLAP_PANCAKE_POOL) return null;
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/pairs/bsc/${FLAP_PANCAKE_POOL}`);
    const data = await res.json();
    if (data?.pair?.priceUsd) return parseFloat(data.pair.priceUsd);
  } catch {}
  return null;
}

interface OnChainPosition {
  isOpen: boolean;
  isLong: boolean;
  collateral: number;   // = margin from contract
  size: number;
  entryPrice: number;
  unrealizedPnl: number;
  positionId: number;   // contract positionId, needed for close/liquidate
}


function TopBar({
  selectedPair,
  onPairSelect,
  allPairs,
  markPrice,
  fundingRate,
  onConnectWallet,
  address,
}: {
  selectedPair: MarketPair | null;
  onPairSelect: (p: MarketPair) => void;
  allPairs: MarketPair[];
  markPrice: number | null;
  fundingRate: number | null;
  onConnectWallet?: () => void;
  address: string | null;
}) {
  const [showPairList, setShowPairList] = useState(false);
  const [pairSearch, setPairSearch] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const filteredPairs = allPairs.filter(
    (p) => p.symbol.toLowerCase().includes(pairSearch.toLowerCase()) || p.pair.toLowerCase().includes(pairSearch.toLowerCase())
  );

  const displayPrice = markPrice ?? selectedPair?.price ?? 0;
  const dec = displayPrice < 0.001 ? 8 : displayPrice < 1 ? 5 : 4;
  const fundingDisplay = fundingRate !== null ? `${(fundingRate / 1e16).toFixed(4)}%` : "0.0100%";

  return (
    <div className="h-12 border-b border-border/40 bg-card/30 flex items-center relative z-50" data-testid="perps-topbar">
      <div className="flex items-center h-full">
        <Link href="/" className="flex items-center gap-2 px-3 sm:px-4 h-full border-r border-border/30" data-testid="link-back-home">
          <img src={logoImg} alt="FFX" className="w-6 h-6" />
          <span className="font-heading font-bold text-sm text-white hidden sm:inline">FFX</span>
        </Link>

        <div className="relative">
          <button
            onClick={() => setShowPairList(!showPairList)}
            className="flex items-center gap-2 px-3 sm:px-4 h-12 border-r border-border/30 hover-elevate"
            data-testid="button-pair-selector"
          >
            {selectedPair?.tokenLogo ? (
              <img src={selectedPair.tokenLogo} alt={selectedPair.symbol} className="w-6 h-6 rounded-full" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            ) : selectedPair ? (
              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">{selectedPair.symbol.substring(0, 2)}</div>
            ) : null}
            <span className="font-heading font-bold text-sm sm:text-base text-white">{selectedPair ? selectedPair.pair : "Select Market"}</span>
            <span className="text-xs text-muted-foreground">Perp</span>
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
          </button>

          {showPairList && (
            <div className="absolute top-12 left-0 w-72 bg-card border border-border/40 rounded-md shadow-lg z-50" data-testid="panel-pair-list">
              <div className="p-2 border-b border-border/30">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search token..."
                    value={pairSearch}
                    onChange={(e) => setPairSearch(e.target.value)}
                    className="h-8 pl-8 text-xs bg-background/50"
                    data-testid="input-pair-search"
                  />
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {filteredPairs.length === 0 && (
                  <div className="px-3 py-6 text-center text-xs text-muted-foreground">No markets available yet</div>
                )}
                {filteredPairs.map((p) => {
                  const pDec = p.price < 0.001 ? 8 : p.price < 1 ? 5 : 4;
                  return (
                    <button
                      key={p.id}
                      onClick={() => { onPairSelect(p); setShowPairList(false); }}
                      className="w-full flex items-center justify-between px-3 py-2.5 text-xs hover-elevate"
                      data-testid={`button-pair-${p.symbol.toLowerCase()}`}
                    >
                      <div className="flex items-center gap-2">
                        {p.tokenLogo ? (
                          <img src={p.tokenLogo} alt={p.symbol} className="w-6 h-6 rounded-full" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                            {p.symbol.substring(0, 2)}
                          </div>
                        )}
                        <div className="text-left">
                          <div className="font-semibold text-white">{p.pair}</div>
                          <div className="text-[10px] text-muted-foreground">
                            Vol ${p.volume24h >= 1000 ? (p.volume24h / 1000).toFixed(1) + "k" : p.volume24h.toFixed(0)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-white">{p.price > 0 ? p.price.toFixed(pDec) : "—"}</div>
                        <div className="text-white/40 text-[10px]">OI ${p.openInterest >= 1000 ? (p.openInterest / 1000).toFixed(1) + "k" : p.openInterest.toFixed(0)}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="hidden md:flex items-center gap-4 lg:gap-6 px-4 flex-1">
        <div>
          <div className="font-mono text-lg font-bold text-white">
            {displayPrice > 0 ? displayPrice.toFixed(dec) : "—"}
          </div>
        </div>
        <div className="h-8 w-px bg-border/30" />
        {[
          { label: "24h Volume",  value: selectedPair ? `$${selectedPair.volume24h >= 1000 ? (selectedPair.volume24h / 1000).toFixed(1) + "k" : selectedPair.volume24h.toFixed(0)}` : "—", color: "text-white" },
          { label: "Open Interest", value: selectedPair ? `$${selectedPair.openInterest >= 1000 ? (selectedPair.openInterest / 1000).toFixed(1) + "k" : selectedPair.openInterest.toFixed(0)}` : "—", color: "text-white" },
          { label: "Long/Short",  value: selectedPair ? `${Math.round(selectedPair.longRatio)}% / ${Math.round(100 - selectedPair.longRatio)}%` : "—", color: "text-white" },
          { label: "Funding",     value: fundingDisplay, color: fundingRate !== null && fundingRate < 0 ? "text-red-400" : "text-green-400" },
        ].map((stat) => (
          <div key={stat.label} className="text-right">
            <div className="text-[10px] text-muted-foreground">{stat.label}</div>
            <div className={`font-mono text-xs ${stat.color}`}>{stat.value}</div>
          </div>
        ))}
        {selectedPair?.status === "LIVE" && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/15 border border-green-500/40 text-green-400 text-[10px] font-semibold tracking-widest uppercase select-none">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
            <span>Live</span>
          </div>
        )}
        {selectedPair?.status === "VAULT_UNLOCK" && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500/15 border border-yellow-500/40 text-yellow-400 text-[10px] font-semibold tracking-widest uppercase select-none">
            <span>🔓</span>
            <span>Vault Unlock</span>
          </div>
        )}
        {selectedPair?.status === "FROZEN" && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/40 text-blue-400 text-[10px] font-semibold tracking-widest uppercase select-none">
            <span>❄</span>
            <span>Frozen</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 ml-auto px-3 sm:px-4">
        <Button variant="ghost" size="icon" className="hidden sm:inline-flex w-8 h-8" data-testid="button-favorite" aria-label="Add to favorites">
          <Star className="w-4 h-4" />
        </Button>
        {onConnectWallet && (
          <Button size="sm" className="text-xs h-8" onClick={onConnectWallet} data-testid="button-connect">
            <Wallet className="w-3.5 h-3.5 mr-1.5" />
            <span className="hidden sm:inline">{address ? `${address.slice(0,6)}…${address.slice(-4)}` : "Connect"}</span>
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden w-8 h-8"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          data-testid="button-mobile-stats"
          aria-label="Toggle market stats"
        >
          <Menu className="w-4 h-4" />
        </Button>
      </div>

      {mobileMenuOpen && (
        <div className="absolute top-12 left-0 right-0 bg-card border-b border-border/40 p-3 md:hidden z-40">
          {selectedPair?.status === "LIVE" && (
            <div className="flex items-center justify-center gap-1.5 mb-2 py-1 rounded bg-green-500/15 border border-green-500/40 text-green-400 text-[10px] font-semibold tracking-widest uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
              <span>Market Live — Trading Open</span>
            </div>
          )}
          {selectedPair?.status === "VAULT_UNLOCK" && (
            <div className="flex items-center justify-center gap-1.5 mb-2 py-1 rounded bg-yellow-500/15 border border-yellow-500/40 text-yellow-400 text-[10px] font-semibold tracking-widest uppercase">
              <span>🔓</span>
              <span>Vault Unlocked — Creator May Withdraw</span>
            </div>
          )}
          {selectedPair?.status === "FROZEN" && (
            <div className="flex items-center justify-center gap-1.5 mb-2 py-1 rounded bg-blue-500/15 border border-blue-500/40 text-blue-400 text-[10px] font-semibold tracking-widest uppercase">
              <span>❄</span>
              <span>Market Frozen — Trading Suspended</span>
            </div>
          )}
          <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Mark Price",    value: displayPrice > 0 ? displayPrice.toFixed(dec) : "—", color: "text-white" },
            { label: "24h Volume",    value: selectedPair ? `$${selectedPair.volume24h >= 1000 ? (selectedPair.volume24h / 1000).toFixed(1) + "k" : selectedPair.volume24h.toFixed(0)}` : "—", color: "text-white" },
            { label: "Open Interest", value: selectedPair ? `$${selectedPair.openInterest >= 1000 ? (selectedPair.openInterest / 1000).toFixed(1) + "k" : selectedPair.openInterest.toFixed(0)}` : "—", color: "text-white" },
            { label: "Long/Short",    value: selectedPair ? `${Math.round(selectedPair.longRatio)}/${Math.round(100 - selectedPair.longRatio)}%` : "—", color: "text-white" },
            { label: "Funding",       value: fundingDisplay, color: "text-green-400" },
          ].map((stat) => (
            <div key={stat.label}>
              <div className="text-[10px] text-muted-foreground">{stat.label}</div>
              <div className={`font-mono text-xs ${stat.color}`}>{stat.value}</div>
            </div>
          ))}
          </div>
        </div>
      )}
    </div>
  );
}

function OrderForm({
  markPrice,
  walletUsdtBalance,
  openPosition,
  closePosition,
  hasOpenPos,
  onConnectWallet,
  address,
  txStatus,
  isSubmitting,
  maxLeverage,
  tradingFeeBps,
  levButtons,
  maxPosition,
  marketMcap,
  marketStatus,
}: {
  markPrice: number | null;
  walletUsdtBalance: number;
  openPosition: (isLong: boolean, collateral: number, leverage: number, tp: number, sl: number) => Promise<void>;
  closePosition: () => Promise<void>;
  hasOpenPos: boolean;
  onConnectWallet: () => void;
  address: string | null;
  txStatus: string | null;
  isSubmitting: boolean;
  maxLeverage: number;
  tradingFeeBps: number;
  levButtons: number[];
  maxPosition: number;
  marketMcap: number;
  marketStatus: string | undefined;
}) {
  const [side, setSide] = useState<"long" | "short">("long");
  const [orderType, setOrderType] = useState("market");
  const [leverage, setLeverage] = useState([Math.min(5, maxLeverage)]);
  const [marginMode, setMarginMode] = useState("cross");
  const [price, setPrice] = useState(markPrice ? markPrice.toFixed(5) : "0.04823");
  const [collateral, setCollateral] = useState("");
  const [tp, setTp] = useState("");
  const [sl, setSl] = useState("");

  useEffect(() => {
    if (markPrice && orderType === "market") setPrice(markPrice.toFixed(5));
  }, [markPrice, orderType]);

  const collateralNum = parseFloat(collateral) || 0;
  const positionSize = collateralNum * leverage[0];
  const fee = positionSize > 0 ? Math.max(positionSize * 0.001, 1.0) : 0;
  const dec = markPrice && markPrice < 0.001 ? 8 : markPrice && markPrice < 1 ? 5 : 4;

  const handleSubmit = async () => {
    if (!address) { onConnectWallet(); return; }
    if (!CONTRACTS_DEPLOYED) return;
    await openPosition(side === "long", collateralNum, leverage[0], parseFloat(tp) || 0, parseFloat(sl) || 0);
  };

  return (
    <div className="flex flex-col h-full" data-testid="order-form">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/20">
        <button onClick={() => setMarginMode("cross")} className={`text-[10px] font-semibold px-2 py-1 rounded ${marginMode === "cross" ? "bg-primary/20 text-primary" : "text-muted-foreground"}`} data-testid="button-margin-cross">Cross</button>
        <button onClick={() => setMarginMode("isolated")} className={`text-[10px] font-semibold px-2 py-1 rounded ${marginMode === "isolated" ? "bg-primary/20 text-primary" : "text-muted-foreground"}`} data-testid="button-margin-isolated">Isolated</button>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground">Leverage</span>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{leverage[0]}x</Badge>
        </div>
      </div>

      <div className="flex border-b border-border/20">
        <button onClick={() => setSide("long")} className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${side === "long" ? "bg-green-500/10 text-green-400 border-b-2 border-green-400" : "text-muted-foreground"}`} data-testid="button-side-long">Long</button>
        <button onClick={() => setSide("short")} className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${side === "short" ? "bg-red-500/10 text-red-400 border-b-2 border-red-400" : "text-muted-foreground"}`} data-testid="button-side-short">Short</button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        <Select value={orderType} onValueChange={setOrderType}>
          <SelectTrigger className="h-8 text-xs bg-background/50" data-testid="select-order-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="limit">Limit</SelectItem>
            <SelectItem value="market">Market</SelectItem>
          </SelectContent>
        </Select>

        {orderType !== "market" && (
          <div>
            <label className="text-[10px] text-muted-foreground mb-1 block">Price (USDT)</label>
            <div className="relative">
              <Input type="text" value={price} onChange={(e) => setPrice(e.target.value)} className="h-8 text-xs font-mono pr-16 bg-background/50" data-testid="input-price" />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">USDT</span>
            </div>
          </div>
        )}

        <div>
          <label className="text-[10px] text-muted-foreground mb-1 block">Collateral (USDT)</label>
          <div className="relative">
            <Input type="text" placeholder="0.00" value={collateral} onChange={(e) => setCollateral(e.target.value)} className="h-8 text-xs font-mono pr-16 bg-background/50" data-testid="input-amount" />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">USDT</span>
          </div>
        </div>

        <div className="flex gap-1">
          {[25, 50, 75, 100].map((pct) => (
            <button key={pct} onClick={() => setCollateral(((walletUsdtBalance * pct) / 100).toFixed(2))} className="flex-1 py-1 text-[10px] font-mono text-muted-foreground bg-secondary/50 rounded hover-elevate" data-testid={`button-pct-${pct}`}>{pct}%</button>
          ))}
        </div>

        {/* Leverage — preset buttons + manual input */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[10px] text-muted-foreground">Leverage</label>
            <span className="text-[10px] font-mono text-white">{leverage[0]}x</span>
          </div>
          {/* Preset buttons */}
          <div className="flex gap-1 mb-2">
            {levButtons.map(b => (
              <button
                key={b}
                onClick={() => setLeverage([b])}
                className={`flex-1 py-1 text-[10px] font-mono rounded border transition-colors ${
                  leverage[0] === b
                    ? "bg-[#7a33fa]/20 text-[#7a33fa] border-[#7a33fa]/40"
                    : "text-muted-foreground border-border/30 hover:border-[#7a33fa]/30"
                }`}
                data-testid={`button-lev-${b}`}
              >
                {b}x
              </button>
            ))}
          </div>
          {/* Manual input — disabled if maxLeverage = 1 */}
          {maxLeverage > 1 ? (
            <div className="relative">
              <Input
                type="number"
                min={1}
                max={maxLeverage}
                value={leverage[0]}
                onChange={e => {
                  const v = Math.max(1, Math.min(maxLeverage, parseInt(e.target.value) || 1));
                  setLeverage([v]);
                }}
                className="h-7 text-[10px] font-mono pr-8 bg-background/50"
                data-testid="input-leverage-manual"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">x</span>
            </div>
          ) : (
            <div className="text-[10px] text-muted-foreground bg-white/5 border border-white/10 rounded px-2 py-1 text-center">
              1x only — market cap under $50k
            </div>
          )}
        </div>

        <div className="space-y-1.5 pt-1">
          <div className="flex justify-between text-[10px]">
            <span className="text-muted-foreground">Position Size</span>
            <span className="text-white font-mono">{positionSize > 0 ? `$${positionSize.toFixed(2)}` : "--"}</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-muted-foreground">Position limit</span>
            <span className="text-muted-foreground font-mono">$5 – ${maxPosition}</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-muted-foreground">Trade fee (0.1%, min $1)</span>
            <span className="text-white font-mono">{fee > 0 ? `$${fee.toFixed(2)}` : "--"}</span>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <div className="flex-1">
            <label className="text-[10px] text-muted-foreground mb-1 block">TP</label>
            <Input placeholder="--" value={tp} onChange={(e) => setTp(e.target.value)} className="h-7 text-[10px] font-mono bg-background/50" data-testid="input-tp" />
          </div>
          <div className="flex-1">
            <label className="text-[10px] text-muted-foreground mb-1 block">SL</label>
            <Input placeholder="--" value={sl} onChange={(e) => setSl(e.target.value)} className="h-7 text-[10px] font-mono bg-background/50" data-testid="input-sl" />
          </div>
        </div>

        {txStatus && (
          <div className="text-[10px] px-2 py-1.5 rounded bg-primary/10 text-primary border border-primary/20">{txStatus}</div>
        )}

        {(() => {
          const canOpen = marketStatus === "LIVE";
          const statusMsg: Record<string, string> = {
            PENDING:      "Vault Not Funded",
            VAULT_UNLOCK: "Opens Blocked — Close Only",
            FROZEN:       "Market Frozen — Close Only",
            PAUSED:       "Market Paused — Close Only",
          };
          const label = isSubmitting
            ? undefined
            : !address
              ? "Connect Wallet"
              : !CONTRACTS_DEPLOYED
                ? "Contracts Pending"
                : !canOpen
                  ? (statusMsg[marketStatus ?? ""] ?? "Unavailable")
                  : side === "long" ? "Open Long" : "Open Short";
          return (
            <Button
              className={`w-full h-10 text-sm font-semibold ${canOpen && CONTRACTS_DEPLOYED && address ? (side === "long" ? "bg-green-600 text-white no-default-hover-elevate no-default-active-elevate" : "bg-red-600 text-white no-default-hover-elevate no-default-active-elevate") : ""}`}
              onClick={handleSubmit}
              disabled={isSubmitting || (!address ? false : !CONTRACTS_DEPLOYED || !canOpen)}
              data-testid="button-place-order"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : label}
            </Button>
          );
        })()}

        <div className="pt-2 border-t border-border/20 space-y-1.5">
          <div className="flex justify-between text-[10px]">
            <span className="text-muted-foreground">Wallet USDT</span>
            <span className="text-white font-mono">{walletUsdtBalance.toFixed(2)} USDT</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function PositionsPanel({
  position,
  markPrice,
  onClose,
  onConnectWallet,
  address,
  txStatus,
  isSubmitting,
}: {
  position: OnChainPosition | null;
  markPrice: number | null;
  onClose: () => Promise<void>;
  onConnectWallet: () => void;
  address: string | null;
  txStatus: string | null;
  isSubmitting: boolean;
}) {
  const dec = markPrice && markPrice < 0.001 ? 8 : markPrice && markPrice < 1 ? 5 : 4;

  return (
    <div className="h-full flex flex-col bg-card/20" data-testid="positions-panel">
      <Tabs defaultValue="positions" className="flex flex-col h-full">
        <TabsList className="h-auto p-0 bg-transparent rounded-none border-b border-border/20 justify-start gap-0 w-full">
          {[
            { value: "positions", label: "Positions", count: position?.isOpen ? 1 : 0 },
            { value: "orders", label: "Open Orders", count: 0 },
            { value: "history", label: "Order History", count: 0 },
            { value: "trades", label: "Trade History", count: 0 },
          ].map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs px-3 sm:px-4 py-2" data-testid={`tab-${tab.value}`}>
              {tab.label}
              {tab.count > 0 && <span className="ml-1 text-[10px] bg-primary/20 text-primary px-1 rounded">{tab.count}</span>}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="positions" className="flex-1 overflow-auto mt-0 p-0">
          {!address ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8">
              <Wallet className="w-8 h-8 mb-2 opacity-30" />
              <span className="text-xs mb-2">Connect wallet to view positions</span>
              <Button size="sm" className="text-xs h-7" onClick={onConnectWallet}>Connect</Button>
            </div>
          ) : !position?.isOpen ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8">
              <BarChart3 className="w-8 h-8 mb-2 opacity-30" />
              <span className="text-xs">{CONTRACTS_DEPLOYED ? "No open positions" : "Contracts not deployed yet"}</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="text-[10px] text-muted-foreground border-b border-border/10">
                    <th className="text-left px-3 py-2 font-medium">Symbol</th>
                    <th className="text-left px-2 py-2 font-medium">Size</th>
                    <th className="text-right px-2 py-2 font-medium">Entry Price</th>
                    <th className="text-right px-2 py-2 font-medium">Mark Price</th>
                    <th className="text-right px-2 py-2 font-medium">PnL(USDT)</th>
                    <th className="text-right px-2 py-2 font-medium">Margin</th>
                    <th className="text-right px-3 py-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/5 text-[11px]" data-testid="row-position-0">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-white">FLAP/USDT</span>
                        <Badge variant="secondary" className="text-[9px] px-1 py-0">{Math.round(position.size / position.collateral)}x</Badge>
                      </div>
                      <span className={position.isLong ? "text-green-400 text-[10px]" : "text-red-400 text-[10px]"}>{position.isLong ? "Long" : "Short"}</span>
                    </td>
                    <td className="px-2 py-2.5 font-mono text-white">${position.size.toFixed(2)}</td>
                    <td className="text-right px-2 py-2.5 font-mono text-muted-foreground">{position.entryPrice.toFixed(dec)}</td>
                    <td className="text-right px-2 py-2.5 font-mono text-white">{(markPrice ?? 0).toFixed(dec)}</td>
                    <td className="text-right px-2 py-2.5">
                      <div className={`font-mono ${position.unrealizedPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {position.unrealizedPnl >= 0 ? "+" : ""}{position.unrealizedPnl.toFixed(2)}
                      </div>
                      <div className={`font-mono text-[10px] ${position.unrealizedPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {position.collateral > 0 ? `${((position.unrealizedPnl / position.collateral) * 100).toFixed(2)}%` : "0%"}
                      </div>
                    </td>
                    <td className="text-right px-2 py-2.5 font-mono text-muted-foreground">{position.collateral.toFixed(2)}</td>
                    <td className="text-right px-3 py-2.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-[10px] px-2 border-red-500/30 text-red-400"
                        onClick={onClose}
                        disabled={isSubmitting}
                        data-testid="button-close-pos"
                      >
                        {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : "Close"}
                      </Button>
                    </td>
                  </tr>
                </tbody>
              </table>
              {txStatus && <div className="px-3 py-2 text-[10px] text-primary">{txStatus}</div>}
            </div>
          )}
        </TabsContent>

        <TabsContent value="orders" className="flex-1 mt-0 p-0">
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8">
            <Clock className="w-8 h-8 mb-2 opacity-30" />
            <span className="text-xs">No open orders</span>
          </div>
        </TabsContent>

        <TabsContent value="history" className="flex-1 mt-0 p-0">
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8">
            <Clock className="w-8 h-8 mb-2 opacity-30" />
            <span className="text-xs">No order history</span>
          </div>
        </TabsContent>

        <TabsContent value="trades" className="flex-1 mt-0 p-0">
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8">
            <BarChart3 className="w-8 h-8 mb-2 opacity-30" />
            <span className="text-xs">No trade history</span>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}



export default function Perps({ embedded, initialToken }: { embedded?: boolean; initialToken?: string | null } = {}) {
  const { address, connect, disconnect, pendingWallet, approvePendingWallet, rejectPendingWallet } = useWalletContext();
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [allPairs, setAllPairs] = useState<MarketPair[]>([]);
  const [selectedPair, setSelectedPair] = useState<MarketPair | null>(null);
  const [mobileTab, setMobileTab] = useState<"chart" | "order">("chart");

  const [markPrice, setMarkPrice] = useState<number | null>(null);
  const [fundingRate, setFundingRate] = useState<number | null>(null);
  const [walletUsdtBalance, setWalletUsdtBalance] = useState(0);
  const [needsApproval, setNeedsApproval] = useState(true);
  const [position, setPosition] = useState<OnChainPosition | null>(null);
  const [maxLeverage, setMaxLeverage] = useState(10);
  const [tradingFeeBps, setTradingFeeBps] = useState(5);
  const [marketMcap, setMarketMcap] = useState(0);
  const levButtons  = useMemo(() => calcLevButtons(marketMcap), [marketMcap]);
  const maxPosition = useMemo(() => calcMaxPosition(marketMcap), [marketMcap]);

  const [tradeTxStatus, setTradeTxStatus] = useState<string | null>(null);
  const [isTradeSubmitting, setIsTradeSubmitting] = useState(false);

  const loadMarketData = useCallback(async () => {
    if (!CONTRACTS_DEPLOYED) {
      const dexPrice = await fetchDexScreenerPrice();
      if (dexPrice) setMarkPrice(dexPrice);
      return;
    }
    try {
      const provider  = getReadProvider();
      const perpsAddr  = selectedPair?.contractPerps  || FFX_CONTRACTS.PERPS;
      const oracleAddr = selectedPair?.contractOracle || FFX_CONTRACTS.ORACLE;
      if (!perpsAddr || !oracleAddr) return;
      const tokenAddr = selectedPair?.tokenAddress || "";
      const oracle = new ethers.Contract(oracleAddr, ORACLE_ABI, provider);
      const perps   = new ethers.Contract(perpsAddr,  PERPS_ABI,  provider);

      const [markRaw, paramsRaw, fundingRaw] = await Promise.allSettled([
        oracle.getPrice(tokenAddr),
        perps.getCurrentParams(),
        fetch(`/api/markets`).then(r => r.json()),
      ]);

      if (markRaw.status === "fulfilled") setMarkPrice(fmt18(markRaw.value));
      if (paramsRaw.status === "fulfilled") {
        setMaxLeverage(Number(paramsRaw.value.maxLeverage));
        setTradingFeeBps(10); // TRADE_FEE_BPS = 10 (0.1%) — constant in contract
      }
    } catch {}
  }, [selectedPair]);

  const loadUserData = useCallback(async () => {
    if (!address) { setWalletUsdtBalance(0); setPosition(null); return; }
    if (!CONTRACTS_DEPLOYED) {
      try {
        const provider = getReadProvider();
        const usdt = new ethers.Contract(USDT_ADDRESS, USDT_ABI, provider);
        const bal = await usdt.balanceOf(address);
        setWalletUsdtBalance(fmt18(bal));
      } catch {}
      return;
    }
    try {
      const provider  = getReadProvider();
      const perpsAddr = selectedPair?.contractPerps || FFX_CONTRACTS.PERPS;
      if (!perpsAddr) { setWalletUsdtBalance(0); return; }
      const perps = new ethers.Contract(perpsAddr, PERPS_ABI, provider);
      const usdt  = new ethers.Contract(USDT_ADDRESS, USDT_ABI, provider);

      // USDT is pulled directly from wallet — approval is for PERPS contract
      const [usdtBal, allowanceRaw, posIds] = await Promise.allSettled([
        usdt.balanceOf(address),
        usdt.allowance(address, perpsAddr),
        perps.traderPositions(address),
      ]);

      if (usdtBal.status === "fulfilled")     setWalletUsdtBalance(fmt18(usdtBal.value));
      if (allowanceRaw.status === "fulfilled") setNeedsApproval(allowanceRaw.value === BigInt(0));

      // Find trader's most recent open position
      if (posIds.status === "fulfilled") {
        const ids: bigint[] = [...posIds.value].reverse();
        let foundOpen = false;
        for (const posId of ids) {
          try {
            const p = await perps.getPosition(posId);
            if (p.isOpen) {
              const pnlRaw = await perps.getUnrealizedPnl(posId).catch(() => BigInt(0));
              setPosition({
                isOpen: true,
                isLong: p.isLong,
                collateral: fmt18(p.margin),
                size: fmt18(p.size),
                entryPrice: fmt18(p.entryPrice),
                unrealizedPnl: Number(ethers.formatEther(pnlRaw)),
                positionId: Number(posId),
              });
              foundOpen = true;
              break;
            }
          } catch {}
        }
        if (!foundOpen) setPosition(null);
      }
    } catch {}
  }, [address]);

  useEffect(() => {
    async function fetchMarkets() {
      try {
        const res = await fetch("/api/markets");
        const data = await res.json();
        if (!Array.isArray(data)) return;
        const pairs: MarketPair[] = data.map((m: any) => ({
          id: m.id,
          contractAddress: (m.tokenAddress || "").toLowerCase(),
          symbol: m.tokenSymbol,
          pair: `${m.tokenSymbol}/USDT`,
          price: m.priceUsd || 0,
          mcap: m.mcap || 0,
          volume24h: m.volume24h || 0,
          openInterest: m.openInterest || 0,
          longRatio: m.longRatio ?? 50,
          fundingRate: m.fundingRate || 0,
          status: m.status || "LIVE",
          contractPerps: m.contractPerps || null,
          contractVault: m.contractVault || null,
          contractOracle: m.contractOracle || null,
          pairAddress: m.pairAddress || null,
          tokenLogo: m.tokenLogo || null,
        }));
        setAllPairs(pairs);
        if (pairs.length > 0 && !selectedPair) {
          const tokenLower = (initialToken || "").toLowerCase();
          const target = tokenLower
            ? (pairs.find(p => p.contractAddress === tokenLower) ?? pairs[0])
            : pairs[0];
          setSelectedPair(target);
          setMarketMcap(target.mcap);
          if (!CONTRACTS_DEPLOYED && target.price > 0) setMarkPrice(target.price);
        }
      } catch {}
    }
    fetchMarkets();
  }, []);

  const handlePairSelect = useCallback((p: MarketPair) => {
    setSelectedPair(p);
    setMarketMcap(p.mcap);
    if (!CONTRACTS_DEPLOYED && p.price > 0) setMarkPrice(p.price);
    if (embedded && p.contractAddress) {
      window.location.hash = `futures/${p.contractAddress}`;
    }
  }, [embedded]);

  useEffect(() => {
    loadMarketData();
    const interval = setInterval(loadMarketData, 30000);
    return () => clearInterval(interval);
  }, [loadMarketData]);

  useEffect(() => {
    loadUserData();
    const interval = setInterval(loadUserData, 15000);
    return () => clearInterval(interval);
  }, [loadUserData]);

  const handleOpenPosition = useCallback(async (isLong: boolean, collateral: number, leverage: number, _tp: number, _sl: number) => {
    if (!CONTRACTS_DEPLOYED || !address) return;
    const perpsAddr = selectedPair?.contractPerps || FFX_CONTRACTS.PERPS;
    if (!perpsAddr) return;
    setIsTradeSubmitting(true);
    try {
      const signer = await getSigner();
      const usdt  = new ethers.Contract(USDT_ADDRESS, USDT_ABI, signer);
      const perps = new ethers.Contract(perpsAddr, PERPS_ABI, signer);

      if (collateral > walletUsdtBalance) {
        setTradeTxStatus("Insufficient USDT in wallet.");
        setTimeout(() => setTradeTxStatus(null), 5000);
        return;
      }

      // notional = margin * leverage; fee = max(notional * 0.1%, $1)
      const marginWei   = to18(collateral);
      const notional    = collateral * leverage;
      const feeEst      = Math.max(notional * 0.001, 1.0);
      const totalNeeded = to18(collateral + feeEst + 0.01); // small buffer for rounding

      // Approve PERPS contract to pull USDT directly from wallet
      const allowance = await usdt.allowance(address, perpsAddr);
      if (allowance < totalNeeded) {
        setTradeTxStatus("Approving USDT...");
        const approveTx = await usdt.approve(perpsAddr, ethers.MaxUint256);
        await approveTx.wait();
        setNeedsApproval(false);
      }

      // Simulate first: openPosition(uint256 margin, uint8 leverage, bool isLong)
      setTradeTxStatus("Simulating trade...");
      try {
        await perps.openPosition.staticCall(marginWei, leverage, isLong);
      } catch (simErr: any) {
        const reason = simErr.reason || simErr.shortMessage || simErr.message || "";
        setTradeTxStatus(`Trade will fail — ${reason.slice(0, 80)}`);
        setTimeout(() => setTradeTxStatus(null), 6000);
        return;
      }

      setTradeTxStatus("Confirm in your wallet...");
      const tx = await perps.openPosition(marginWei, leverage, isLong);
      setTradeTxStatus("Waiting for confirmation...");
      await tx.wait();
      setTradeTxStatus("Position opened!");
      await loadUserData();
      setTimeout(() => setTradeTxStatus(null), 4000);
    } catch (e: any) {
      const msg = e.reason || e.shortMessage || e.message || "Transaction failed";
      setTradeTxStatus(msg.includes("user rejected") ? "Transaction rejected" : msg.slice(0, 80));
      setTimeout(() => setTradeTxStatus(null), 5000);
    } finally {
      setIsTradeSubmitting(false);
    }
  }, [address, walletUsdtBalance, loadUserData, selectedPair]);

  const handleClosePosition = useCallback(async () => {
    if (!CONTRACTS_DEPLOYED || !address || !position) return;
    const perpsAddr = selectedPair?.contractPerps || FFX_CONTRACTS.PERPS;
    if (!perpsAddr) return;
    setIsTradeSubmitting(true);
    try {
      const signer = await getSigner();
      const perps = new ethers.Contract(perpsAddr, PERPS_ABI, signer);
      setTradeTxStatus("Confirm close in your wallet...");
      const tx = await perps.closePosition(position.positionId);
      setTradeTxStatus("Waiting for confirmation...");
      await tx.wait();
      setTradeTxStatus("Position closed!");
      await loadUserData();
      setTimeout(() => setTradeTxStatus(null), 4000);
    } catch (e: any) {
      const msg = e.reason || e.shortMessage || e.message || "Transaction failed";
      setTradeTxStatus(msg.includes("user rejected") ? "Transaction rejected" : msg.slice(0, 80));
      setTimeout(() => setTradeTxStatus(null), 5000);
    } finally {
      setIsTradeSubmitting(false);
    }
  }, [address, position, loadUserData, selectedPair]);

  const openWalletModal = useCallback(() => setIsWalletModalOpen(true), []);

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden" data-testid="page-perps">
      <TopBar
        selectedPair={selectedPair}
        onPairSelect={handlePairSelect}
        allPairs={allPairs}
        markPrice={markPrice}
        fundingRate={fundingRate}
        onConnectWallet={embedded ? undefined : openWalletModal}
        address={address}
      />

      {/* Desktop lg+ */}
      <div className="hidden lg:grid flex-1 overflow-hidden" style={{ gridTemplateColumns: "1fr 300px", gridTemplateRows: "1fr 220px" }}>
        <div className="border-r border-border/20 border-b border-border/20 overflow-hidden">
          <TradingChart
            price={markPrice ?? selectedPair?.price}
            marketCap={selectedPair?.mcap}
            symbol={selectedPair?.symbol}
            pairAddress={selectedPair?.pairAddress ?? undefined}
          />
        </div>

        <div className="border-b border-border/20 overflow-hidden row-span-1">
          <OrderForm
            markPrice={markPrice}
            walletUsdtBalance={walletUsdtBalance}
            openPosition={handleOpenPosition}
            closePosition={handleClosePosition}
            hasOpenPos={position?.isOpen ?? false}
            onConnectWallet={openWalletModal}
            address={address}
            txStatus={tradeTxStatus}
            isSubmitting={isTradeSubmitting}
            maxLeverage={maxLeverage}
            tradingFeeBps={tradingFeeBps}
            levButtons={levButtons}
            maxPosition={maxPosition}
            marketMcap={marketMcap}
            marketStatus={selectedPair?.status}
          />
        </div>

        <div className="overflow-hidden col-span-2">
          <PositionsPanel
            position={position}
            markPrice={markPrice}
            onClose={handleClosePosition}
            onConnectWallet={openWalletModal}
            address={address}
            txStatus={tradeTxStatus}
            isSubmitting={isTradeSubmitting}
          />
        </div>
      </div>

      {/* Tablet md */}
      <div className="hidden md:grid lg:hidden flex-1 overflow-hidden" style={{ gridTemplateColumns: "1fr 260px", gridTemplateRows: "1fr 200px" }}>
        <div className="border-r border-border/20 border-b border-border/20 overflow-hidden">
          <TradingChart
            price={markPrice ?? selectedPair?.price}
            marketCap={selectedPair?.mcap}
            symbol={selectedPair?.symbol}
            pairAddress={selectedPair?.pairAddress ?? undefined}
          />
        </div>

        <div className="border-b border-border/20 overflow-hidden">
          <OrderForm markPrice={markPrice} walletUsdtBalance={walletUsdtBalance} openPosition={handleOpenPosition} closePosition={handleClosePosition} hasOpenPos={position?.isOpen ?? false} onConnectWallet={openWalletModal} address={address} txStatus={tradeTxStatus} isSubmitting={isTradeSubmitting} maxLeverage={maxLeverage} tradingFeeBps={tradingFeeBps} levButtons={levButtons} maxPosition={maxPosition} marketMcap={marketMcap} marketStatus={selectedPair?.status} />
        </div>

        <div className="col-span-2 overflow-hidden">
          <PositionsPanel position={position} markPrice={markPrice} onClose={handleClosePosition} onConnectWallet={openWalletModal} address={address} txStatus={tradeTxStatus} isSubmitting={isTradeSubmitting} />
        </div>
      </div>

      {/* Mobile */}
      <div className="md:hidden flex-1 flex flex-col overflow-hidden">
        <div className="flex border-b border-border/20">
          {(["chart", "order"] as const).map((tab) => (
            <button key={tab} onClick={() => setMobileTab(tab)} className={`flex-1 py-2 text-xs font-semibold text-center transition-colors ${mobileTab === tab ? "text-primary border-b-2 border-primary" : "text-muted-foreground"}`} data-testid={`button-mobile-tab-${tab}`}>
              {tab === "chart" ? "Chart" : "Order"}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-hidden">
          {mobileTab === "chart" && <TradingChart
            price={markPrice ?? selectedPair?.price}
            marketCap={selectedPair?.mcap}
            symbol={selectedPair?.symbol}
            pairAddress={selectedPair?.pairAddress ?? undefined}
          />}
          {mobileTab === "order" && (
            <OrderForm markPrice={markPrice} walletUsdtBalance={walletUsdtBalance} openPosition={handleOpenPosition} closePosition={handleClosePosition} hasOpenPos={position?.isOpen ?? false} onConnectWallet={openWalletModal} address={address} txStatus={tradeTxStatus} isSubmitting={isTradeSubmitting} maxLeverage={maxLeverage} tradingFeeBps={tradingFeeBps} levButtons={levButtons} maxPosition={maxPosition} marketMcap={marketMcap} marketStatus={selectedPair?.status} />
          )}
        </div>

        {mobileTab === "chart" && (
          <div className="border-t border-border/20 max-h-[45vh] overflow-hidden">
            <PositionsPanel position={position} markPrice={markPrice} onClose={handleClosePosition} onConnectWallet={openWalletModal} address={address} txStatus={tradeTxStatus} isSubmitting={isTradeSubmitting} />
          </div>
        )}
      </div>

      <WalletModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
        onConnect={(provider) => { setIsWalletModalOpen(false); connect(provider); }}
      />
    </div>
  );
}
