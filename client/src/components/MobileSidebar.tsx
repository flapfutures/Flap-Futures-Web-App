import { useState } from "react";
import { X, BarChart3, Zap, Globe, Shield } from "lucide-react";
import { SiTelegram, SiX } from "react-icons/si";

function TwoSquaresIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1.5" y="1.5" width="9" height="9" rx="2.5" stroke="#d5f704" strokeWidth="2"/>
      <rect x="11.5" y="11.5" width="9" height="9" rx="2.5" stroke="#7a33fa" strokeWidth="2"/>
    </svg>
  );
}

const navLinks = [
  { label: "How It Works", href: "#how-it-works", icon: Zap },
  { label: "Ecosystem",    href: "#ecosystem",    icon: Globe },
  { label: "Markets",      href: "#trading",      icon: BarChart3 },
  { label: "Why Us",       href: "#why",           icon: Shield },
];

const quickLinks = [
  { label: "Telegram", href: "https://t.me/", icon: SiTelegram },
  { label: "Twitter",  href: "https://x.com/", icon: SiX },
];

export default function MobileSidebar() {
  const [open, setOpen] = useState(false);

  const close = () => setOpen(false);

  return (
    <div className="lg:hidden">
      {open && (
        <div
          className="fixed inset-0"
          style={{ background: "rgba(0,0,0,0.45)", zIndex: 55 }}
          onClick={close}
        />
      )}

      <div
        className="fixed left-0 top-0 h-full transition-transform duration-400 ease-in-out"
        style={{
          zIndex: 60,
          width: 280,
          transform: open ? "translateX(0)" : "translateX(-100%)",
          borderTopRightRadius: "50vh",
          borderBottomRightRadius: "50vh",
          background: "rgba(255, 255, 255, 0.02)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          boxShadow: open
            ? "0 0.2rem 0.4rem rgba(0,0,0,0.35), 0 -0.2rem 0.5rem rgba(0,0,0,0.15) inset, 0px -2px 12px 0px rgba(255,255,255,0.06) inset"
            : "none",
          border: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "48px 28px 48px 28px",
          overflow: "hidden",
        }}
      >

        <div className="mb-10 relative z-10">
          <span className="font-bold text-xl tracking-tight text-white">
            FLAP <span style={{ color: "#d5f704" }}>FUTURES</span>
          </span>
        </div>

        <nav className="flex flex-col gap-2 relative z-10">
          {navLinks.map((link) => {
            const Icon = link.icon;
            return (
              <a
                href={link.href}
                key={link.label}
                onClick={close}
                className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-150 cursor-pointer"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.07)",
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.background = "rgba(255,255,255,0.12)";
                  el.style.transform = "scale(1.04)";
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.background = "rgba(255,255,255,0.05)";
                  el.style.transform = "scale(1)";
                }}
              >
                <Icon className="w-4 h-4 shrink-0" style={{ color: "rgba(255,255,255,0.75)" }} />
                <span className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.92)" }}>
                  {link.label}
                </span>
              </a>
            );
          })}
        </nav>

        <div className="flex gap-3 mt-10 relative z-10">
          {quickLinks.map((q) => {
            const Icon = q.icon;
            return (
              <a
                key={q.label}
                href={q.href}
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full flex items-center justify-center transition-all duration-150"
                style={{
                  background: "rgba(255,255,255,0.1)",
                  border: "1px solid rgba(255,255,255,0.15)",
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.background = "rgba(255,255,255,0.2)";
                  el.style.transform = "scale(1.15)";
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.background = "rgba(255,255,255,0.1)";
                  el.style.transform = "scale(1)";
                }}
              >
                <Icon className="w-4 h-4 text-white" />
              </a>
            );
          })}
        </div>

        <button
          onClick={close}
          className="absolute bottom-8 left-6 z-10 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-150 active:scale-95"
          style={{
            background: "rgba(255,255,255,0.12)",
            border: "1px solid rgba(255,255,255,0.2)",
          }}
          aria-label="Close menu"
        >
          <X className="w-4 h-4 text-white" />
        </button>
      </div>

      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 active:scale-95"
          style={{
            zIndex: 45,
            background: "rgba(255, 255, 255, 0.02)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 0.2rem 0.4rem rgba(0,0,0,0.35), 0 -0.2rem 0.5rem rgba(0,0,0,0.15) inset, 0px -2px 12px 0px rgba(255,255,255,0.06) inset",
          }}
          aria-label="Open menu"
        >
          <TwoSquaresIcon />
        </button>
      )}
    </div>
  );
}
