import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Search, Copy, ExternalLink, TrendingUp, TrendingDown,
  RefreshCw, ArrowUpDown, ChevronDown, Wallet,
} from "lucide-react";
import { ethers } from "ethers";
import { TradingChart } from "@/components/trading-chart";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import logoImg from "@assets/flapfutureslogo_nobg.png";
import { WalletModal } from "@/components/wallet-modal";
import { useWalletContext } from "@/components/WalletProvider";
import {
  BSC_RPC, ZERO_ADDR, WBNB, USDT_BSC,
  FLAP_PORTAL, PANCAKE_V2_ROUTER,
  PORTAL_ABI, PANCAKE_V2_ABI, ERC20_SPOT_ABI,
  ensureBSC, getTokenState,
  type TokenState,
} from "@/lib/spot-contracts";

const DEFAULT_TOKEN = WBNB; // Moralis lookup for WBNB returns WBNB/USDT correctly
const BNB_PRICE_USD = 600;

interface PairData {
  chainId: string;
  dexId: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; name: string; symbol: string };
  priceNative: string;
  priceUsd: string;
  txns: { h24: { buys: number; sells: number } };
  volume: { h24: number };
  priceChange: { h24: number };
  liquidity: { usd: number };
  fdv: number;
  marketCap: number;
  info?: { imageUrl?: string };
}

function tokenLogo(address: string): string {
  return `/api/spot/logo/${address}`;
}

function TokenIcon({ address, imageUrl, symbol, size = 20 }: { address: string; imageUrl?: string; symbol?: string; size?: number }) {
  const [err, setErr] = React.useState(false);
  const [err2, setErr2] = React.useState(false);
  const primary   = imageUrl ?? tokenLogo(address);
  const secondary = imageUrl ? tokenLogo(address) : null;
  const letter    = (symbol ?? address).charAt(0).toUpperCase();
  const s         = `${size}px`;

  if (!err) {
    return (
      <img
        src={primary}
        alt={symbol}
        width={size}
        height={size}
        style={{ width: s, height: s, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
        onError={() => setErr(true)}
      />
    );
  }
  if (secondary && !err2) {
    return (
      <img
        src={secondary}
        alt={symbol}
        width={size}
        height={size}
        style={{ width: s, height: s, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
        onError={() => setErr2(true)}
      />
    );
  }
  return (
    <div style={{ width: s, height: s, borderRadius: "50%", background: "linear-gradient(135deg,#7a33fa,#d5f704)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: `${Math.max(8, size * 0.45)}px`, fontWeight: "bold", color: "#fff", flexShrink: 0 }}>
      {letter}
    </div>
  );
}

function fmtShort(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function fmtPrice(s: string | number): string {
  const n = Number(s);
  if (isNaN(n) || n === 0) return "—";
  if (n < 0.000001) return `$${n.toFixed(10)}`;
  if (n < 0.0001)   return `$${n.toFixed(8)}`;
  if (n < 0.01)     return `$${n.toFixed(6)}`;
  if (n < 1)        return `$${n.toFixed(4)}`;
  return `$${n.toFixed(4)}`;
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function SpotTopBar({
  pair,
  loading,
  tokenAddress,
  onLoadToken,
  address,
  onConnectWallet,
}: {
  pair: PairData | null;
  loading: boolean;
  tokenAddress: string;
  onLoadToken: (addr: string) => void;
  address: string | null;
  onConnectWallet?: () => void;
}) {
  const [showSearch, setShowSearch] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleLoad = () => {
    const v = searchInput.trim();
    if (/^0x[0-9a-fA-F]{40}$/.test(v)) {
      onLoadToken(v);
      setShowSearch(false);
      setSearchInput("");
    } else {
      toast({ title: "Invalid address", description: "Enter a valid BEP-20 contract address", variant: "destructive" });
    }
  };

  useEffect(() => {
    if (showSearch) setTimeout(() => inputRef.current?.focus(), 50);
  }, [showSearch]);

  const priceChange = pair?.priceChange?.h24 ?? 0;
  const priceUp = priceChange >= 0;
  const displayPrice = pair ? fmtPrice(pair.priceUsd) : "—";

  const stats = pair ? [
    { label: "24h Volume",  value: pair.volume?.h24  ? fmtShort(pair.volume.h24)  : "—" },
    { label: "Market Cap",  value: (pair.marketCap || pair.fdv) ? fmtShort(pair.marketCap || pair.fdv) : "—" },
    { label: "Liquidity",   value: pair.liquidity?.usd ? fmtShort(pair.liquidity.usd) : "—" },
    { label: "24h Change",  value: `${priceUp ? "+" : ""}${priceChange.toFixed(2)}%`, color: priceUp ? "text-green-400" : "text-red-400" },
  ] : [];

  return (
    <div className="h-12 border-b border-border/40 bg-card/30 flex items-center relative z-50" data-testid="spot-topbar">
      <div className="flex items-center h-full">
        <Link href="/" className="flex items-center gap-2 px-3 sm:px-4 h-full border-r border-border/30">
          <img src={logoImg} alt="FFX" className="w-6 h-6" />
          <span className="font-heading font-bold text-sm text-white hidden sm:inline">FFX</span>
        </Link>

        <div className="relative">
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="flex items-center gap-2 px-3 sm:px-4 h-12 border-r border-border/30 hover-elevate"
            data-testid="button-token-selector"
          >
            {pair && (
              <TokenIcon address={pair.baseToken.address} imageUrl={pair.info?.imageUrl} symbol={pair.baseToken.symbol} size={20} />
            )}
            <span className="font-heading font-bold text-sm sm:text-base text-white">
              {pair ? `${pair.baseToken.symbol}/${pair.quoteToken.symbol}` : "Select Token"}
            </span>
            <span className="text-xs text-muted-foreground">Spot</span>
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
          </button>

          {showSearch && (
            <div className="absolute top-12 left-0 w-80 bg-card border border-border/40 rounded-md shadow-xl z-50">
              <div className="p-2 border-b border-border/30">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    ref={inputRef}
                    placeholder="Paste BEP-20 token address (0x...)"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleLoad()}
                    className="h-8 pl-8 text-xs bg-background/50"
                  />
                </div>
              </div>
              <div className="p-2">
                <Button size="sm" className="w-full h-8 text-xs" onClick={handleLoad}>
                  Load Token
                </Button>
              </div>
              <div className="px-3 py-2 border-t border-border/20">
                <div className="text-[10px] text-muted-foreground mb-1.5">Quick Load</div>
                <button
                  onClick={() => { onLoadToken(WBNB); setShowSearch(false); }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover-elevate"
                >
                  <TokenIcon address={WBNB} symbol="BNB" size={20} />
                  <span className="text-white font-medium">BNB/USDT</span>
                  <span className="text-muted-foreground text-[10px] font-mono">{shortAddr(WBNB)}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="hidden md:flex items-center gap-4 lg:gap-6 px-4 flex-1">
        {pair && (
          <div className="flex items-baseline gap-2">
            <div className="font-mono text-lg font-bold text-white">{displayPrice}</div>
            <span className={`text-xs font-mono ${priceUp ? "text-green-400" : "text-red-400"}`}>
              {priceUp ? "+" : ""}{priceChange.toFixed(2)}%
            </span>
          </div>
        )}
        {pair && <div className="h-8 w-px bg-border/30" />}
        <div className="flex items-center gap-4 lg:gap-6">
          {stats.map((s) => (
            <div key={s.label}>
              <div className="text-[10px] text-muted-foreground leading-none mb-0.5">{s.label}</div>
              <div className={`text-xs font-mono font-semibold ${s.color ?? "text-white"}`}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 px-3 ml-auto">
        {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
        {pair && (
          <a
            href={`https://dexscreener.com/bsc/${pair.pairAddress}`}
            target="_blank" rel="noreferrer"
            className="hidden sm:flex items-center gap-1 text-[10px] text-muted-foreground hover:text-white transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            DexScreener
          </a>
        )}
        {onConnectWallet && (
          address ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary/10 border border-primary/20">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
              <span className="text-[10px] font-mono text-white">{shortAddr(address)}</span>
            </div>
          ) : (
            <Button size="sm" className="h-8 text-xs" onClick={onConnectWallet} data-testid="button-connect-spot">
              <Wallet className="w-3.5 h-3.5 mr-1.5" />Connect
            </Button>
          )
        )}
      </div>
    </div>
  );
}

function SwapPanel({
  pair,
  address,
  onConnectWallet,
}: {
  pair: PairData | null;
  address: string | null;
  onConnectWallet: () => void;
}) {
  const [mode, setMode] = useState<"buy" | "sell">("buy");
  const [payAmount, setPayAmount] = useState("");
  const [slippage, setSlippage] = useState("10");
  const [payWith, setPayWith] = useState<"BNB" | "USDT">("BNB");
  const [slipCustom, setSlipCustom] = useState("");

  // ── swap backend state ──────────────────────────────────────────
  const [tokenState, setTokenState] = useState<TokenState | null>(null);
  const [receiveAmount, setReceiveAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txStatus, setTxStatus] = useState<string | null>(null);
  const [tokenBalance, setTokenBalance] = useState<string>("");
  const [bnbBalance, setBnbBalance] = useState<string>("");
  const [usdtBalance, setUsdtBalance] = useState<string>("");
  const { toast } = useToast();

  // detect flap.sh bonding-curve vs pancakeswap whenever token changes
  useEffect(() => {
    if (!pair) return;
    setTokenState(null);
    setReceiveAmount("");
    setPayWith("BNB");
    getTokenState(pair.baseToken.address).then(setTokenState);
  }, [pair?.baseToken.address]);

  // fetch wallet balances whenever address or token changes
  useEffect(() => {
    if (!address || !pair) return;
    const provider = new ethers.JsonRpcProvider(BSC_RPC);
    provider.getBalance(address).then((b) => setBnbBalance(parseFloat(ethers.formatEther(b)).toFixed(4))).catch(() => {});
    const token = new ethers.Contract(pair.baseToken.address, ERC20_SPOT_ABI, provider);
    token.balanceOf(address).then((b: bigint) => setTokenBalance(parseFloat(ethers.formatEther(b)).toFixed(6))).catch(() => {});
    const usdt = new ethers.Contract(USDT_BSC, ERC20_SPOT_ABI, provider);
    usdt.balanceOf(address).then((b: bigint) => setUsdtBalance(parseFloat(ethers.formatEther(b)).toFixed(2))).catch(() => {});
  }, [address, pair?.baseToken.address]);

  // derived flags
  const isWbnbPair = pair?.baseToken.address.toLowerCase() === WBNB.toLowerCase();
  const isBonding  = tokenState?.status === "bonding";
  const showPaySelector = !isBonding && !isWbnbPair;

  // instant price-based estimate (no RPC needed)
  const priceEstimate = useCallback((qty: number): string => {
    if (!pair || qty <= 0) return "";
    const tokenUsd = parseFloat(pair.priceUsd || "0") || 1;
    const pn       = parseFloat(pair.priceNative || "0");
    const bnbUsd   = isWbnbPair
      ? tokenUsd                                          // WBNB price IS BNB price
      : (pn > 0 && tokenUsd > 0 ? tokenUsd / pn : BNB_PRICE_USD);
    if (isWbnbPair) {
      // BUY: pay BNB → receive USDT  |  SELL: pay USDT → receive BNB
      return mode === "buy"
        ? (qty * bnbUsd).toFixed(4)
        : (qty / bnbUsd).toFixed(6);
    }
    if (mode === "buy") {
      return payWith === "USDT"
        ? (qty / tokenUsd).toFixed(6)
        : (qty * bnbUsd / tokenUsd).toFixed(6);
    } else {
      return payWith === "USDT"
        ? (qty * tokenUsd).toFixed(4)
        : (qty * tokenUsd / bnbUsd).toFixed(6);
    }
  }, [pair, mode, payWith, isWbnbPair]);

  // show instant estimate immediately, then refine with on-chain quote (500ms debounce)
  useEffect(() => {
    const qty = parseFloat(payAmount || "0");
    if (!pair || qty <= 0) { setReceiveAmount(""); return; }
    setReceiveAmount(priceEstimate(qty));         // instant
    if (!tokenState) return;                      // on-chain needs tokenState
    const t = setTimeout(fetchQuote, 500);
    return () => clearTimeout(t);
  }, [payAmount, mode, tokenState, payWith, pair?.baseToken.address, priceEstimate]);

  const fetchQuote = useCallback(async () => {
    if (!pair || !tokenState || !payAmount || Number(payAmount) <= 0) return;
    try {
      const provider  = new ethers.JsonRpcProvider(BSC_RPC);
      const tokenAddr = pair.baseToken.address;
      const inputWei  = ethers.parseEther(payAmount);

      if (tokenState.status === "bonding") {
        // ── flap.sh bonding curve: BNB only ─────────────────────
        const portal      = new ethers.Contract(FLAP_PORTAL, PORTAL_ABI, provider);
        const inputToken  = mode === "buy" ? ZERO_ADDR : tokenAddr;
        const outputToken = mode === "buy" ? tokenAddr  : ZERO_ADDR;
        const out = await portal.quoteExactInput.staticCall({ inputToken, outputToken, inputAmount: inputWei });
        setReceiveAmount(parseFloat(ethers.formatEther(out)).toFixed(6));
      } else {
        // ── PancakeSwap V2 ───────────────────────────────────────
        const router = new ethers.Contract(PANCAKE_V2_ROUTER, PANCAKE_V2_ABI, provider);
        let path: string[];
        if (isWbnbPair) {
          path = mode === "buy" ? [WBNB, USDT_BSC] : [USDT_BSC, WBNB];
        } else if (payWith === "USDT") {
          path = mode === "buy" ? [USDT_BSC, WBNB, tokenAddr] : [tokenAddr, WBNB, USDT_BSC];
        } else {
          path = mode === "buy" ? [WBNB, tokenAddr] : [tokenAddr, WBNB];
        }
        const amounts = await router.getAmountsOut(inputWei, path);
        setReceiveAmount(parseFloat(ethers.formatEther(amounts[amounts.length - 1])).toFixed(6));
      }
    } catch {
      // on-chain quote failed — keep the price-based estimate already shown
    }
  }, [pair, tokenState, payAmount, mode, payWith, isWbnbPair]);

  const handleSwap = useCallback(async () => {
    if (!address || !pair || !payAmount || Number(payAmount) <= 0 || isSubmitting) return;
    setIsSubmitting(true);
    setTxStatus("Confirm in wallet…");
    try {
      const provider  = await ensureBSC();
      const signer    = await provider.getSigner();
      const tokenAddr = pair.baseToken.address;
      const inputWei  = ethers.parseEther(payAmount);
      const deadline  = BigInt(Math.floor(Date.now() / 1000) + 1800);
      const slipBps   = BigInt(Math.round(Number(slippage) * 10));
      const minOut    = receiveAmount && receiveAmount !== "—"
        ? ethers.parseEther(receiveAmount) * (1000n - slipBps) / 1000n
        : 0n;
      if (tokenState?.status === "bonding") {
        // ── flap.sh Portal: BNB only ─────────────────────────────
        const portal = new ethers.Contract(FLAP_PORTAL, PORTAL_ABI, signer);
        if (mode === "buy") {
          const tx = await portal.swapExactInput(
            { inputToken: ZERO_ADDR, outputToken: tokenAddr, inputAmount: inputWei, minOutputAmount: minOut, permitData: "0x" },
            { value: inputWei },
          );
          setTxStatus("Confirming…"); await tx.wait();
        } else {
          const tkn = new ethers.Contract(tokenAddr, ERC20_SPOT_ABI, signer);
          if (await tkn.allowance(address, FLAP_PORTAL) < inputWei) {
            setTxStatus("Approving…");
            await (await tkn.approve(FLAP_PORTAL, ethers.MaxUint256)).wait();
          }
          setTxStatus("Confirm in wallet…");
          const tx = await portal.swapExactInput(
            { inputToken: tokenAddr, outputToken: ZERO_ADDR, inputAmount: inputWei, minOutputAmount: minOut, permitData: "0x" },
            { value: 0n },
          );
          setTxStatus("Confirming…"); await tx.wait();
        }
      } else {
        // ── PancakeSwap V2 ───────────────────────────────────────
        const router = new ethers.Contract(PANCAKE_V2_ROUTER, PANCAKE_V2_ABI, signer);

        if (isWbnbPair) {
          // WBNB/USDT pair: BNB ↔ USDT
          if (mode === "buy") {
            // pay BNB → get USDT
            const tx = await router.swapExactETHForTokens(minOut, [WBNB, USDT_BSC], address, deadline, { value: inputWei });
            setTxStatus("Confirming…"); await tx.wait();
          } else {
            // pay USDT → get BNB
            const tkn = new ethers.Contract(USDT_BSC, ERC20_SPOT_ABI, signer);
            if (await tkn.allowance(address, PANCAKE_V2_ROUTER) < inputWei) {
              setTxStatus("Approving…");
              await (await tkn.approve(PANCAKE_V2_ROUTER, ethers.MaxUint256)).wait();
            }
            setTxStatus("Confirm in wallet…");
            const tx = await router.swapExactTokensForETH(inputWei, minOut, [USDT_BSC, WBNB], address, deadline);
            setTxStatus("Confirming…"); await tx.wait();
          }
        } else if (payWith === "BNB") {
          // BNB ↔ TOKEN
          if (mode === "buy") {
            // pay BNB → get TOKEN
            const tx = await router.swapExactETHForTokens(minOut, [WBNB, tokenAddr], address, deadline, { value: inputWei });
            setTxStatus("Confirming…"); await tx.wait();
          } else {
            // pay TOKEN → get BNB
            const tkn = new ethers.Contract(tokenAddr, ERC20_SPOT_ABI, signer);
            if (await tkn.allowance(address, PANCAKE_V2_ROUTER) < inputWei) {
              setTxStatus("Approving…");
              await (await tkn.approve(PANCAKE_V2_ROUTER, ethers.MaxUint256)).wait();
            }
            setTxStatus("Confirm in wallet…");
            const tx = await router.swapExactTokensForETH(inputWei, minOut, [tokenAddr, WBNB], address, deadline);
            setTxStatus("Confirming…"); await tx.wait();
          }
        } else {
          // USDT ↔ TOKEN (route through WBNB)
          if (mode === "buy") {
            // pay USDT → get TOKEN
            const tkn = new ethers.Contract(USDT_BSC, ERC20_SPOT_ABI, signer);
            if (await tkn.allowance(address, PANCAKE_V2_ROUTER) < inputWei) {
              setTxStatus("Approving…");
              await (await tkn.approve(PANCAKE_V2_ROUTER, ethers.MaxUint256)).wait();
            }
            setTxStatus("Confirm in wallet…");
            const tx = await router.swapExactTokensForTokens(inputWei, minOut, [USDT_BSC, WBNB, tokenAddr], address, deadline);
            setTxStatus("Confirming…"); await tx.wait();
          } else {
            // pay TOKEN → get USDT
            const tkn = new ethers.Contract(tokenAddr, ERC20_SPOT_ABI, signer);
            if (await tkn.allowance(address, PANCAKE_V2_ROUTER) < inputWei) {
              setTxStatus("Approving…");
              await (await tkn.approve(PANCAKE_V2_ROUTER, ethers.MaxUint256)).wait();
            }
            setTxStatus("Confirm in wallet…");
            const tx = await router.swapExactTokensForTokens(inputWei, minOut, [tokenAddr, WBNB, USDT_BSC], address, deadline);
            setTxStatus("Confirming…"); await tx.wait();
          }
        }
      }

      toast({ title: `${mode === "buy" ? "Buy" : "Sell"} successful!`, description: "Transaction confirmed on-chain." });
      setPayAmount("");
      setReceiveAmount("");
      setTimeout(refreshBalances, 2000);
    } catch (e: any) {
      const msg     = e?.message ?? String(e);
      const display = msg.includes("user rejected") || msg.includes("ACTION_REJECTED")
        ? "Transaction rejected"
        : msg.slice(0, 80);
      toast({ title: "Swap failed", description: display, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
      setTxStatus(null);
    }
  }, [address, pair, payAmount, slippage, mode, tokenState, receiveAmount, isSubmitting, toast]);
  // refresh balances after a successful swap
  const refreshBalances = useCallback(() => {
    if (!address || !pair) return;
    const provider = new ethers.JsonRpcProvider(BSC_RPC);
    provider.getBalance(address).then((b) => setBnbBalance(parseFloat(ethers.formatEther(b)).toFixed(4))).catch(() => {});
    const token = new ethers.Contract(pair.baseToken.address, ERC20_SPOT_ABI, provider);
    token.balanceOf(address).then((b: bigint) => setTokenBalance(parseFloat(ethers.formatEther(b)).toFixed(6))).catch(() => {});
    const usdt = new ethers.Contract(USDT_BSC, ERC20_SPOT_ABI, provider);
    usdt.balanceOf(address).then((b: bigint) => setUsdtBalance(parseFloat(ethers.formatEther(b)).toFixed(2))).catch(() => {});
  }, [address, pair?.baseToken.address]);

  // Derived BNB price from pair data: priceUsd / priceNative
  const derivedBnbPrice = (() => {
    if (!pair) return BNB_PRICE_USD;
    if (pair.baseToken.address.toLowerCase() === WBNB.toLowerCase()) return parseFloat(pair.priceUsd || "0") || BNB_PRICE_USD;
    const pn = parseFloat(pair.priceNative || "0");
    const pu = parseFloat(pair.priceUsd || "0");
    if (pn > 0 && pu > 0) return pu / pn;
    return BNB_PRICE_USD;
  })();

  // ── derived UI values ──────────────────────────────────────────
  const SELL_PCTS = ["25%", "50%", "75%", "Max"] as const;
  const BUY_QTYS  = ["0.01", "0.05", "0.1", "0.5"] as const;

  const handleQuick = (val: string) => {
    if (mode === "buy") { setPayAmount(val); return; }
    // Sell: calculate from balance
    const bal = parseFloat(
      isWbnbPair ? usdtBalance || "0"
      : payWith === "USDT" ? tokenBalance || "0"
      : tokenBalance || "0"
    );
    if (!bal) return;
    const pct = val === "Max" ? 1 : parseFloat(val) / 100;
    const result = (bal * pct).toFixed(6);
    setPayAmount(result);
  };

  // Pay-amount USD display
  const payAmountUsd = (() => {
    const n = parseFloat(payAmount || "0");
    if (!n || !pair) return "";
    if (mode === "sell") {
      if (isWbnbPair) return `$${n.toFixed(2)}`;                               // selling USDT: 1 USDT = $1
      if (payWith === "USDT") return `$${(n * parseFloat(pair.priceUsd || "0")).toFixed(4)}`; // selling TOKEN, display USD value
      return `$${(n * parseFloat(pair.priceUsd || "0")).toFixed(4)}`;          // selling TOKEN (BNB pair), display USD value
    }
    if (payWith === "USDT" && !isWbnbPair) return `$${n.toFixed(2)}`;         // paying USDT: 1 USDT = $1
    return `$${(n * derivedBnbPrice).toFixed(2)}`;                             // paying BNB: n * BNB price
  })();

  // Wallet balance label for current pay token
  const payBalanceLabel = (() => {
    if (!address) return "";
    if (mode === "buy") {
      if (payWith === "USDT" && !isWbnbPair) return usdtBalance ? `Balance: ${usdtBalance} USDT` : "";
      return bnbBalance ? `Balance: ${bnbBalance} BNB` : "";
    }
    if (isWbnbPair) return usdtBalance ? `Balance: ${usdtBalance} USDT` : "";
    return tokenBalance ? `Balance: ${tokenBalance} ${pair?.baseToken.symbol ?? ""}` : "";
  })();

  const baseSymbol = pair?.baseToken.symbol ?? "TOKEN";
  let paySymbol: string;
  let receiveSymbol: string;
  if (isBonding) {
    paySymbol     = mode === "buy" ? "BNB" : baseSymbol;
    receiveSymbol = mode === "buy" ? baseSymbol : "BNB";
  } else if (isWbnbPair) {
    paySymbol     = mode === "buy" ? "BNB"  : "USDT";
    receiveSymbol = mode === "buy" ? "USDT" : "BNB";
  } else {
    paySymbol     = mode === "buy" ? payWith     : baseSymbol;
    receiveSymbol = mode === "buy" ? baseSymbol  : payWith;
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="grid grid-cols-2 border-b border-border/20">
        {(["buy", "sell"] as const).map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); setPayAmount(""); setReceiveAmount(""); }}
            className="py-2.5 text-sm font-bold uppercase tracking-wide transition-all"
            style={{
              background: mode === m ? (m === "buy" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)") : "transparent",
              color: mode === m ? (m === "buy" ? "#22c55e" : "#ef4444") : "rgba(255,255,255,0.3)",
              borderBottom: mode === m ? `2px solid ${m === "buy" ? "#22c55e" : "#ef4444"}` : "2px solid transparent",
            }}
            data-testid={`button-spot-${m}`}
          >
            {m}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {/* Slippage row */}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>{mode === "buy" ? "You pay" : "You sell"}</span>
          <div className="flex items-center gap-1">
            <span>Slippage</span>
            <div className="flex gap-0.5 items-center">
              {["5", "10", "15"].map((s) => (
                <button
                  key={s}
                  onClick={() => { setSlippage(s); setSlipCustom(""); }}
                  className="px-1.5 py-0.5 rounded text-[9px] font-mono transition-colors"
                  style={{
                    background: slippage === s && !slipCustom ? "rgba(122,51,250,0.3)" : "rgba(255,255,255,0.06)",
                    color: slippage === s && !slipCustom ? "#fff" : "rgba(255,255,255,0.4)",
                  }}
                >
                  {s}%
                </button>
              ))}
              <input
                type="number"
                min="0.1"
                max="50"
                step="0.1"
                placeholder="custom"
                value={slipCustom}
                onChange={(e) => { setSlipCustom(e.target.value); if (e.target.value) setSlippage(e.target.value); }}
                className="w-12 px-1 py-0.5 rounded text-[9px] font-mono bg-transparent border border-border/30 text-white outline-none placeholder:text-muted-foreground/40 text-center"
              />
            </div>
          </div>
        </div>

        {/* BNB / USDT currency selector — graduated tokens only */}
        {showPaySelector && (
          <div className="flex items-center gap-1.5 text-[10px]">
            <span className="text-muted-foreground">{mode === "buy" ? "Pay with" : "Receive in"}</span>
            {(["BNB", "USDT"] as const).map((c) => (
              <button
                key={c}
                onClick={() => { setPayWith(c); setPayAmount(""); setReceiveAmount(""); }}
                className="px-2 py-0.5 rounded font-semibold transition-colors"
                style={{
                  background: payWith === c ? "rgba(122,51,250,0.35)" : "rgba(255,255,255,0.06)",
                  color: payWith === c ? "#fff" : "rgba(255,255,255,0.4)",
                  border: payWith === c ? "1px solid rgba(122,51,250,0.6)" : "1px solid transparent",
                }}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        <div className="rounded-lg border border-border/20 bg-background/50">
          <div className="px-3 pt-3 pb-2">
            <input
              type="number"
              min="0"
              placeholder="0.00"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              className="w-full bg-transparent text-2xl font-bold font-mono text-white outline-none placeholder:text-muted-foreground/40"
            />
          </div>
          <div className="flex items-center justify-between px-3 pb-3">
            <span className="text-xs font-semibold text-white">{paySymbol}</span>
            <div className="flex flex-col items-end gap-0.5">
              {payAmountUsd && <span className="text-[10px] text-muted-foreground">≈ {payAmountUsd}</span>}
              {payBalanceLabel && <span className="text-[9px] text-muted-foreground/60">{payBalanceLabel}</span>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {(mode === "buy" ? BUY_QTYS : SELL_PCTS).map((amt) => (
            <button
              key={amt}
              onClick={() => handleQuick(amt)}
              className="py-1.5 rounded text-[10px] font-mono font-medium transition-colors border border-border/20 hover:border-primary/30 hover:bg-primary/10 hover:text-white"
              style={{ background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.45)" }}
            >
              {amt}
            </button>
          ))}
        </div>

        <div className="flex justify-center py-0.5">
          <button className="rounded-full p-1.5 border border-border/20 bg-background/50 hover:border-primary/30 hover:bg-primary/10 transition-colors">
            <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>

        <div>
          <div className="text-[10px] text-muted-foreground mb-1.5">You receive</div>
          <div className="rounded-lg border border-border/20 bg-background/50 px-3 py-3">
            <div className="text-2xl font-bold font-mono" style={{ color: receiveAmount ? "#d5f704" : "rgba(255,255,255,0.2)" }}>
              {receiveAmount || "0.00"}
            </div>
            <div className="text-xs font-semibold text-muted-foreground mt-1">{receiveSymbol}</div>
          </div>
        </div>

        {address ? (
          <button
            onClick={handleSwap}
            disabled={isSubmitting || !payAmount || Number(payAmount) <= 0}
            className="w-full py-3 rounded-lg text-sm font-bold transition-all disabled:opacity-60"
            style={{
              background: mode === "buy" ? "#22c55e" : "#ef4444",
              color: "#fff",
              boxShadow: mode === "buy" ? "0 4px 20px rgba(34,197,94,0.25)" : "0 4px 20px rgba(239,68,68,0.25)",
            }}
            data-testid="button-swap-confirm"
          >
            {txStatus ?? (mode === "buy" ? `Buy ${pair?.baseToken.symbol ?? "Token"}` : `Sell ${pair?.baseToken.symbol ?? "Token"}`)}
          </button>
        ) : (
          <button
            onClick={onConnectWallet}
            className="w-full py-3 rounded-lg text-sm font-bold transition-all"
            style={{ background: "#22c55e", color: "#fff", boxShadow: "0 4px 20px rgba(34,197,94,0.25)" }}
            data-testid="button-connect-swap"
          >
            <Wallet className="w-4 h-4 inline mr-2" />
            Connect Wallet
          </button>
        )}

        <div className="space-y-1.5 pt-1 border-t border-border/20">
          {[
            ["Price", pair ? fmtPrice(pair.priceUsd) : "—"],
            ["24h Txns", pair ? `${pair.txns?.h24?.buys ?? 0} buys / ${pair.txns?.h24?.sells ?? 0} sells` : "—"],
            ["DEX", pair ? (pair.dexId.charAt(0).toUpperCase() + pair.dexId.slice(1)) : "—"],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between text-[10px]">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-mono text-white/70">{value}</span>
            </div>
          ))}
        </div>

        {pair && (
          <div className="flex gap-2 pt-1">
            <a
              href={`https://dexscreener.com/bsc/${pair.pairAddress}`}
              target="_blank" rel="noreferrer"
              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded border border-border/20 text-[10px] text-muted-foreground hover:text-white hover:border-border/40 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />DexScreener
            </a>
            <a
              href={`https://bscscan.com/token/${pair.baseToken.address}`}
              target="_blank" rel="noreferrer"
              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded border border-border/20 text-[10px] text-muted-foreground hover:text-white hover:border-border/40 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />BSCScan
            </a>
          </div>
        )}
      </div>
    </div>
  );
}


interface SpotProps { embedded?: boolean }

export default function Spot({ embedded }: SpotProps) {
  const { address, connect, disconnect, pendingWallet, approvePendingWallet, rejectPendingWallet } = useWalletContext();
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [tokenAddress, setTokenAddress] = useState(DEFAULT_TOKEN);
  const [pair, setPair]       = useState<PairData | null>(null);
  const [loading, setLoading] = useState(false);
  const [mobileTab, setMobileTab] = useState<"chart" | "swap">("chart");
  const [swapWidth, setSwapWidth] = useState(300);
  const dragging   = useRef(false);
  const dragStartX = useRef(0);
  const dragStartW = useRef(0);

  const onDividerMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current   = true;
    dragStartX.current = e.clientX;
    dragStartW.current = swapWidth;
    document.body.style.cursor    = "col-resize";
    document.body.style.userSelect = "none";

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const delta   = dragStartX.current - ev.clientX;
      const next    = Math.max(0, Math.min(520, dragStartW.current + delta));
      setSwapWidth(next);
    };
    const onUp = () => {
      dragging.current = false;
      document.body.style.cursor     = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
  }, [swapWidth]);

  // double-click divider: collapse or restore to 300
  const onDividerDblClick = useCallback(() => {
    setSwapWidth((w) => (w < 60 ? 300 : 0));
  }, []);

  const fetchToken = useCallback(async (addr: string) => {
    setLoading(true);
    try {
      // Server-side Moralis lookup: returns the exact correct pair (e.g. WBNB/USDT)
      const res  = await fetch(`/api/spot/token/${addr}`);
      const data = await res.json();
      setPair(data.pair ?? null);
    } catch {
      setPair(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchToken(tokenAddress); }, [tokenAddress, fetchToken]);

  const handleLoadToken = useCallback((addr: string) => {
    setTokenAddress(addr);
  }, []);

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden" data-testid="page-spot">
      {!embedded && (
        <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/30">
          <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <img src={logoImg} alt="Flap Futures" className="w-7 h-7" />
              <span className="font-heading font-bold text-sm text-white">FFX FUTURES</span>
            </Link>
          </div>
        </header>
      )}

      <SpotTopBar
        pair={pair}
        loading={loading}
        tokenAddress={tokenAddress}
        onLoadToken={handleLoadToken}
        address={address}
        onConnectWallet={embedded ? undefined : () => setWalletModalOpen(true)}
      />

      {/* Desktop + Tablet — shared drag-to-resize layout */}
      <div className="hidden md:flex flex-1 overflow-hidden">
        {/* Chart — takes remaining space */}
        <div className="flex-1 overflow-hidden min-w-0">
          <TradingChart
            price={pair?.priceUsd}
            priceChange24h={pair?.priceChange?.h24}
            marketCap={pair?.marketCap || pair?.fdv}
            symbol={pair?.baseToken?.symbol}
            pairAddress={pair?.pairAddress}
          />
        </div>

        {/* Drag handle */}
        <div
          onMouseDown={onDividerMouseDown}
          onDoubleClick={onDividerDblClick}
          title="Drag to resize · Double-click to collapse/restore"
          className="w-1.5 flex-shrink-0 flex items-center justify-center cursor-col-resize group relative z-20 select-none"
          style={{ background: "rgba(255,255,255,0.04)" }}
        >
          <div className="w-0.5 h-8 rounded-full bg-border/40 group-hover:bg-primary/60 group-active:bg-primary transition-colors" />
        </div>

        {/* Swap panel — width controlled by drag, hidden at 0 */}
        <div
          className="flex-shrink-0 overflow-hidden transition-none"
          style={{ width: swapWidth, minWidth: 0 }}
        >
          {swapWidth > 40 && (
            <SwapPanel pair={pair} address={address} onConnectWallet={() => setWalletModalOpen(true)} />
          )}
        </div>
      </div>

      {/* Mobile */}
      <div className="md:hidden flex-1 flex flex-col overflow-hidden">
        <div className="flex border-b border-border/20">
          {(["chart", "swap"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setMobileTab(tab)}
              className={`flex-1 py-2 text-xs font-semibold text-center transition-colors ${mobileTab === tab ? "text-primary border-b-2 border-primary" : "text-muted-foreground"}`}
            >
              {tab === "chart" ? "Chart" : "Swap"}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-hidden">
          {mobileTab === "chart" && <TradingChart
                price={pair?.priceUsd}
                priceChange24h={pair?.priceChange?.h24}
                marketCap={pair?.marketCap || pair?.fdv}
                symbol={pair?.baseToken?.symbol}
                pairAddress={pair?.pairAddress}
              />}
          {mobileTab === "swap" && (
            <SwapPanel pair={pair} address={address} onConnectWallet={() => setWalletModalOpen(true)} />
          )}
        </div>
      </div>

      <WalletModal
        isOpen={walletModalOpen}
        onClose={() => setWalletModalOpen(false)}
        onConnect={(provider) => { setWalletModalOpen(false); connect(provider); }}
      />
    </div>
  );
}
