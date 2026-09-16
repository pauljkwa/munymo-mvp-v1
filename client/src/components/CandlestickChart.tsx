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
  /**
   * Archived daily candles. When supplied the live query is skipped entirely
   * and these are rendered instead — used by practice, where fetching live
   * prices would show today's market rather than the game's, and would reveal
   * the outcome the player is being asked to predict.
   */
  archivedCandles?: Candle[];
}

export type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number | null;
};

/**
 * Intraday ranges are unavailable for archived data: the stored series is
 * daily, and a 5-minute or hourly view of the game day would BE the result.
 */
const ARCHIVED_RANGES: Range[] = ["1mo", "3mo", "6mo", "1y"];

/** Approximate trading days per range, for slicing one stored daily series. */
const RANGE_DAYS: Record<Range, number> = {
  "1d": 1,
  "5d": 5,
  "1mo": 22,
  "3mo": 65,
  "6mo": 130,
  "1y": 260,
};

export function CandlestickChart({
  ticker,
  companyName,
  accentColor = "#009050",
  archivedCandles,
}: CandlestickChartProps) {
  const isArchived = Array.isArray(archivedCandles);
  const [range, setRange] = useState<Range>("1mo");
  const chartContainerRef = useRef<HTMLDivElement>(null);

  const live = trpc.streaks.getStockChart.useQuery(
    { ticker, range },
    { staleTime: 5 * 60 * 1000, enabled: !isArchived } // cache 5 min; skipped for archived
  );

  // Slice the stored daily series to the selected range rather than refetching.
  const archivedSlice = isArchived
    ? archivedCandles!.slice(-(RANGE_DAYS[range] ?? 22))
    : [];
  const data = isArchived
    ? {
        candles: archivedSlice,
        // The last archived close is the PRIOR day's close — what a live player
        // saw when picking. Not a leak: it predates the game day entirely.
        meta: archivedSlice.length
          ? {
              currency: "USD",
              regularMarketPrice: archivedSlice[archivedSlice.length - 1].close,
            }
          : undefined,
      }
    : live.data;
  const isLoading = isArchived ? false : live.isLoading;
  const error = isArchived ? null : live.error;

  const rangeOptions = isArchived
    ? RANGES.filter((r) => ARCHIVED_RANGES.includes(r.value))
    : RANGES;

  useEffect(() => {
    if (!chartContainerRef.current || !data?.candles?.length) return;

    const container = chartContainerRef.current;

    const isDark = document.documentElement.classList.contains("dark");
    const bg = isDark ? "#0f172a" : "#ffffff";
    const textColor = isDark ? "#94a3b8" : "#64748b";
    const gridColor = isDark ? "#1e293b" : "#f1f5f9";

    // Use actual container width, falling back to a sensible default if not yet laid out
    const initialWidth = container.clientWidth > 0 ? container.clientWidth : 320;

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
      width: initialWidth,
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

    // ResizeObserver keeps chart in sync with container width changes (grid layout, orientation)
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const w = entry.contentRect.width;
        if (w > 0) chart.applyOptions({ width: w });
      }
    });
    ro.observe(container);

    // Also handle window resize as a fallback
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
            {rangeOptions.map((r) => (
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
