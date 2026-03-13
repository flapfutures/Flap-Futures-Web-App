import { useState, useEffect, useRef, useCallback } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  CandlestickSeries,
  AreaSeries,
  LineSeries,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from "lightweight-charts";
import { RefreshCw, Settings } from "lucide-react";

type ChartType = "area" | "candles" | "line";

export interface TradingChartProps {
  price?: number | string | null;
  priceChange24h?: number | null;
  marketCap?: number | null;
  symbol?: string | null;
  pairAddress?: string | null;
}

interface OHLCVItem {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function fmtMcap(n: number | null | undefined): string {
  if (!n || n === 0) return "—";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000)     return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)         return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

const TIMEFRAMES = ["1m", "5m", "15m", "1H", "4H", "1D", "1W"] as const;

export function TradingChart({
  price,
  priceChange24h,
  marketCap,
  symbol,
  pairAddress,
}: TradingChartProps = {}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<IChartApi | null>(null);
  const mainRef      = useRef<ISeriesApi<any> | null>(null);
  const volRef       = useRef<ISeriesApi<"Histogram"> | null>(null);
  const priceRef     = useRef(price);

  const [chartType, setChartType]           = useState<ChartType>("area");
  const [activeTimeframe, setActiveTimeframe] = useState("15m");
  const [stripView, setStripView]           = useState<"price" | "mcap">("price");
  const [candles, setCandles]               = useState<OHLCVItem[]>([]);
  const [loading, setLoading]               = useState(false);

  const changeUp = (priceChange24h ?? 0) >= 0;

  const priceFormatter = useCallback(
    (p: number) => {
      if (stripView === "mcap") return fmtMcap(p).replace("$", "");
      if (p < 0.000001) return p.toFixed(10);
      if (p < 0.0001)   return p.toFixed(8);
      if (p < 0.01)     return p.toFixed(6);
      if (p < 1)        return p.toFixed(4);
      return p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },
    [stripView],
  );

  // Create chart once
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;

    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "rgba(255,255,255,0.45)",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.08)",
        textColor: "rgba(255,255,255,0.45)",
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.08)",
        textColor: "rgba(255,255,255,0.45)",
        timeVisible: true,
        secondsVisible: false,
        fixLeftEdge: true,
        fixRightEdge: false,
        minBarSpacing: 0.5,
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { mouseWheel: true, pinch: true },
      localization: { priceFormatter },
    });

    chartRef.current = chart;

    const ro = new ResizeObserver(() => {
      if (el) chart.applyOptions({ width: el.offsetWidth, height: el.offsetHeight });
    });
    ro.observe(el);
    chart.applyOptions({ width: el.offsetWidth, height: el.offsetHeight });

    return () => { ro.disconnect(); chart.remove(); chartRef.current = null; };
  }, []);

  // Sync formatter when stripView changes
  useEffect(() => {
    chartRef.current?.applyOptions({ localization: { priceFormatter } });
  }, [priceFormatter]);

  // Keep price ref in sync without triggering re-fetches
  priceRef.current = price;

  // Fetch OHLCV data
  useEffect(() => {
    setCandles([]);
    if (!pairAddress) return;
    setLoading(true);
    const p    = priceRef.current;
    const hint = p != null && Number(p) > 0 ? `&priceHint=${Number(p)}` : "";
    let cancelled = false;
    fetch(`/api/spot/ohlcv/${pairAddress}?tf=${activeTimeframe}${hint}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const raw: OHLCVItem[] = d.candles ?? [];
        const seen = new Set<number>();
        const deduped = raw
          .sort((a, b) => a.time - b.time)
          .filter((c) => { if (seen.has(c.time)) return false; seen.add(c.time); return true; });
        setCandles(deduped);
      })
      .catch(() => { if (!cancelled) setCandles([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [pairAddress, activeTimeframe]);

  // Render candles into chart
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    if (mainRef.current) { chart.removeSeries(mainRef.current); mainRef.current = null; }
    if (volRef.current)  { chart.removeSeries(volRef.current);  volRef.current  = null; }

    if (!candles.length) return;

    const scale =
      stripView === "mcap" && marketCap && price && Number(price) > 0
        ? marketCap / Number(price)
        : 1;

    const scaled = candles.map((c) => ({
      ...c,
      open: c.open * scale, close: c.close * scale,
      high: c.high * scale, low:   c.low   * scale,
    }));

    if (chartType === "candles") {
      const s = chart.addSeries(CandlestickSeries, {
        upColor: "#22c55e", downColor: "#ef4444",
        borderUpColor: "#22c55e", borderDownColor: "#ef4444",
        wickUpColor: "#22c55e",   wickDownColor: "#ef4444",
      });
      s.setData(scaled.map((c) => ({ time: c.time as Time, open: c.open, high: c.high, low: c.low, close: c.close })));
      mainRef.current = s;
    } else if (chartType === "line") {
      const s = chart.addSeries(LineSeries, { color: "#7a33fa", lineWidth: 2 });
      s.setData(scaled.map((c) => ({ time: c.time as Time, value: c.close })));
      mainRef.current = s;
    } else {
      const s = chart.addSeries(AreaSeries, {
        lineColor: "#7a33fa", topColor: "rgba(122,51,250,0.35)",
        bottomColor: "rgba(122,51,250,0.01)", lineWidth: 2,
      });
      s.setData(scaled.map((c) => ({ time: c.time as Time, value: c.close })));
      mainRef.current = s;
    }

    const vs = chart.addSeries(HistogramSeries, {
      priceScaleId: "vol", priceFormat: { type: "volume" },
      color: "rgba(122,51,250,0.25)",
    });
    vs.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 }, borderVisible: false });
    vs.setData(candles.map((c) => ({
      time: c.time as Time, value: c.volume,
      color: c.close >= c.open ? "rgba(34,197,94,0.28)" : "rgba(239,68,68,0.28)",
    })));
    volRef.current = vs;

    chart.timeScale().fitContent();
  }, [candles, chartType, stripView, marketCap, price]);

  const reload = useCallback(() => {
    setCandles([]);
    setLoading(true);
    if (!pairAddress) return;
    const p    = priceRef.current;
    const hint = p != null && Number(p) > 0 ? `&priceHint=${Number(p)}` : "";
    fetch(`/api/spot/ohlcv/${pairAddress}?tf=${activeTimeframe}${hint}`)
      .then((r) => r.json())
      .then((d) => {
        const raw: OHLCVItem[] = d.candles ?? [];
        const seen = new Set<number>();
        setCandles(raw.sort((a, b) => a.time - b.time).filter((c) => {
          if (seen.has(c.time)) return false; seen.add(c.time); return true;
        }));
      })
      .catch(() => setCandles([]))
      .finally(() => setLoading(false));
  }, [pairAddress, activeTimeframe]);

  return (
    <div className="w-full h-full flex flex-col" data-testid="chart-container">

      {/* Toolbar */}
      <div className="flex items-center px-2 py-1.5 border-b border-border/20 gap-2 shrink-0 overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => setActiveTimeframe(tf)}
              className={`px-2 py-1 text-[10px] font-mono rounded transition-colors flex-shrink-0 ${
                tf === activeTimeframe ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
        <div className="w-px h-4 bg-border/30 flex-shrink-0" />

        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Chart type */}
          <div className="flex items-center gap-0.5 bg-muted/30 rounded p-0.5 flex-shrink-0">
            <button
              onClick={() => setChartType("area")}
              title="Area"
              className={`px-1.5 py-1 text-[10px] font-mono rounded transition-colors flex items-center gap-1 ${chartType === "area" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              <svg width="12" height="10" viewBox="0 0 12 10" fill="none" className="shrink-0">
                <path d="M0 9 L2 5 L4 6 L6 3 L8 4 L10 1 L12 2 L12 9 Z" fill="currentColor" opacity="0.4"/>
                <path d="M0 9 L2 5 L4 6 L6 3 L8 4 L10 1 L12 2" stroke="currentColor" strokeWidth="1.2" fill="none"/>
              </svg>
              <span className="hidden sm:inline">Area</span>
            </button>
            <button
              onClick={() => setChartType("candles")}
              title="Candles"
              className={`px-1.5 py-1 text-[10px] font-mono rounded transition-colors flex items-center gap-1 ${chartType === "candles" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              <svg width="12" height="10" viewBox="0 0 12 10" fill="none" className="shrink-0">
                <rect x="1" y="3" width="2" height="5" fill="currentColor"/>
                <line x1="2" y1="1" x2="2" y2="3" stroke="currentColor" strokeWidth="1"/>
                <line x1="2" y1="8" x2="2" y2="10" stroke="currentColor" strokeWidth="1"/>
                <rect x="5" y="1" width="2" height="4" fill="currentColor" opacity="0.5"/>
                <line x1="6" y1="0" x2="6" y2="1" stroke="currentColor" strokeWidth="1"/>
                <line x1="6" y1="5" x2="6" y2="7" stroke="currentColor" strokeWidth="1"/>
                <rect x="9" y="2" width="2" height="5" fill="currentColor"/>
                <line x1="10" y1="0" x2="10" y2="2" stroke="currentColor" strokeWidth="1"/>
                <line x1="10" y1="7" x2="10" y2="9" stroke="currentColor" strokeWidth="1"/>
              </svg>
              <span className="hidden sm:inline">Candles</span>
            </button>
            <button
              onClick={() => setChartType("line")}
              title="Line"
              className={`px-1.5 py-1 text-[10px] font-mono rounded transition-colors flex items-center gap-1 ${chartType === "line" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              <svg width="12" height="10" viewBox="0 0 12 10" fill="none" className="shrink-0">
                <path d="M0 8 L3 5 L5 6 L7 3 L9 4 L12 1" stroke="currentColor" strokeWidth="1.5" fill="none"/>
              </svg>
              <span className="hidden sm:inline">Line</span>
            </button>
          </div>

          {/* Price / MCap toggle */}
          <div className="flex items-center rounded overflow-hidden border border-border/20">
            <button
              onClick={() => setStripView("price")}
              className="px-2 py-1 text-[9px] font-mono font-semibold transition-colors"
              style={{
                background: stripView === "price" ? "rgba(122,51,250,0.35)" : "transparent",
                color: stripView === "price" ? "#fff" : "rgba(255,255,255,0.35)",
              }}
            >
              Price
            </button>
            <button
              onClick={() => setStripView("mcap")}
              className="px-2 py-1 text-[9px] font-mono font-semibold transition-colors"
              style={{
                background: stripView === "mcap" ? "rgba(122,51,250,0.35)" : "transparent",
                color: stripView === "mcap" ? "#fff" : "rgba(255,255,255,0.35)",
              }}
            >
              MCap
            </button>
          </div>

          <button
            onClick={reload}
            title="Reload chart"
            className="p-1.5 rounded text-muted-foreground hover:text-white transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button className="p-1.5 rounded text-muted-foreground hover:text-white transition-colors">
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Chart canvas */}
      <div className="flex-1 relative min-h-0">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <span className="text-xs text-muted-foreground font-mono animate-pulse">Loading chart…</span>
          </div>
        )}
        {!loading && !candles.length && pairAddress && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10 gap-3">
            <span className="text-xs text-muted-foreground font-mono">No chart data</span>
            <button
              onClick={reload}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono border border-border/30 hover:border-primary/40 hover:bg-primary/10 text-muted-foreground hover:text-white transition-colors"
            >
              <RefreshCw className="w-3 h-3" /> Retry
            </button>
          </div>
        )}
        {!pairAddress && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <span className="text-xs text-muted-foreground font-mono">Select a token to view chart</span>
          </div>
        )}
        <div ref={containerRef} className="w-full h-full" />
      </div>
    </div>
  );
}
