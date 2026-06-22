import { useEffect, useRef, useState } from "react";
import { createChart, ColorType, CandlestickSeries, type Time } from "lightweight-charts";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

    const container = chartContainerRef.current;

    // Chart factory — called once we know the real container width.
    const buildChart = (w: number) => {
      const isDark = document.documentElement.classList.contains("dark");
      const bg = isDark ? "#0f172a" : "#ffffff";
      const textColor = isDark ? "#94a3b8" : "#64748b";
      const gridColor = isDark ? "#1e293b" : "#f1f5f9";

      const chart = createChart(container, {
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
        width: w,
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

      // Keep chart in sync with future container width changes (e.g. orientation change)
      const ro = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (entry) {
          const newW = entry.contentRect.width;
          if (newW > 0) chart.applyOptions({ width: newW });
        }
      });
      ro.observe(container);

      const handleResize = () => {
        if (container.clientWidth > 0) {
          chart.applyOptions({ width: container.clientWidth });
        }
      };
      window.addEventListener("resize", handleResize);

      return () => {
        ro.disconnect();
        window.removeEventListener("resize", handleResize);
        chart.remove();
      };
    };

    // If the container already has a real width (e.g. inline chart, first company),
    // build immediately. Otherwise attach a ResizeObserver that fires as soon as
    // the Drawer animation settles and the container gets its first non-zero width.
    // This is more reliable than a single rAF which can fire mid-animation.
    if (container.clientWidth > 0) {
      return buildChart(container.clientWidth);
    }

    let cleanup: (() => void) | undefined;
    let built = false;

    const waitRo = new ResizeObserver((entries) => {
      if (built) return;
      const w = entries[0]?.contentRect.width ?? 0;
      if (w > 0) {
        built = true;
        waitRo.disconnect();
        cleanup = buildChart(w);
      }
    });
    waitRo.observe(container);

    // Safety fallback: if the ResizeObserver never fires (e.g. hidden tab),
    // try again after 300 ms (enough for any CSS transition to complete).
    const fallbackTimer = setTimeout(() => {
      if (built) return;
      built = true;
      waitRo.disconnect();
      const w = container.clientWidth > 0 ? container.clientWidth : 320;
      cleanup = buildChart(w);
    }, 300);

    return () => {
      clearTimeout(fallbackTimer);
      waitRo.disconnect();
      cleanup?.();
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
        {/* Range selector — dropdown to avoid overflow on mobile */}
        <Select value={range} onValueChange={(v) => setRange(v as Range)}>
          <SelectTrigger className="h-7 w-20 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RANGES.map((r) => (
              <SelectItem key={r.value} value={r.value} className="text-xs">
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
