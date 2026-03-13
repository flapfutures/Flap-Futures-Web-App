import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import logoImg from "@assets/flapfutureslogo_nobg.png";
import { Link, useLocation } from "wouter";
import {
  ArrowLeft, ArrowRight, Shield, FileCheck, Rocket, CheckCircle, XCircle, AlertCircle,
  Globe, Zap, Lock, Bot, BarChart3, Loader2, Search, TrendingUp, Clock, Copy, Fuel, DollarSign,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  calcSpread, calcMaxLeverage, calcMaxPosition, calcMaxOI, calcMinInsurance,
  trustBadgeLabel, trustBadgeColor,
} from "@/lib/flex-params";
import {
  CONTRACTS_DEPLOYED, FLAP_PLATFORM_ADDRESS, USDT_ADDRESS,
} from "@/lib/perps-contracts";

// ── ABI encoding helpers (no ethers dependency) ───────────────────────────────
function encodeAddress(addr: string): string {
  return addr.replace("0x", "").toLowerCase().padStart(64, "0");
}
function encodeUint(n: bigint): string { return n.toString(16).padStart(64, "0"); }

// USDT.approve(spender, amount)  method id 0x095ea7b3
function encodeApprove(spender: string, amount: bigint): string {
  return "0x095ea7b3" + encodeAddress(spender) + encodeUint(amount);
}
// FlapPlatform.launchMarket(address,uint256,uint256,uint256,uint256)
// keccak256 selector: 0x3b14d2a5
function encodeLaunchMarket(
  token: string, lockDays: bigint, vault: bigint, ins: bigint, refresh: bigint,
): string {
  return "0x3b14d2a5"
    + encodeAddress(token) + encodeUint(lockDays)
    + encodeUint(vault) + encodeUint(ins) + encodeUint(refresh);
}
// Convert USDT dollar amount → 18-decimal bigint
function usdtWei(dollars: number): bigint {
  return BigInt(Math.round(dollars * 1e6)) * BigInt(1e12);
}

const steps = [
  { id: 1, label: "Token Info",   icon: FileCheck },
  { id: 2, label: "Pair Config",  icon: BarChart3 },
  { id: 3, label: "Review",       icon: Rocket },
];

const creatorPerks = [
  { icon: BarChart3, title: "Your own trading pair",   desc: "TOKEN/USDT perpetuals live on BSC" },
  { icon: DollarSign, title: "80% of all spread fees", desc: "Earned on every trade opened in your market" },
  { icon: Globe,      title: "Live oracle price feed", desc: "Bot pushes on-chain prices at your chosen interval" },
  { icon: Zap,        title: "Auto funding settlements", desc: "Every 8 hours, automatically handled by the bot" },
  { icon: Shield,     title: "Insurance backstop",     desc: "Liquidation proceeds protect your vault from bad debt" },
  { icon: Lock,       title: "Full market control",    desc: "Pause new trades at any time without touching the vault" },
];

const LOCK_OPTIONS = [
  { days: 7,   label: "7 days",   desc: "Minimum lock" },
  { days: 30,  label: "30 days",  desc: "Silver trust" },
  { days: 90,  label: "90 days",  desc: "Gold trust" },
  { days: 180, label: "180 days", desc: "Platinum trust" },
];

const REFRESH_OPTIONS = [
  { sec: 60,   label: "1 min",   desc: "Highest precision" },
  { sec: 300,  label: "5 min",   desc: "Recommended" },
  { sec: 600,  label: "10 min",  desc: "Balanced" },
  { sec: 1800, label: "30 min",  desc: "Low gas cost" },
  { sec: 3600, label: "1 hour",  desc: "Minimal gas" },
];

// BSC: ~1.5 Gwei, oracle push ~40k gas, funding settle every 8h ~60k gas
const GAS_PRICE_GWEI = 1.5;
const ORACLE_GAS = 40_000;
const FUNDING_GAS = 60_000;

function calcGasBnb(lockDays: number, refreshSec: number): number {
  const totalHours = lockDays * 24;
  const pushesPerHour = 3600 / refreshSec;
  const totalPushes = totalHours * pushesPerHour;
  const totalFundings = totalHours / 8;
  const oracleBnb  = totalPushes  * ORACLE_GAS  * GAS_PRICE_GWEI * 1e-9;
  const fundingBnb = totalFundings * FUNDING_GAS * GAS_PRICE_GWEI * 1e-9;
  return parseFloat(((oracleBnb + fundingBnb) * 1.20).toFixed(4)); // +20% buffer
}

// Bot/platform wallet that pays gas — creator sends BNB here
const BOT_GAS_WALLET = "0xd8AE9A69FD6Fe0e1B3D40F32D6E2E4A10894e118";

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

interface TokenResult {
  found: boolean; error?: string; address?: string; name?: string; symbol?: string;
  logo?: string; priceUsd?: number; mcap?: number; liquidity?: number; volume24h?: number;
  pairAddress?: string; checks?: Record<string, boolean>; allPassed?: boolean;
  flexParams?: {
    spread: number; maxLeverage: number; maxPosition: number; maxOI: number;
    minInsurance: number; minVault: number;
  };
}

type PayStep = "idle" | "approving" | "paying" | "launching" | "registering" | "done";

export default function Apply({ embedded = false }: { embedded?: boolean }) {
  const [step, setStep] = useState(1);
  const [ca, setCa] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [payStep, setPayStep] = useState<PayStep>("idle");
  const [gasTxHash, setGasTxHash] = useState<string | null>(null);
  const [token, setToken] = useState<TokenResult | null>(null);
  const [lockDays, setLockDays] = useState(30);
  const [refreshSec, setRefreshSec] = useState(300);
  const [minVault, setMinVault] = useState(500);
  const [minVaultInput, setMinVaultInput] = useState("500");
  const [error, setError] = useState("");
  const { authenticated, walletAddress, signIn, signing } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  async function verifyToken() {
    if (!ca.trim()) return;
    setLoading(true); setError(""); setToken(null);
    try {
      const res = await fetch(`/api/verify-token?ca=${ca.trim()}`);
      const data = await res.json();
      setToken(data);
      if (!data.found || !data.allPassed) setError(data.error || "Token did not pass all checks.");
    } catch {
      setError("Failed to verify token. Please try again.");
    }
    setLoading(false);
  }

  async function handleLaunch() {
    if (!authenticated) {
      toast({ title: "Sign in required", description: "Connect and sign in with your wallet first." });
      return;
    }
    if (!token?.allPassed) return;

    const eth = (window as any).ethereum;
    if (!eth) {
      toast({ title: "No wallet found", description: "Please install MetaMask or a BNB-compatible wallet.", variant: "destructive" });
      return;
    }

    const gasBnbVal   = calcGasBnb(lockDays, refreshSec);
    const vaultUsdt   = minVault;          // dollars
    const insUsdt     = Math.ceil(minIns); // dollars, round up
    const gasBnbWeiHex = "0x" + BigInt(Math.round(gasBnbVal * 1e18)).toString(16);

    let txHash: string | null = null;

    if (CONTRACTS_DEPLOYED && FLAP_PLATFORM_ADDRESS) {
      // ── Full on-chain flow ──────────────────────────────────────────────────
      const totalUsdt  = usdtWei(vaultUsdt + insUsdt);
      const vaultWei   = usdtWei(vaultUsdt);
      const insWei     = usdtWei(insUsdt);

      // Step 1: Approve USDT spend to FlapPlatform
      setPayStep("approving");
      try {
        await eth.request({
          method: "eth_sendTransaction",
          params: [{
            from: walletAddress,
            to: USDT_ADDRESS,
            data: encodeApprove(FLAP_PLATFORM_ADDRESS, totalUsdt),
            chainId: "0x38",
          }],
        });
        toast({ title: "USDT approved", description: `$${vaultUsdt + insUsdt} approved to platform contract.` });
      } catch (err: any) {
        setPayStep("idle");
        if (err?.code === 4001) toast({ title: "Approval cancelled", description: "You rejected the approval.", variant: "destructive" });
        else toast({ title: "Approval failed", description: err?.message || "Unknown error", variant: "destructive" });
        return;
      }

      // Step 2: Call launchMarket — sends BNB + triggers USDT pull + deploys contracts
      setPayStep("launching");
      try {
        txHash = await eth.request({
          method: "eth_sendTransaction",
          params: [{
            from: walletAddress,
            to: FLAP_PLATFORM_ADDRESS,
            value: gasBnbWeiHex,
            data: encodeLaunchMarket(
              token.address!,
              BigInt(lockDays),
              vaultWei,
              insWei,
              BigInt(refreshSec),
            ),
            chainId: "0x38",
          }],
        });
        setGasTxHash(txHash);
        toast({ title: "Market launched on-chain!", description: `TX: ${txHash?.slice(0, 10)}…` });
      } catch (err: any) {
        setPayStep("idle");
        if (err?.code === 4001) toast({ title: "Launch cancelled", description: "You rejected the transaction.", variant: "destructive" });
        else toast({ title: "Launch failed", description: err?.message || "Unknown error", variant: "destructive" });
        return;
      }

    } else {
      // ── Pre-deployment flow: gas BNB only, register for manual activation ──
      setPayStep("paying");
      try {
        txHash = await eth.request({
          method: "eth_sendTransaction",
          params: [{
            from: walletAddress,
            to: BOT_GAS_WALLET,
            value: gasBnbWeiHex,
            chainId: "0x38",
          }],
        });
        setGasTxHash(txHash);
        toast({ title: "Gas deposit sent", description: `TX: ${txHash?.slice(0, 10)}…` });
      } catch (err: any) {
        setPayStep("idle");
        if (err?.code === 4001) toast({ title: "Payment cancelled", description: "You rejected the transaction.", variant: "destructive" });
        else toast({ title: "Payment failed", description: err?.message || "Unknown error", variant: "destructive" });
        return;
      }
    }

    // Register market with platform API
    setPayStep("registering");
    setSubmitting(true);
    try {
      const res = await fetch("/api/markets/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          tokenAddress: token.address,
          tokenName: token.name,
          tokenSymbol: token.symbol,
          tokenLogo: token.logo,
          pairAddress: token.pairAddress,
          lockDays,
          minVault,
          mcap: token.mcap,
          liquidity: token.liquidity,
          priceUsd: token.priceUsd,
          volume24h: token.volume24h,
          refreshInterval: refreshSec,
          gasBnbRequired: gasBnbVal,
          gasTxHash: txHash,
          vaultDeposit: vaultUsdt,
          insuranceDeposit: Math.ceil(minIns),
          contractsLaunched: CONTRACTS_DEPLOYED,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPayStep("done");
        toast({ title: "Market registered!", description: `${token.name}/USDT pending activation.` });
        setTimeout(() => {
          if (embedded) window.location.hash = "markets"; else navigate("/dashboard");
        }, 1500);
      } else {
        setPayStep("idle");
        toast({ title: "Registration failed", description: data.error || "Unknown error", variant: "destructive" });
      }
    } catch {
      setPayStep("idle");
      toast({ title: "Error", description: "Failed to register market.", variant: "destructive" });
    }
    setSubmitting(false);
  }

  async function handleContinue() {
    if (!authenticated) {
      toast({ title: "Sign in required", description: "Connect your wallet first." });
      return;
    }
    if (!token?.allPassed) return;
    setPayStep("registering");
    setSubmitting(true);
    try {
      const res = await fetch("/api/markets/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          tokenAddress: token.address,
          tokenName: token.name,
          tokenSymbol: token.symbol,
          tokenLogo: token.logo,
          pairAddress: token.pairAddress,
          lockDays,
          minVault,
          mcap: token.mcap,
          liquidity: token.liquidity,
          priceUsd: token.priceUsd,
          volume24h: token.volume24h,
          refreshInterval: refreshSec,
          gasBnbRequired: calcGasBnb(lockDays, refreshSec),
          gasTxHash: null,
          payLater: true,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPayStep("done");
        toast({ title: "Market registered!", description: "Deploy contracts and send gas from your market panel." });
        setTimeout(() => {
          const marketId = data.market?.id;
          if (embedded) {
            window.location.hash = marketId ? `market-${marketId}` : "markets";
          } else {
            navigate(marketId ? `/dashboard#market-${marketId}` : "/dashboard");
          }
        }, 1000);
      } else {
        setPayStep("idle");
        toast({ title: "Registration failed", description: data.error || "Unknown error", variant: "destructive" });
      }
    } catch {
      setPayStep("idle");
      toast({ title: "Error", description: "Failed to register market.", variant: "destructive" });
    }
    setSubmitting(false);
  }

  const gasBnb = calcGasBnb(lockDays, refreshSec);

  const mcap = token?.mcap || 0;
  const vault = Math.max(minVault, 100);

  // All parameters flex with vault — vault is the binding safety constraint
  const spreadBase  = token?.flexParams?.spread     ?? calcSpread(mcap);
  const spread      = Math.max(spreadBase, 0.50 * (100 / vault));          // widen below $100 vault

  const maxLevBase  = token?.flexParams?.maxLeverage ?? calcMaxLeverage(mcap);
  const maxLev      = Math.min(maxLevBase, Math.max(1, Math.floor(vault / 25)));  // cap by vault size

  const maxPos      = Math.min(token?.flexParams?.maxPosition ?? calcMaxPosition(mcap), vault * 2);
  const maxOI       = Math.min(token?.flexParams?.maxOI       ?? calcMaxOI(mcap),       vault * 10);
  const minIns      = maxOI * 0.10;
  const trustLabel  = trustBadgeLabel(lockDays);
  const trustColor  = trustBadgeColor(lockDays);

  return (
    <div className={embedded ? "min-h-full" : "min-h-screen bg-[#0a0614]"} style={embedded ? {} : { backgroundImage: "radial-gradient(ellipse at top, rgba(122,51,250,0.12) 0%, transparent 60%)" }}>
      {!embedded && (
        <nav className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer">
              <img src={logoImg} alt="Flap Futures" className="h-7 w-auto" />
              <span className="text-white font-bold text-lg">FLAP <span className="text-[#7a33fa]">FUTURES</span></span>
            </div>
          </Link>
          <Link href="/dashboard">
            <Button variant="ghost" className="text-white/60 hover:text-white text-sm gap-1">
              <ArrowLeft className="w-4 h-4" /> Dashboard
            </Button>
          </Link>
        </nav>
      )}

      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Steps */}
        <div className="flex items-center justify-center gap-2 mb-10">
          {steps.map((s, i) => {
            const Icon = s.icon;
            const active = step === s.id;
            const done = step > s.id;
            return (
              <div key={s.id} className="flex items-center gap-2">
                <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${active ? "bg-[#7a33fa] text-white" : done ? "bg-[#7a33fa]/20 text-[#7a33fa]" : "bg-white/5 text-white/30"}`}>
                  {done ? <CheckCircle className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  {s.label}
                </div>
                {i < steps.length - 1 && <div className={`w-8 h-px ${done ? "bg-[#7a33fa]/50" : "bg-white/10"}`} />}
              </div>
            );
          })}
        </div>

        <AnimatePresence mode="wait">

          {/* ── Step 1: Token Info ──────────────────────────────── */}
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <Card className="bg-white/5 border-white/10 p-6">
                <h2 className="text-xl font-bold text-white mb-1">Enter Token Address</h2>
                <p className="text-white/50 text-sm mb-6">Paste your flap.sh token contract address on BSC. The token must have a PancakeSwap <span className="text-white/80 font-medium">USDT pair</span> — BNB pairs are not supported.</p>

                <div className="flex gap-2 mb-4">
                  <Input
                    placeholder="0x...7777"
                    value={ca}
                    onChange={e => { setCa(e.target.value); setToken(null); setError(""); }}
                    onKeyDown={e => e.key === "Enter" && verifyToken()}
                    className="bg-white/5 border-white/10 text-white placeholder-white/30 flex-1"
                  />
                  <Button onClick={verifyToken} disabled={loading || !ca.trim()} className="bg-[#7a33fa] hover:bg-[#6620e0] text-white gap-2">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    Verify
                  </Button>
                </div>

                {error && !token && (
                  <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4">
                    <XCircle className="w-4 h-4 flex-shrink-0" /> {error}
                  </div>
                )}

                {token?.found && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                    <div className="flex items-center gap-3 p-4 bg-white/5 rounded-xl border border-white/10">
                      {token.logo && <img src={token.logo} alt="" className="w-12 h-12 rounded-full" />}
                      <div>
                        <div className="text-white font-bold text-lg">{token.name} <span className="text-white/40 font-normal">({token.symbol})</span></div>
                        <div className="flex gap-4 text-sm text-white/50 mt-1">
                          <span>MCap: <span className="text-white">{fmt(token.mcap || 0)}</span></span>
                          <span>Liq: <span className="text-white">{fmt(token.liquidity || 0)}</span></span>
                          <span>24h: <span className="text-white">{fmt(token.volume24h || 0)}</span></span>
                        </div>
                      </div>
                      {token.allPassed && (
                        <Badge className="ml-auto bg-[#7a33fa]/20 text-[#7a33fa] border border-[#7a33fa]/30 text-sm px-3">
                          <TrendingUp className="w-3 h-3 mr-1" /> Eligible
                        </Badge>
                      )}
                    </div>

                    {token.checks && (
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(token.checks).map(([k, v]) => (
                          <div key={k} className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${v ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                            {v ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <XCircle className="w-4 h-4 flex-shrink-0" />}
                            {k === "flapOrigin" ? "Flap Origin" : k === "pancakeV2" ? "PancakeSwap V2/V3 (BNB/USDT)" : k === "hasName" ? "Name & Symbol" : k === "hasLogo" ? "Token Logo" : k === "fixedSupply" ? "Fixed Supply" : k === "marketCapOk" ? "MCap ≥ $25k" : "Liquidity ≥ $5k"}
                          </div>
                        ))}
                      </div>
                    )}

                    {!token.allPassed && (
                      <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                        Token did not pass all checks. Please ensure your token meets all requirements.
                      </div>
                    )}
                  </motion.div>
                )}
              </Card>

              <div className="flex justify-end mt-4">
                <Button
                  disabled={!token?.allPassed}
                  onClick={() => setStep(2)}
                  className="bg-[#7a33fa] hover:bg-[#6620e0] text-white gap-2"
                >
                  Pair Config <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* ── Step 2: Pair Config ─────────────────────────────── */}
          {step === 2 && token?.allPassed && (
            <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <Card className="bg-white/5 border-white/10 p-6 space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-white mb-1">Pair Configuration</h2>
                  <p className="text-white/50 text-sm">Parameters scale with both mcap and vault balance — edit Min Vault below to see them update.</p>
                </div>

                {/* Pair header */}
                <div className="flex items-center gap-3 p-4 bg-white/5 rounded-xl border border-white/10">
                  {token.logo && <img src={token.logo} alt="" className="w-10 h-10 rounded-full" />}
                  <div>
                    <div className="text-white font-bold">{token.symbol}/USDT</div>
                    <div className="text-white/40 text-xs">Perpetual futures pair on BSC — MCap {fmt(mcap)}</div>
                  </div>
                </div>

                {/* Flex params grid */}
                <div>
                  <div className="text-white/50 text-xs mb-3 uppercase tracking-wide">Live parameters at current mcap &amp; vault</div>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Spread",       value: `${(spread * 100).toFixed(0)} bps`, sub: `${spread.toFixed(2)}%` },
                      { label: "Max Leverage", value: `${maxLev}x`,                        sub: "per trade" },
                      { label: "Max Position", value: fmt(maxPos),                          sub: "per trade" },
                      { label: "Max OI Cap",   value: fmt(maxOI),                           sub: "mcap-based" },
                      { label: "Min Insurance", value: fmt(minIns),                         sub: "10% of maxOI" },
                    ].map(item => (
                      <div key={item.label} className="bg-white/5 rounded-xl p-3 border border-white/10">
                        <div className="text-white/40 text-xs mb-1">{item.label}</div>
                        <div className="text-white font-bold">{item.value}</div>
                        <div className="text-white/30 text-xs mt-0.5">{item.sub}</div>
                      </div>
                    ))}

                    {/* Editable Min Vault */}
                    <div className="bg-[#7a33fa]/10 rounded-xl p-3 border border-[#7a33fa]/50 cursor-text">
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-[#7a33fa] text-xs font-medium flex items-center gap-1">
                          Min Vault
                        </div>
                        <div className="flex items-center gap-1 text-[#7a33fa]/60 text-[10px]">
                          <Bot className="w-3 h-3" />
                          editable
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 border-b border-[#7a33fa]/40 pb-1 focus-within:border-[#7a33fa]">
                        <span className="text-white/50 text-sm">$</span>
                        <input
                          type="number"
                          min={100}
                          value={minVaultInput}
                          onChange={e => {
                            setMinVaultInput(e.target.value);
                            const n = parseFloat(e.target.value);
                            if (!isNaN(n) && n >= 100) setMinVault(n);
                          }}
                          onBlur={() => {
                            const n = parseFloat(minVaultInput);
                            if (isNaN(n) || n < 100) { setMinVaultInput("100"); setMinVault(100); }
                            else { setMinVaultInput(String(n)); setMinVault(n); }
                          }}
                          className="w-full bg-transparent text-white font-bold text-sm outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>
                      <div className="text-white/30 text-xs mt-1">min $100 · no max</div>
                    </div>
                  </div>
                </div>

                {/* Lock duration selector */}
                <div>
                  <div className="text-white/50 text-xs mb-3 uppercase tracking-wide">Vault lock duration — earns trust badge</div>
                  <div className="grid grid-cols-4 gap-2">
                    {LOCK_OPTIONS.map(opt => {
                      const label = trustBadgeLabel(opt.days);
                      const color = trustBadgeColor(opt.days);
                      const active = lockDays === opt.days;
                      return (
                        <button
                          key={opt.days}
                          onClick={() => setLockDays(opt.days)}
                          className={`p-3 rounded-xl border text-left transition-all ${active ? "bg-[#7a33fa]/20 border-[#7a33fa]/50" : "bg-white/5 border-white/10 hover:border-white/20"}`}
                        >
                          <div className="text-white font-bold text-sm">{opt.label}</div>
                          <div className="text-white/40 text-xs mt-0.5">{opt.desc}</div>
                          {label !== "None" && (
                            <Badge className={`border text-[10px] mt-1.5 px-1.5 py-0 ${color}`}>{label}</Badge>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-3 p-3 bg-[#7a33fa]/10 border border-[#7a33fa]/20 rounded-xl text-white/50 text-xs flex items-start gap-2">
                    <Lock className="w-4 h-4 text-[#7a33fa] flex-shrink-0 mt-0.5" />
                    <span>After depositing into your vault, funds are locked for the selected duration. This protects traders from rug pulls. You can still pause new trades at any time.</span>
                  </div>
                </div>

                {/* Price refresh interval */}
                <div>
                  <div className="text-white/50 text-xs mb-3 uppercase tracking-wide flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5" /> Oracle price refresh interval
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {REFRESH_OPTIONS.map(opt => (
                      <button
                        key={opt.sec}
                        onClick={() => setRefreshSec(opt.sec)}
                        className={`p-3 rounded-xl border text-left transition-all ${refreshSec === opt.sec ? "bg-[#d5f704]/10 border-[#d5f704]/40" : "bg-white/5 border-white/10 hover:border-white/20"}`}
                      >
                        <div className={`font-bold text-sm ${refreshSec === opt.sec ? "text-[#d5f704]" : "text-white"}`}>{opt.label}</div>
                        <div className="text-white/40 text-[10px] mt-0.5 leading-snug">{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 p-3 bg-white/5 border border-white/10 rounded-xl text-white/50 text-xs flex items-start gap-2">
                    <Clock className="w-4 h-4 text-white/30 flex-shrink-0 mt-0.5" />
                    <span>Our bot pushes a new price on-chain at this interval. Faster refresh = more accurate prices but higher gas cost. The market stays active for the full vault lock duration ({lockDays} days).</span>
                  </div>
                </div>

                {/* Gas estimate */}
                <div className="p-4 rounded-xl border" style={{ background: "rgba(213,247,4,0.05)", borderColor: "rgba(213,247,4,0.2)" }}>
                  <div className="flex items-center gap-2 mb-3">
                    <Fuel className="w-4 h-4" style={{ color: "#d5f704" }} />
                    <span className="text-white font-semibold text-sm">Gas Deposit Required</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div className="bg-white/5 rounded-lg p-3">
                      <div className="text-white/40 text-xs mb-1">Market Duration</div>
                      <div className="text-white font-bold">{lockDays} days</div>
                    </div>
                    <div className="bg-white/5 rounded-lg p-3">
                      <div className="text-white/40 text-xs mb-1">Oracle Pushes</div>
                      <div className="text-white font-bold">{(lockDays * 24 * 3600 / refreshSec).toLocaleString()}</div>
                    </div>
                    <div className="bg-white/5 rounded-lg p-3">
                      <div className="text-white/40 text-xs mb-1">Funding Settles</div>
                      <div className="text-white font-bold">{(lockDays * 3).toLocaleString()}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: "rgba(213,247,4,0.08)", border: "1px solid rgba(213,247,4,0.2)" }}>
                    <span className="text-white/70 text-sm">BNB to send (incl. 20% buffer)</span>
                    <span className="font-bold text-lg" style={{ color: "#d5f704" }}>{gasBnb} BNB</span>
                  </div>
                  <div className="mt-2 text-white/35 text-xs">Based on 1.5 Gwei avg gas price on BSC. Unused BNB is not auto-refunded — contact the platform.</div>
                </div>

                {/* What you get */}
                <div>
                  <div className="text-white/50 text-xs mb-3 uppercase tracking-wide">What you get</div>
                  <div className="grid grid-cols-2 gap-2">
                    {creatorPerks.map(p => {
                      const Icon = p.icon;
                      return (
                        <div key={p.title} className="flex items-start gap-2.5 p-3 bg-white/5 rounded-lg border border-white/10">
                          <Icon className="w-4 h-4 text-[#7a33fa] flex-shrink-0 mt-0.5" />
                          <div>
                            <div className="text-white text-sm font-medium">{p.title}</div>
                            <div className="text-white/40 text-xs leading-snug mt-0.5">{p.desc}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Card>

              <div className="flex justify-between mt-4">
                <Button variant="ghost" onClick={() => setStep(1)} className="text-white/60 hover:text-white gap-2">
                  <ArrowLeft className="w-4 h-4" /> Back
                </Button>
                <Button onClick={() => setStep(3)} className="bg-[#7a33fa] hover:bg-[#6620e0] text-white gap-2">
                  Review Config <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* ── Step 3: Confirm & Launch ────────────────────────── */}
          {step === 3 && token && (
            <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <Card className="bg-white/5 border-white/10 p-6 space-y-5">
                <div>
                  <h2 className="text-xl font-bold text-white mb-1">Review Your Configuration</h2>
                  <p className="text-white/50 text-sm">Check every setting below. After continuing, you will deploy contracts and send gas manually from your market panel.</p>
                </div>

                {/* ── Full config summary ── */}
                <div className="rounded-xl border border-white/10 overflow-hidden">
                  {(() => {
                    const tradesAtMaxLev = Math.floor(maxOI / (maxPos * Math.max(maxLev, 1)));
                    const tradesAt1x    = Math.floor(maxOI / maxPos);
                    const tradeCapacity = tradesAtMaxLev === tradesAt1x
                      ? `~${tradesAt1x} open positions`
                      : `~${tradesAtMaxLev} – ${tradesAt1x} open positions`;
                    return [
                      { label: "Token",           value: `${token.name} (${token.symbol})` },
                      { label: "Trading Pair",    value: `${token.symbol}/USDT Perps` },
                      { label: "Market Cap",      value: fmt(mcap) },
                      { label: "Spread",          value: `${(spread * 100).toFixed(0)} bps (${spread.toFixed(2)}%)` },
                      { label: "Max Leverage",    value: `${maxLev}x` },
                      { label: "Max Position",    value: fmt(maxPos) + " per trade" },
                      { label: "Max OI Cap",      value: fmt(maxOI) },
                      { label: "Trade Capacity",  value: tradeCapacity, sub: `at ${maxLev}× down to 1×` },
                    ];
                  })().map((row, i, arr) => (
                    <div key={row.label} className={`flex items-center justify-between px-4 py-3 text-sm ${i < arr.length - 1 ? "border-b border-white/5" : ""} bg-white/[0.02]`}>
                      <span className="text-white/50">{row.label}</span>
                      <div className="text-right">
                        <div className={`font-medium ${"sub" in row ? "text-[#7a33fa]" : "text-white"}`}>{row.value}</div>
                        {"sub" in row && <div className="text-white/30 text-[10px]">{(row as any).sub}</div>}
                      </div>
                    </div>
                  ))}

                  {/* Vault Lock row with trust badge */}
                  <div className="flex items-center justify-between px-4 py-3 text-sm border-t border-white/5 bg-white/[0.02]">
                    <span className="text-white/50">Vault Lock Duration</span>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">{lockDays} days</span>
                      {trustLabel !== "None" && (
                        <Badge className={`border text-xs ${trustColor}`}>{trustLabel}</Badge>
                      )}
                    </div>
                  </div>

                  {/* Min Vault — lime highlight */}
                  <div className="flex items-center justify-between px-4 py-3 text-sm border-t border-white/5 bg-white/[0.02]">
                    <span className="text-white/50">Min Vault Deposit</span>
                    <span className="font-bold" style={{ color: "#d5f704" }}>${minVault.toLocaleString()} USDT</span>
                  </div>

                  {/* Min Insurance */}
                  <div className="flex items-center justify-between px-4 py-3 text-sm border-t border-white/5 bg-white/[0.02]">
                    <span className="text-white/50">Min Insurance Fund</span>
                    <span className="font-bold text-amber-400">{fmt(minIns)} USDT</span>
                  </div>

                  {/* Oracle interval */}
                  <div className="flex items-center justify-between px-4 py-3 text-sm border-t border-white/5 bg-white/[0.02]">
                    <span className="text-white/50">Oracle Price Refresh</span>
                    <span className="text-white font-medium">{REFRESH_OPTIONS.find(o => o.sec === refreshSec)?.label ?? "5 min"}</span>
                  </div>

                  {/* Registration fee */}
                  <div className="flex items-center justify-between px-4 py-3 text-sm border-t border-white/5 bg-white/[0.02]">
                    <span className="text-white/50">Registration Fee</span>
                    <span className="text-green-400 font-bold">FREE</span>
                  </div>
                </div>

                {/* ── Launch Payment panel ── */}
                <div className="rounded-xl border space-y-3 p-4" style={{ background: "rgba(213,247,4,0.04)", borderColor: "rgba(213,247,4,0.22)" }}>
                  <div className="flex items-center gap-2 pb-1">
                    <Fuel className="w-4 h-4" style={{ color: "#d5f704" }} />
                    <span className="text-white font-semibold text-sm">Launch Payment</span>
                    <span className="ml-auto text-white/30 text-xs">BSC mainnet only</span>
                  </div>

                  {/* Three payment rows */}
                  <div className="space-y-2">
                    {/* Gas BNB */}
                    <div className="flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-black/30 border border-white/5">
                      <div>
                        <div className="text-white/60 text-xs mb-0.5">Gas deposit — bot operator</div>
                        <div className="text-white/35 text-[10px]">
                          {(lockDays * 24 * 3600 / refreshSec).toLocaleString()} oracle pushes
                          + {(lockDays * 3).toLocaleString()} funding settles × 1.5 Gwei × 1.20
                        </div>
                      </div>
                      <div className="text-right ml-4 flex-shrink-0">
                        <div className="font-bold font-mono text-lg leading-none" style={{ color: "#d5f704" }}>{gasBnb} BNB</div>
                        <div className="flex items-center gap-1 justify-end mt-1">
                          <span className="font-mono text-[9px] text-white/35">{BOT_GAS_WALLET.slice(0, 8)}…</span>
                          <button onClick={() => { navigator.clipboard.writeText(BOT_GAS_WALLET); toast({ title: "Copied" }); }} className="text-white/25 hover:text-white/60 transition-colors">
                            <Copy className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Vault USDT */}
                    <div className="flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-black/30 border border-white/5">
                      <div>
                        <div className="text-white/60 text-xs mb-0.5">Vault deposit — backs trader payouts</div>
                        <div className="text-white/35 text-[10px]">Locked {lockDays} days · earns 80% of all spread fees</div>
                      </div>
                      <div className="text-right ml-4 flex-shrink-0">
                        <div className="font-bold font-mono text-lg leading-none" style={{ color: "#d5f704" }}>${minVault.toLocaleString()}</div>
                        <div className="text-white/35 text-[9px] mt-0.5">USDT</div>
                      </div>
                    </div>

                    {/* Insurance USDT */}
                    <div className="flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-black/30 border border-white/5">
                      <div>
                        <div className="text-white/60 text-xs mb-0.5">Insurance fund — liquidation backstop</div>
                        <div className="text-white/35 text-[10px]">10% of maxOI cap · auto-refilled by liquidations</div>
                      </div>
                      <div className="text-right ml-4 flex-shrink-0">
                        <div className="font-bold font-mono text-lg leading-none text-amber-400">${Math.ceil(minIns).toLocaleString()}</div>
                        <div className="text-white/35 text-[9px] mt-0.5">USDT</div>
                      </div>
                    </div>
                  </div>

                  {/* Total summary bar */}
                  <div className="flex items-center justify-between px-3.5 py-2.5 rounded-lg border mt-1" style={{ background: "rgba(213,247,4,0.08)", borderColor: "rgba(213,247,4,0.30)" }}>
                    <span className="text-white/60 text-xs font-semibold uppercase tracking-wider">Total to pay</span>
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-sm" style={{ color: "#d5f704" }}>{gasBnb} BNB</span>
                      <span className="text-white/30 text-xs">+</span>
                      <span className="font-mono font-bold text-sm text-white">${(minVault + Math.ceil(minIns)).toLocaleString()} USDT</span>
                    </div>
                  </div>

                  {/* Flow note */}
                  <div className="text-white/25 text-[10px] pt-0.5">
                    {CONTRACTS_DEPLOYED
                      ? "Two wallet confirmations: ① approve USDT spend  ② send BNB + call FlapPlatform.launchMarket() — contracts deploy instantly."
                      : "One wallet confirmation: BNB gas deposit sent to bot. Vault + insurance USDT collected on-chain when contracts go live."}
                  </div>

                  {/* TX hash shown after payment */}
                  {gasTxHash && (
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-xs">
                      <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="font-mono truncate">TX: {gasTxHash}</span>
                      <a href={`https://bscscan.com/tx/${gasTxHash}`} target="_blank" rel="noopener noreferrer" className="ml-auto flex-shrink-0">
                        <ArrowRight className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  )}
                </div>

                {/* ── Continue / auth ── */}
                {!authenticated ? (
                  <div className="space-y-3">
                    <div className="text-white/50 text-sm text-center">Connect wallet to register your market</div>
                    <Button
                      onClick={() => signIn()}
                      disabled={signing}
                      className="w-full bg-[#7a33fa] hover:bg-[#6620e0] text-white gap-2 h-12"
                    >
                      {signing ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                      Connect Wallet &amp; Sign In
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <span className="text-green-400 text-sm">Wallet connected — {walletAddress?.slice(0, 6)}...{walletAddress?.slice(-4)}</span>
                    </div>

                    {payStep === "done" ? (
                      <div className="flex items-center justify-center gap-2 h-12 rounded-xl bg-green-500/20 border border-green-500/30 text-green-400 font-bold">
                        <CheckCircle className="w-5 h-5" /> Market registered — redirecting…
                      </div>
                    ) : (
                      <Button
                        onClick={handleContinue}
                        disabled={submitting || payStep !== "idle"}
                        className="w-full font-bold gap-2 h-12 text-base text-white"
                        style={{ background: "#7a33fa" }}
                      >
                        {payStep === "registering"
                          ? <><Loader2 className="w-5 h-5 animate-spin" /> Registering market…</>
                          : <><ArrowRight className="w-5 h-5" /> Continue — Deploy &amp; Fund from Market Panel</>
                        }
                      </Button>
                    )}

                    <div className="text-white/25 text-xs text-center">
                      No payment now. You will deploy contracts and send gas manually from your market panel.
                    </div>
                  </div>
                )}
              </Card>

              <div className="flex justify-between mt-4">
                <Button variant="ghost" onClick={() => setStep(2)} disabled={payStep !== "idle"} className="text-white/60 hover:text-white gap-2">
                  <ArrowLeft className="w-4 h-4" /> Back
                </Button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
