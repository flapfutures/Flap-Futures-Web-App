import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { TrendingUp, Rocket, LayoutDashboard, Zap, PanelLeftClose, PanelLeftOpen, Home, User, Menu } from "lucide-react";
import { useWalletContext } from "@/components/WalletProvider";
import { ConnectWallet } from "@/components/ConnectWallet";
import logoImg from "@assets/flapfutureslogo_nobg.png";
import Perps from "./perps";
import Apply from "./apply";
import Dashboard from "./dashboard";
import MarketDetail from "./market-detail";
import Admin from "./admin";
import Spot from "./spot";
import MyProfile from "./my-profile";


type Section = "futures" | "spot" | "apply" | "markets" | "market" | "admin" | "profile";

function parseHash(raw: string): { section: Section; id: string | null } {
  const h = raw.replace(/^#/, "");
  if (h.startsWith("market-"))  return { section: "market",  id: h.slice(7) };
  if (h.startsWith("admin-"))   return { section: "admin",   id: h.slice(6) };
  if (h.startsWith("futures/")) return { section: "futures", id: h.slice(8) };
  if (h === "apply")   return { section: "apply",   id: null };
  if (h === "markets") return { section: "markets", id: null };
  if (h === "spot")    return { section: "spot",    id: null };
  if (h === "profile") return { section: "profile", id: null };
  return { section: "futures", id: null };
}

const SECTION_LABELS: Record<Section, string> = {
  futures: "Futures",
  spot:    "Spot",
  apply:   "Launch Market",
  markets: "My Markets",
  market:  "Market",
  admin:   "Admin",
  profile: "My Profile",
};

export default function DashboardShell() {
  const [hash, setHash]               = useState(window.location.hash || "#futures");
  const [marketCount, setMarketCount] = useState<number | null>(null);
  const { address }                   = useWalletContext();


  const isMobile = () => window.innerWidth < 768;
  const [open, setOpen]         = useState(!isMobile());
  const [mobile, setMobile]     = useState(isMobile());

  const { section, id } = parseHash(hash);
  const isMarketCreator = (marketCount ?? 0) > 0;

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash || "#futures");
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    const onResize = () => {
      const m = window.innerWidth < 768;
      setMobile(m);
      if (!m) setOpen(true);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!address) { setMarketCount(0); return; }
    fetch("/api/markets/mine", { credentials: "include" })
      .then(r => r.json())
      .then(data => setMarketCount(Array.isArray(data) ? data.length : 0))
      .catch(() => setMarketCount(0));
  }, [address, section]);

  const navigate = useCallback((hash: string) => {
    window.location.hash = hash;
    if (mobile) setOpen(false);
  }, [mobile]);

  const NAV = [
    { id: "futures", label: "Futures",               icon: TrendingUp,      walletRequired: false, creatorOnly: false },
    { id: "spot",    label: "Spot",                  icon: Zap,             walletRequired: false, creatorOnly: false },
    { id: "profile", label: "My Profile",            icon: User,            walletRequired: true,  creatorOnly: false },
    { id: "apply",   label: "Launch Market (FLAP)",  icon: Rocket,          walletRequired: true,  creatorOnly: false },
    { id: "markets", label: "My Markets",            icon: LayoutDashboard, walletRequired: true,  creatorOnly: true  },
    { id: "bsc",     label: "Launch Market (BSC)",   icon: Rocket,          walletRequired: false, creatorOnly: false, comingSoon: true },
  ];

  const isActive = (itemId: string) => {
    if (itemId === "markets") return section === "markets" || section === "market";
    if (itemId === "admin")   return section === "admin";
    return section === itemId;
  };

  function navDisabled(item: typeof NAV[number]) {
    if ((item as any).comingSoon)             return "soon";
    if (item.walletRequired && !address)      return "wallet";
    if (item.creatorOnly && !isMarketCreator) return "creator";
    return false;
  }

  function navTitle(item: typeof NAV[number]) {
    const reason = navDisabled(item);
    if (reason === "soon")    return "Coming soon";
    if (reason === "wallet")  return `Connect wallet to access`;
    if (reason === "creator") return "Only available to market creators";
    return !open ? item.label : undefined;
  }

  function navBadge(item: typeof NAV[number]) {
    const reason = navDisabled(item);
    if (reason === "soon")    return "SOON";
    if (reason === "wallet")  return "CONN";
    if (reason === "creator") return "PRO";
    return null;
  }

  const mobileSidebarW = Math.min(260, window.innerWidth * 0.82);
  const sidebarW = open ? (mobile ? mobileSidebarW : 260) : (mobile ? 0 : 52);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#0a0614" }}>

      {/* ── Mobile backdrop ─────────────────────────────────────────────── */}
      {mobile && open && (
        <div
          className="fixed inset-0 bg-black/70"
          style={{ zIndex: 9998 }}
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside
        className="flex-shrink-0 h-screen flex flex-col"
        style={{
          width: sidebarW,
          minWidth: sidebarW,
          position: mobile ? "fixed" : "relative",
          top: 0,
          left: 0,
          zIndex: mobile ? 9999 : "auto",
          height: "100vh",
          transition: "width 200ms ease, min-width 200ms ease",
          borderRight: "1px solid rgba(255,255,255,0.05)",
          background: "rgba(10,6,20,0.98)",
          overflow: "hidden",
        }}
      >
        {/* Brand / toggle */}
        <div
          className="flex items-center h-[52px] flex-shrink-0"
          style={{
            borderBottom: "1px solid rgba(255,255,255,0.05)",
            padding: open ? "0 12px 0 16px" : "0",
            justifyContent: open ? "space-between" : "center",
          }}
        >
          {open && (
            <Link href="/" className="flex items-center gap-2 min-w-0">
              <img src={logoImg} alt="Flap Futures" className="h-6 w-auto flex-shrink-0" />
              <span className="text-white font-bold text-sm whitespace-nowrap">
                FLAP <span style={{ color: "#7a33fa" }}>FUTURES</span>
              </span>
            </Link>
          )}
          <button
            onClick={() => setOpen(!open)}
            className="flex-shrink-0 flex items-center justify-center rounded-lg transition-colors"
            style={{ width: 28, height: 28, color: "rgba(255,255,255,0.35)", background: "transparent" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.8)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.35)"; }}
            title={open ? "Collapse sidebar" : "Expand sidebar"}
          >
            {open ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-1.5 space-y-0.5 overflow-hidden">
          <Link href="/" onClick={() => { if (mobile) setOpen(false); }}>
            <div
              className="w-full flex items-center rounded-lg font-medium transition-colors cursor-pointer"
              style={{
                gap: open ? 12 : 0,
                padding: open ? "10px 12px" : "10px 0",
                justifyContent: open ? "flex-start" : "center",
                fontSize: 13,
                background: "transparent",
                color: "rgba(255,255,255,0.4)",
              }}
              title={!open ? "Home" : undefined}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.8)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.4)"; }}
            >
              <Home className="w-4 h-4 flex-shrink-0" />
              {open && <span className="whitespace-nowrap overflow-hidden">Home</span>}
            </div>
          </Link>

          <div style={{ height: 1, background: "rgba(255,255,255,0.04)", margin: "4px 8px" }} />

          {NAV.map(item => {
            const Icon     = item.icon;
            const active   = isActive(item.id);
            const disabled = !!navDisabled(item);
            const badge    = navBadge(item);
            return (
              <button
                key={item.id}
                onClick={() => { if (!disabled) navigate(item.id); }}
                title={navTitle(item)}
                disabled={disabled}
                className="w-full flex items-center rounded-lg font-medium text-left"
                style={{
                  gap: open ? 12 : 0,
                  padding: open ? "10px 12px" : "10px 0",
                  justifyContent: open ? "flex-start" : "center",
                  fontSize: 13,
                  background: active ? "rgba(122,51,250,0.18)" : "transparent",
                  color: disabled ? "rgba(255,255,255,0.18)" : active ? "#ffffff" : "rgba(255,255,255,0.4)",
                  cursor: disabled ? "not-allowed" : "pointer",
                }}
                onMouseEnter={e => { if (!active && !disabled) { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.8)"; }}}
                onMouseLeave={e => { if (!active && !disabled) { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.4)"; }}}
              >
                <Icon className="w-4 h-4 flex-shrink-0" style={{ color: disabled ? "rgba(255,255,255,0.18)" : active ? "#7a33fa" : "inherit" }} />
                {open && (
                  <>
                    <span className="whitespace-nowrap overflow-hidden flex-1 truncate" style={{ fontSize: 13 }}>
                      {item.label}
                    </span>
                    {badge && (
                      <span className="flex-shrink-0" style={{ fontSize: 8, color: "rgba(255,255,255,0.28)", background: "rgba(255,255,255,0.06)", padding: "1px 5px", borderRadius: 4, letterSpacing: "0.06em" }}>
                        {badge}
                      </span>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="flex-shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.05)", padding: "10px 0", display: "flex", justifyContent: "center" }}>
          {open
            ? <div style={{ color: "rgba(255,255,255,0.15)", fontSize: "10px", textAlign: "center" }}>BSC BEP-20 · On-chain Perps</div>
            : <div style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(122,51,250,0.4)" }} />
          }
        </div>
      </aside>

      {/* ── Main column ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden min-w-0">

        {/* Header */}
        <header
          className="flex-shrink-0 flex items-center justify-between gap-2"
          style={{
            height: 52,
            borderBottom: "1px solid rgba(255,255,255,0.05)",
            background: "rgba(10,6,20,0.9)",
            backdropFilter: "blur(12px)",
            padding: "0 12px 0 16px",
          }}
        >
          <div className="flex items-center gap-2 min-w-0">
            {/* Hamburger on mobile */}
            {mobile && (
              <button
                onClick={() => setOpen(true)}
                className="flex-shrink-0 flex items-center justify-center rounded-lg"
                style={{ width: 32, height: 32, color: "rgba(255,255,255,0.5)", background: "transparent" }}
              >
                <Menu className="w-4 h-4" />
              </button>
            )}
            <div className="flex items-center gap-1.5 min-w-0 truncate">
              <span className="hidden sm:inline text-white/30 text-xs flex-shrink-0">Dashboard</span>
              <span className="hidden sm:inline text-white/15 text-xs flex-shrink-0">/</span>
              <span className="text-white/85 text-xs font-medium truncate">{SECTION_LABELS[section]}</span>
            </div>
          </div>
          <div className="flex-shrink-0">
            <ConnectWallet />
          </div>
        </header>

        {/* Page content */}
        <main
          className="flex-1 overflow-hidden min-w-0"
          style={{ background: "radial-gradient(ellipse at top, rgba(122,51,250,0.08) 0%, transparent 60%)" }}
        >
          {section === "futures" && <Perps embedded initialToken={id} />}

          {section === "spot" && (
            <div className="h-full overflow-hidden">
              <Spot embedded />
            </div>
          )}

          {section === "profile" && (
            <div className="h-full overflow-y-auto">
              <MyProfile embedded />
            </div>
          )}

          {section === "apply" && (
            <div className="h-full overflow-y-auto">
              <Apply embedded />
            </div>
          )}

          {section === "markets" && (
            <div className="h-full overflow-y-auto">
              <Dashboard embedded />
            </div>
          )}

          {section === "market" && id && (
            <div className="h-full overflow-y-auto">
              <MarketDetail embedded embeddedId={id} />
            </div>
          )}

          {section === "admin" && id && (
            <div className="h-full overflow-y-auto">
              <Admin embedded embeddedTokenId={id} />
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
