import { metricGroupInfo } from "@/lib/metricGroups";
import { MetricExplanationSheet } from "@/components/MetricExplanationSheet";

/**
 * The two-column metric comparison used on the game pages.
 *
 * Reproduces the layout DailyGame uses — company A beside company B, rows
 * paired by metric and banded by group (The Long Game → Game-Day Setup). The
 * first attempt at practice metrics copied the ARCHIVE page's flat table
 * instead, which stacks every metric in one column: labels wrapped over three
 * lines, the value column collapsed to nothing, and long values overflowed the
 * card. Side by side is the whole point — you are comparing two companies.
 *
 * DailyGame deliberately still has its own copy of this markup. Handover §27
 * records that the research metrics layout "was rebuilt multiple times and is
 * correct and stable", and the live game page is auth-gated behind a
 * production-only Clerk key, so it cannot be verified locally after a refactor.
 * Extracting it there is worth doing when it can actually be checked; until
 * then the risk of silently breaking the live game outweighs the duplication.
 */

export type MetricPair = [label: string, value: string];

interface Props {
  metrics: MetricPair[];
  tickerA: string;
  tickerB: string;
  companyAName: string;
  companyBName: string;
}

const COLOR_A = "#009050";
const COLOR_B = "#1d4ed8";

/** Does this metric label belong to that ticker? Labels look like "T P/E Ratio". */
function matchesTicker(label: string, ticker: string): boolean {
  return new RegExp(`\\b${ticker}\\b`, "i").test(label);
}

/** "TMUS Market Cap" → "Market Cap"; the ticker is already the column header. */
function shortLabel(label: string, ticker: string): string {
  return label
    .replace(new RegExp(`^${ticker}\\s*[—\\-:]\\s*`, "i"), "")
    .replace(new RegExp(`^${ticker}\\s+`, "i"), "");
}

export default function ResearchMetricsPanel({
  metrics,
  tickerA,
  tickerB,
  companyAName,
  companyBName,
}: Props) {
  if (metrics.length === 0) return null;

  let metricsA = metrics.filter(([label]) => matchesTicker(label, tickerA));
  let metricsB = metrics.filter(([label]) => matchesTicker(label, tickerB));

  // Older games may not prefix labels with the ticker. Splitting down the
  // middle keeps them readable rather than showing one empty column.
  if (metricsA.length === 0 && metricsB.length === 0) {
    const mid = Math.ceil(metrics.length / 2);
    metricsA = metrics.slice(0, mid);
    metricsB = metrics.slice(mid);
  }

  const byGroup = (a: MetricPair, b: MetricPair) =>
    metricGroupInfo(a[0]).rank - metricGroupInfo(b[0]).rank;
  metricsA = [...metricsA].sort(byGroup);
  metricsB = [...metricsB].sort(byGroup);

  const rowCount = Math.max(metricsA.length, metricsB.length);
  const rows = Array.from({ length: rowCount }, (_, i) => ({
    labelA: metricsA[i] ? shortLabel(metricsA[i][0], tickerA) : "",
    valueA: metricsA[i]?.[1] ?? "—",
    rawLabelA: metricsA[i]?.[0] ?? "",
    labelB: metricsB[i] ? shortLabel(metricsB[i][0], tickerB) : "",
    valueB: metricsB[i]?.[1] ?? "—",
    rawLabelB: metricsB[i]?.[0] ?? "",
    group: metricGroupInfo(metricsA[i]?.[0] ?? metricsB[i]?.[0] ?? ""),
  }));

  // Legacy games whose metrics all sit in one group render without bands.
  const showGroupHeaders = new Set(rows.map((r) => r.group.id)).size > 1;

  const columns = [
    { ticker: tickerA, name: companyAName, color: COLOR_A },
    { ticker: tickerB, name: companyBName, color: COLOR_B },
  ];

  return (
    <div className="mt-5">
      <p
        className="text-xs font-semibold uppercase tracking-wider mb-3"
        style={{ color: "var(--color-brand)" }}
      >
        Key Metrics
      </p>
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: "1px solid var(--color-border)", background: "var(--color-surface)" }}
      >
        <div
          className="grid grid-cols-2"
          style={{
            borderBottom: "2px solid var(--color-border)",
            background: "var(--color-surface-raised)",
          }}
        >
          {columns.map((co) => (
            <div
              key={co.ticker}
              className="px-3 py-3 flex items-center gap-2 min-w-0"
              style={{
                borderRight: co.ticker === tickerA ? "1px solid var(--color-border)" : undefined,
              }}
            >
              <span
                className="ticker-chip shrink-0"
                style={{
                  fontSize: "0.6rem",
                  background: co.color,
                  color: "#fff",
                  borderColor: co.color,
                }}
              >
                {co.ticker}
              </span>
              <span
                className="text-xs font-semibold leading-tight truncate"
                style={{ color: "var(--color-foreground)" }}
              >
                {co.name}
              </span>
            </div>
          ))}
        </div>

        {rows.map((row, i) => (
          <div key={i}>
            {showGroupHeaders && (i === 0 || rows[i - 1].group.id !== row.group.id) && (
              <div
                className="px-3 py-1.5 text-[0.625rem] font-bold uppercase tracking-widest"
                style={{
                  color: "var(--color-brand)",
                  background: "var(--color-surface-raised)",
                  borderBottom: "1px solid var(--color-border)",
                  borderTop: i > 0 ? "2px solid var(--color-border)" : undefined,
                }}
              >
                {row.group.title}
              </div>
            )}
            <div
              className="grid grid-cols-2"
              style={{
                borderBottom: i < rows.length - 1 ? "1px solid var(--color-border)" : undefined,
                background: i % 2 === 0 ? "var(--color-surface)" : "var(--color-surface-raised)",
              }}
            >
              <div
                className="px-3 py-2.5 flex flex-col gap-0.5 min-w-0"
                style={{ borderRight: "1px solid var(--color-border)" }}
              >
                <p
                  className="text-[0.625rem] font-semibold uppercase tracking-wider"
                  style={{ color: "var(--color-muted)" }}
                >
                  {row.labelA}
                </p>
                <p
                  className="text-sm font-bold font-display"
                  style={{ color: "var(--color-foreground)" }}
                >
                  {row.valueA}
                </p>
                {row.rawLabelA && <MetricExplanationSheet metricLabel={row.rawLabelA} />}
              </div>
              <div className="px-3 py-2.5 flex flex-col gap-0.5 min-w-0">
                <p
                  className="text-[0.625rem] font-semibold uppercase tracking-wider"
                  style={{ color: "var(--color-muted)" }}
                >
                  {row.labelB}
                </p>
                <p
                  className="text-sm font-bold font-display"
                  style={{ color: "var(--color-foreground)" }}
                >
                  {row.valueB}
                </p>
                {row.rawLabelB && <MetricExplanationSheet metricLabel={row.rawLabelB} />}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
