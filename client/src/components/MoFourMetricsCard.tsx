import { ListChecks } from "lucide-react";
import MoByline from "@/components/MoByline";
import { PRICE_TREND_LABEL } from "@shared/const";
import { objectiveSideForMetric, valuesForMetric } from "@shared/metricValues";

type Notes = Record<string, string> | null | undefined;

interface Props {
  tickerA: string;
  tickerB: string;
  winner: "A" | "B" | null | undefined;
  highlightedMetrics: string[] | null | undefined;
  notes: Notes;
  debrief: Notes;
  /** The research panel as a "{TICKER} {Label}" → value record (games.getResearch). */
  metrics: Record<string, string> | null | undefined;
  /** The signed-in player's pick for this game; omit (or null) for signed-out visitors. */
  myPick?: { reasonMetric?: string | null; reasonSide?: "A" | "B" | null } | null;
  className?: string;
}

const sameLabel = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const lookup = (record: Notes, label: string): string | undefined => {
  if (!record) return undefined;
  const key = Object.keys(record).find((k) => sameLabel(k, label));
  const text = key ? record[key]?.trim() : undefined;
  return text || undefined;
};

/**
 * "Mo's Four Metrics" (results pages only): why Mo picked each highlighted
 * metric before the open, and how it played out. The notes and debrief are
 * withheld by the server until the result is published, so there is nothing to
 * render here beforehand. Renders only when the game has highlights and at
 * least one of the two objects; a missing sentence omits just that line.
 */
export default function MoFourMetricsCard({
  tickerA,
  tickerB,
  winner,
  highlightedMetrics,
  notes,
  debrief,
  metrics,
  myPick,
  className = "mb-6",
}: Props) {
  if (!highlightedMetrics || highlightedMetrics.length === 0) return null;
  const hasNotes = !!notes && Object.keys(notes).length > 0;
  const hasDebrief = !!debrief && Object.keys(debrief).length > 0;
  if (!hasNotes && !hasDebrief) return null;

  const rows = Object.entries(metrics ?? {}).map(([label, value]) => ({ label, value: String(value) }));
  const tickerFor = (side: "A" | "B") => (side === "A" ? tickerA : tickerB);

  return (
    <div className={`card-glass p-6 animate-fade-up delay-200 ${className}`}>
      <div className="flex items-center gap-2 mb-2">
        <ListChecks size={16} style={{ color: "var(--color-brand)" }} />
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-brand)" }}>
          Mo's Four Metrics
        </p>
      </div>
      <p className="text-xs mb-4" style={{ color: "var(--color-subtle)" }}>
        Mo chose these four before the open because they separated the two companies most. Here is why, and how each one held up.
      </p>

      {highlightedMetrics.map((label, i) => {
        const isChart = sameLabel(label, PRICE_TREND_LABEL);
        const { valueA, valueB } = isChart ? { valueA: undefined, valueB: undefined } : valuesForMetric(rows, label, tickerA, tickerB);
        const note = hasNotes ? lookup(notes, label) : undefined;
        const played = hasDebrief ? lookup(debrief, label) : undefined;
        const numbersFavor = isChart ? null : objectiveSideForMetric(label, valueA, valueB);
        const yourReason = !!myPick?.reasonMetric && sameLabel(myPick.reasonMetric, label);
        const reasonSide = yourReason ? myPick?.reasonSide ?? null : null;
        const reasonRight = reasonSide != null && reasonSide === winner;

        return (
          <div
            key={label}
            className={i === 0 ? "" : "pt-4 mt-4"}
            style={i === 0 ? undefined : { borderTop: "1px solid var(--color-border)" }}
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold" style={{ color: "var(--color-foreground)" }}>
                  {label}
                </p>
                {isChart ? (
                  <p className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>
                    the 20-session chart
                  </p>
                ) : valueA || valueB ? (
                  <p className="text-xs mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1" style={{ color: "var(--color-muted)" }}>
                    <span><span className="ticker-chip">{tickerA}</span> {valueA ?? "n/a"}</span>
                    <span style={{ color: "var(--color-subtle)" }}>·</span>
                    <span><span className="ticker-chip">{tickerB}</span> {valueB ?? "n/a"}</span>
                  </p>
                ) : null}
              </div>
              {(yourReason || numbersFavor) && (
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  {yourReason && (
                    <span
                      className="rounded-full px-3 py-1 text-xs font-semibold"
                      style={
                        reasonRight
                          ? { background: "var(--color-success-muted)", color: "var(--color-success)", border: "1px solid var(--color-success)" }
                          : { background: "var(--color-surface-raised)", color: "var(--color-muted)", border: "1px solid var(--color-border)" }
                      }
                    >
                      Your reason{reasonSide ? ` · you said ${tickerFor(reasonSide)}` : ""}
                    </span>
                  )}
                  {numbersFavor && (
                    <span
                      className="rounded-full px-3 py-1 text-xs font-semibold"
                      style={{ background: "var(--color-brand-muted)", color: "var(--color-brand)", border: "1px solid var(--color-brand)" }}
                    >
                      Numbers favored {tickerFor(numbersFavor)}
                    </span>
                  )}
                </div>
              )}
            </div>

            {note && (
              <p className="text-sm leading-relaxed mt-2" style={{ color: "var(--color-muted)" }}>
                <span className="text-xs font-semibold uppercase tracking-wider mr-1.5" style={{ color: "var(--color-subtle)" }}>
                  Before the open
                </span>
                {note}
              </p>
            )}
            {played && (
              <p className="text-sm leading-relaxed mt-2" style={{ color: "var(--color-foreground)" }}>
                <span className="text-xs font-semibold uppercase tracking-wider mr-1.5" style={{ color: "var(--color-subtle)" }}>
                  How it played out
                </span>
                {played}
              </p>
            )}
          </div>
        );
      })}

      <MoByline className="mt-4" />
    </div>
  );
}
