import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import logoImg from "@assets/flapfutureslogo_nobg.png";
import WaveCanvas from "@/components/WaveCanvas";
import ShimmerBorder from "@/components/ShimmerBorder";
import MobileSidebar from "@/components/MobileSidebar";
import {
  ArrowRight,
  Shield,
  Zap,
  BarChart3,
  Lock,
  Globe,
  Layers,
  TrendingUp,
  Rocket,
  FileCheck,
  Bot,
  Wallet,
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  Clock,
  Coins,
  Database,
  Unlock,
  PiggyBank,
  Snowflake,
  PauseCircle,
} from "lucide-react";
import { SiTelegram, SiX, SiDiscord, SiGithub } from "react-icons/si";
import { Link } from "wouter";

const navLinks = [
  { label: "About", href: "#about" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Ecosystem", href: "#ecosystem" },
  { label: "Markets", href: "#trading" },
  { label: "Why Us", href: "#why" },
];


function Header() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-background/80 backdrop-blur-xl border-b border-border/50"
          : "bg-transparent"
      }`}
      data-testid="header"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 h-16 sm:h-20">
          <a href="#" className="flex items-center gap-2 sm:gap-3 shrink-0" data-testid="link-home">
            <img src={logoImg} alt="FLAP FUTURES" className="w-8 h-8 sm:w-10 sm:h-10" />
            <span className="font-heading font-bold text-lg sm:text-xl tracking-tight text-white">
              FLAP <span className="text-gradient" style={{ letterSpacing: "0.06em" }}>FUTURES</span>
            </span>
          </a>

          <nav className="hidden lg:flex items-center gap-1" data-testid="nav-desktop">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="px-4 py-2 text-sm text-muted-foreground transition-colors rounded-md hover-elevate"
                data-testid={`link-${link.label.toLowerCase().replace(/\s/g, "-")}`}
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <ShimmerBorder borderRadius="8px" borderSize={2}>
              <Button size="sm" asChild className="inline-flex" data-testid="button-launch-app">
                <Link href="/dashboard#futures">
                  Launch App
                </Link>
              </Button>
            </ShimmerBorder>
          </div>
        </div>
      </div>
    </header>
  );
}

function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center pt-20" data-testid="section-hero">
      <WaveCanvas />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-32" style={{ zIndex: 2 }}>
          <div className="text-center max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <Badge variant="secondary" className="mb-6 sm:mb-8 px-4 py-1.5 text-xs font-mono bg-lime-subtle border-lime-subtle text-lime-soft" data-testid="badge-live">
                <span className="w-2 h-2 rounded-full bg-lime mr-2 inline-block animate-pulse" />
                LIVE ON BNB SMART CHAIN
              </Badge>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="font-heading font-bold text-4xl sm:text-5xl md:text-6xl lg:text-7xl tracking-tight leading-[1.1] mb-6 sm:mb-8 text-3d"
              data-testid="text-hero-title"
            >
              PERPETUAL
              <br />
              TRADING FOR
              <br />
              <a href="https://flap.sh/bnb/board" target="_blank" rel="noopener noreferrer" className="text-gradient hover:opacity-80 transition-opacity">FLAP.SH TOKEN</a>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="text-muted-foreground text-base sm:text-lg md:text-xl max-w-2xl mx-auto mb-8 sm:mb-12 leading-relaxed px-4"
              data-testid="text-hero-description"
            >
              Turn any <a href="https://flap.sh/bnb/board" target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity">flap.sh</a> token into a perpetual market — trade long or short with <span className="text-lime-soft font-semibold">flexible leverage</span>. Non-custodial,
              fully on-chain, and accessible to every level of trader.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 px-4"
            >
              <ShimmerBorder borderRadius="8px" borderSize={2} className="w-full sm:w-auto">
                <Button size="lg" className="w-full text-base px-8 h-12" asChild data-testid="button-start-trading">
                  <Link href="/dashboard#futures">
                    Start Trading
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Link>
                </Button>
              </ShimmerBorder>
              <ShimmerBorder borderRadius="8px" borderSize={2} className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="w-full text-base px-8 h-12 glass-button" asChild data-testid="button-list-token">
                  <Link href="/dashboard" className="flex items-center gap-2">
                    Launch Your Perps
                    <Rocket className="w-4 h-4" />
                  </Link>
                </Button>
              </ShimmerBorder>
            </motion.div>
          </div>
        </div>
    </section>
  );
}

function BaitSection() {
  const hooks = [
    { num: "80%",  label: "of every trade fee goes directly to you — the market creator" },
    { num: "$50",  label: "minimum to launch your own on-chain perpetuals market" },
    { num: "10×",  label: "leverage available on your token from day one" },
    { num: "0",    label: "monthly fees, no middlemen, no permission required" },
  ];

  return (
    <section className="relative py-16 sm:py-24 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[#7a33fa]/8 via-transparent to-[#d5f704]/4 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Hook headline */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-14"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#d5f704]/10 border border-[#d5f704]/25 mb-5">
            <span className="w-2 h-2 rounded-full bg-[#d5f704] animate-pulse" />
            <span className="text-[#d5f704] text-xs font-mono font-semibold uppercase tracking-widest">For Token Creators</span>
          </div>
          <h2 className="font-heading font-bold text-3xl sm:text-4xl lg:text-5xl tracking-tight leading-tight mb-5">
            Your Token Deserves<br />
            <span className="text-gradient">Its Own Futures Market</span>
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            Most token projects leave millions in trading fees on the table every month.{" "}
            <span className="text-white/80 font-semibold">FFX puts that revenue back in your hands — starting from $50.</span>
          </p>
        </motion.div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {hooks.map((h, i) => (
            <motion.div
              key={h.num}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
            >
              <Card className="p-5 sm:p-6 text-center border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition-colors h-full">
                <div className="font-heading font-black text-3xl sm:text-4xl text-gradient mb-2">{h.num}</div>
                <p className="text-xs text-muted-foreground leading-relaxed">{h.label}</p>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Curiosity strip */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="relative rounded-2xl overflow-hidden border border-[#7a33fa]/40 bg-gradient-to-r from-[#7a33fa]/10 via-[#7a33fa]/5 to-[#d5f704]/5 p-7 sm:p-10 flex flex-col sm:flex-row items-center justify-between gap-6"
        >
          {/* Decorative glow blob */}
          <div className="absolute -left-20 top-1/2 -translate-y-1/2 w-52 h-52 rounded-full bg-[#7a33fa]/20 blur-3xl pointer-events-none" />
          <div className="absolute -right-10 top-0 w-40 h-40 rounded-full bg-[#d5f704]/8 blur-2xl pointer-events-none" />

          <div className="relative">
            <p className="text-[#d5f704] text-xs font-mono font-semibold uppercase tracking-widest mb-2">Did you know?</p>
            <h3 className="font-heading font-bold text-xl sm:text-2xl text-white mb-2">
              Your token already has traders — just no market.
            </h3>
            <p className="text-muted-foreground text-sm sm:text-base max-w-lg leading-relaxed">
              Every day your holders speculate on price with nowhere to go leveraged. Launch a vault,
              set your parameters once, and collect <span className="text-white/80 font-medium">80% of every trade fee</span> — automatically,
              on-chain, forever.
            </p>
          </div>

          <div className="relative shrink-0">
            <ShimmerBorder rounded="rounded-xl">
              <Button
                size="lg"
                className="bg-[#7a33fa] hover:bg-[#7a33fa]/90 text-white font-semibold px-8 gap-2 whitespace-nowrap"
                onClick={() => window.location.href = "/dashboard#apply"}
              >
                Launch My Market
                <ArrowRight className="w-4 h-4" />
              </Button>
            </ShimmerBorder>
          </div>
        </motion.div>

      </div>
    </section>
  );
}

function AboutSection() {
  const pillars = [
    {
      icon: TrendingUp,
      title: "Lowest Fees on BSC",
      desc: "Flat 0.1% trade fee, minimum $1 per open or close. No spread markup, no borrow rate, no overnight charge — one cost, fully visible before you confirm.",
    },
    {
      icon: Zap,
      title: "Ready in Minutes",
      desc: "No code, no contracts to deploy. Paste your token address, pass 7 automated checks, set your vault — your perpetual market is live instantly.",
    },
    {
      icon: Layers,
      title: "Flexible Vault, Dynamic Limits",
      desc: "Your vault size directly controls your market's parameters. Deposit more USDT and max leverage, position cap, and OI limit all recompute automatically — no manual updates required.",
    },
    {
      icon: Bot,
      title: "Built for Developers",
      desc: "Every market, position, fee event, and vault state is accessible via REST API. Build trading bots, custom dashboards, or integrate perpetual trading directly into your own product.",
    },
  ];

  return (
    <section id="about" className="relative py-20 sm:py-32" data-testid="section-about">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center mb-16 sm:mb-20">
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <Badge variant="secondary" className="mb-5 text-xs font-mono" style={{ color: "#d5f704" }} data-testid="badge-about">About the Platform</Badge>
            <h2 className="font-heading font-bold text-3xl sm:text-4xl lg:text-5xl tracking-tight leading-tight mb-6 text-3d-sm" data-testid="text-about-title">
              The First On-Chain<br />
              <span className="text-gradient">Perpetuals for BSC</span>
            </h2>
            <p className="text-muted-foreground text-base sm:text-lg leading-relaxed mb-6" data-testid="text-about-p1">
              Flap Futures is the first platform to offer on-chain perpetual futures trading specifically built for{" "}
              <a href="https://flap.sh/bnb/board" target="_blank" rel="noopener noreferrer" className="text-white/80 hover:text-white underline underline-offset-2 transition-colors">
                flap.sh
              </a>{" "}
              tokens on BNB Smart Chain. Until now, meme and community tokens had no way to offer leveraged trading to their holders — we change that.
            </p>
            <p className="text-muted-foreground text-base sm:text-lg leading-relaxed mb-6">
              Token creators keep full control: set your own vault, earn the majority of fees, and watch your market parameters scale automatically as your community grows. No middlemen. No monthly fees. Just infrastructure that works.
            </p>
            <p className="text-muted-foreground text-base sm:text-lg leading-relaxed">
              For developers, the platform is a foundation to build on — not a walled garden. Every market, trade, vault balance, and fee event is exposed via REST API. Use it to power trading bots, build custom analytics, or embed perpetual markets into your own dApp. We provide the rails; you build the experience.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="grid grid-cols-2 gap-4"
          >
            {[
              { label: "First on BSC", sublabel: "On-chain perpetuals\nfor BSC tokens", accent: true },
              { label: "0.1% fee", sublabel: "Flat trade fee, min $1\nper open or close", accent: false },
              { label: "Flexible vault", sublabel: "$500 recommended\nto launch a live market", accent: false },
              { label: "Fee to creator", sublabel: "Every trade fee\ngoes directly to you", accent: true },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.15 + i * 0.07 }}
              >
                <Card className={`p-5 h-full ${stat.accent ? "border-primary/40 bg-primary/5" : "border-border/20"}`} data-testid={`stat-about-${i}`}>
                  <div className={`font-heading font-bold text-2xl sm:text-3xl mb-2 ${stat.accent ? "text-gradient" : "text-white"}`}>{stat.label}</div>
                  <div className="text-xs text-muted-foreground whitespace-pre-line leading-relaxed">{stat.sublabel}</div>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
          {pillars.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
            >
              <Card className="p-6 h-full border-border/20 hover-elevate" data-testid={`pillar-about-${i}`}>
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <p.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-heading font-semibold text-white text-base mb-2">{p.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{p.desc}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function WhoIsItForSection() {
  const cases = [
    {
      icon: Rocket,
      tag: "Token Creator",
      tagColor: "bg-primary/10 text-primary border-primary/30",
      title: "Turn your token into a trading venue",
      points: [
        "Paste your token address — market goes live in minutes",
        "Set your own vault size and lock duration",
        "Earn 80% of every trade fee your market generates",
        "Parameters auto-upgrade as your market cap grows",
      ],
    },
    {
      icon: TrendingUp,
      tag: "Leveraged Trader",
      tagColor: "bg-green-900/30 text-green-400 border-green-700/40",
      title: "Long or short BSC tokens with leverage",
      points: [
        "Up to 10× leverage on supported markets",
        "USDT-only collateral — no wrapping or bridging",
        "Flat 0.1% fee per side, shown before you confirm",
        "Close any position at any time, in any market condition",
      ],
    },
    {
      icon: Bot,
      tag: "Developer",
      tagColor: "bg-blue-900/30 text-blue-300 border-blue-700/40",
      title: "Build on top of the REST API",
      points: [
        "Every market, trade, vault balance, and fee event exposed via API",
        "Power trading bots, liquidation monitors, or custom dashboards",
        "Embed perpetual markets directly into your own dApp",
        "No SDK required — standard REST over HTTPS",
      ],
    },
    {
      icon: Globe,
      tag: "Community",
      tagColor: "bg-yellow-900/30 text-yellow-300 border-yellow-700/40",
      title: "Give your holders something to do",
      points: [
        "Futures market creates ongoing trading volume for the token",
        "Deeper engagement than simple spot holding",
        "Market cap growth unlocks better leverage for traders",
        "Vault lock builds holder confidence — Rugpull Protector built in",
      ],
    },
  ];

  return (
    <section id="who-is-it-for" className="relative py-20 sm:py-28" data-testid="section-who">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 sm:mb-16">
          <Badge variant="secondary" className="mb-4 text-xs font-mono" style={{ color: "#d5f704" }}>Use Cases</Badge>
          <h2 className="font-heading font-bold text-3xl sm:text-4xl lg:text-5xl tracking-tight mb-4 text-3d-sm">
            Built for <span className="text-gradient">Everyone</span>
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto">
            Whether you're launching a market, trading it, building on it, or just holding the token — Flap Futures has a clear role for you.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-5 sm:gap-6">
          {cases.map((c, i) => {
            const Icon = c.icon;
            return (
              <motion.div
                key={c.tag}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="h-full"
              >
                <Card
                  className="p-6 h-full border-border/20 hover-elevate"
                  style={{ background: "linear-gradient(145deg, hsl(250,45%,12%) 0%, hsl(250,45%,9%) 100%)" }}
                >
                  <div className="flex items-start gap-3 mb-4">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: "rgba(122,51,250,0.15)", border: "1px solid rgba(122,51,250,0.3)" }}
                    >
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border ${c.tagColor} mb-1`}>
                        {c.tag}
                      </span>
                      <h3 className="font-heading font-bold text-white text-sm sm:text-base leading-snug">{c.title}</h3>
                    </div>
                  </div>
                  <ul className="space-y-2">
                    {c.points.map((p, pi) => (
                      <li key={pi} className="flex items-start gap-2.5 text-xs text-muted-foreground">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary/60" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function UseCaseSection() {
  const cases = [
    {
      badge: "Token Creator",
      color: "text-[#d5f704]",
      badgeBg: "bg-[#d5f704]/10 border-[#d5f704]/20",
      title: "Your market earns while you sleep",
      steps: [
        { label: "Deposit $500 USDT vault", note: "Market goes live instantly — no setup needed" },
        { label: "Trader opens a $500 position", note: "Fee charged: max($500 × 0.1%, $1) = $1.00" },
        { label: "Trader closes the position", note: "Another $1.00 fee on close" },
        { label: "Your dashboard shows $1.60 earned", note: "80% of $2 total fees, claimable anytime" },
      ],
      outcome: "10 trades/day → $16/day → ~$480/month. Dashboard shows pending fees claimable in one click.",
    },
    {
      badge: "Trader",
      color: "text-primary",
      badgeBg: "bg-primary/10 border-primary/20",
      title: "Clear costs, clean profit calculation",
      steps: [
        { label: "$200 collateral × 10× = $2,000 position", note: "Open fee: max($2,000 × 0.1%, $1) = $2.00" },
        { label: "Token price rises 8%", note: "PnL = 8% × $2,000 = +$160" },
        { label: "Close position — fee: $2.00", note: "Total fees paid: $2 open + $2 close = $4" },
        { label: "Net profit = $160 − $4 = $156", note: "Deposited directly to your wallet" },
      ],
      outcome: "Total cost: $4 on a $2,000 position (0.2% round-trip). No borrow rate, no funding surprise.",
    },
    {
      badge: "Growth Loop",
      color: "text-green-400",
      badgeBg: "bg-green-400/10 border-green-400/20",
      title: "Bigger vault, better market, more fees",
      steps: [
        { label: "$500 vault → 40× max leverage, $1k max pos", note: "Fee is always 0.1% / min $1 — never changes" },
        { label: "Fees accumulate → top up vault to $2,000", note: "4× growth unlocks 4× better parameters" },
        { label: "$2,000 vault → 80× leverage, $4k max pos", note: "Larger traders can now enter your market" },
        { label: "More volume → more fees → repeat", note: "Creator income compounds with market activity" },
      ],
      outcome: "Trade fee stays fixed at 0.1% / min $1. Only the market limits grow — giving you a competitive edge.",
    },
  ];

  return (
    <section id="use-cases" className="relative py-20 sm:py-28" data-testid="section-use-cases">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 sm:mb-16">
          <Badge variant="secondary" className="mb-4 text-xs font-mono" style={{ color: "#d5f704" }} data-testid="badge-use-cases">Example Use Cases</Badge>
          <h2 className="font-heading font-bold text-3xl sm:text-4xl lg:text-5xl tracking-tight mb-4 text-3d-sm" data-testid="text-use-cases-title">
            See It In <span className="text-gradient">Action</span>
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto">
            Real scenarios showing how token creators and traders benefit from the platform.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-5 sm:gap-6">
          {cases.map((c, i) => (
            <motion.div
              key={c.badge}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: i * 0.1 }}
              className="h-full"
            >
              <Card className="p-6 h-full flex flex-col border-border/20 hover-elevate" data-testid={`card-use-case-${i}`}>
                <div className={`inline-flex items-center self-start px-2.5 py-1 rounded-full text-xs font-mono font-semibold border mb-4 ${c.badgeBg} ${c.color}`}>
                  {c.badge}
                </div>
                <h3 className="font-heading font-semibold text-white text-base mb-5 leading-snug">{c.title}</h3>
                <div className="space-y-3 flex-1">
                  {c.steps.map((s, si) => (
                    <div key={si} className="flex items-start gap-3">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold ${c.color} bg-current/10`} style={{ backgroundColor: "rgba(255,255,255,0.05)" }}>
                        <span className={c.color}>{si + 1}</span>
                      </div>
                      <div>
                        <div className="text-sm text-white font-medium">{s.label}</div>
                        <div className="text-xs text-muted-foreground">{s.note}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className={`mt-5 pt-4 border-t border-border/20 text-xs font-mono leading-relaxed ${c.color}`}>
                  {c.outcome}
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function MarketStatusSection() {
  const statuses = [
    {
      key: "PENDING",
      label: "Pending",
      icon: Clock,
      dot: "bg-zinc-500",
      badge: "bg-zinc-800/60 text-zinc-400 border-zinc-700/50",
      bar: "bg-zinc-600",
      title: "Awaiting Vault Deposit",
      desc: "The market creator hasn't funded the vault yet. The market is visible but no trading is active.",
      canOpen: false,
      canClose: false,
    },
    {
      key: "LIVE",
      label: "Live",
      icon: CheckCircle2,
      dot: "bg-green-500",
      badge: "bg-green-900/40 text-green-400 border-green-700/40",
      bar: "bg-green-500",
      title: "Live & Tradeable",
      desc: "Vault is funded and the lock period is active. Open and close long/short positions freely.",
      canOpen: true,
      canClose: true,
    },
    {
      key: "VAULT_UNLOCK",
      label: "Vault Unlock",
      icon: Unlock,
      dot: "bg-yellow-400",
      badge: "bg-yellow-900/40 text-yellow-300 border-yellow-700/40",
      bar: "bg-yellow-400",
      title: "Vault Lock Expired",
      desc: "The vault's lock period is over. The creator may reclaim funds at any time. New positions are blocked — existing positions can still be closed.",
      canOpen: false,
      canClose: true,
    },
    {
      key: "FROZEN",
      label: "Frozen",
      icon: Snowflake,
      dot: "bg-blue-400",
      badge: "bg-blue-900/40 text-blue-300 border-blue-700/40",
      bar: "bg-blue-400",
      title: "Vault Withdrawn",
      desc: "The creator has reclaimed the vault. New positions are blocked. Existing positions can still be closed against the remaining insurance balance in the vault.",
      canOpen: false,
      canClose: true,
    },
    {
      key: "PAUSED",
      label: "Paused",
      icon: PauseCircle,
      dot: "bg-orange-400",
      badge: "bg-orange-900/40 text-orange-300 border-orange-700/40",
      bar: "bg-orange-400",
      title: "Manually Paused",
      desc: "The creator has temporarily halted trading — typically for a token migration or emergency. Existing positions can still be closed.",
      canOpen: false,
      canClose: true,
    },
  ];

  return (
    <section id="market-status" className="relative py-20 sm:py-28" data-testid="section-market-status">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 sm:mb-16">
          <Badge variant="secondary" className="mb-4 text-xs font-mono" style={{ color: "#d5f704" }}>Market Status</Badge>
          <h2 className="font-heading font-bold text-3xl sm:text-4xl lg:text-5xl tracking-tight mb-4 text-3d-sm">
            Know What Each <span className="text-gradient">Status Means</span>
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto">
            Every market on Flap Futures has a live status that tells you exactly what you can and can't do.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {statuses.map((s, i) => {
            const Icon = s.icon;
            return (
              <motion.div
                key={s.key}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.07 }}
              >
                <Card className="p-5 h-full flex flex-col border-border/20 hover-elevate">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${s.dot} bg-opacity-20`} style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
                      <Icon className={`w-4 h-4`} style={{ color: "inherit" }} />
                    </div>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold border ${s.badge}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${s.dot} inline-block`} />
                      {s.label}
                    </span>
                  </div>

                  <h3 className="font-heading font-semibold text-white text-sm mb-2">{s.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed flex-1">{s.desc}</p>

                  <div className="mt-4 pt-3 border-t border-border/20 grid grid-cols-2 gap-2">
                    <div className={`flex items-center gap-1.5 text-[10px] font-mono ${s.canOpen ? "text-green-400" : "text-zinc-500"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.canOpen ? "bg-green-400" : "bg-zinc-600"}`} />
                      Open positions
                    </div>
                    <div className={`flex items-center gap-1.5 text-[10px] font-mono ${s.canClose ? "text-green-400" : "text-zinc-500"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.canClose ? "bg-green-400" : "bg-zinc-600"}`} />
                      Close positions
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function FairTradeSection() {
  const traderPoints = [
    {
      title: "One fee. No asterisks.",
      desc: "0.1% of your position size per open and close, minimum $1. That's the complete cost — listed in full in the order panel before you confirm. No spread markup, no borrow rate, no overnight charge.",
    },
    {
      title: "A price feed no one controls",
      desc: "Every market is priced from DexScreener's live on-chain data — publicly auditable by anyone. The market creator has zero ability to push, manipulate, or delay the mark price.",
    },
    {
      title: "Liquidations by the numbers",
      desc: "A position is liquidated when it loses 80% of its margin — calculated against the same live price feed, every time. No special treatment, no premature triggers, no exceptions.",
    },
    {
      title: "Profits land in your wallet immediately",
      desc: "Close a winning trade and USDT is released from the vault directly to your address. No claim form, no waiting period, no admin involved. Win and walk.",
    },
    {
      title: "Close any position, in any condition.",
      desc: "Regardless of market status — paused, vault unlocked, or frozen — you can always close your open position. Your exit is never blocked.",
    },
  ];

  const creatorPoints = [
    {
      title: "80% of every fee — automatically",
      desc: "The moment a trade opens or closes on your market, 80% of the fee is credited to your pending balance. No invoices, no batch settlements, no manual requests. Just accumulates.",
    },
    {
      title: "Lock period protects traders, not us",
      desc: "Your vault USDT is locked for the duration you set so traders know funds are available for payouts. Once the lock ends, it's fully yours — withdraw any time, no notice required.",
    },
    {
      title: "Parameters are a formula, not a policy",
      desc: "Max leverage, position cap, and OI limit are derived from vault size and market cap using a fixed public formula. No admin can override them. You can predict your market's limits exactly.",
    },
    {
      title: "Liquidations top up your insurance — automatically",
      desc: "When a position is liquidated (80% margin loss), the remaining 20% of the trader's margin is split on-chain: 50% goes directly into your vault's insurance balance (creator-owned), 30% goes to the liquidation bot as a gas incentive, and 20% goes to the Flap Futures platform fee reserve. Example: trader deposits $100 USDT margin — $80 is absorbed covering the loss, then the remaining $20 splits as $10 into your insurance, $6 to the bot, $4 to Flap Futures. No claim needed — it lands in your vault instantly.",
    },
    {
      title: "Zero fixed costs. 20% of revenue only.",
      desc: "No listing fee, no monthly subscription, no setup cost of any kind. We take 20% of what traders pay in fees. If your market earns nothing, we earn nothing. Our incentives are aligned with yours.",
    },
  ];

  return (
    <section id="fair-trade" className="relative py-20 sm:py-28" data-testid="section-fair-trade">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 sm:mb-16">
          <Badge variant="secondary" className="mb-4 text-xs font-mono" style={{ color: "#d5f704" }} data-testid="badge-fair-trade">Fair by Design</Badge>
          <h2 className="font-heading font-bold text-3xl sm:text-4xl lg:text-5xl tracking-tight mb-4 text-3d-sm" data-testid="text-fair-trade-title">
            A Square Deal for <span className="text-gradient">Both Sides</span>
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto">
            A market only works when both participants trust it. Here's exactly how Flap Futures protects traders and market openers equally.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-5 sm:gap-6">
          {/* Trader side */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45 }}
          >
            <Card className="p-6 sm:p-8 h-full border-primary/30 bg-primary/5" data-testid="card-fair-trader">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="font-heading font-bold text-white text-lg">For Traders</div>
                  <div className="text-xs text-muted-foreground">What you're protected by</div>
                </div>
              </div>
              <div className="space-y-5">
                {traderPoints.map((p, i) => (
                  <div key={i} className="flex items-start gap-3" data-testid={`trader-point-${i}`}>
                    <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[10px] font-bold text-primary">✓</span>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white mb-0.5">{p.title}</div>
                      <div className="text-xs text-muted-foreground leading-relaxed">{p.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>

          {/* Market opener side */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45, delay: 0.08 }}
          >
            <Card className="p-6 sm:p-8 h-full border-[#d5f704]/20 bg-[#d5f704]/5" data-testid="card-fair-creator">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-[#d5f704]/10 flex items-center justify-center">
                  <Rocket className="w-5 h-5 text-[#d5f704]" />
                </div>
                <div>
                  <div className="font-heading font-bold text-white text-lg">For Market Openers</div>
                  <div className="text-xs text-muted-foreground">What you're guaranteed</div>
                </div>
              </div>
              <div className="space-y-5">
                {creatorPoints.map((p, i) => (
                  <div key={i} className="flex items-start gap-3" data-testid={`creator-point-${i}`}>
                    <div className="w-5 h-5 rounded-full bg-[#d5f704]/10 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[10px] font-bold text-[#d5f704]">✓</span>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white mb-0.5">{p.title}</div>
                      <div className="text-xs text-muted-foreground leading-relaxed">{p.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  const steps = [
    {
      step: "01",
      icon: FileCheck,
      title: "Verify Your Token",
      desc: "Paste your flap.sh token contract address. Your token must end in 7777 or 8888 (flap.sh origin), or be confirmed via the flap.sh token page.",
    },
    {
      step: "02",
      icon: Shield,
      title: "Pass 7 Checks",
      desc: "Automated checks confirm: PancakeSwap V2/V3 pair with BNB or USDT, market cap ≥ $25k, liquidity ≥ $5k, token name, logo, and fixed supply.",
    },
    {
      step: "03",
      icon: Layers,
      title: "Set Your Vault",
      desc: "Choose your minimum vault size (default $500 USDT) and lock duration (7–365 days). Your vault backs trader PnL and determines market parameters.",
    },
    {
      step: "04",
      icon: Rocket,
      title: "Market Goes Live",
      desc: "Your perpetual market is created instantly. Spread, max leverage (up to 50×), position limits, and OI cap all scale automatically with your vault size.",
    },
    {
      step: "05",
      icon: Bot,
      title: "Platform Runs It",
      desc: "Our price bot refreshes market data every 5 minutes from DexScreener. Parameters re-flex whenever you deposit or withdraw from the vault.",
    },
    {
      step: "06",
      icon: TrendingUp,
      title: "Earn 80% of Fees",
      desc: "Every trade open and close pays a spread fee. You receive 80% automatically — claimable from your dashboard. Platform takes the remaining 20%.",
    },
  ];

  return (
    <section id="how-it-works" className="relative py-20 sm:py-32" data-testid="section-how-it-works">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 sm:mb-16">
          <Badge variant="secondary" className="mb-4 text-xs font-mono" style={{ color: "#d5f704" }} data-testid="badge-how">Process</Badge>
          <h2 className="font-heading font-bold text-3xl sm:text-4xl lg:text-5xl tracking-tight mb-4 text-3d-sm" data-testid="text-how-title">
            How It <span className="text-gradient">Works</span>
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto" data-testid="text-how-subtitle">
            From application to live trading in minutes. Fully automated, fully on-chain.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {steps.map((s, i) => (
            <motion.div
              key={s.step}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="h-full"
            >
              <Card
                className="relative p-6 sm:p-7 h-full hover-elevate overflow-hidden"
                data-testid={`card-step-${s.step}`}
                style={{
                  background: "linear-gradient(145deg, hsl(250,45%,12%) 0%, hsl(250,45%,9%) 100%)",
                  border: "1px solid rgba(122,51,250,0.18)",
                }}
              >
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: "radial-gradient(ellipse at 0% 0%, rgba(122,51,250,0.08) 0%, transparent 60%)",
                  }}
                />

                <div className="flex items-start justify-between mb-5 relative z-10">
                  <div
                    className="flex items-center justify-center rounded-xl"
                    style={{
                      width: 48,
                      height: 48,
                      background: "linear-gradient(135deg, rgba(122,51,250,0.2) 0%, rgba(145,72,255,0.1) 100%)",
                      border: "1px solid rgba(122,51,250,0.35)",
                      boxShadow: "0 0 16px rgba(122,51,250,0.15)",
                    }}
                  >
                    <s.icon className="w-5 h-5" style={{ color: "#d5f704" }} />
                  </div>

                  <span
                    className="font-mono font-black leading-none select-none"
                    style={{
                      fontSize: "3rem",
                      background: "linear-gradient(180deg, rgba(122,51,250,0.35) 0%, rgba(122,51,250,0.05) 100%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }}
                  >
                    {s.step}
                  </span>
                </div>

                <div
                  className="mb-3 relative z-10"
                  style={{ height: 2, width: 32, background: "linear-gradient(90deg, #7a33fa, transparent)" }}
                />

                <h3 className="font-heading font-bold text-base sm:text-lg mb-2 text-white relative z-10 tracking-tight">
                  {s.title}
                </h3>
                <p className="text-sm leading-relaxed relative z-10" style={{ color: "rgba(255,255,255,0.5)" }}>
                  {s.desc}
                </p>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function EcosystemSection() {
  const contracts = [
    { icon: Wallet, name: "Secure Custody", desc: "Your funds are held securely on-chain. Deposit and withdraw anytime with full transparency.", color: "text-blue-400" },
    { icon: Globe, name: "Real-Time Pricing", desc: "Accurate price feeds sourced directly on-chain. No third-party dependencies or delays.", color: "text-green-400" },
    { icon: BarChart3, name: "Perpetual Trading", desc: "Go long or short with leverage. A professional-grade trading experience fully on-chain.", color: "text-purple-400" },
    { icon: TrendingUp, name: "Fair Rates", desc: "Dynamic rates keep markets balanced and ensure fair pricing across all positions.", color: "text-yellow-400" },
    { icon: Shield, name: "Risk Management", desc: "Automated systems protect the platform and traders from excessive risk exposure.", color: "text-red-400" },
    { icon: Lock, name: "Market Stability", desc: "Built-in safeguards ensure platform resilience even during extreme market conditions.", color: "text-cyan-400" },
  ];

  return (
    <section id="ecosystem" className="relative py-20 sm:py-32" data-testid="section-ecosystem">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 sm:mb-16">
          <Badge variant="secondary" className="mb-4 text-xs font-mono" style={{ color: "#d5f704" }} data-testid="badge-ecosystem">Architecture</Badge>
          <h2 className="font-heading font-bold text-3xl sm:text-4xl lg:text-5xl tracking-tight mb-4 text-3d-sm" data-testid="text-ecosystem-title">
            Our <span className="text-gradient">Ecosystem</span>
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto" data-testid="text-ecosystem-subtitle">
            Every listed token gets its own dedicated trading infrastructure, deployed automatically.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {contracts.map((c, i) => (
            <motion.div
              key={c.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="h-full"
            >
              <Card
                className="relative p-6 sm:p-7 h-full hover-elevate overflow-hidden"
                data-testid={`card-eco-${c.name.toLowerCase().replace(/\s/g, "-")}`}
                style={{
                  background: "linear-gradient(145deg, hsl(250,45%,12%) 0%, hsl(250,45%,9%) 100%)",
                  border: "1px solid rgba(122,51,250,0.18)",
                }}
              >
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: "radial-gradient(ellipse at 0% 0%, rgba(122,51,250,0.08) 0%, transparent 60%)",
                  }}
                />

                <div
                  className="flex items-center justify-center rounded-xl mb-5 relative z-10"
                  style={{
                    width: 48,
                    height: 48,
                    background: "linear-gradient(135deg, rgba(122,51,250,0.2) 0%, rgba(145,72,255,0.1) 100%)",
                    border: "1px solid rgba(122,51,250,0.35)",
                    boxShadow: "0 0 16px rgba(122,51,250,0.15)",
                  }}
                >
                  <c.icon className="w-5 h-5" style={{ color: "#d5f704" }} />
                </div>

                <div
                  className="mb-3 relative z-10"
                  style={{ height: 2, width: 32, background: "linear-gradient(90deg, #7a33fa, transparent)" }}
                />

                <h3 className="font-heading font-bold text-base sm:text-lg mb-2 text-white relative z-10 tracking-tight">
                  {c.name}
                </h3>
                <p className="text-sm leading-relaxed relative z-10" style={{ color: "rgba(255,255,255,0.5)" }}>
                  {c.desc}
                </p>
              </Card>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-8 sm:mt-12"
        >
          <Card className="p-6 sm:p-8" data-testid="card-master-brain">
            <div className="flex flex-col lg:flex-row items-start lg:items-center gap-6">
              <div className="w-16 h-16 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                <Layers className="w-8 h-8 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-heading font-semibold text-lg sm:text-xl mb-2 text-white">Automated Infrastructure</h3>
                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                  All trading infrastructure is set up automatically when a token is approved. Each market gets its own
                  dedicated systems to ensure reliable and secure operations.
                </p>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </section>
  );
}

function ContractsSection() {
  const global = [
    {
      icon: Layers,
      name: "FlapFactory",
      desc: "The master deployer. When a token is approved, FlapFactory spins up a fresh PerpVault and PerpMarket pair — fully automated, no human intervention required.",
    },
    {
      icon: Globe,
      name: "PriceRegistry",
      desc: "Stores and refreshes DexScreener price feeds for every active market. All mark prices and PnL calculations read from this single source of truth.",
    },
    {
      icon: Zap,
      name: "FundingEngine",
      desc: "Called every 8 hours by the bot. Charges the heavier side (longs or shorts) a funding rate and pays the lighter side. Keeps perpetual prices tethered to the live spot price. 10% of funding goes to the platform.",
    },
    {
      icon: Coins,
      name: "FeeReserve",
      desc: "Receives the 20% platform cut from every trade fee and the 20% platform cut from every liquidation. Funds bot gas, operations, and future protocol development.",
    },
  ];

  const perMarket: { icon: any; name: string; desc: string; balances?: { label: string; note: string; color: string; borderColor: string }[] }[] = [
    {
      icon: Database,
      name: "PerpVault",
      desc: "Holds two separate USDT balances per market. Both are locked until the vault expiry date. Creator deposits, withdraws, and fully controls both.",
      balances: [
        {
          label: "Vault Collateral",
          note: "Backs trader payouts on profitable closes.",
          color: "rgba(122,51,250,0.12)",
          borderColor: "rgba(122,51,250,0.3)",
        },
        {
          label: "Insurance Fund",
          note: "Creator-owned backstop. 50% of every liquidation flows here automatically.",
          color: "rgba(59,130,246,0.10)",
          borderColor: "rgba(59,130,246,0.3)",
        },
      ],
    },
    {
      icon: TrendingUp,
      name: "PerpMarket",
      desc: "The trading engine for one token. Handles open/close logic, PnL calculation, liquidation triggers, and distributes the 80% fee split to the market creator.",
    },
  ];

  const cardStyle = {
    background: "linear-gradient(145deg, hsl(250,45%,12%) 0%, hsl(250,45%,9%) 100%)",
    border: "1px solid rgba(122,51,250,0.18)",
  };

  const iconBoxStyle = {
    width: 48,
    height: 48,
    background: "linear-gradient(135deg, rgba(122,51,250,0.2) 0%, rgba(145,72,255,0.1) 100%)",
    border: "1px solid rgba(122,51,250,0.35)",
    boxShadow: "0 0 16px rgba(122,51,250,0.15)",
  };

  return (
    <section id="contracts" className="relative py-20 sm:py-28" data-testid="section-contracts">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 sm:mb-16">
          <Badge variant="secondary" className="mb-4 text-xs font-mono" style={{ color: "#d5f704" }}>Smart Contracts</Badge>
          <h2 className="font-heading font-bold text-3xl sm:text-4xl lg:text-5xl tracking-tight mb-4 text-3d-sm">
            6 Contracts. <span className="text-gradient">One System.</span>
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto">
            The platform runs on 4 shared global contracts and 2 dedicated contracts deployed automatically for every token market. Each PerpVault holds both the vault collateral and the creator's insurance fund — insurance is not a separate contract.
          </p>
        </div>

        <div className="space-y-8">
          {/* Global contracts */}
          <div>
            <div className="flex items-center gap-3 mb-5">
              <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-full border border-primary/40 text-primary bg-primary/10">
                Global — deployed once
              </span>
              <div className="flex-1 h-px bg-border/30" />
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
              {global.map((c, i) => (
                <motion.div
                  key={c.name}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.07 }}
                  className="h-full"
                >
                  <Card className="relative p-5 h-full hover-elevate overflow-hidden" style={cardStyle}>
                    <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 0% 0%, rgba(122,51,250,0.08) 0%, transparent 60%)" }} />
                    <div className="flex items-center justify-center rounded-xl mb-4 relative z-10" style={iconBoxStyle}>
                      <c.icon className="w-5 h-5" style={{ color: "#d5f704" }} />
                    </div>
                    <div className="mb-3 relative z-10" style={{ height: 2, width: 32, background: "linear-gradient(90deg, #7a33fa, transparent)" }} />
                    <h3 className="font-heading font-bold text-sm sm:text-base mb-2 text-white relative z-10 tracking-tight font-mono">{c.name}</h3>
                    <p className="text-xs leading-relaxed relative z-10" style={{ color: "rgba(255,255,255,0.5)" }}>{c.desc}</p>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Per-market contracts */}
          <div>
            <div className="flex items-center gap-3 mb-5">
              <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-full border border-yellow-500/40 text-yellow-300 bg-yellow-900/20">
                Per-market — deployed per token
              </span>
              <div className="flex-1 h-px bg-border/30" />
            </div>
            <div className="grid sm:grid-cols-2 gap-4 sm:gap-5">
              {perMarket.map((c, i) => (
                <motion.div
                  key={c.name}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.1 }}
                  className="h-full"
                >
                  <Card className="relative p-6 h-full hover-elevate overflow-hidden" style={{ ...cardStyle, border: "1px solid rgba(213,247,4,0.15)" }}>
                    <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 0% 0%, rgba(213,247,4,0.04) 0%, transparent 60%)" }} />
                    <div className="flex items-center justify-center rounded-xl mb-4 relative z-10" style={{ ...iconBoxStyle, border: "1px solid rgba(213,247,4,0.3)" }}>
                      <c.icon className="w-5 h-5" style={{ color: "#d5f704" }} />
                    </div>
                    <div className="mb-3 relative z-10" style={{ height: 2, width: 32, background: "linear-gradient(90deg, #d5f704, transparent)" }} />
                    <h3 className="font-heading font-bold text-base sm:text-lg mb-2 text-white relative z-10 tracking-tight font-mono">{c.name}</h3>
                    <p className="text-sm leading-relaxed relative z-10 mb-4" style={{ color: "rgba(255,255,255,0.55)" }}>{c.desc}</p>
                    {c.balances && (
                      <div className="grid grid-cols-2 gap-2 relative z-10">
                        {c.balances.map(b => (
                          <div key={b.label} className="rounded-lg p-3" style={{ background: b.color, border: `1px solid ${b.borderColor}` }}>
                            <div className="text-[11px] font-mono font-semibold text-white mb-1">{b.label}</div>
                            <div className="text-[10px] leading-snug" style={{ color: "rgba(255,255,255,0.45)" }}>{b.note}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FeeSection() {
  return (
    <section id="fees" className="relative py-20 sm:py-28" data-testid="section-fees">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        <div className="text-center mb-12 sm:mb-16">
          <Badge variant="secondary" className="mb-4 text-xs font-mono" style={{ color: "#d5f704" }}>Fee Structure</Badge>
          <h2 className="font-heading font-bold text-3xl sm:text-4xl lg:text-5xl tracking-tight mb-4 text-3d-sm">
            How <span className="text-gradient">Fees Work</span>
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto">
            One flat rate. No hidden charges. Every fee split is deterministic and settled on-chain the moment a trade fires.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 sm:gap-8">

          {/* Trade fee */}
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.45 }}>
            <Card className="p-6 sm:p-8 h-full border-border/20" style={{ background: "linear-gradient(145deg, hsl(250,45%,12%) 0%, hsl(250,45%,9%) 100%)" }}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(122,51,250,0.15)", border: "1px solid rgba(122,51,250,0.35)" }}>
                  <Coins className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="font-heading font-bold text-white text-base">Trade Fee</div>
                  <div className="text-xs text-muted-foreground">charged on open and on close</div>
                </div>
                <span className="ml-auto font-mono font-bold text-2xl" style={{ color: "#d5f704" }}>0.1%</span>
              </div>

              <div className="space-y-2 mb-6">
                <div className="text-xs text-muted-foreground font-mono">min $1 per side &nbsp;·&nbsp; applied to position size &nbsp;·&nbsp; shown before confirm</div>
              </div>

              {/* Split bar */}
              <div className="mb-3">
                <div className="flex justify-between text-[10px] font-mono mb-1.5">
                  <span className="text-primary">80% → Market Creator</span>
                  <span className="text-muted-foreground">20% → Platform</span>
                </div>
                <div className="flex h-3 rounded-full overflow-hidden">
                  <div className="bg-primary" style={{ width: "80%" }} />
                  <div className="bg-white/20" style={{ width: "20%" }} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-5">
                <div className="rounded-lg p-3" style={{ background: "rgba(122,51,250,0.10)", border: "1px solid rgba(122,51,250,0.2)" }}>
                  <div className="font-mono font-bold text-xl text-primary mb-0.5">80%</div>
                  <div className="text-[11px] text-muted-foreground leading-snug">Added to creator's pending balance — claimable from dashboard anytime.</div>
                </div>
                <div className="rounded-lg p-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div className="font-mono font-bold text-xl text-white/60 mb-0.5">20%</div>
                  <div className="text-[11px] text-muted-foreground leading-snug">Sent immediately to the platform FeeReserve contract on every trade.</div>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Liquidation split */}
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.45, delay: 0.1 }}>
            <Card className="p-6 sm:p-8 h-full border-border/20" style={{ background: "linear-gradient(145deg, hsl(250,45%,12%) 0%, hsl(250,45%,9%) 100%)" }}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)" }}>
                  <Zap className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <div className="font-heading font-bold text-white text-base">Liquidation Split</div>
                  <div className="text-xs text-muted-foreground">when a position loses 80% of margin</div>
                </div>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed mb-5">
                A position is liquidated when it loses 80% of its margin. The remaining 20% of collateral is split three ways — instantly, on-chain.
              </p>

              {/* Three-way split bar */}
              <div className="mb-3">
                <div className="flex justify-between text-[10px] font-mono mb-1.5">
                  <span className="text-blue-400">50% Creator Insurance</span>
                  <span style={{ color: "#d5f704" }}>30% Liquidator Bot</span>
                  <span className="text-white/50">20% Platform</span>
                </div>
                <div className="flex h-3 rounded-full overflow-hidden gap-px">
                  <div className="bg-blue-500 rounded-l-full" style={{ width: "50%" }} />
                  <div style={{ width: "30%", background: "#d5f704" }} />
                  <div className="bg-white/25 rounded-r-full" style={{ width: "20%" }} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mt-5">
                <div className="rounded-lg p-3" style={{ background: "rgba(59,130,246,0.10)", border: "1px solid rgba(59,130,246,0.2)" }}>
                  <div className="font-mono font-bold text-lg text-blue-400 mb-0.5">50%</div>
                  <div className="text-[10px] text-muted-foreground leading-snug">Your vault's insurance — creator-owned, locked until vault unlock date.</div>
                </div>
                <div className="rounded-lg p-3" style={{ background: "rgba(213,247,4,0.07)", border: "1px solid rgba(213,247,4,0.2)" }}>
                  <div className="font-mono font-bold text-lg mb-0.5" style={{ color: "#d5f704" }}>30%</div>
                  <div className="text-[10px] text-muted-foreground leading-snug">Gas incentive for the liquidation bot that triggered the close.</div>
                </div>
                <div className="rounded-lg p-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div className="font-mono font-bold text-lg text-white/60 mb-0.5">20%</div>
                  <div className="text-[10px] text-muted-foreground leading-snug">Platform FeeReserve — same destination as the trade fee cut.</div>
                </div>
              </div>
            </Card>
          </motion.div>

        </div>

        {/* Worked examples */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45, delay: 0.15 }}
          className="mt-8"
        >
          <div className="flex items-center gap-3 mb-5">
            <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-full border border-primary/40 text-primary bg-primary/10">
              Worked examples
            </span>
            <div className="flex-1 h-px bg-border/30" />
          </div>

          <div className="grid sm:grid-cols-2 gap-5">

            {/* Trade fee example */}
            <Card className="p-5 border-border/20" style={{ background: "linear-gradient(145deg, hsl(250,45%,12%) 0%, hsl(250,45%,9%) 100%)" }}>
              <div className="text-xs font-mono font-semibold text-primary mb-4">Example A — Trade open + close</div>
              <div className="space-y-2 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Position size</span>
                  <span className="text-white">$500</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Open fee (0.1%, min $1)</span>
                  <span className="text-white">$1.00</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Close fee (0.1%, min $1)</span>
                  <span className="text-white">$1.00</span>
                </div>
                <div className="h-px bg-border/30 my-1" />
                <div className="flex justify-between font-semibold">
                  <span className="text-muted-foreground">Total fees paid</span>
                  <span className="text-white">$2.00</span>
                </div>
                <div className="h-px bg-border/30 my-1" />
                <div className="flex justify-between">
                  <span className="text-primary">→ Creator receives (80%)</span>
                  <span className="text-primary font-semibold">$1.60</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">→ Platform receives (20%)</span>
                  <span className="text-muted-foreground">$0.40</span>
                </div>
              </div>
            </Card>

            {/* Liquidation example */}
            <Card className="p-5 border-border/20" style={{ background: "linear-gradient(145deg, hsl(250,45%,12%) 0%, hsl(250,45%,9%) 100%)" }}>
              <div className="text-xs font-mono font-semibold text-red-400 mb-4">Example B — Position liquidated</div>
              <div className="space-y-2 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Trader margin deposited</span>
                  <span className="text-white">$100</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Loss absorbed at liquidation (80%)</span>
                  <span className="text-red-400">−$80</span>
                </div>
                <div className="h-px bg-border/30 my-1" />
                <div className="flex justify-between font-semibold">
                  <span className="text-muted-foreground">Remaining margin (20%)</span>
                  <span className="text-white">$20</span>
                </div>
                <div className="h-px bg-border/30 my-1" />
                <div className="flex justify-between">
                  <span className="text-blue-400">→ Your insurance (50%)</span>
                  <span className="text-blue-400 font-semibold">$10</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: "#d5f704" }}>→ Liquidator bot (30%)</span>
                  <span className="font-semibold" style={{ color: "#d5f704" }}>$6</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">→ Platform (20%)</span>
                  <span className="text-muted-foreground">$4</span>
                </div>
              </div>
            </Card>

          </div>
        </motion.div>

      </div>
    </section>
  );
}

function FlexParamsSection() {
  const tiers = [
    { mcap: "< $50k",        spread: "0.50%", lev: "1×",  maxPos: "$20",  maxOI: "$1k",   ins: "$100" },
    { mcap: "$50k – $100k",  spread: "0.45%", lev: "5×",  maxPos: "$35",  maxOI: "$2.5k", ins: "$250" },
    { mcap: "$100k – $300k", spread: "0.40%", lev: "7×",  maxPos: "$50",  maxOI: "$6k",   ins: "$600" },
    { mcap: "$300k – $1M",   spread: "0.35%", lev: "10×", maxPos: "$75",  maxOI: "$15k",  ins: "$1.5k" },
    { mcap: "$1M – $5M",     spread: "0.25%", lev: "10×", maxPos: "$100", maxOI: "$40k",  ins: "$4k" },
    { mcap: "> $5M",         spread: "0.10%", lev: "10×", maxPos: "$100", maxOI: "$100k", ins: "$10k" },
  ];

  const params = [
    { icon: Zap,      label: "Spread",        key: "spread", desc: "Lower spread as token matures — tighter markets for bigger tokens." },
    { icon: TrendingUp, label: "Max Leverage", key: "lev",   desc: "Leverage unlocks with market cap — starts at 1× for micro-caps." },
    { icon: BarChart3, label: "Max Position",  key: "maxPos", desc: "Single-trade size cap scales with liquidity and market depth." },
    { icon: Layers,   label: "Max Open Interest", key: "maxOI", desc: "Total platform exposure cap; keeps risk proportional to market size." },
    { icon: Shield,   label: "Min Insurance", key: "ins",    desc: "Required insurance fund floor — 10% of max OI, minimum $100." },
  ];

  const trust = [
    { label: "None",     days: "< 30 days",   color: "text-white/40",   bg: "bg-white/5 border-white/10" },
    { label: "Silver",   days: "30+ days",     color: "text-slate-300",  bg: "bg-slate-500/15 border-slate-500/30" },
    { label: "Gold",     days: "90+ days",     color: "text-yellow-300", bg: "bg-yellow-500/15 border-yellow-500/30" },
    { label: "Platinum", days: "180+ days",    color: "text-cyan-300",   bg: "bg-cyan-500/15 border-cyan-500/30" },
  ];

  return (
    <section id="flex-params" className="relative py-20 sm:py-28" data-testid="section-flex-params">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="text-center mb-12 sm:mb-16">
          <Badge variant="secondary" className="mb-4 text-xs font-mono" style={{ color: "#d5f704" }}>Dynamic Parameters</Badge>
          <h2 className="font-heading font-bold text-3xl sm:text-4xl lg:text-5xl tracking-tight mb-4 text-3d-sm">
            Flex Params <span className="text-gradient">System</span>
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto">
            Every market parameter is derived automatically from the token's live market cap. As the token grows, its trading limits upgrade — no manual changes, no admin required.
          </p>
        </div>

        {/* Params explained */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-10">
          {params.map((p, i) => (
            <motion.div
              key={p.key}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: i * 0.07 }}
            >
              <Card className="p-4 h-full border-border/20 hover-elevate">
                <div className="flex items-center gap-2 mb-2">
                  <p.icon className="w-4 h-4 shrink-0" style={{ color: "#7a33fa" }} />
                  <span className="text-xs font-mono font-semibold text-white">{p.label}</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{p.desc}</p>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Tier table */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <Card className="overflow-hidden border-border/20 mb-10">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "rgba(122,51,250,0.12)", borderBottom: "1px solid rgba(122,51,250,0.2)" }}>
                    <th className="text-left px-4 py-3 text-xs font-mono font-semibold text-muted-foreground">Market Cap</th>
                    <th className="text-center px-4 py-3 text-xs font-mono font-semibold text-muted-foreground">Spread</th>
                    <th className="text-center px-4 py-3 text-xs font-mono font-semibold text-muted-foreground">Max Lev</th>
                    <th className="text-center px-4 py-3 text-xs font-mono font-semibold text-muted-foreground">Max Pos</th>
                    <th className="text-center px-4 py-3 text-xs font-mono font-semibold text-muted-foreground">Max OI</th>
                    <th className="text-center px-4 py-3 text-xs font-mono font-semibold text-muted-foreground">Min Insurance</th>
                  </tr>
                </thead>
                <tbody>
                  {tiers.map((t, i) => (
                    <tr
                      key={t.mcap}
                      style={{ borderBottom: i < tiers.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}
                      className="hover:bg-primary/5 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-white">{t.mcap}</td>
                      <td className="px-4 py-3 text-center font-mono text-xs text-red-400">{t.spread}</td>
                      <td className="px-4 py-3 text-center font-mono text-xs" style={{ color: "#d5f704" }}>{t.lev}</td>
                      <td className="px-4 py-3 text-center font-mono text-xs text-blue-300">{t.maxPos}</td>
                      <td className="px-4 py-3 text-center font-mono text-xs text-purple-300">{t.maxOI}</td>
                      <td className="px-4 py-3 text-center font-mono text-xs text-green-400">{t.ins}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </motion.div>

        {/* Trust badges */}
        <div>
          <div className="flex items-center gap-3 mb-5">
            <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-full border border-primary/40 text-primary bg-primary/10">
              Creator Trust Badge — vault lock duration
            </span>
            <div className="flex-1 h-px bg-border/30" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {trust.map((t, i) => (
              <motion.div
                key={t.label}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: i * 0.08 }}
              >
                <Card className={`p-4 border text-center ${t.bg}`}>
                  <div className={`font-heading font-bold text-lg mb-1 ${t.color}`}>{t.label}</div>
                  <div className="text-[11px] text-muted-foreground font-mono">{t.days} lock</div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}

function DepositWithdrawSection() {
  const traderSteps = [
    {
      icon: Wallet,
      title: "Connect Your Wallet",
      desc: "Connect any BNB Smart Chain wallet (MetaMask, Trust Wallet, etc.). Your USDT balance is read directly — nothing is deposited into the platform.",
    },
    {
      icon: ArrowDownToLine,
      title: "USDT Pulled on Open",
      desc: "When you open a position, the required USDT collateral is taken directly from your connected wallet. No pre-deposit step, no wrapping.",
    },
    {
      icon: CheckCircle2,
      title: "USDT Returned on Close",
      desc: "Close your position and your payout — original collateral plus any profit, minus the 0.1% fee — is sent directly back to your connected wallet. Instantly.",
    },
    {
      icon: ArrowUpFromLine,
      title: "Nothing Held on Platform",
      desc: "The platform never holds your funds between trades. Your USDT stays in your wallet until the moment you open a position.",
    },
  ];

  const creatorSteps = [
    {
      icon: Database,
      title: "Deposit Vault from Wallet",
      desc: "Send USDT directly from your connected wallet into your market's vault — minimum $500. This backs all trader payouts and sets your market's leverage and position limits.",
    },
    {
      icon: PiggyBank,
      title: "Deposit Insurance from Wallet",
      desc: "Fund your market's insurance pool alongside the vault. Both must be deposited before your market can accept trades. Insurance is creator-owned — it is never touched by the platform.",
    },
    {
      icon: Coins,
      title: "Fees Accumulate On-Chain",
      desc: "80% of every 0.1% trade fee (min $1/side) accrues to your market's pending fee balance on-chain, every time a trader opens or closes.",
    },
    {
      icon: Unlock,
      title: "Claim Fees & Withdraw After Unlock",
      desc: "Claim accumulated fees to your wallet any time. After the vault lock period expires, withdraw your vault liquidity and your insurance balance — both unlock together at the same time.",
    },
  ];

  const accentLine = (
    <div style={{ height: 2, width: 32, background: "linear-gradient(90deg, #7a33fa, transparent)", marginBottom: 20 }} />
  );

  return (
    <section id="deposit-withdraw" className="relative py-20 sm:py-32" data-testid="section-deposit-withdraw">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 sm:mb-16">
          <Badge variant="secondary" className="mb-4 text-xs font-mono" style={{ color: "#d5f704" }}>
            Funds & Liquidity
          </Badge>
          <h2 className="font-heading font-bold text-3xl sm:text-4xl lg:text-5xl tracking-tight mb-4 text-3d-sm">
            Deposit &amp; <span className="text-gradient">Withdraw</span>
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto">
            No platform wallets. No pre-deposits. USDT moves directly between your connected wallet and the on-chain contracts — for both traders and market creators.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 lg:gap-8">
          {/* Trader card */}
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <Card
              className="p-7 sm:p-8 h-full flex flex-col"
              style={{
                background: "linear-gradient(145deg, hsl(250,45%,12%) 0%, hsl(250,45%,9%) 100%)",
                border: "1px solid rgba(122,51,250,0.35)",
              }}
            >
              <div className="flex items-center gap-3 mb-2">
                <div
                  className="flex items-center justify-center rounded-xl"
                  style={{
                    width: 44,
                    height: 44,
                    background: "linear-gradient(135deg, rgba(122,51,250,0.25) 0%, rgba(145,72,255,0.12) 100%)",
                    border: "1px solid rgba(122,51,250,0.4)",
                  }}
                >
                  <Wallet className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="text-xs font-mono mb-0.5" style={{ color: "#d5f704" }}>FOR TRADERS</div>
                  <h3 className="font-heading font-bold text-xl text-white">Your Trading Balance</h3>
                </div>
              </div>
              {accentLine}
              <div className="space-y-5 flex-1">
                {traderSteps.map((step, i) => (
                  <motion.div
                    key={step.title}
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.35, delay: i * 0.08 }}
                    className="flex gap-4"
                  >
                    <div
                      className="flex items-center justify-center rounded-lg shrink-0 mt-0.5"
                      style={{
                        width: 36,
                        height: 36,
                        background: "rgba(122,51,250,0.12)",
                        border: "1px solid rgba(122,51,250,0.25)",
                      }}
                    >
                      <step.icon className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <div className="font-semibold text-sm text-white mb-1">{step.title}</div>
                      <div className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>{step.desc}</div>
                    </div>
                  </motion.div>
                ))}
              </div>
              <div className="mt-8">
                <Link href="/dashboard#futures">
                  <Button className="w-full font-semibold" style={{ background: "linear-gradient(135deg,#7a33fa,#9148ff)" }}>
                    Open a Position <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </Link>
              </div>
            </Card>
          </motion.div>

          {/* Creator card */}
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Card
              className="p-7 sm:p-8 h-full flex flex-col"
              style={{
                background: "linear-gradient(145deg, hsl(68,95%,8%) 0%, hsl(250,45%,9%) 100%)",
                border: "1px solid rgba(213,247,4,0.25)",
              }}
            >
              <div className="flex items-center gap-3 mb-2">
                <div
                  className="flex items-center justify-center rounded-xl"
                  style={{
                    width: 44,
                    height: 44,
                    background: "linear-gradient(135deg, rgba(213,247,4,0.15) 0%, rgba(213,247,4,0.06) 100%)",
                    border: "1px solid rgba(213,247,4,0.3)",
                  }}
                >
                  <Database className="w-5 h-5" style={{ color: "#d5f704" }} />
                </div>
                <div>
                  <div className="text-xs font-mono mb-0.5" style={{ color: "#d5f704" }}>FOR MARKET CREATORS</div>
                  <h3 className="font-heading font-bold text-xl text-white">Your Market Vault</h3>
                </div>
              </div>
              {accentLine}
              <div className="space-y-5 flex-1">
                {creatorSteps.map((step, i) => (
                  <motion.div
                    key={step.title}
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.35, delay: 0.1 + i * 0.08 }}
                    className="flex gap-4"
                  >
                    <div
                      className="flex items-center justify-center rounded-lg shrink-0 mt-0.5"
                      style={{
                        width: 36,
                        height: 36,
                        background: "rgba(213,247,4,0.08)",
                        border: "1px solid rgba(213,247,4,0.2)",
                      }}
                    >
                      <step.icon className="w-4 h-4" style={{ color: "#d5f704" }} />
                    </div>
                    <div>
                      <div className="font-semibold text-sm text-white mb-1">{step.title}</div>
                      <div className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>{step.desc}</div>
                    </div>
                  </motion.div>
                ))}
              </div>
              <div className="mt-8">
                <Link href="/dashboard">
                  <Button
                    className="w-full font-semibold"
                    style={{ background: "linear-gradient(135deg,#a8c200,#d5f704)", color: "#0a0614" }}
                  >
                    Launch Your Market <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </Link>
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Lock duration info banner */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="mt-6"
        >
          <Card
            className="p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4"
            style={{ border: "1px solid rgba(255,255,255,0.07)", background: "rgba(122,51,250,0.04)" }}
          >
            <div
              className="flex items-center justify-center rounded-xl shrink-0"
              style={{
                width: 44,
                height: 44,
                background: "rgba(122,51,250,0.1)",
                border: "1px solid rgba(122,51,250,0.25)",
              }}
            >
              <Clock className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="font-semibold text-sm text-white mb-1">Why is the vault locked?</div>
              <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
                Creators choose a lock duration at launch (default 7 days). This prevents a creator from withdrawing vault USDT while traders have open positions — ensuring payouts are always available. Once the lock expires, the creator calls a single transaction from their wallet to withdraw the full vault balance. Fees can be claimed to the creator's wallet at any time, independently of the lock.
              </p>
            </div>
          </Card>
        </motion.div>
      </div>
    </section>
  );
}

interface LiveMarket {
  id: string;
  tokenSymbol: string;
  tokenLogo: string | null;
  priceUsd: number;
  mcap: number;
  volume24h: number;
  openInterest: number;
  spread: number;
  maxLeverage: number;
  vaultBalance: number;
  longRatio: number;
}

function fmtVal(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

function SecuritySection() {
  const pillars = [
    {
      icon: Shield,
      color: "#7a33fa",
      title: "Non-Custodial by Design",
      desc: "The platform never holds your funds. USDT moves directly between your connected wallet and the on-chain contracts — no intermediary, no escrow, no platform wallet.",
    },
    {
      icon: Lock,
      color: "#d5f704",
      title: "Vault Lock Prevents Rug Pulls",
      desc: "Creator vault liquidity is locked on-chain for the duration they set at launch. No admin key, no override — the contract enforces it. Traders can always be paid out during the lock.",
    },
    {
      icon: Globe,
      color: "#7a33fa",
      title: "Tamper-Proof Price Oracle",
      desc: "Mark prices are sourced from DexScreener's live on-chain DEX data — publicly verifiable by anyone. Market creators have zero ability to push, delay, or manipulate the price feed.",
    },
    {
      icon: PiggyBank,
      color: "#d5f704",
      title: "Creator-Owned Insurance",
      desc: "Every market requires a funded insurance pool before it can accept trades. The creator deposits and owns it — not the platform. Liquidation proceeds automatically replenish it. Withdrawable after vault unlock.",
    },
    {
      icon: BarChart3,
      color: "#7a33fa",
      title: "Formula-Driven Risk Limits",
      desc: "Max leverage, position cap, and OI limits are calculated from a fixed public formula using vault size and market cap. No admin can override or change them at runtime.",
    },
    {
      icon: Zap,
      color: "#d5f704",
      title: "Automated Liquidations",
      desc: "Positions are liquidated at exactly 80% margin loss — calculated against the same live price feed, with the same formula, for every trader. No selective treatment, no manual triggers.",
    },
    {
      icon: Unlock,
      color: "#7a33fa",
      title: "Rugpull Protector",
      desc: "When vault lock expires, the market enters Vault Unlock mode. Every open position is automatically closed at the fair market price before the creator can withdraw a single dollar — no trader gets left behind.",
    },
  ];

  return (
    <section id="security" className="relative py-20 sm:py-32" data-testid="section-security">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 sm:mb-16">
          <Badge variant="secondary" className="mb-4 text-xs font-mono" style={{ color: "#d5f704" }}>
            Trust & Safety
          </Badge>
          <h2 className="font-heading font-bold text-3xl sm:text-4xl lg:text-5xl tracking-tight mb-4 text-3d-sm">
            Built to Be <span className="text-gradient">Trustless</span>
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto">
            Security isn't a feature we added — it's the constraint the platform was designed around. No admin keys, no custody, no opaque rules.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 mb-8">
          {pillars.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.07 }}
              className="h-full"
            >
              <Card
                className="relative p-6 h-full hover-elevate overflow-hidden"
                style={{
                  background: "linear-gradient(145deg, hsl(250,45%,12%) 0%, hsl(250,45%,9%) 100%)",
                  border: `1px solid ${p.color === "#7a33fa" ? "rgba(122,51,250,0.25)" : "rgba(213,247,4,0.15)"}`,
                }}
              >
                <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 0% 0%, rgba(122,51,250,0.06) 0%, transparent 60%)" }} />
                <div
                  className="flex items-center justify-center rounded-xl mb-5 relative z-10"
                  style={{
                    width: 44, height: 44,
                    background: p.color === "#7a33fa" ? "rgba(122,51,250,0.12)" : "rgba(213,247,4,0.08)",
                    border: `1px solid ${p.color === "#7a33fa" ? "rgba(122,51,250,0.3)" : "rgba(213,247,4,0.2)"}`,
                  }}
                >
                  <p.icon className="w-5 h-5" style={{ color: p.color }} />
                </div>
                <div style={{ height: 2, width: 28, background: `linear-gradient(90deg, ${p.color}, transparent)`, marginBottom: 14 }} className="relative z-10" />
                <h3 className="font-heading font-bold text-sm sm:text-base mb-2 text-white relative z-10">{p.title}</h3>
                <p className="text-sm leading-relaxed relative z-10" style={{ color: "rgba(255,255,255,0.5)" }}>{p.desc}</p>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Bottom banner */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Card
            className="p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center gap-5"
            style={{ border: "1px solid rgba(122,51,250,0.2)", background: "linear-gradient(135deg, rgba(122,51,250,0.06) 0%, rgba(122,51,250,0.02) 100%)" }}
          >
            <div
              className="flex items-center justify-center rounded-xl shrink-0"
              style={{ width: 52, height: 52, background: "rgba(122,51,250,0.12)", border: "1px solid rgba(122,51,250,0.3)" }}
            >
              <FileCheck className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-heading font-bold text-base sm:text-lg text-white mb-1">Verified Token Requirements</h3>
              <p className="text-sm sm:text-base leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
                Every token must pass 7 automated checks before a market can go live — including on-chain origin verification, minimum liquidity thresholds, and USDT pair confirmation. No unverified or fraudulent tokens can list on the platform.
              </p>
            </div>
            <div className="shrink-0">
              <div className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-mono font-semibold" style={{ background: "rgba(122,51,250,0.15)", border: "1px solid rgba(122,51,250,0.3)", color: "#d5f704" }}>
                <CheckCircle2 className="w-3.5 h-3.5" />
                7-Point Verification
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </section>
  );
}

function TradingBoardSection() {
  const [markets, setMarkets] = useState<LiveMarket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/markets")
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setMarkets(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const dec = (p: number) => p < 0.001 ? 8 : p < 1 ? 5 : 4;

  return (
    <section id="trading" className="relative py-20 sm:py-32" data-testid="section-trading">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 sm:mb-16">
          <Badge variant="secondary" className="mb-4 text-xs font-mono" style={{ color: "#d5f704" }} data-testid="badge-trading">Active Markets</Badge>
          <h2 className="font-heading font-bold text-3xl sm:text-4xl lg:text-5xl tracking-tight mb-4 text-3d-sm" data-testid="text-trading-title">
            Trading <span className="text-gradient">Board</span>
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto" data-testid="text-trading-subtitle">
            Live perpetual markets for <a href="https://flap.sh/bnb/board" target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity">flap.sh</a> tokens. Parameters flex in real-time with each market's vault size.
          </p>
        </div>

        <Card className="overflow-hidden" data-testid="card-trading-board">
          <div className="flex items-center justify-between gap-4 p-4 sm:p-6 border-b border-border/30">
            <span className="text-sm font-semibold text-white">Live Markets</span>
            <Badge variant="secondary" className="text-xs font-mono bg-lime-subtle border-lime-subtle text-lime-soft" data-testid="badge-live-count">
              <span className="w-1.5 h-1.5 rounded-full bg-lime mr-1.5 inline-block animate-pulse" />
              {markets.length} Live
            </Badge>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px]">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-border/20">
                  <th className="text-left px-4 sm:px-6 py-3 font-medium">Market</th>
                  <th className="text-right px-4 py-3 font-medium">Price</th>
                  <th className="text-right px-4 py-3 font-medium hidden sm:table-cell">Mcap</th>
                  <th className="text-right px-4 py-3 font-medium">Spread</th>
                  <th className="text-right px-4 py-3 font-medium">Max Lev</th>
                  <th className="text-right px-4 py-3 font-medium hidden md:table-cell">24h Vol</th>
                  <th className="text-right px-4 py-3 font-medium hidden md:table-cell">OI</th>
                  <th className="text-right px-4 sm:px-6 py-3 font-medium">Trade</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-muted-foreground text-sm">Loading markets…</td>
                  </tr>
                )}
                {!loading && markets.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-muted-foreground text-sm">No live markets yet — be the first to list your token.</td>
                  </tr>
                )}
                {markets.map((m) => (
                  <tr key={m.id} className="border-b border-border/10 last:border-0 hover-elevate transition-colors" data-testid={`row-pair-${m.tokenSymbol.toLowerCase()}`}>
                    <td className="px-4 sm:px-6 py-4">
                      <div className="flex items-center gap-3">
                        {m.tokenLogo ? (
                          <img src={m.tokenLogo} alt={m.tokenSymbol} className="w-8 h-8 rounded-full" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                            {m.tokenSymbol.substring(0, 2)}
                          </div>
                        )}
                        <div>
                          <div className="font-semibold text-sm text-white">{m.tokenSymbol}/USDT</div>
                          <div className="text-xs text-muted-foreground">Perpetual · flap.sh</div>
                        </div>
                      </div>
                    </td>
                    <td className="text-right px-4 py-4 font-mono text-sm text-white">
                      {m.priceUsd > 0 ? m.priceUsd.toFixed(dec(m.priceUsd)) : "—"}
                    </td>
                    <td className="text-right px-4 py-4 font-mono text-xs text-muted-foreground hidden sm:table-cell">
                      {fmtVal(m.mcap || 0)}
                    </td>
                    <td className="text-right px-4 py-4 font-mono text-xs text-white">
                      {((m.spread || 0) * 100).toFixed(0)} bps
                    </td>
                    <td className="text-right px-4 py-4 font-mono text-xs text-white">
                      {m.maxLeverage || 1}×
                    </td>
                    <td className="text-right px-4 py-4 font-mono text-xs text-muted-foreground hidden md:table-cell">
                      {fmtVal(m.volume24h || 0)}
                    </td>
                    <td className="text-right px-4 py-4 font-mono text-xs text-muted-foreground hidden md:table-cell">
                      {fmtVal(m.openInterest || 0)}
                    </td>
                    <td className="text-right px-4 sm:px-6 py-4">
                      <Button size="sm" variant="outline" className="text-xs border-primary/30 text-primary" asChild data-testid={`button-trade-${m.tokenSymbol.toLowerCase()}`}>
                        <Link href="/dashboard#futures">Trade</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-4 sm:p-6 border-t border-border/30 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{markets.length} live market{markets.length !== 1 ? "s" : ""} · Real-time data</span>
            <Button size="sm" variant="outline" className="text-xs border-primary/30 text-primary" asChild data-testid="button-view-all-markets">
              <Link href="/dashboard#futures">Open Trading App</Link>
            </Button>
          </div>
        </Card>
      </div>
    </section>
  );
}

function WhyFlapSection() {
  const features = [
    {
      icon: BarChart3,
      title: "Precision Trading",
      desc: "Execute trades with tight spreads and real-time pricing. Built for traders who demand accuracy and speed.",
    },
    {
      icon: Layers,
      title: "Deep Liquidity",
      desc: "Access pooled liquidity across markets to support large, confident trades with minimal slippage.",
    },
    {
      icon: Zap,
      title: "Advanced Tools",
      desc: "Leverage, limit orders, take-profit and stop-loss — built for control, speed, and a competitive edge.",
    },
    {
      icon: Shield,
      title: "Confidence in Every Trade",
      desc: "Whether you're new or a pro, enjoy a streamlined experience built for clarity and control.",
    },
  ];

  return (
    <section id="why" className="relative py-20 sm:py-32" data-testid="section-why">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 sm:mb-16">
          <Badge variant="secondary" className="mb-4 text-xs font-mono" style={{ color: "#d5f704" }} data-testid="badge-why">Advantages</Badge>
          <h2 className="font-heading font-bold text-3xl sm:text-4xl lg:text-5xl tracking-tight mb-4 text-3d-sm" data-testid="text-why-title">
            Why FLAP <span className="text-gradient">FUTURES</span>
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="h-full"
            >
              <Card
                className="relative p-6 sm:p-7 h-full hover-elevate overflow-hidden"
                data-testid={`card-why-${i}`}
                style={{
                  background: "linear-gradient(145deg, hsl(250,45%,12%) 0%, hsl(250,45%,9%) 100%)",
                  border: "1px solid rgba(122,51,250,0.18)",
                }}
              >
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: "radial-gradient(ellipse at 0% 0%, rgba(122,51,250,0.08) 0%, transparent 60%)",
                  }}
                />

                <div
                  className="flex items-center justify-center rounded-xl mb-5 relative z-10"
                  style={{
                    width: 48,
                    height: 48,
                    background: "linear-gradient(135deg, rgba(122,51,250,0.2) 0%, rgba(145,72,255,0.1) 100%)",
                    border: "1px solid rgba(122,51,250,0.35)",
                    boxShadow: "0 0 16px rgba(122,51,250,0.15)",
                  }}
                >
                  <f.icon className="w-5 h-5" style={{ color: "#d5f704" }} />
                </div>

                <div
                  className="mb-3 relative z-10"
                  style={{ height: 2, width: 32, background: "linear-gradient(90deg, #7a33fa, transparent)" }}
                />

                <h3 className="font-heading font-bold text-base sm:text-lg mb-2 text-white relative z-10 tracking-tight">
                  {f.title}
                </h3>
                <p className="text-sm leading-relaxed relative z-10" style={{ color: "rgba(255,255,255,0.5)" }}>
                  {f.desc}
                </p>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ListTokenSection() {
  return (
    <section id="list-token" className="relative py-20 sm:py-32" data-testid="section-list-token">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Card className="relative p-8 sm:p-12 lg:p-16" data-testid="card-list-token">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <div>
              <Badge variant="secondary" className="mb-4 text-xs font-mono" style={{ color: "#d5f704" }} data-testid="badge-developers">For Token Projects</Badge>
              <h2 className="font-heading font-bold text-3xl sm:text-4xl lg:text-5xl tracking-tight mb-6 text-3d-sm" data-testid="text-list-title">
                List Your <span className="text-gradient">Token</span>
              </h2>
              <p className="text-muted-foreground text-base sm:text-lg leading-relaxed mb-6" data-testid="text-list-desc">
                Built a token on <a href="https://flap.sh/bnb/board" target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity">flap.sh</a>? Get your own perpetual trading market up and running in minutes.
                The full trading infrastructure is provisioned and ready before you are — just connect your token and take control from a clean dashboard.
              </p>

              <div className="space-y-4 mb-8">
                {[
                  "Token must be a flap.sh original — CA ending in 7777 or 8888, or confirmed on the flap.sh token page",
                  "Listed on PancakeSwap V2 or V3 with a BNB or USDT pair",
                  "Market cap ≥ $25k and liquidity ≥ $5k at time of listing",
                  "Set a minimum vault (default $500 USDT, locked 7–365 days) — your vault backs trader PnL",
                  "Parameters auto-scale: bigger vault unlocks higher leverage (up to 50×), larger position & OI limits",
                  "Earn 80% of every spread fee on open and close — claimable from your dashboard anytime",
                ].map((step, i) => (
                  <div key={i} className="flex items-start gap-3" data-testid={`text-list-step-${i}`}>
                    <div className="w-6 h-6 rounded-full bg-lime-subtle flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-lime-soft">✓</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{step}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button size="lg" className="w-full sm:w-auto" asChild data-testid="button-apply-listing">
                  <Link href="/dashboard#apply">
                    Apply for Listing
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="w-full sm:w-auto glass-button" asChild data-testid="button-admin-dashboard">
                  <Link href="/dashboard#admin-demo">
                    Admin Dashboard
                  </Link>
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <Card className="p-5 bg-secondary/30 border-border/20" data-testid="card-listing-preview">
                <div className="flex items-center justify-between mb-4">
                  <Badge className="bg-lime-muted text-lime-soft border-lime-subtle text-xs">Example Market · $1k Vault</Badge>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-5">
                  {[
                    { label: "Trade Fee",    value: "0.1%, min $1/side" },
                    { label: "Max Leverage", value: "40×" },
                    { label: "Max Position", value: "$2,000" },
                    { label: "OI Cap",       value: "$10,000" },
                  ].map((stat) => (
                    <div key={stat.label} data-testid={`stat-preview-${stat.label.toLowerCase().replace(/\s/g, "-")}`}>
                      <div className="text-xs text-muted-foreground mb-1">{stat.label}</div>
                      <div className="font-heading font-semibold text-white text-sm">{stat.value}</div>
                    </div>
                  ))}
                </div>
                <div className="text-xs text-muted-foreground mb-2">Fee split per trade</div>
                <div className="space-y-2">
                  {[
                    { label: "Your share (80%)", value: "$0.80", note: "per trade side (min)", color: "text-[#d5f704]" },
                    { label: "Platform (20%)",   value: "$0.20", note: "per trade side (min)", color: "text-white/40" },
                    { label: "Trader pays",       value: "$1.00", note: "per open or close", color: "text-white/60" },
                  ].map((row, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className={row.color}>{row.label}</span>
                      <span className="text-white font-mono">{row.value}</span>
                      <span className="text-muted-foreground">{row.note}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}

function CTASection() {
  return (
    <section className="relative py-20 sm:py-32" data-testid="section-cta">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Card className="p-8 sm:p-12 text-center" data-testid="card-cta">
          <h3 className="font-heading font-bold text-2xl sm:text-3xl lg:text-4xl mb-4 text-white" data-testid="text-cta-title">
            Trade smarter.<br />Earn more.
          </h3>
          <p className="text-muted-foreground text-base sm:text-lg max-w-xl mx-auto mb-8" data-testid="text-cta-desc">
            Connect your wallet and start trading perpetuals on <a href="https://flap.sh/bnb/board" target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity">flap.sh</a> tokens. Or list your own token and open a new market.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Button size="lg" className="w-full sm:w-auto text-base px-8" asChild data-testid="button-cta-launch">
              <Link href="/dashboard#futures">
                Launch Trading App
                <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="w-full sm:w-auto text-base px-8 glass-button" asChild data-testid="button-cta-flap">
              <a href="https://flap.sh/bnb/board" target="_blank" rel="noopener noreferrer">
                Visit flap.sh
              </a>
            </Button>
          </div>
        </Card>
      </div>
    </section>
  );
}

const FOOTER_PLATFORM = [
  { label: "Trading Board",   href: "/dashboard#perps" },
  { label: "List Your Token", href: "/dashboard#apply" },
  { label: "Dev Dashboard",   href: "/dev88" },
  { label: "Whitepaper",      href: "/whitepaper" },
];

const FOOTER_RESOURCES = [
  { label: "Smart Contracts", href: "https://bscscan.com/address/0xb86D9ae5321A2006788Ea5844C30064C57bE34CE", external: true },
  { label: "API Reference",   href: "/whitepaper#architecture" },
  { label: "Bug Bounty",      href: "https://github.com/flapfutures/Flap-Futures-Web-App/issues", external: true },
  { label: "GitHub",          href: "https://github.com/flapfutures/Flap-Futures-Web-App", external: true },
];

const FOOTER_LEGAL = [
  { label: "Terms of Service", href: "/terms" },
  { label: "Privacy Policy",   href: "/privacy" },
  { label: "Risk Disclosure",  href: "/risk" },
  { label: "Cookie Policy",    href: "/cookies" },
];

function Footer() {
  return (
    <footer className="border-t border-border/30 py-12 sm:py-16" data-testid="footer">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-10 mb-10 sm:mb-12">
          <div>
            <Link href="/" className="flex items-center gap-2 mb-4" data-testid="link-footer-logo">
              <img src={logoImg} alt="FLAP FUTURES" className="w-8 h-8" />
              <span className="font-heading font-bold text-lg text-white">
                FLAP <span className="text-gradient">FUTURES</span>
              </span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4" data-testid="text-footer-desc">
              Decentralized perpetual trading infrastructure for every token on <a href="https://flap.sh/bnb/board" target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity">flap.sh</a>.
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <a href="#" aria-label="Telegram" className="w-9 h-9 rounded-md bg-secondary flex items-center justify-center text-muted-foreground hover-elevate" data-testid="link-footer-telegram">
                <SiTelegram className="w-4 h-4" />
              </a>
              <a href="#" aria-label="X (Twitter)" className="w-9 h-9 rounded-md bg-secondary flex items-center justify-center text-muted-foreground hover-elevate" data-testid="link-footer-x">
                <SiX className="w-4 h-4" />
              </a>
              <a href="#" aria-label="Discord" className="w-9 h-9 rounded-md bg-secondary flex items-center justify-center text-muted-foreground hover-elevate" data-testid="link-footer-discord">
                <SiDiscord className="w-4 h-4" />
              </a>
              <a href="https://github.com/flapfutures/Flap-Futures-Web-App" target="_blank" rel="noopener noreferrer" aria-label="GitHub" className="w-9 h-9 rounded-md bg-secondary flex items-center justify-center text-muted-foreground hover-elevate" data-testid="link-footer-github">
                <SiGithub className="w-4 h-4" />
              </a>
            </div>
          </div>

          <div>
            <h4 className="font-heading font-semibold text-sm text-white mb-4">Platform</h4>
            <ul className="space-y-3">
              {FOOTER_PLATFORM.map(({ label, href }) => (
                <li key={label}>
                  <Link href={href} className="text-sm text-muted-foreground hover:text-white transition-colors" data-testid={`link-footer-${label.toLowerCase().replace(/\s/g, "-")}`}>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-heading font-semibold text-sm text-white mb-4">Resources</h4>
            <ul className="space-y-3">
              {FOOTER_RESOURCES.map(({ label, href, external }) => (
                <li key={label}>
                  {external ? (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-white transition-colors" data-testid={`link-footer-${label.toLowerCase().replace(/\s/g, "-")}`}>
                      {label}
                    </a>
                  ) : (
                    <a href={href} className="text-sm text-muted-foreground hover:text-white transition-colors" data-testid={`link-footer-${label.toLowerCase().replace(/\s/g, "-")}`}>
                      {label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-heading font-semibold text-sm text-white mb-4">Legal</h4>
            <ul className="space-y-3">
              {FOOTER_LEGAL.map(({ label, href }) => (
                <li key={label}>
                  <a href={href} className="text-sm text-muted-foreground hover:text-white transition-colors" data-testid={`link-footer-${label.toLowerCase().replace(/\s/g, "-")}`}>
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-border/30 pt-6 sm:pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground" data-testid="text-copyright">
            © 2026 FLAP FUTURES. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground text-center sm:text-right" data-testid="text-disclaimer">
            Trading involves significant risk. This is not financial advice.
          </p>
        </div>
      </div>
    </footer>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen">
      <div className="fixed inset-0 pointer-events-none blob-bg-overlay" style={{ zIndex: 0 }} />
      <div className="blob blob-1" />
      <div className="blob blob-2" />
      <div className="blob blob-3" />
      <Header />
      <MobileSidebar />
      <HeroSection />
      <BaitSection />
      <AboutSection />
      <WhoIsItForSection />
      <UseCaseSection />
      <MarketStatusSection />
      <FairTradeSection />
      <HowItWorksSection />
      <EcosystemSection />
      <ContractsSection />
      <FeeSection />
      <FlexParamsSection />
      <DepositWithdrawSection />
      <SecuritySection />
      <TradingBoardSection />
      <WhyFlapSection />
      <ListTokenSection />
      <CTASection />
      <Footer />
    </div>
  );
}
