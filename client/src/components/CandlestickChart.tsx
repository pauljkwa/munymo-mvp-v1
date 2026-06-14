import { useEffect, useRef, useState } from "react";
import { createChart, ColorType, CandlestickSeries, type Time } from "lightweight-charts";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";

type Range = "1d" | "5d" | "1mo" | "3mo" | "6mo" | "1y";

const RANGES: { label: string; value: Range }[] = [
  { label: "1D", value: "1d" },
  { label: "5D", value: "5d" },
  { label: "1M", value: "1mo" },
  { label: "3M", value: "3mo" },
  { label: "6M", value: "6mo" },
  { label: "1Y", value: "1y" },
];

interface CandlestickChartProps {
  ticker: string;
  companyName: string;
  accentColor?: string;
}

export function CandlestickChart({ ticker, companyName, accentColor = "#009050" }: CandlestickChartProps) {
  const [range, setRange] = useState<Range>("1mo");
  const chartContainerRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, error } = trpc.streaks.getStockChart.useQuery(
    { ticker, range },
    { staleTime: 5 * 60 * 1000 } // cache for 5 minutes
  );

  useEffect(() => {
    if (!chartContainerRef.current || !data?.candles?.length) return;

    const isDark = document.documentElement.classList.contains("dark");
    const bg = isDark ? "#0f172a" : "#ffffff";
    const textColor = isDark ? "#94a3b8" : "#64748b";
    const gridColor = isDark ? "#1e293b" : "#f1f5f9";

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: bg },
        textColor,
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: gridColor },
        horzLines: { color: gridColor },
      },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: gridColor },
      timeScale: {
        borderColor: gridColor,
        timeVisible: range === "1d" || range === "5d",
        secondsVisible: false,
      },
      width: chartContainerRef.current.clientWidth,
      height: 280,
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: accentColor,
      downColor: "#ef4444",
      borderUpColor: accentColor,
      borderDownColor: "#ef4444",
      wickUpColor: accentColor,
      wickDownColor: "#ef4444",
    });

    type RawCandle = { time: number; open: number | null; high: number | null; low: number | null; close: number | null; volume: number | null };
    const formattedCandles = (data.candles as RawCandle[])
      .filter((c) => c.open !== null && c.close !== null && c.high !== null && c.low !== null)
      .map((c) => ({
        time: c.time as Time,
        open: c.open as number,
        high: c.high as number,
        low: c.low as number,
        close: c.close as number,
      }));

    candleSeries.setData(formattedCandles);
    chart.timeScale().fitContent();

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [data, range, accentColor]);

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div>
          <span className="text-sm font-semibold text-foreground">{ticker}</span>
          <span className="ml-2 text-xs text-muted-foreground">{companyName}</span>
          {data?.meta?.regularMarketPrice && (
            <span className="ml-3 text-sm font-mono font-medium text-foreground">
              ${data.meta.regularMarketPrice.toFixed(2)}
            </span>
          )}
        </div>
        {/* Range selector */}
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={`px-2 py-0.5 text-xs font-medium rounded transition-colors ${
                range === r.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart area */}
      <div className="relative">
        {isLoading && (
          <div className="p-4">
            <Skeleton className="h-[280px] w-full" />
          </div>
        )}
        {error && (
          <div className="flex items-center justify-center h-[280px] text-sm text-muted-foreground">
            Unable to load chart data for {ticker}
          </div>
        )}
        {!isLoading && !error && (
          <div ref={chartContainerRef} className="w-full" />
        )}
      </div>
    </div>
  );
}
