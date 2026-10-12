import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useState, useEffect, useRef } from "react";
import { Link, useRoute } from "wouter";
import PublicLayout from "@/components/PublicLayout";
import { usePageMeta } from "@/hooks/usePageMeta";
import { toast } from "sonner";
import ResearchMetricsPanel from "@/components/ResearchMetricsPanel";
import { ChartSheet } from "@/components/ChartSheet";
import { ValidationModal } from "@/components/ValidationModal";
import PerfectScoreConfetti from "@/components/PerfectScoreConfetti";
import { metricGroupInfo } from "@/lib/metricGroups";
import { MetricExplanationSheet } from "@/components/MetricExplanationSheet";
import { displayCompanyName } from "@shared/companyName";
import {
  SCORE_WEIGHTS,
  CONFIDENCE_TABLE,
  CONFIDENCE_LABELS,
  PRICE_TREND_LABEL,
  type ConfidenceLevel,
} from "@shared/const";
import { BarChart2, TrendingUp, Timer, Lightbulb } from "lucide-react";
import {
  Brain,
  BookOpen,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Trophy,
  CheckCircle2,
  XCircle,
  Dumbbell,
} from "lucide-react";

type Step = "gut" | "research" | "reason" | "final" | "done";

const CONFIDENCE_LEVELS: ConfidenceLevel[] = ["tossup", "leaning", "confident"];

/** Points shown on a confidence button: "{if right} / {if wrong}". */
const confidencePoints = (level: ConfidenceLevel) => {
  const [ifRight, ifWrong] = CONFIDENCE_TABLE[level];
  return `${Math.round(SCORE_WEIGHTS.conf * ifRight)} / ${Math.round(SCORE_WEIGHTS.conf * ifWrong)}`;
};

const sameLabel = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Both companies' values for each highlighted metric (same idiom as DailyGame).
 * Metric keys are prefixed with the ticker; strip it to match Mo's labels.
 * "Price trend" has no values: the player reads the chart.
 */
function highlightedValues(
  metrics: Record<string, string>,
  highlighted: string[],
  tickerA: string,
  tickerB: string
): { label: string; valueA: string | null; valueB: string | null }[] {
  const strip = (label: string, ticker: string) => {
    const m = label.match(new RegExp(`^${ticker}\\s*(?:[—\\-:]\\s*)?(.+)$`, "i"));
    return m ? m[1] : null;
  };
  const a = new Map<string, string>();
  const b = new Map<string, string>();
  for (const [key, value] of Object.entries(metrics)) {
    const sa = strip(key, tickerA);
    const sb = strip(key, tickerB);
    if (sa) a.set(sa.trim().toLowerCase(), value);
    else if (sb) b.set(sb.trim().toLowerCase(), value);
  }
  return highlighted.map((label) =>
    sameLabel(label, PRICE_TREND_LABEL)
      ? { label, valueA: null, valueB: null }
      : {
          label,
          valueA: a.get(label.trim().toLowerCase()) ?? "—",
          valueB: b.get(label.trim().toLowerCase()) ?? "—",
        }
  );
}

const HIGHLIGHT_BG = "oklch(0.95 0.07 85 / 0.55)";
const HighlightChip = () => (
  <span
    className="inline-block self-start rounded-full px-1.5 py-0.5 text-[0.55rem] font-bold uppercase tracking-wider"
    style={{ background: "oklch(0.85 0.12 80 / 0.7)", color: "oklch(0.35 0.08 70)" }}
  >
    Highlighted
  </span>
);

/**
 * Scoring v2 metrics table: the shared two-column layout with Mo's four
 * highlighted rows in amber. ResearchMetricsPanel (used by legacy games and the
 * archive) is untouched.
 */
function HighlightedMetricsTable({
  metrics,
  highlighted,
  tickerA,
  tickerB,
  companyAName,
  companyBName,
}: {
  metrics: [string, string][];
  highlighted: string[];
  tickerA: string;
  tickerB: string;
  companyAName: string;
  companyBName: string;
}) {
  if (metrics.length === 0) return null;
  const matchesTicker = (label: string, t: string) => new RegExp(`\\b${t}\\b`, "i").test(label);
  const shortLabel = (label: string, t: string) =>
    label.replace(new RegExp(`^${t}\\s*(?:[—\\-:]\\s*)?`, "i"), "");
  let mA = metrics.filter(([l]) => matchesTicker(l, tickerA));
  let mB = metrics.filter(([l]) => matchesTicker(l, tickerB));
  if (mA.length === 0 && mB.length === 0) {
    const mid = Math.ceil(metrics.length / 2);
    mA = metrics.slice(0, mid);
    mB = metrics.slice(mid);
  }
  const byGroup = (a: [string, string], b: [string, string]) =>
    metricGroupInfo(a[0]).rank - metricGroupInfo(b[0]).rank;
  mA = [...mA].sort(byGroup);
  mB = [...mB].sort(byGroup);
  const rowCount = Math.max(mA.length, mB.length);
  const rows = Array.from({ length: rowCount }, (_, i) => {
    const labelA = mA[i] ? shortLabel(mA[i][0], tickerA) : "";
    const labelB = mB[i] ? shortLabel(mB[i][0], tickerB) : "";
    return {
      labelA,
      valueA: mA[i]?.[1] ?? "—",
      rawLabelA: mA[i]?.[0] ?? "",
      labelB,
      valueB: mB[i]?.[1] ?? "—",
      rawLabelB: mB[i]?.[0] ?? "",
      group: metricGroupInfo(mA[i]?.[0] ?? mB[i]?.[0] ?? ""),
      highlighted: highlighted.some((h) => sameLabel(h, labelA || labelB)),
    };
  });
  const showGroupHeaders = new Set(rows.map((r) => r.group.id)).size > 1;
  const columns = [
    { ticker: tickerA, name: companyAName, color: "#009050" },
    { ticker: tickerB, name: companyBName, color: "#1d4ed8" },
  ];
  return (
    <div className="mt-5">
      <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--color-brand)" }}>
        Key Metrics
      </p>
      <p className="text-xs mb-3" style={{ color: "var(--color-muted)" }}>
        Mo has highlighted the four metrics where these two companies differ most.
        You'll be asked which one is your reason.
      </p>
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: "1px solid var(--color-border)", background: "var(--color-surface)" }}
      >
        <div
          className="grid grid-cols-2"
          style={{ borderBottom: "2px solid var(--color-border)", background: "var(--color-surface-raised)" }}
        >
          {columns.map((co) => (
            <div
              key={co.ticker}
              className="px-3 py-3 flex items-center gap-2 min-w-0"
              style={{ borderRight: co.ticker === tickerA ? "1px solid var(--color-border)" : undefined }}
            >
              <span
                className="ticker-chip shrink-0"
                style={{ fontSize: "0.6rem", background: co.color, color: "#fff", borderColor: co.color }}
              >
                {co.ticker}
              </span>
              <span className="text-xs font-semibold leading-tight break-words min-w-0" style={{ color: "var(--color-foreground)" }}>
                {displayCompanyName(co.name)}
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
                background: row.highlighted
                  ? HIGHLIGHT_BG
                  : i % 2 === 0 ? "var(--color-surface)" : "var(--color-surface-raised)",
              }}
            >
              <div className="px-3 py-2.5 flex flex-col gap-0.5 min-w-0" style={{ borderRight: "1px solid var(--color-border)" }}>
                {row.highlighted && <HighlightChip />}
                <p className="text-[0.625rem] font-semibold uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>
                  {row.labelA}
                </p>
                <p className="text-sm font-bold font-display" style={{ color: "var(--color-foreground)" }}>
                  {row.valueA}
                </p>
                {row.rawLabelA && <MetricExplanationSheet metricLabel={row.rawLabelA} />}
              </div>
              <div className="px-3 py-2.5 flex flex-col gap-0.5 min-w-0">
                <p className="text-[0.625rem] font-semibold uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>
                  {row.labelB}
                </p>
                <p className="text-sm font-bold font-display" style={{ color: "var(--color-foreground)" }}>
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

/**
 * Playing one archived game.
 *
 * Mirrors the live game's shape deliberately — gut pick, research, (Scoring v2:
 * your reason), final pick + confidence, reading check, result — because the
 * point of practice is to rehearse the real loop. Games without highlighted
 * metrics keep the legacy timed-question flow.
 *
 * The server withholds the winner, both percentage moves, the game date and the
 * source link until the play is completed, so nothing here needs to hide the
 * answer; it simply isn't in the payload yet.
 */
export default function PracticeGame() {
  const [, params] = useRoute("/practice/:id");
  const gameId = Number(params?.id);
  // See Practice.tsx: gating on `loading` can spin forever if Clerk stalls.
  const { isAuthenticated, likelyAuthenticated } = useAuth();
  const utils = trpc.useUtils();

  const { data: game, isLoading } = trpc.practice.getGame.useQuery(
    { gameId },
    { enabled: isAuthenticated && Number.isFinite(gameId) }
  );

  usePageMeta({
    title: game
      ? `Practice: ${game.companyATicker} vs ${game.companyBTicker} | Munymo`
      : "Practice | Munymo",
  });

  const [step, setStep] = useState<Step>("gut");
  const [gutChoice, setGutChoice] = useState<"A" | "B" | null>(null);
  const [finalChoice, setFinalChoice] = useState<"A" | "B" | null>(null);
  const [showFullResearch, setShowFullResearch] = useState(false);
  const [reasonMetric, setReasonMetric] = useState<string | null>(null);
  const [reasonSide, setReasonSide] = useState<"A" | "B" | null>(null);
  const [confidence, setConfidence] = useState<ConfidenceLevel | null>(null);
  const [chartTicker, setChartTicker] = useState<string | null>(null);
  // Mirrors the live game's modal phases so the question is preceded by the
  // same warning and run under the same timer.
  const [modalPhase, setModalPhase] = useState<"confirm" | "question" | "result" | null>(null);
  const [validationResult, setValidationResult] = useState<{
    isCorrect: boolean;
    correctAnswer?: string;
  } | null>(null);
  const [result, setResult] = useState<null | {
    predictionScore: number;
    validationScore: number;
    dailyScore: number;
    reasonScore?: number;
    confidenceScore?: number;
    totalScore?: number;
    dayKind?: "coin_toss" | "clear" | "decisive" | null;
    margin?: number | null;
    winner: "A" | "B";
    correctAnswer: string | null;
    gameDate: string;
    companyAPerf: string | null;
    companyBPerf: string | null;
  }>(null);
  const questionShownAt = useRef<number | null>(null);

  const highlightedMetrics: string[] | null = game?.highlightedMetrics ?? null;
  const isV2 = highlightedMetrics !== null;

  const { data: question } = trpc.games.getValidationQuestion.useQuery(
    { gameId },
    { enabled: isAuthenticated && step === "final" }
  );

  // Resume where the player left off rather than restarting the game.
  useEffect(() => {
    if (!game?.pick) return;
    if (game.pick.completedAt) setStep("done");
    else if (game.pick.finalSelection) setStep("final");
    else if (game.pick.gutSelection) setStep("research");
    // Scoring v2: the reason and confidence live on the stored pick, so a
    // reload on the final step does not make the player choose them again.
    if (game.pick.reasonMetric) setReasonMetric(game.pick.reasonMetric);
    if (game.pick.reasonSide) setReasonSide(game.pick.reasonSide);
    if (game.pick.confidence) setConfidence(game.pick.confidence);
  }, [game]);

  const submitGut = trpc.practice.submitGut.useMutation({
    onSuccess: () => {
      setStep("research");
      utils.practice.getGame.invalidate({ gameId });
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const submitFinal = trpc.practice.submitFinal.useMutation({
    onSuccess: () => {
      // Opens the same confirmation the live game shows — the warning about
      // one attempt, the timer, and not navigating away — before the question.
      setModalPhase("confirm");
      utils.practice.getGame.invalidate({ gameId });
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const submitValidation = trpc.practice.submitValidation.useMutation({
    onSuccess: (r) => {
      setResult(r as typeof result);
      setValidationResult({
        isCorrect: (r.validationScore ?? 0) > 0,
        correctAnswer: r.correctAnswer ?? undefined,
      });
      setModalPhase("result");
      utils.practice.available.invalidate();
      utils.practice.stats.invalidate();
      utils.practice.getGame.invalidate({ gameId });
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  if (likelyAuthenticated && isLoading) {
    return (
      <PublicLayout>
        <div className="flex justify-center py-24">
          <Loader2 size={28} className="animate-spin" style={{ color: "var(--color-brand)" }} />
        </div>
      </PublicLayout>
    );
  }

  if (!likelyAuthenticated || !game) {
    return (
      <PublicLayout>
        <div className="container py-16 max-w-lg mx-auto text-center">
          <p className="text-sm mb-5" style={{ color: "var(--color-muted)" }}>
            {likelyAuthenticated ? "That practice game isn't available." : "Sign in to practise."}
          </p>
          <Link href="/practice" className="btn-ghost text-sm px-5 py-2.5">
            Back to practice
          </Link>
        </div>
      </PublicLayout>
    );
  }

  const companies: { side: "A" | "B"; name: string; ticker: string }[] = [
    { side: "A", name: game.companyAName, ticker: game.companyATicker },
    { side: "B", name: game.companyBName, ticker: game.companyBTicker },
  ];

  // researchMetrics is stored as an ARRAY of {label, value} (see
  // ResearchMetric in the schema), not a keyed object — Object.entries on it
  // would yield array indices as labels. Grouping and pairing are the panel's
  // job; this only normalises the shape.
  const rawMetrics = (game.researchMetrics ?? []) as Array<{ label: string; value: string }>;
  const metrics: [string, string][] = (Array.isArray(rawMetrics) ? rawMetrics : [])
    .filter((m) => m && typeof m.label === "string")
    .map((m) => [m.label, m.value] as [string, string]);

  // Archived candles, if this game was published after chart snapshotting
  // existed. No live fallback by design: live prices would show today's market
  // and reveal the outcome.
  const snapshot = (game.chartSnapshot ?? null) as {
    asOf?: string;
    series?: Record<string, { time: number; open: number; high: number; low: number; close: number }[]>;
  } | null;
  const seriesFor = (ticker: string) => snapshot?.series?.[ticker] ?? null;
  const priceTrendHighlighted =
    highlightedMetrics !== null && highlightedMetrics.some((h) => sameLabel(h, PRICE_TREND_LABEL));
  const hasCharts = Boolean(seriesFor(game.companyATicker) || seriesFor(game.companyBTicker));


  function CompanyButtons({
    selected,
    onSelect,
  }: {
    selected: "A" | "B" | null;
    onSelect: (s: "A" | "B") => void;
  }) {
    return (
      <div className="grid grid-cols-2 gap-3 mb-5">
        {companies.map((c) => (
          <button
            key={c.side}
            onClick={() => onSelect(c.side)}
            className="p-4 rounded-xl text-left transition-all active:scale-95"
            style={{
              background:
                selected === c.side ? "var(--color-brand-muted)" : "var(--color-surface-raised)",
              border: `2px solid ${
                selected === c.side ? "var(--color-brand)" : "var(--color-border)"
              }`,
            }}
          >
            <p className="font-bold text-sm mb-1" style={{ color: "var(--color-foreground)" }}>
              {c.ticker}
            </p>
            <p className="text-xs" style={{ color: "var(--color-muted)" }}>
              {c.name}
            </p>
          </button>
        ))}
      </div>
    );
  }

  return (
    <PublicLayout>
      <div className="container py-8 max-w-2xl mx-auto">
        <Link
          href="/practice"
          className="inline-flex items-center gap-1.5 text-xs mb-5"
          style={{ color: "var(--color-muted)" }}
        >
          <ArrowLeft size={13} /> Practice
        </Link>

        <div className="flex items-center gap-2 mb-5">
          <Dumbbell size={16} style={{ color: "var(--color-brand)" }} />
          <span
            className="text-xs font-bold uppercase tracking-widest"
            style={{ color: "var(--color-brand)" }}
          >
            Practice game — not scored on the leaderboard
          </span>
        </div>

        {/* ── Step 1: gut ── */}
        {step === "gut" && (
          <div className="card-glass p-6 animate-scale-in">
            <div className="flex items-center gap-3 mb-4">
              <Brain size={20} style={{ color: "var(--color-brand)" }} />
              <h2 style={{ color: "var(--color-foreground)" }}>Gut Selection</h2>
            </div>
            <p className="text-sm mb-5" style={{ color: "var(--color-muted)" }}>
              Instinct only — which of these performed better that day? You'll see the
              research next, and you can change your mind.
            </p>
            <CompanyButtons selected={gutChoice} onSelect={setGutChoice} />
            <button
              className="btn-gold text-sm px-6 py-3 w-full justify-center"
              disabled={!gutChoice || submitGut.isPending}
              onClick={() => gutChoice && submitGut.mutate({ gameId, selection: gutChoice })}
            >
              {submitGut.isPending ? <Loader2 size={15} className="animate-spin" /> : null}
              Lock in gut pick <ArrowRight size={15} />
            </button>
          </div>
        )}

        {/* ── Step 2: research ── */}
        {step === "research" && (
          <div className="animate-scale-in">
            <div className="card-glass p-6 mb-4">
              <div className="flex items-center gap-3 mb-4">
                <BookOpen size={20} style={{ color: "var(--color-brand)" }} />
                <h2 style={{ color: "var(--color-foreground)" }}>Research</h2>
              </div>
              {game.pairingRationale && (
                <div className="mb-5">
                  <p
                    className="text-xs font-semibold uppercase tracking-wider mb-2"
                    style={{ color: "var(--color-brand)" }}
                  >
                    Why these two
                  </p>
                  <p
                    className="text-sm leading-relaxed whitespace-pre-line"
                    style={{ color: "var(--color-muted)" }}
                  >
                    {game.pairingRationale}
                  </p>
                </div>
              )}
              {(game.researchSummary || game.researchContent) && (
                <div>
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <p
                      className="text-xs font-semibold uppercase tracking-wider"
                      style={{ color: "var(--color-brand)" }}
                    >
                      {game.researchSummary && !showFullResearch ? "Summary" : "Research Notes"}
                    </p>
                    {/* Same summary-by-default with a toggle to the full
                        analysis as the live game — a practice player needs the
                        same depth to qualify a decision. */}
                    {game.researchSummary && game.researchContent && (
                      <button
                        className="text-xs font-medium"
                        style={{ color: "var(--color-brand)" }}
                        onClick={() => setShowFullResearch(!showFullResearch)}
                      >
                        {showFullResearch ? "← Show summary" : "Show full analysis →"}
                      </button>
                    )}
                  </div>
                  <p
                    className="text-sm leading-relaxed whitespace-pre-line"
                    style={{ color: "var(--color-muted)" }}
                  >
                    {game.researchSummary && !showFullResearch
                      ? game.researchSummary
                      : game.researchContent || game.researchSummary}
                  </p>
                </div>
              )}
            </div>

            {/* Two-column comparison, matching the live game. The first
                attempt used the archive page's flat table, which stacked every
                metric in one column and collapsed the value column. */}
            {isV2 ? (
              <HighlightedMetricsTable
                metrics={metrics}
                highlighted={highlightedMetrics ?? []}
                tickerA={game.companyATicker}
                tickerB={game.companyBTicker}
                companyAName={game.companyAName}
                companyBName={game.companyBName}
              />
            ) : (
              <ResearchMetricsPanel
                metrics={metrics}
                tickerA={game.companyATicker}
                tickerB={game.companyBTicker}
                companyAName={game.companyAName}
                companyBName={game.companyBName}
              />
            )}

            {/* Charts from the archived snapshot only. Games published before
                snapshotting existed simply don't show these. */}
            {hasCharts && (
              <div
                className="grid grid-cols-2 gap-2 mt-3 mb-4 rounded-xl p-2"
                style={priceTrendHighlighted ? { background: HIGHLIGHT_BG } : undefined}
              >
                {priceTrendHighlighted && (
                  <div className="col-span-2">
                    <HighlightChip />
                  </div>
                )}
                {[
                  { ticker: game.companyATicker, color: "#009050" },
                  { ticker: game.companyBTicker, color: "#1d4ed8" },
                ].map((co) =>
                  seriesFor(co.ticker) ? (
                    <button
                      key={co.ticker}
                      onClick={() => setChartTicker(co.ticker)}
                      className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all active:scale-95"
                      style={{
                        background: co.color + "18",
                        color: co.color,
                        border: `1px solid ${co.color}40`,
                      }}
                    >
                      <BarChart2 size={13} />
                      {co.ticker} Chart
                    </button>
                  ) : (
                    <div key={co.ticker} />
                  )
                )}
              </div>
            )}
            {snapshot?.asOf && hasCharts && (
              <p className="text-[0.625rem] mb-4 text-center" style={{ color: "var(--color-subtle)" }}>
                Prices up to {snapshot.asOf} — the day before this matchup, exactly what a
                live player could see.
              </p>
            )}

            {/* Same warning the live game shows before the final pick. */}
            <div
              className="card-glass p-4 mb-4 flex items-start gap-3"
              style={{ borderColor: "var(--color-warning)" }}
            >
              {isV2 ? (
                <BookOpen size={16} className="mt-0.5 shrink-0" style={{ color: "var(--color-warning)" }} />
              ) : (
                <Timer size={16} className="mt-0.5 shrink-0" style={{ color: "var(--color-warning)" }} />
              )}
              {isV2 ? (
                <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                  After submitting your final selection, a{" "}
                  <strong style={{ color: "var(--color-foreground)" }}>reading check</strong>{" "}
                  will open worth{" "}
                  <strong style={{ color: "var(--color-foreground)" }}>{SCORE_WEIGHTS.check} points</strong>.
                  No timer. Study the research carefully.
                </p>
              ) : (
                <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                  After submitting your final selection, a{" "}
                  <strong style={{ color: "var(--color-foreground)" }}>
                    timed Research Validation Question
                  </strong>{" "}
                  will open worth{" "}
                  <strong style={{ color: "var(--color-foreground)" }}>20% of your score</strong>.
                  Study the research carefully.
                </p>
              )}
            </div>

            {/* Explicit "I've read it" step — the live game returns you to a
                dedicated pick screen rather than putting the final selection
                directly under the research. */}
            <button
              className="btn-brand w-full justify-center"
              onClick={() => {
                setStep(isV2 ? "reason" : "final");
                requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
              }}
            >
              {isV2 ? "I've Read the Research — Choose My Reason" : "I've Read the Research — Make Final Pick"}
              <ArrowRight size={16} />
            </button>
          </div>
        )}

        {/* ── Step: Your reason (scoring v2 only) ── */}
        {step === "reason" && isV2 && (() => {
          const options = highlightedValues(
            Object.fromEntries(metrics),
            highlightedMetrics ?? [],
            game.companyATicker.toUpperCase(),
            game.companyBTicker.toUpperCase()
          );
          const choiceStyle = (selected: boolean) => ({
            background: selected ? "var(--color-brand)" : "var(--color-surface-raised)",
            color: selected ? "var(--color-brand-foreground)" : "var(--color-foreground)",
            border: `1px solid ${selected ? "var(--color-brand)" : "var(--color-border)"}`,
          });
          return (
            <div className="card-glass p-6 animate-scale-in">
              <div className="flex items-center gap-3 mb-4">
                <Lightbulb size={20} style={{ color: "var(--color-brand)" }} />
                <h2 style={{ color: "var(--color-foreground)" }}>Your Reason</h2>
              </div>
              <p className="text-sm font-semibold mb-3" style={{ color: "var(--color-foreground)" }}>
                Which highlighted metric is the main reason for your pick?
              </p>
              <div className="flex flex-col gap-2 mb-6">
                {options.map((o) => (
                  <button
                    key={o.label}
                    type="button"
                    onClick={() => {
                      setReasonMetric(o.label);
                      setReasonSide(null);
                    }}
                    className="px-4 py-3 rounded-xl text-sm text-left transition-all"
                    style={choiceStyle(reasonMetric === o.label)}
                  >
                    <span className="font-semibold">{o.label}</span>
                    <span className="block text-xs mt-0.5 opacity-80">
                      {o.valueA === null
                        ? "the chart"
                        : `${game.companyATicker}: ${o.valueA} · ${game.companyBTicker}: ${o.valueB}`}
                    </span>
                  </button>
                ))}
              </div>

              {reasonMetric && (
                <div className="mb-6">
                  <p className="text-sm font-semibold mb-3" style={{ color: "var(--color-foreground)" }}>
                    Which company does {reasonMetric} favor?
                  </p>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {(["A", "B"] as const).map((side) => (
                      <button
                        key={side}
                        type="button"
                        onClick={() => setReasonSide(side)}
                        className="px-4 py-3 rounded-xl text-sm font-semibold transition-all"
                        style={choiceStyle(reasonSide === side)}
                      >
                        {side === "A" ? game.companyAName : game.companyBName}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                    The {SCORE_WEIGHTS.reason} reason points are yours if your final pick agrees with the company you
                    name here, and, where a metric has a plain direction, you read it the right way round. There is
                    no answer key for which metric matters most.
                  </p>
                </div>
              )}

              <button
                className="btn-brand w-full justify-center"
                disabled={!reasonMetric || !reasonSide}
                onClick={() => {
                  setStep("final");
                  requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
                }}
              >
                Continue to Final Pick <ArrowRight size={16} />
              </button>
            </div>
          );
        })()}

        {/* ── Step: Final selection, on its own screen ── */}
        {step === "final" && (
          <div className="card-glass p-6 animate-scale-in">
            <div className="flex items-center gap-3 mb-4">
              <TrendingUp size={20} style={{ color: "var(--color-brand)" }} />
              <h2 style={{ color: "var(--color-foreground)" }}>Final Selection</h2>
            </div>
            <p className="text-sm mb-5" style={{ color: "var(--color-muted)" }}>
              Your official prediction. You can stick with your gut pick or change your mind.
            </p>
            <CompanyButtons selected={finalChoice} onSelect={setFinalChoice} />
            {isV2 && (
              <div className="mb-6">
                <p className="text-sm font-semibold mb-3" style={{ color: "var(--color-foreground)" }}>
                  How sure are you?
                </p>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {CONFIDENCE_LEVELS.map((level) => {
                    const selected = confidence === level;
                    return (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setConfidence(level)}
                        className="px-2 py-3 rounded-xl text-sm font-semibold transition-all"
                        style={{
                          background: selected ? "var(--color-brand)" : "var(--color-surface-raised)",
                          color: selected ? "var(--color-brand-foreground)" : "var(--color-foreground)",
                          border: `1px solid ${selected ? "var(--color-brand)" : "var(--color-border)"}`,
                        }}
                      >
                        {CONFIDENCE_LABELS[level]}
                        <span className="block text-xs font-mono mt-0.5 opacity-80">{confidencePoints(level)}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                  Points if right / if wrong. Toss-up never loses.
                </p>
              </div>
            )}
            <button
              className="btn-gold text-sm px-6 py-3 w-full justify-center"
              disabled={!finalChoice || submitFinal.isPending || (isV2 && (!confidence || !reasonMetric || !reasonSide))}
              onClick={() => {
                if (!finalChoice) return;
                if (isV2) {
                  if (!reasonMetric || !reasonSide || !confidence) return;
                  submitFinal.mutate({ gameId, selection: finalChoice, reasonMetric, reasonSide, confidence });
                } else {
                  submitFinal.mutate({ gameId, selection: finalChoice });
                }
              }}
            >
              {submitFinal.isPending ? <Loader2 size={15} className="animate-spin" /> : null}
              Submit final pick <ArrowRight size={15} />
            </button>
          </div>
        )}

        {/* ── Step 4: result ── */}
        {step === "done" && (
          <div className="card-glass p-6 animate-scale-in text-center">
            {/* Same threshold as the live result — practice rehearses the real
                thing, so a perfect game earns the same moment. */}
            {(result?.totalScore ?? result?.dailyScore) === 100 && <PerfectScoreConfetti />}
            <Trophy size={36} className="mx-auto mb-4" style={{ color: "var(--color-brand)" }} />
            {result ? (
              <>
                {isV2 && result.dayKind && (
                  <p className="mb-3">
                    <span
                      className="inline-block rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider"
                      style={{ background: "oklch(0.85 0.12 80 / 0.7)", color: "oklch(0.35 0.08 70)" }}
                    >
                      {result.dayKind === "coin_toss"
                        ? `Coin toss${result.margin != null ? ` · ${Number(result.margin).toFixed(2)} pts apart` : ""}`
                        : result.dayKind === "clear"
                          ? "Clear"
                          : "Decisive"}
                    </span>
                  </p>
                )}
                <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "var(--color-subtle)" }}>
                  Practice score
                </p>
                <p
                  className="font-display text-5xl font-bold mb-5"
                  style={{ color: "var(--color-brand)" }}
                >
                  {isV2 ? (result.totalScore ?? result.dailyScore) : result.dailyScore}
                  {isV2 && (
                    <span className="text-xl font-semibold" style={{ color: "var(--color-muted)" }}> / 100</span>
                  )}
                </p>
                {isV2 ? (
                  <div className="flex flex-col gap-1.5 mb-5 text-sm items-center">
                    {[
                      { label: "The call", got: result.predictionScore, max: SCORE_WEIGHTS.call },
                      { label: "Your reason", got: result.reasonScore ?? 0, max: SCORE_WEIGHTS.reason },
                      { label: "Confidence", got: result.confidenceScore ?? 0, max: SCORE_WEIGHTS.conf },
                      { label: "Reading check", got: result.validationScore, max: SCORE_WEIGHTS.check },
                    ].map((line) => (
                      <span
                        key={line.label}
                        className="inline-flex items-center gap-1.5"
                        style={{ color: "var(--color-muted)" }}
                      >
                        {line.got > 0 ? (
                          <CheckCircle2 size={15} style={{ color: "var(--color-success)" }} />
                        ) : (
                          <XCircle size={15} style={{ color: "var(--color-error)" }} />
                        )}
                        {line.label} {line.got}/{line.max}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-6 mb-5 text-sm">
                    <span
                      className="inline-flex items-center gap-1.5"
                      style={{ color: "var(--color-muted)" }}
                    >
                      {result.predictionScore > 0 ? (
                        <CheckCircle2 size={15} style={{ color: "var(--color-success)" }} />
                      ) : (
                        <XCircle size={15} style={{ color: "var(--color-error)" }} />
                      )}
                      Prediction {result.predictionScore}/80
                    </span>
                    <span
                      className="inline-flex items-center gap-1.5"
                      style={{ color: "var(--color-muted)" }}
                    >
                      {result.validationScore > 0 ? (
                        <CheckCircle2 size={15} style={{ color: "var(--color-success)" }} />
                      ) : (
                        <XCircle size={15} style={{ color: "var(--color-error)" }} />
                      )}
                      Question {result.validationScore}/20
                    </span>
                  </div>
                )}
                <p className="text-sm mb-1" style={{ color: "var(--color-foreground)" }}>
                  {result.winner === "A" ? game.companyAName : game.companyBName} performed
                  better
                </p>
                <p className="text-xs mb-6" style={{ color: "var(--color-subtle)" }}>
                  {game.companyATicker} {result.companyAPerf}% · {game.companyBTicker}{" "}
                  {result.companyBPerf}% · {result.gameDate}
                </p>
              </>
            ) : (
              <p className="text-sm mb-6" style={{ color: "var(--color-muted)" }}>
                You've already practised this matchup.
              </p>
            )}
            <div className="flex gap-2 justify-center flex-wrap">
              <Link href="/practice" className="btn-gold text-sm px-5 py-2.5">
                Practise another <ArrowRight size={15} />
              </Link>
              <Link href={`/research/${gameId}`} className="btn-ghost text-sm px-5 py-2.5">
                See full research
              </Link>
            </div>
          </div>
        )}
      </div>

      {modalPhase && (
        <ValidationModal
          phase={modalPhase}
          question={
            question
              ? {
                  questionType: question.questionType,
                  questionText: question.questionText,
                  options: question.options,
                }
              : null
          }
          onOpenQuestion={() => {
            questionShownAt.current = Date.now();
            setModalPhase("question");
          }}
          untimed={isV2}
          onSubmitAnswer={(ans, timeMs) =>
            submitValidation.mutate({ gameId, answer: ans, answerTimeMs: timeMs })
          }
          isSubmitting={submitValidation.isPending}
          result={validationResult}
          onClose={() => {
            setModalPhase(null);
            setStep("done");
          }}
        />
      )}

      {chartTicker && (
        <ChartSheet
          ticker={chartTicker}
          companyName={
            chartTicker === game.companyATicker ? game.companyAName : game.companyBName
          }
          accentColor={chartTicker === game.companyATicker ? "#009050" : "#1d4ed8"}
          archivedCandles={seriesFor(chartTicker) ?? []}
          onClose={() => setChartTicker(null)}
        />
      )}
    </PublicLayout>
  );
}
