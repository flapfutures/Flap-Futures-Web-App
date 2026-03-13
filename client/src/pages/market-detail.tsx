import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import logoImg from "@assets/flapfutureslogo_nobg.png";
import { Link, useParams, useLocation } from "wouter";
import {
  ArrowLeft, Lock, Shield, RefreshCw, Loader2, ExternalLink,
  Pause, Play, Plus, Minus, TrendingUp, TrendingDown, DollarSign,
  Fuel, Copy, CheckCircle2, Clock,
} from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  calcSpread, calcMaxLeverage, calcLevButtons, calcMaxPosition, calcMaxOI,
  vaultHealth, vaultHealthLabel, vaultHealthColor, vaultHealthBg, vaultHealthBarColor,
  trustBadgeLabel, trustBadgeColor,
} from "@/lib/flex-params";

const BOT_GAS_WALLET  = "0xd8AE9A69FD6Fe0e1B3D40F32D6E2E4A10894e118";
const USDT_ADDRESS    = "0x55d398326f99059fF775485246999027B3197955";
const BSC_CHAIN_ID    = 56;

const USDT_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
];
const VAULT_ABI = [
  "function depositVault(uint256 a) external",
  "function depositInsurance(uint256 a) external",
  "function vaultBalance() external view returns (uint256)",
  "function insuranceBalance() external view returns (uint256)",
];

async function ensureBSC(): Promise<ethers.BrowserProvider> {
  const w = window as any;
  if (!w.ethereum) throw new Error("No wallet found — install MetaMask");
  const provider = new ethers.BrowserProvider(w.ethereum);
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== BSC_CHAIN_ID) {
    const switchPromise = w.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0x38" }],
    });
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Chain switch timed out — please switch to BSC manually in your wallet")), 20000)
    );
    await Promise.race([switchPromise, timeout]);
    return new ethers.BrowserProvider(w.ethereum);
  }
  return provider;
}
async function getVaultSigner(): Promise<ethers.Signer> {
  const provider = await ensureBSC();
  return provider.getSigner();
}

interface Market {
  id: string; tokenName: string; tokenSymbol: string; tokenLogo: string | null;
  tokenAddress: string; pairAddress: string | null; status: string;
  mcap: number; liquidity: number; priceUsd: number;
  vaultBalance: number; insuranceBalance: number;
  vaultDepositedAt: string | null; vaultUnlocksAt: string | null;
  openInterest: number; longRatio: number; fundingRate: number;
  volume24h: number; feesEarned: number; pendingFees: number | null;
  spread: number | null; maxLeverage: number | null; maxPosition: number | null; maxOI: number | null;
  contractVault: string | null; contractPerps: string | null;
  paramsLockedByAdmin: boolean; lastRefreshed: string | null; createdAt: string;
  ownerWallet: string; lockDuration: number | null;
  refreshInterval: number | null; gasBnbRequired: number | null; gasBnbPaid: boolean | null;
  minVault: number | null;
}

interface Trade {
  id: string; traderWallet: string; side: string; status: string;
  size: number; leverage: number; entryPrice: number; exitPrice: number | null;
  pnl: number | null; feeOpen: number | null; openedAt: string; closedAt: string | null;
}

function fmt(n: number) {
  if (!n) return "$0";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(2)}`;
}

function shortAddr(addr: string) {
  return addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "";
}

function DepositWithdrawPanel({
  label, balance, onDeposit, onWithdraw, locked, unlockDate, minAmount,
}: {
  label: string; balance: number; locked?: boolean; unlockDate?: string | null;
  onDeposit: (amt: number) => Promise<void>; onWithdraw: (amt: number) => Promise<void>;
  minAmount?: number;
}) {
  const [mode, setMode] = useState<"deposit" | "withdraw" | null>(null);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleAction() {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    setBusy(true);
    try {
      if (mode === "deposit") await onDeposit(amt);
      else if (mode === "withdraw") await onWithdraw(amt);
      setAmount("");
      setMode(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-white/40 text-sm">{label}</div>
        <div className="text-white font-bold text-lg">{fmt(balance)}</div>
      </div>

      {locked && unlockDate && (
        <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
          <Lock className="w-3 h-3 flex-shrink-0" />
          Locked until {new Date(unlockDate).toDateString()}
        </div>
      )}

      {minAmount && (
        <div className="text-white/30 text-xs">Min deposit: ${minAmount.toFixed(0)}</div>
      )}

      <div className="flex gap-2">
        <Button size="sm" variant="ghost" onClick={() => setMode(mode === "deposit" ? null : "deposit")}
          className="flex-1 text-green-400 hover:bg-green-500/10 border border-green-500/20 gap-1">
          <Plus className="w-3 h-3" /> Deposit
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setMode(mode === "withdraw" ? null : "withdraw")}
          disabled={locked}
          className="flex-1 text-red-400 hover:bg-red-500/10 border border-red-500/20 gap-1 disabled:opacity-40">
          <Minus className="w-3 h-3" /> Withdraw
        </Button>
      </div>

      {mode && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-2">
          <Input type="number" placeholder="Amount in USDT" value={amount}
            onChange={e => setAmount(e.target.value)}
            className="bg-white/5 border-white/10 text-white placeholder-white/30" />
          <Button onClick={handleAction} disabled={busy || !amount}
            className={`w-full gap-2 ${mode === "deposit" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"} text-white`}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Confirm {mode === "deposit" ? "Deposit" : "Withdrawal"}
          </Button>
        </motion.div>
      )}
    </div>
  );
}

export default function MarketDetail({ embedded = false, embeddedId }: { embedded?: boolean; embeddedId?: string }) {
  const params = useParams<{ id: string }>();
  const id = embeddedId || params?.id;
  const [, navigate] = useLocation();
  const go = (path: string, hash?: string) => embedded && hash ? (window.location.hash = hash) : navigate(path);
  const { authenticated, walletAddress } = useAuth();
  const { toast } = useToast();
  const [market, setMarket] = useState<Market | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [claimingFees, setClaimingFees] = useState(false);
  const [savingInterval, setSavingInterval] = useState(false);
  const [deploying, setDeploying] = useState(false);

  useEffect(() => { if (id) { loadMarket(); loadTrades(); } }, [id]);

  async function loadMarket() {
    setLoading(true);
    try {
      const res = await fetch(`/api/markets/${id}`, { credentials: "include" });
      const data = await res.json();
      if (data.id) setMarket(data);
    } catch {}
    setLoading(false);
  }

  async function loadTrades() {
    try {
      const res = await fetch(`/api/trades/market/${id}`, { credentials: "include" });
      const data = await res.json();
      if (Array.isArray(data)) setTrades(data);
    } catch {}
  }

  async function handleVaultDeposit(amount: number) {
    const vaultAddr = market?.contractVault;
    if (!vaultAddr) { toast({ title: "Contracts not deployed yet", variant: "destructive" }); return; }
    const minVault = market?.minVault ?? 500;
    if ((market?.vaultBalance ?? 0) + amount < minVault) {
      toast({ title: `Minimum vault deposit is $${minVault}`, description: `You need at least $${minVault} total in the vault`, variant: "destructive" });
      return;
    }
    try {
      const signer = await getVaultSigner();
      const addr   = await signer.getAddress();
      const usdt   = new ethers.Contract(USDT_ADDRESS, USDT_ABI, signer);
      const vault  = new ethers.Contract(vaultAddr, VAULT_ABI, signer);
      const amt18  = ethers.parseUnits(amount.toFixed(6), 18);

      const allowance = await usdt.allowance(addr, vaultAddr);
      if (allowance < amt18) {
        toast({ title: "Approving USDT…", description: "Confirm in your wallet" });
        const appTx = await usdt.approve(vaultAddr, ethers.MaxUint256);
        await appTx.wait();
      }

      toast({ title: "Depositing to vault…", description: "Confirm in your wallet" });
      const tx = await vault.depositVault(amt18);
      await tx.wait();

      // Sync DB
      const res = await fetch(`/api/markets/${id}/vault-deposit`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ amount, txHash: tx.hash }),
      });
      const data = await res.json();
      if (data.success) { setMarket(data.market); toast({ title: "Vault deposit confirmed", description: `+${fmt(amount)} deposited on-chain` }); }
      else { await loadMarket(); toast({ title: "On-chain deposit succeeded", description: "Balance will refresh shortly" }); }
    } catch (e: any) {
      const msg = e?.reason || e?.shortMessage || e?.message || "Unknown error";
      toast({ title: "Deposit failed", description: msg.slice(0, 120), variant: "destructive" });
    }
  }

  async function handleVaultWithdraw(amount: number) {
    const res = await fetch(`/api/markets/${id}/vault-withdraw`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      credentials: "include", body: JSON.stringify({ amount }),
    });
    const data = await res.json();
    if (data.success) { setMarket(data.market); toast({ title: "Vault withdrawal recorded" }); }
    else toast({ title: "Locked or insufficient", description: data.error, variant: "destructive" });
  }

  async function handleInsuranceDeposit(amount: number) {
    const vaultAddr = market?.contractVault;
    if (!vaultAddr) { toast({ title: "Contracts not deployed yet", variant: "destructive" }); return; }
    try {
      const signer = await getVaultSigner();
      const addr   = await signer.getAddress();
      const usdt   = new ethers.Contract(USDT_ADDRESS, USDT_ABI, signer);
      const vault  = new ethers.Contract(vaultAddr, VAULT_ABI, signer);
      const amt18  = ethers.parseUnits(amount.toFixed(6), 18);

      const allowance = await usdt.allowance(addr, vaultAddr);
      if (allowance < amt18) {
        toast({ title: "Approving USDT…", description: "Confirm in your wallet" });
        const appTx = await usdt.approve(vaultAddr, ethers.MaxUint256);
        await appTx.wait();
      }

      toast({ title: "Depositing to insurance…", description: "Confirm in your wallet" });
      const tx = await vault.depositInsurance(amt18);
      await tx.wait();

      const res = await fetch(`/api/markets/${id}/insurance-deposit`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ amount, txHash: tx.hash }),
      });
      const data = await res.json();
      if (data.success) { setMarket(data.market); toast({ title: "Insurance deposit confirmed", description: `+${fmt(amount)} deposited on-chain` }); }
      else { await loadMarket(); toast({ title: "On-chain deposit succeeded", description: "Balance will refresh shortly" }); }
    } catch (e: any) {
      const msg = e?.reason || e?.shortMessage || e?.message || "Unknown error";
      toast({ title: "Deposit failed", description: msg.slice(0, 120), variant: "destructive" });
    }
  }

  async function handleInsuranceWithdraw(amount: number) {
    const res = await fetch(`/api/markets/${id}/insurance-withdraw`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      credentials: "include", body: JSON.stringify({ amount }),
    });
    const data = await res.json();
    if (data.success) { setMarket(data.market); toast({ title: "Insurance withdrawal recorded" }); }
    else toast({ title: "Failed", description: data.error, variant: "destructive" });
  }

  async function handleSaveInterval(seconds: number) {
    setSavingInterval(true);
    try {
      const res = await fetch(`/api/markets/${id}/settings`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ refreshInterval: seconds }),
      });
      const data = await res.json();
      if (data.success) {
        setMarket(data.market);
        const label = seconds === 60 ? "1 min" : seconds === 300 ? "5 min" : seconds === 600 ? "10 min" : seconds === 1800 ? "30 min" : "1 hour";
        toast({ title: "Refresh interval updated", description: `Oracle will push prices every ${label}` });
      } else {
        toast({ title: "Failed", description: data.error, variant: "destructive" });
      }
    } finally {
      setSavingInterval(false);
    }
  }

  async function handleDeployContracts() {
    setDeploying(true);
    try {
      const res = await fetch(`/api/markets/${id}/deploy-contracts`, {
        method: "POST", credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        setMarket(data.market);
        toast({ title: "Contracts deployed", description: "Vault and Perps contracts are now live. You can deposit below." });
      } else {
        toast({ title: "Deployment failed", description: data.error, variant: "destructive" });
      }
    } finally {
      setDeploying(false);
    }
  }

  async function refreshParams() {
    setRefreshing(true);
    const res = await fetch(`/api/markets/${id}/refresh-tier`, { method: "POST", credentials: "include" });
    const data = await res.json();
    if (data.success) {
      setMarket(data.market);
      toast({ title: "Parameters refreshed", description: "Spread, leverage and OI limits updated from live mcap." });
    } else {
      toast({ title: "Failed", description: data.error, variant: "destructive" });
    }
    setRefreshing(false);
  }

  async function handleClaimFees() {
    setClaimingFees(true);
    try {
      const res = await fetch(`/api/markets/${id}/claim-fees`, {
        method: "POST", credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        setMarket(data.market);
        toast({ title: "Fees claimed", description: `${fmt(data.claimed)} USDT added to total earnings.` });
      } else {
        toast({ title: "Failed", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to claim fees.", variant: "destructive" });
    }
    setClaimingFees(false);
  }

  async function toggleStatus() {
    if (!market) return;
    setTogglingStatus(true);
    const newStatus = market.status === "LIVE" ? "PAUSED" : "LIVE";
    const res = await fetch(`/api/markets/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      credentials: "include", body: JSON.stringify({ status: newStatus }),
    });
    const data = await res.json();
    if (data.success) { setMarket(data.market); toast({ title: `Market ${newStatus === "LIVE" ? "resumed" : "paused"}` }); }
    else toast({ title: "Failed", description: data.error, variant: "destructive" });
    setTogglingStatus(false);
  }

  if (loading) {
    return <div className="min-h-screen bg-[#0a0614] flex items-center justify-center"><Loader2 className="w-8 h-8 text-[#7a33fa] animate-spin" /></div>;
  }

  if (!market) {
    return (
      <div className="min-h-screen bg-[#0a0614] flex items-center justify-center text-white/40">
        Market not found. <span className="text-[#7a33fa] ml-2 cursor-pointer" onClick={() => go("/dashboard", "markets")}>Back to dashboard</span>
      </div>
    );
  }

  const mcap        = market.mcap || 0;
  const spread      = market.spread      ?? calcSpread(mcap);
  const maxLev      = market.maxLeverage ?? calcMaxLeverage(mcap);
  const maxPos      = market.maxPosition ?? calcMaxPosition(mcap);
  const maxOI       = market.maxOI       ?? calcMaxOI(mcap);
  // Use stored maxOI × 10% so minIns matches exactly what was shown during registration.
  // calcMinInsurance(mcap) ignores the vault-cap on maxOI and overstates the minimum.
  const minIns      = Math.max(100, maxOI * 0.10);
  const levButtons  = calcLevButtons(mcap);
  const health      = vaultHealth(market.vaultBalance || 0, maxOI);
  const healthLabel = vaultHealthLabel(health);
  const healthColor = vaultHealthColor(health);
  const healthBg    = vaultHealthBg(health);
  const healthBar   = vaultHealthBarColor(health);
  const lockDays    = market.lockDuration ? Math.round(market.lockDuration / 86400) : 7;
  const trustLabel  = trustBadgeLabel(lockDays);
  const trustColor  = trustBadgeColor(lockDays);
  const isOwner     = walletAddress && market.ownerWallet?.toLowerCase() === walletAddress.toLowerCase();
  const vaultLocked = !!(market.vaultUnlocksAt && new Date(market.vaultUnlocksAt) > new Date());
  const oiPct       = maxOI > 0 ? Math.min(100, ((market.openInterest || 0) / maxOI) * 100) : 0;
  const vaultPct    = maxOI > 0 ? Math.min(100, ((market.vaultBalance || 0) / maxOI) * 100) : 0;

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
          <Link href="/dashboard">
            <Button variant="ghost" className="text-white/60 hover:text-white gap-1 text-sm">
              <ArrowLeft className="w-4 h-4" /> Dashboard
            </Button>
          </Link>
        </nav>
      )}
      {embedded && (
        <div className="flex items-center gap-2 px-6 py-4 border-b border-white/5">
          <Button variant="ghost" size="sm" onClick={() => go("/dashboard", "markets")} className="text-white/50 hover:text-white gap-1 text-sm">
            <ArrowLeft className="w-4 h-4" /> My Markets
          </Button>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            {market.tokenLogo ? (
              <img src={market.tokenLogo} alt="" className="w-14 h-14 rounded-full" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-[#7a33fa]/20 flex items-center justify-center text-[#7a33fa] font-bold text-lg">
                {market.tokenSymbol?.slice(0, 2)}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-white">{market.tokenSymbol}/USDT</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {/* Vault health badge */}
                <Badge className={`${healthBg} ${healthColor} border text-xs`}>● {healthLabel}</Badge>
                {/* Status badge */}
                {market.status === "LIVE"
                  ? <Badge className="bg-green-500/15 text-green-400 border border-green-500/30 text-xs">● Live</Badge>
                  : <Badge className="bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 text-xs">⏸ Paused</Badge>}
                {/* Trust badge */}
                {trustLabel !== "None" && (
                  <Badge className={`border text-xs ${trustColor}`}>{trustLabel} Lock</Badge>
                )}
              </div>
            </div>
          </div>

          {isOwner && (
            <div className="flex gap-2 flex-wrap justify-end">
              <Button size="sm" variant="ghost" onClick={refreshParams} disabled={refreshing || market.paramsLockedByAdmin}
                className="text-white/50 hover:text-white border border-white/10 gap-2">
                {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Refresh Params
              </Button>
              <Button size="sm" variant="ghost" onClick={toggleStatus} disabled={togglingStatus}
                className={market.status === "LIVE"
                  ? "text-yellow-400 hover:bg-yellow-500/10 border border-yellow-500/20 gap-2"
                  : "text-green-400 hover:bg-green-500/10 border border-green-500/20 gap-2"}>
                {togglingStatus ? <Loader2 className="w-4 h-4 animate-spin" /> : market.status === "LIVE" ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {market.status === "LIVE" ? "Pause" : "Resume"}
              </Button>
              <Button size="sm" className="bg-[#7a33fa] hover:bg-[#6620e0] text-white gap-2" onClick={() => go("/dashboard#futures", "futures")}>
                Futures <ExternalLink className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Mark Price",  value: market.priceUsd ? `$${market.priceUsd.toFixed(8)}` : "—" },
            { label: "Market Cap",  value: fmt(market.mcap) },
            { label: "Liquidity",   value: fmt(market.liquidity) },
            { label: "24h Volume",  value: fmt(market.volume24h) },
          ].map(s => (
            <Card key={s.label} className="bg-white/5 border-white/10 p-3">
              <div className="text-white/40 text-xs mb-1">{s.label}</div>
              <div className="text-white font-semibold">{s.value}</div>
            </Card>
          ))}
        </div>

        {/* Flexible Params panel */}
        <Card className="bg-white/5 border-white/10 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">Market Parameters</h3>
            <span className="text-white/30 text-xs">Auto-updated from live mcap</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 bg-white/5 rounded-lg border border-white/10">
              <div className="text-white/40 text-xs mb-1">Spread</div>
              <div className="text-[#d5f704] font-bold text-xl font-mono">{spread.toFixed(2)}%</div>
            </div>
            <div className="p-3 bg-white/5 rounded-lg border border-white/10">
              <div className="text-white/40 text-xs mb-2">Max Leverage</div>
              <div className="flex gap-1 flex-wrap">
                {levButtons.map(b => (
                  <span key={b} className="px-2 py-0.5 rounded bg-[#7a33fa]/20 text-[#7a33fa] text-xs font-mono">{b}x</span>
                ))}
                {maxLev > (levButtons[levButtons.length - 1] || 0) && (
                  <span className="text-white/30 text-xs self-center">up to {maxLev}x</span>
                )}
              </div>
            </div>
            <div className="p-3 bg-white/5 rounded-lg border border-white/10">
              <div className="text-white/40 text-xs mb-1">Position Size</div>
              <div className="text-white font-bold">$5 – ${maxPos}</div>
              <div className="text-white/30 text-xs mt-0.5">per trade</div>
            </div>
            <div className="p-3 bg-white/5 rounded-lg border border-white/10">
              <div className="text-white/40 text-xs mb-1">Max OI</div>
              <div className="text-white font-bold">{fmt(maxOI)}</div>
              <div className="text-white/30 text-xs mt-0.5">mcap-based cap</div>
            </div>
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
            <div className="flex items-center gap-4">
              {market.refreshInterval && (
                <span className="text-white/30 text-xs">
                  Oracle refresh: <span className="text-white/60">{
                    market.refreshInterval === 60   ? "1 min"  :
                    market.refreshInterval === 300  ? "5 min"  :
                    market.refreshInterval === 600  ? "10 min" :
                    market.refreshInterval === 1800 ? "30 min" :
                    market.refreshInterval === 3600 ? "1 hour" :
                    `${market.refreshInterval}s`
                  }</span>
                </span>
              )}
              {market.gasBnbRequired != null && market.gasBnbRequired > 0 && (
                <span className={`text-xs px-2 py-0.5 rounded-full border ${market.gasBnbPaid ? "text-green-400 border-green-500/30 bg-green-500/10" : "text-amber-400 border-amber-500/30 bg-amber-500/10"}`}>
                  Gas: {market.gasBnbRequired} BNB {market.gasBnbPaid ? "✓ paid" : "— pending"}
                </span>
              )}
            </div>
            {market.lastRefreshed && (
              <span className="text-white/20 text-xs">Last refreshed: {new Date(market.lastRefreshed).toLocaleString()}</span>
            )}
          </div>
        </Card>

        {/* Market Health */}
        <Card className="bg-white/5 border-white/10 p-5">
          <h3 className="text-white font-semibold mb-4">Market Health</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* OI bar */}
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-white/50">Open Interest</span>
                <span className="text-white">{fmt(market.openInterest || 0)} / {fmt(maxOI)}</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${oiPct > 80 ? "bg-red-500" : oiPct > 50 ? "bg-yellow-500" : "bg-[#7a33fa]"}`}
                  style={{ width: `${oiPct}%` }} />
              </div>
            </div>
            {/* Vault health bar */}
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-white/50">Vault Health</span>
                <span className={healthColor}>{healthLabel} — {fmt(market.vaultBalance || 0)} / {fmt(maxOI)}</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${healthBar}`} style={{ width: `${Math.min(100, vaultPct)}%` }} />
              </div>
              {health === 1 && (
                <div className="text-yellow-400 text-xs mt-1">Vault low — top up to keep market healthy</div>
              )}
              {health === 2 && (
                <div className="text-orange-400 text-xs mt-1">Market frozen — deposit vault to resume trading</div>
              )}
            </div>
            {/* Long/Short */}
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-green-400">Long {Math.round(market.longRatio || 50)}%</span>
                <span className="text-red-400">{Math.round(100 - (market.longRatio || 50))}% Short</span>
              </div>
              <div className="h-2 bg-red-500/40 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${market.longRatio || 50}%` }} />
              </div>
            </div>
            {/* Funding rate */}
            <div className="flex items-center justify-between">
              <span className="text-white/50 text-sm">Funding Rate (8h)</span>
              <span className={`font-medium ${(market.fundingRate || 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                {(market.fundingRate || 0) >= 0 ? "+" : ""}{((market.fundingRate || 0) * 100).toFixed(4)}%
              </span>
            </div>
          </div>
        </Card>

        {/* Vault + Insurance — owner only */}
        {isOwner && (
          !market.contractVault ? (
            /* ── Contracts not yet deployed ── */
            <Card className="p-6 border" style={{
              background: "linear-gradient(145deg, rgba(122,51,250,0.08) 0%, rgba(0,0,0,0) 100%)",
              borderColor: "rgba(122,51,250,0.25)",
            }}>
              <div className="flex flex-col items-center text-center gap-4 py-2">
                <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "rgba(122,51,250,0.15)", border: "1px solid rgba(122,51,250,0.3)" }}>
                  <Shield className="w-6 h-6" style={{ color: "#7a33fa" }} />
                </div>
                <div>
                  <div className="text-white font-semibold text-base mb-1">Vault &amp; Insurance Contracts Not Deployed</div>
                  <div className="text-white/40 text-sm max-w-md">
                    You skipped deployment during registration. Click below to have the platform deploy your Vault and Perps contracts on-chain — no extra fee, the platform covers it.
                  </div>
                </div>
                <div className="w-full max-w-sm grid grid-cols-2 gap-3 p-4 rounded-xl text-left" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <div className="flex items-center gap-2 text-sm text-white/50">
                    <Lock className="w-3.5 h-3.5 text-[#7a33fa]" />
                    <span>FlapVault</span>
                  </div>
                  <div className="text-right text-xs text-red-400 font-medium">Not deployed</div>
                  <div className="flex items-center gap-2 text-sm text-white/50">
                    <TrendingUp className="w-3.5 h-3.5 text-[#7a33fa]" />
                    <span>FlapPerps</span>
                  </div>
                  <div className="text-right text-xs text-red-400 font-medium">Not deployed</div>
                </div>
                <Button
                  onClick={handleDeployContracts}
                  disabled={deploying}
                  className="gap-2 px-6 text-black font-bold"
                  style={{ background: "#d5f704" }}
                >
                  {deploying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {deploying ? "Deploying contracts…" : "Deploy Vault & Perps Contracts"}
                </Button>
                <div className="text-white/25 text-xs">Platform deploys on-chain via FlapFactory · BSC mainnet only</div>
              </div>
            </Card>
          ) : (
            /* ── Contracts deployed — show deposit/withdraw panels ── */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-white/50 text-sm mb-2 flex items-center gap-2">
                  <Lock className="w-4 h-4" /> Vault
                  {vaultLocked && <span className="text-amber-400 text-xs">(locked — {lockDays}d)</span>}
                  {trustLabel !== "None" && (
                    <Badge className={`border text-xs ${trustColor}`}>{trustLabel}</Badge>
                  )}
                </div>
                {market.vaultUnlocksAt && (
                  <div className="mb-2 flex items-center gap-1.5 text-xs text-white/40">
                    <Clock className="w-3 h-3" />
                    {vaultLocked
                      ? <>Unlocks {new Date(market.vaultUnlocksAt).toLocaleDateString()}</>
                      : <span className="text-green-400">Withdrawal available</span>}
                  </div>
                )}
                <DepositWithdrawPanel
                  label="Vault Balance (USDT)"
                  balance={market.vaultBalance || 0}
                  locked={vaultLocked}
                  unlockDate={market.vaultUnlocksAt}
                  minAmount={market.minVault ?? 100}
                  onDeposit={handleVaultDeposit}
                  onWithdraw={handleVaultWithdraw}
                />
              </div>
              <div>
                <div className="text-white/50 text-sm mb-2 flex items-center gap-2">
                  <Shield className="w-4 h-4" /> Insurance Fund
                  <span className="text-white/30 text-xs">min ${minIns.toFixed(0)}</span>
                  {vaultLocked && (
                    <span className="text-amber-400 text-xs">(locked — same as vault)</span>
                  )}
                </div>
                {market.vaultUnlocksAt && (
                  <div className="mb-2 flex items-center gap-1.5 text-xs text-white/40">
                    <Clock className="w-3 h-3" />
                    {vaultLocked
                      ? <>Unlocks {new Date(market.vaultUnlocksAt).toLocaleDateString()}</>
                      : <span className="text-green-400">Withdrawal available</span>}
                  </div>
                )}
                <DepositWithdrawPanel
                  label="Insurance Balance (USDT)"
                  balance={market.insuranceBalance || 0}
                  locked={vaultLocked}
                  unlockDate={market.vaultUnlocksAt}
                  minAmount={minIns}
                  onDeposit={handleInsuranceDeposit}
                  onWithdraw={handleInsuranceWithdraw}
                />
              </div>
            </div>
          )
        )}

        {/* Gas Deposit — owner only */}
        {isOwner && market.gasBnbRequired != null && market.gasBnbRequired > 0 && (
          <Card className="p-5 border" style={{
            background: market.gasBnbPaid
              ? "linear-gradient(145deg, rgba(34,197,94,0.06) 0%, rgba(0,0,0,0) 100%)"
              : "linear-gradient(145deg, rgba(213,247,4,0.05) 0%, rgba(0,0,0,0) 100%)",
            borderColor: market.gasBnbPaid ? "rgba(34,197,94,0.2)" : "rgba(213,247,4,0.2)",
          }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Fuel className="w-4 h-4" style={{ color: market.gasBnbPaid ? "#4ade80" : "#d5f704" }} />
                <span className="text-white font-semibold text-sm">Bot Gas Deposit</span>
                <span className="text-white/30 text-xs flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {market.refreshInterval === 60   ? "1 min"  :
                   market.refreshInterval === 300  ? "5 min"  :
                   market.refreshInterval === 600  ? "10 min" :
                   market.refreshInterval === 1800 ? "30 min" :
                   market.refreshInterval === 3600 ? "1 hour" : `${market.refreshInterval}s`} refresh
                </span>
              </div>
              {market.gasBnbPaid ? (
                <span className="flex items-center gap-1.5 text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-2.5 py-1 rounded-full">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Confirmed by platform
                </span>
              ) : (
                <span className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full">
                  Awaiting payment
                </span>
              )}
            </div>

            {/* Oracle refresh interval selector — owner only */}
            <div className="mb-4 p-3 rounded-xl" style={{ background: "rgba(122,51,250,0.08)", border: "1px solid rgba(122,51,250,0.2)" }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-white/60 text-xs">Oracle price refresh interval</span>
                {savingInterval && <Loader2 className="w-3.5 h-3.5 text-white/40 animate-spin" />}
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {([
                  { s: 60,   label: "1 min"  },
                  { s: 300,  label: "5 min"  },
                  { s: 600,  label: "10 min" },
                  { s: 1800, label: "30 min" },
                  { s: 3600, label: "1 hour" },
                ] as const).map(({ s, label }) => {
                  const active = (market.refreshInterval ?? 300) === s;
                  return (
                    <button
                      key={s}
                      disabled={savingInterval || active}
                      onClick={() => handleSaveInterval(s)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-all border ${
                        active
                          ? "bg-[#7a33fa] border-[#7a33fa] text-white"
                          : "border-white/10 text-white/50 hover:border-[#7a33fa]/60 hover:text-white/80 disabled:opacity-40"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <p className="text-white/25 text-[10px] mt-2">
                Faster intervals consume bot gas faster. Current gas budget covers the interval set when you registered.
              </p>
            </div>

            {!market.gasBnbPaid && (
              <div className="space-y-3">
                <p className="text-white/50 text-xs leading-relaxed">
                  Our oracle bot needs BNB to push prices on-chain every{" "}
                  <span className="text-white/80">
                    {market.refreshInterval === 60 ? "minute" :
                     market.refreshInterval === 300 ? "5 minutes" :
                     market.refreshInterval === 600 ? "10 minutes" :
                     market.refreshInterval === 1800 ? "30 minutes" : "hour"}
                  </span>{" "}
                  for this market. Send the exact amount below to the bot operator wallet.
                  The platform will confirm receipt and activate your market.
                </p>

                {/* Amount highlight */}
                <div className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ background: "rgba(213,247,4,0.08)", border: "1px solid rgba(213,247,4,0.2)" }}>
                  <span className="text-white/60 text-sm">Amount to send</span>
                  <span className="font-bold text-xl font-mono" style={{ color: "#d5f704" }}>
                    {market.gasBnbRequired} BNB
                  </span>
                </div>

                {/* Wallet address */}
                <div>
                  <div className="text-white/30 text-xs mb-1.5 uppercase tracking-wide">Send to — Bot Operator Wallet (BSC only)</div>
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg" style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(213,247,4,0.15)" }}>
                    <a
                      href={`https://bscscan.com/address/${BOT_GAS_WALLET}`}
                      target="_blank" rel="noopener noreferrer"
                      className="font-mono text-xs flex-1 text-[#d5f704] hover:text-white transition-colors flex items-center gap-1.5"
                    >
                      {BOT_GAS_WALLET}
                      <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-50" />
                    </a>
                    <button
                      onClick={() => { navigator.clipboard.writeText(BOT_GAS_WALLET); toast({ title: "Address copied" }); }}
                      className="p-1.5 rounded hover:bg-white/10 text-white/40 hover:text-white transition-colors flex-shrink-0"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="text-white/25 text-[10px]">
                  BNB chain only. Platform will verify the transfer on-chain before activating your market. Unused BNB is not auto-refunded.
                </div>
              </div>
            )}

            {market.gasBnbPaid && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/5 border border-green-500/15 text-green-400 text-sm">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{market.gasBnbRequired} BNB received — bot is operating this market.</span>
                <a
                  href={`https://bscscan.com/address/${BOT_GAS_WALLET}`}
                  target="_blank" rel="noopener noreferrer"
                  className="ml-auto text-green-400/60 hover:text-green-400 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            )}
          </Card>
        )}

        {/* Fees earned */}
        {isOwner && (
          <Card className="bg-white/5 border-white/10 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-white/40 text-sm flex items-center gap-2">
                <DollarSign className="w-4 h-4" /> Opener Fees (80% spread share)
              </div>
              <div className="text-white/20 text-xs">Rate: {spread.toFixed(2)}%</div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-white/30 text-xs mb-1">Pending (claimable)</div>
                <div className={`font-bold text-xl font-mono ${(market.pendingFees || 0) > 0 ? "text-[#d5f704]" : "text-white/40"}`}>
                  {fmt(market.pendingFees || 0)}
                </div>
              </div>
              <div>
                <div className="text-white/30 text-xs mb-1">Total claimed</div>
                <div className="text-white/60 font-semibold text-xl font-mono">{fmt(market.feesEarned || 0)}</div>
              </div>
            </div>
            {(market.pendingFees || 0) > 0 && (
              <Button
                onClick={handleClaimFees}
                disabled={claimingFees}
                className="w-full mt-3 bg-[#d5f704] hover:bg-[#c4e600] text-black font-bold gap-2"
              >
                {claimingFees ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
                Claim {fmt(market.pendingFees || 0)}
              </Button>
            )}
          </Card>
        )}

        {/* Trade History */}
        <div>
          <h3 className="text-white font-semibold mb-4">
            Trade History <span className="text-white/30 font-normal text-sm">({trades.length})</span>
          </h3>
          {trades.length === 0 ? (
            <Card className="bg-white/5 border-white/10 p-8 text-center text-white/30">
              No trades yet on this market.
            </Card>
          ) : (
            <Card className="bg-white/5 border-white/10 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-white/30 text-xs border-b border-white/10">
                      <th className="text-left py-3 pl-4">Trader</th>
                      <th className="text-left py-3">Side</th>
                      <th className="text-right py-3">Size</th>
                      <th className="text-right py-3">Lev</th>
                      <th className="text-right py-3">Entry</th>
                      <th className="text-right py-3">Exit</th>
                      <th className="text-right py-3">PnL</th>
                      <th className="text-right py-3">Fee</th>
                      <th className="text-right py-3">Status</th>
                      <th className="text-right py-3 pr-4">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.map(trade => (
                      <tr key={trade.id} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                        <td className="py-3 pl-4 text-white/50 font-mono text-xs">{shortAddr(trade.traderWallet)}</td>
                        <td className="py-3">
                          <span className={`font-medium text-xs px-2 py-0.5 rounded ${trade.side === "LONG" ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}>
                            {trade.side}
                          </span>
                        </td>
                        <td className="py-3 text-right text-white">{fmt(trade.size)}</td>
                        <td className="py-3 text-right text-white/60">{trade.leverage}x</td>
                        <td className="py-3 text-right text-white/60 font-mono text-xs">${trade.entryPrice?.toFixed(6)}</td>
                        <td className="py-3 text-right text-white/60 font-mono text-xs">
                          {trade.exitPrice ? `$${trade.exitPrice.toFixed(6)}` : "—"}
                        </td>
                        <td className={`py-3 text-right font-medium ${!trade.pnl ? "text-white/30" : trade.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {trade.pnl != null ? `${trade.pnl >= 0 ? "+" : ""}${fmt(trade.pnl)}` : "—"}
                        </td>
                        <td className="py-3 text-right text-white/40 text-xs">{trade.feeOpen ? fmt(trade.feeOpen) : "—"}</td>
                        <td className="py-3 text-right">
                          {trade.status === "OPEN"       && <Badge className="bg-blue-500/15 text-blue-400 border border-blue-500/30 text-xs">Open</Badge>}
                          {trade.status === "CLOSED"     && <Badge className="bg-white/10 text-white/50 border border-white/10 text-xs">Closed</Badge>}
                          {trade.status === "LIQUIDATED" && <Badge className="bg-red-500/15 text-red-400 border border-red-500/30 text-xs">Liq.</Badge>}
                        </td>
                        <td className="py-3 text-right pr-4 text-white/30 text-xs">
                          {new Date(trade.openedAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>

      </div>
    </div>
  );
}
