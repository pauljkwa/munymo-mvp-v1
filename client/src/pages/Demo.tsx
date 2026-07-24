import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "wouter";
import PublicLayout from "@/components/PublicLayout";
import { usePageMeta } from "@/hooks/usePageMeta";
import { ChartSheet } from "@/components/ChartSheet";
import {
  Brain,
  BookOpen,
  TrendingUp,
  CheckCircle2,
  ArrowRight,
  Lock,
  Timer,
  Lightbulb,
  Trophy,
  Loader2,
  FlaskConical,
  BarChart2,
  TrendingDown,
  DollarSign,
  Percent,
  Activity,
  Target,
  LineChart,
  X,
} from "lucide-react";

import { MetricExplanationSheet } from "@/components/MetricExplanationSheet";

// ─── Demo Data ────────────────────────────────────────────────────────────────

const DEMO_GAME = {
  companyAName: "Apple Inc.",
  companyATicker: "AAPL",
  companyBName: "Microsoft Corporation",
  companyBTicker: "MSFT",
  sector: "Technology",
  pairingRationale:
    "Apple and Microsoft are the two largest companies in the world by market capitalisation and both are deeply embedded in the AI race — Apple through on-device intelligence and the Apple Intelligence platform, Microsoft through its $13 billion OpenAI partnership and Copilot integration across Office 365. On any given trading day, macro sentiment, earnings revisions, and AI narrative shifts can send one soaring while the other lags. This matchup tests whether you can identify which giant has the edge today.",
  researchContent: `Apple is trading near its 52-week high following a strong iPhone 16 cycle and the rollout of Apple Intelligence features. Services revenue — now the highest-margin segment — grew 14% YoY last quarter, and management guided for continued double-digit growth. The stock carries a premium valuation (P/E ~29x) but bulls argue the ecosystem lock-in and buyback programme justify it.

Microsoft reported Q3 FY2025 results that beat on both top and bottom lines. Azure cloud revenue grew 21% YoY, accelerating from 19% the prior quarter, driven by AI workloads. Copilot monetisation is beginning to show up in Office commercial revenue. The stock trades at ~33x forward earnings — a premium to Apple — but analysts point to the faster revenue growth rate as justification.

Key risk for Apple: any softness in China sales or a delay in AI feature rollout could weigh on sentiment. Key risk for Microsoft: if Azure growth decelerates, the premium multiple compresses quickly.`,
  researchMetrics: {
    "AAPL Revenue Growth (YoY)": "+5.1%",
    "AAPL EPS (TTM)": "$6.57",
    "AAPL P/E Ratio": "29.4x",
    "AAPL Services Revenue Growth": "+14.2%",
    "AAPL Gross Margin": "46.6%",
    "MSFT Revenue Growth (YoY)": "+17.6%",
    "MSFT EPS (TTM)": "$12.93",
    "MSFT P/E Ratio": "33.1x",
    "MSFT Azure Growth (YoY)": "+21%",
    "MSFT Gross Margin": "69.4%",
  },
  validationQuestion: {
    questionText:
      "Which metric best explains why Microsoft's gross margin is significantly higher than Apple's?",
    questionType: "multiple_choice",
    options: [
      "Microsoft sells more hardware products at premium prices",
      "Microsoft's revenue mix is dominated by high-margin software and cloud services",
      "Apple has higher manufacturing costs due to its supply chain complexity",
      "Microsoft benefits from government contracts that carry higher margins",
    ],
    correctAnswer:
      "Microsoft's revenue mix is dominated by high-margin software and cloud services",
  },
  winner: "MSFT" as "AAPL" | "MSFT",
  winnerName: "Microsoft Corporation",
  companyAPerf: "-0.42%",
  companyBPerf: "+1.87%",
  resultSummary:
    "Microsoft outperformed Apple on the day as Azure cloud growth figures were cited in multiple analyst upgrades. Apple dipped slightly on profit-taking following its recent run to all-time highs.",
  hindsightSpotlight: `Pre-game research highlighted the divergence in growth trajectories: Apple's Services segment is impressive but growing off a large base, while Microsoft's Azure is accelerating. The crowd that focused on revenue growth rate over absolute margin likely leaned Microsoft — and that call proved correct.

During the session, three Wall Street analysts raised their Microsoft price targets citing the Azure acceleration as evidence that AI monetisation is arriving faster than expected. Apple, by contrast, saw no major catalysts and faced light selling pressure as some investors rotated into faster-growing names.

The key lesson: in a market obsessed with AI, growth rate matters more than current profitability. Microsoft's 21% Azure growth narrative dominated the day's trading, while Apple's steadier, more mature growth profile offered less excitement for momentum traders.

For future matchups, watch for: which company has the more recent analyst upgrade cycle, which has a near-term product catalyst, and whether macro sentiment favours growth (MSFT) or quality/defensive (AAPL).`,
};

// ─── Validation Modal ─────────────────────────────────────────────────────────

interface ValidationModalProps {
  phase: "confirm" | "question" | "result";
  onOpenQuestion: () => void;
  onSubmitAnswer: (answer: string, timeMs: number) => void;
  result: { isCorrect: boolean } | null;
  onClose: () => void;
}

function ValidationModal({ phase, onOpenQuestion, onSubmitAnswer, result, onClose }: ValidationModalProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<string>("");
  const [elapsedMs, setElapsedMs] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (phase === "question") {
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setElapsedMs(Date.now() - (startTimeRef.current ?? Date.now()));
      }, 100);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase]);

  const handleSubmit = () => {
    if (!selectedAnswer) return;
    const timeMs = startTimeRef.current ? Date.now() - startTimeRef.current : 0;
    if (timerRef.current) clearInterval(timerRef.current);
    const isCorrect = selectedAnswer === DEMO_GAME.validationQuestion.correctAnswer;
    onSubmitAnswer(selectedAnswer, timeMs);
    // Result is set by parent
    void isCorrect;
  };

  const bgColor =
    phase === "result"
      ? result?.isCorrect
        ? "oklch(0.35 0.12 145)"
        : "oklch(0.35 0.15 25)"
      : "var(--color-surface)";

  if (phase === "result" && result) {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6"
        style={{ background: bgColor, transition: "background 0.4s ease" }}
      >
        <div className="text-center max-w-md">
          {result.isCorrect ? (
            <CheckCircle2 size={64} className="mx-auto mb-4 text-white" />
          ) : (
            <div className="text-6xl mb-4">✗</div>
          )}
          <h2 className="text-2xl font-bold text-white mb-3">
            {result.isCorrect ? "Correct!" : "Not quite"}
          </h2>
          <p className="text-white/80 text-sm mb-2">
            {result.isCorrect
              ? "You identified the right answer — great research skills."
              : `The correct answer was: "${DEMO_GAME.validationQuestion.correctAnswer}"`}
          </p>
          <p className="text-white/60 text-xs mb-8">
            In the real game, your answer speed also contributes to your score.
          </p>
          <button className="btn-brand bg-white text-gray-900 hover:bg-white/90" onClick={onClose}>
            See the Result <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
      <div className="card-glass p-6 w-full max-w-md animate-scale-in">
        {phase === "confirm" && (
          <>
            <div className="flex items-center gap-3 mb-4">
              <Timer size={20} style={{ color: "var(--color-warning)" }} />
              <h3 style={{ color: "var(--color-foreground)" }}>Research Validation</h3>
            </div>
            <p className="text-sm mb-5" style={{ color: "var(--color-muted)" }}>
              A timed question is about to open. It's worth{" "}
              <strong style={{ color: "var(--color-foreground)" }}>20% of your score</strong>.
              Answer as quickly as you can — speed matters.
            </p>
            <div
              className="rounded-lg px-3 py-2 mb-5 text-xs"
              style={{ background: "var(--color-surface-raised)", color: "var(--color-muted)" }}
            >
              ⚠ Do not close this window — your answer will be lost
            </div>
            <button className="btn-brand w-full justify-center" onClick={onOpenQuestion}>
              Open Question <Timer size={15} />
            </button>
          </>
        )}

        {phase === "question" && (
          <>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Timer size={18} style={{ color: "var(--color-brand)" }} />
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-brand)" }}>
                  Research Validation
                </span>
              </div>
              <span
                className="font-mono text-sm font-bold tabular-nums"
                style={{ color: elapsedMs > 30000 ? "var(--color-warning)" : "var(--color-muted)" }}
              >
                {(elapsedMs / 1000).toFixed(1)}s
              </span>
            </div>

            <p className="font-semibold mb-6" style={{ color: "var(--color-foreground)" }}>
              {DEMO_GAME.validationQuestion.questionText}
            </p>

            <div className="flex flex-col gap-2 mb-6">
              {DEMO_GAME.validationQuestion.options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setSelectedAnswer(opt)}
                  className="px-4 py-3 rounded-xl text-sm font-semibold text-left transition-all"
                  style={{
                    background: selectedAnswer === opt ? "var(--color-brand)" : "var(--color-surface-raised)",
                    color: selectedAnswer === opt ? "var(--color-brand-foreground)" : "var(--color-foreground)",
                    border: `1px solid ${selectedAnswer === opt ? "var(--color-brand)" : "var(--color-border)"}`,
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>

            <div
              className="rounded-lg px-3 py-2 mb-5 text-xs"
              style={{ background: "var(--color-surface-raised)", color: "var(--color-muted)" }}
            >
              ⚠ Do not close this window — your answer will be lost
            </div>

            <button
              className="btn-brand w-full justify-center"
              disabled={!selectedAnswer}
              onClick={handleSubmit}
            >
              Submit Answer
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Step Tooltips ───────────────────────────────────────────────────────────

const STEP_TIPS: Record<string, { title: string; body: string; emoji: string }> = {
  gut: {
    emoji: "🧠",
    title: "Step 1 of 5 — Gut Pick",
    body: "Before you see any data, tap the company you instinctively think will outperform today — pure gut feel. Later you'll see whether the research changed your mind.",
  },
  research: {
    emoji: "📊",
    title: "Step 2 of 5 — Research",
    body: "Read the rationale, analyst notes, metrics, and charts for both companies. You'll be tested on this in a timed question — so read carefully!",
  },
  final: {
    emoji: "🎯",
    title: "Step 3 of 5 — Final Pick",
    body: "Lock in your official prediction — this is the pick that counts for scoring. Changing your mind from your gut pick is allowed; that's the whole point.",
  },
  validation: {
    emoji: "⏱",
    title: "Step 4 of 5 — Validation Question",
    body: "A timed question on the research you just read — answer quickly, speed is part of your score. It tests whether you absorbed the research or just skimmed it.",
  },
  result: {
    emoji: "🏆",
    title: "Step 5 of 5 — Result",
    body: "See who won, how your picks compared, and the Hindsight Spotlight explaining what drove the result. In the live game, your score joins the leaderboard.",
  },
};

interface StepTooltipProps {
  step: string;
  onDismiss: () => void;
}

function StepTooltip({ step, onDismiss }: StepTooltipProps) {
  const tip = STEP_TIPS[step];
  const touchStartX = useRef<number | null>(null);
  const [isExiting, setIsExiting] = useState(false);

  const dismiss = useCallback(() => {
    setIsExiting(true);
    setTimeout(onDismiss, 250);
  }, [onDismiss]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > 60) dismiss();
    touchStartX.current = null;
  };

  if (!tip) return null;

  return (
    <div
      className="fixed bottom-6 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm"
      style={{
        transform: `translateX(-50%) translateY(${isExiting ? "120%" : "0"})`,
        transition: "transform 0.25s cubic-bezier(0.23,1,0.32,1)",
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="rounded-2xl p-5 shadow-2xl"
        style={{
          background: "oklch(0.18 0.02 250)",
          border: "1px solid oklch(0.35 0.08 250)",
          color: "white",
        }}
      >
        {/* Drag handle */}
        <div className="flex justify-center mb-3">
          <div className="w-8 h-1 rounded-full" style={{ background: "oklch(0.5 0.05 250)" }} />
        </div>

        <div className="flex items-start gap-3 mb-4">
          <span className="text-2xl leading-none mt-0.5">{tip.emoji}</span>
          <div>
            <p className="font-bold text-sm mb-1" style={{ color: "oklch(0.85 0.12 250)" }}>
              {tip.title}
            </p>
            <p className="text-sm leading-relaxed" style={{ color: "oklch(0.78 0.03 250)" }}>
              {tip.body}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs" style={{ color: "oklch(0.55 0.04 250)" }}>
            Swipe to dismiss
          </p>
          <button
            onClick={dismiss}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95"
            style={{
              background: "oklch(0.45 0.2 250)",
              color: "white",
            }}
          >
            Got it →
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Demo Banner ──────────────────────────────────────────────────────────────

function DemoBanner() {
  return (
    <div
      className="sticky top-0 z-30 flex items-center justify-center gap-2 px-4 py-2 text-white text-sm font-semibold"
      style={{ background: "oklch(0.45 0.2 250)" }}
    >
      <FlaskConical size={15} />
      <span className="sm:hidden">Demo Mode — nothing is saved</span>
      <span className="hidden sm:inline">Demo Mode — Apple vs Microsoft · Nothing is saved · This is a tutorial walkthrough</span>
    </div>
  );
}

// ─── Main Demo Component ──────────────────────────────────────────────────────

type DemoStep = "gut" | "research" | "final" | "validation" | "result";

export default function Demo() {
  usePageMeta({
    title: "How Munymo Works — Daily Stock Market Game Demo | Munymo",
    description:
      "Walk through a full Munymo game day: the gut pick, the research brief, the scored prediction, and the result. See how the free daily stock market game works.",
  });
  const [step, setStep] = useState<DemoStep>("gut");
  const [gutSelection, setGutSelection] = useState<"A" | "B" | null>(null);
  const [finalSelection, setFinalSelection] = useState<"A" | "B" | null>(null);
  const [modalPhase, setModalPhase] = useState<"confirm" | "question" | "result" | null>(null);
  const [validationResult, setValidationResult] = useState<{ isCorrect: boolean } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Track which step tooltips have been dismissed
  const [dismissedTips, setDismissedTips] = useState<Set<string>>(new Set());
  // Chart sheet state
  const [chartTicker, setChartTicker] = useState<string | null>(null);
  const [chartName, setChartName] = useState("");
  const [chartColor, setChartColor] = useState("#009050");
  const showTip = (s: string) => !dismissedTips.has(s) && step === s && !modalPhase;
  const dismissTip = (s: string) => setDismissedTips(prev => new Set(Array.from(prev).concat(s)));

  const stepLabels: DemoStep[] = ["gut", "research", "final", "validation", "result"];
  const stepDisplayLabels = ["Gut Pick", "Research", "Final Pick", "Validation", "Result"];
  const currentIndex = stepLabels.indexOf(step);

  const handleGutConfirm = () => {
    if (!gutSelection) return;
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setStep("research");
    }, 600);
  };

  const handleFinalConfirm = () => {
    if (!finalSelection) return;
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setModalPhase("confirm");
    }, 600);
  };

  const handleValidationSubmit = (answer: string, _timeMs: number) => {
    const isCorrect = answer === DEMO_GAME.validationQuestion.correctAnswer;
    setValidationResult({ isCorrect });
    setModalPhase("result");
  };

  const handleModalClose = () => {
    setModalPhase(null);
    setStep("result");
  };

  // Build metrics split
  const allMetrics = Object.entries(DEMO_GAME.researchMetrics);
  const metricsA = allMetrics.filter(([label]) => label.toUpperCase().startsWith("AAPL"));
  const metricsB = allMetrics.filter(([label]) => label.toUpperCase().startsWith("MSFT"));

  const stripTicker = (label: string, ticker: string) =>
    label.replace(new RegExp(`^${ticker}\\s*[—\\-\\s:]\\s*`, "i"), "");

  // Pick an icon for each metric based on its label
  const metricIcon = (label: string) => {
    const l = label.toLowerCase();
    if (l.includes("revenue") || l.includes("sales")) return DollarSign;
    if (l.includes("margin") || l.includes("eps") || l.includes("earning")) return Percent;
    if (l.includes("p/e") || l.includes("ratio") || l.includes("valuation")) return BarChart2;
    if (l.includes("growth")) return TrendingUp;
    if (l.includes("market cap") || l.includes("cap")) return Activity;
    if (l.includes("analyst") || l.includes("target") || l.includes("consensus")) return Target;
    if (l.includes("week") || l.includes("range") || l.includes("52")) return LineChart;
    return BarChart2;
  };

  void TrendingDown; // imported but available for future use

  return (
    <>
      <DemoBanner />
      {chartTicker && (
        <ChartSheet
          ticker={chartTicker}
          companyName={chartName}
          accentColor={chartColor}
          onClose={() => setChartTicker(null)}
        />
      )}
      <PublicLayout>
        {/* Step-by-step guided tooltips */}
        {showTip("gut") && <StepTooltip step="gut" onDismiss={() => dismissTip("gut")} />}
        {showTip("research") && <StepTooltip step="research" onDismiss={() => dismissTip("research")} />}
        {showTip("final") && <StepTooltip step="final" onDismiss={() => dismissTip("final")} />}
        {showTip("result") && <StepTooltip step="result" onDismiss={() => dismissTip("result")} />}
        {/* Validation Modal */}
        {modalPhase && (
          <ValidationModal
            phase={modalPhase}
            onOpenQuestion={() => setModalPhase("question")}
            onSubmitAnswer={handleValidationSubmit}
            result={validationResult}
            onClose={handleModalClose}
          />
        )}

        <div className="container py-10 max-w-3xl mx-auto">
          {/* Header */}
          <div className="mb-8 animate-fade-up">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
              <h1 className="font-display text-3xl" style={{ color: "var(--color-foreground)" }}>
                Today's Matchup
              </h1>
              <span className="status-pill status-active">
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                Demo
              </span>
            </div>
            <p className="text-sm mt-1" style={{ color: "var(--color-subtle)" }}>
              Sector: {DEMO_GAME.sector}
            </p>
          </div>

          {/* Progress steps */}
          <div className="flex items-center gap-2 mb-8 animate-fade-up delay-75">
            {stepLabels.map((s, i) => {
              const isDone = currentIndex > i;
              const isCurrent = currentIndex === i;
              return (
                <div key={s} className="flex items-center gap-2 flex-1">
                  <div className="flex flex-col items-center gap-1 flex-1">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                      style={{
                        background:
                          isDone || isCurrent ? "var(--color-brand)" : "var(--color-surface-raised)",
                        color:
                          isDone || isCurrent ? "var(--color-brand-foreground)" : "var(--color-subtle)",
                      }}
                    >
                      {isDone ? <CheckCircle2 size={14} /> : i + 1}
                    </div>
                    <span
                      className="text-xs hidden sm:block"
                      style={{ color: isCurrent ? "var(--color-brand)" : "var(--color-subtle)" }}
                    >
                      {stepDisplayLabels[i]}
                    </span>
                  </div>
                  {i < stepLabels.length - 1 && (
                    <div
                      className="h-px flex-1 mb-4"
                      style={{ background: isDone ? "var(--color-brand)" : "var(--color-border)" }}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Company cards */}
          <div className="grid grid-cols-2 gap-4 mb-8 animate-fade-up delay-150">
            {(["A", "B"] as const).map((side) => {
              const name = side === "A" ? DEMO_GAME.companyAName : DEMO_GAME.companyBName;
              const ticker = side === "A" ? DEMO_GAME.companyATicker : DEMO_GAME.companyBTicker;
              const isGutSelected = gutSelection === side;
              const isFinalSelected = finalSelection === side;
              const showSelected =
                step === "result"
                  ? isFinalSelected
                  : step === "gut"
                  ? isGutSelected
                  : step === "final"
                  ? isFinalSelected
                  : isGutSelected;
              const canSelect = step === "gut" || step === "final";

              return (
                <button
                  key={side}
                  disabled={!canSelect}
                  onClick={() => {
                    if (step === "gut") setGutSelection(side);
                    if (step === "final") setFinalSelection(side);
                  }}
                  className="card-glass p-6 text-center transition-all duration-200"
                  style={{
                    borderColor: showSelected ? "var(--color-brand)" : undefined,
                    boxShadow: showSelected
                      ? "0 0 0 2px var(--color-brand), 0 8px 32px oklch(0.78 0.14 75 / 0.2)"
                      : undefined,
                    cursor: canSelect ? "pointer" : "default",
                  }}
                >
                  <div className="ticker-chip mx-auto mb-3">{ticker}</div>
                  <p className="font-semibold text-sm" style={{ color: "var(--color-foreground)" }}>
                    {name}
                  </p>
                  {showSelected && (
                    <div
                      className="mt-3 flex items-center justify-center gap-1 text-xs font-semibold"
                      style={{ color: "var(--color-brand)" }}
                    >
                      <CheckCircle2 size={13} /> Selected
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Step: Gut ── */}
          {step === "gut" && (
            <div className="card-glass p-6 animate-scale-in">
              <div className="flex items-center gap-3 mb-4">
                <Brain size={20} style={{ color: "var(--color-brand)" }} />
                <h3 style={{ color: "var(--color-foreground)" }}>Gut Selection</h3>
              </div>
              <p className="text-sm mb-6" style={{ color: "var(--color-muted)" }}>
                Before reading any research, pick the company you instinctively believe will
                outperform today. Your raw, unfiltered intuition — no data allowed yet.
              </p>
              <button
                className="btn-brand w-full justify-center"
                disabled={!gutSelection || isSubmitting}
                onClick={handleGutConfirm}
              >
                {isSubmitting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <>Confirm Gut Selection <ArrowRight size={16} /></>
                )}
              </button>
            </div>
          )}

          {/* ── Step: Research ── */}
          {step === "research" && (
            <div className="animate-scale-in">
              <div className="card-glass p-6 mb-4">
                <div className="flex items-center gap-3 mb-4">
                  <BookOpen size={20} style={{ color: "var(--color-brand)" }} />
                  <h3 style={{ color: "var(--color-foreground)" }}>Research</h3>
                </div>

                <div className="mb-5">
                  <p
                    className="text-xs font-semibold uppercase tracking-wider mb-2"
                    style={{ color: "var(--color-brand)" }}
                  >
                    Pairing Rationale
                  </p>
                  <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                    {DEMO_GAME.pairingRationale}
                  </p>
                </div>

                <div className="mb-5">
                  <p
                    className="text-xs font-semibold uppercase tracking-wider mb-2"
                    style={{ color: "var(--color-brand)" }}
                  >
                    Research Notes
                  </p>
                  <div className="prose-munymo text-sm whitespace-pre-wrap" style={{ color: "var(--color-muted)" }}>
                    {DEMO_GAME.researchContent}
                  </div>
                </div>

                {/* Key Metrics & Charts — dashboard-style stat cards, always side by side */}
                <div className="mt-5">
                  <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--color-brand)" }}>
                    Key Metrics &amp; Charts
                  </p>

                  {/* Company headers */}
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div className="flex items-center gap-2 px-1">
                      <span className="ticker-chip" style={{ fontSize: "0.6rem" }}>AAPL</span>
                      <span className="text-xs font-semibold truncate" style={{ color: "var(--color-foreground)" }}>{DEMO_GAME.companyAName}</span>
                    </div>
                    <div className="flex items-center gap-2 px-1">
                      <span className="ticker-chip" style={{ fontSize: "0.6rem", background: "oklch(0.45 0.18 260 / 0.15)", color: "oklch(0.45 0.18 260)" }}>MSFT</span>
                      <span className="text-xs font-semibold truncate" style={{ color: "var(--color-foreground)" }}>{DEMO_GAME.companyBName}</span>
                    </div>
                  </div>

                  {/* Metric card rows — each row is a grid-cols-2 pair */}
                  <div className="flex flex-col gap-2">
                    {Array.from({ length: Math.max(metricsA.length, metricsB.length) }, (_, i) => {
                      const [labelA, valueA] = metricsA[i] ?? ["", "—"];
                      const [labelB, valueB] = metricsB[i] ?? ["", "—"];
                      const IconA = metricIcon(labelA);
                      const IconB = metricIcon(labelB);
                      const shortLabelA = stripTicker(labelA, "AAPL");
                      const shortLabelB = stripTicker(labelB, "MSFT");
                      return (
                        <div key={i} className="grid grid-cols-2 gap-2">
                          {/* Company A card */}
                          <div className="rounded-2xl p-4" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
                            <div className="flex items-start justify-between mb-2">
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--color-surface-raised)" }}>
                                <IconA size={14} style={{ color: "var(--color-brand)" }} />
                              </div>
                            </div>
                            <p className="text-base font-display font-bold leading-tight mb-1" style={{ color: "var(--color-foreground)" }}>{valueA}</p>
                            <p className="text-xs font-semibold uppercase tracking-wider leading-tight" style={{ color: "var(--color-muted)" }}>{shortLabelA || labelA}</p>
                            {labelA && <MetricExplanationSheet metricLabel={labelA} />}
                          </div>
                          {/* Company B card */}
                          <div className="rounded-2xl p-4" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
                            <div className="flex items-start justify-between mb-2">
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "oklch(0.45 0.18 260 / 0.08)" }}>
                                <IconB size={14} style={{ color: "oklch(0.45 0.18 260)" }} />
                              </div>
                            </div>
                            <p className="text-base font-display font-bold leading-tight mb-1" style={{ color: "var(--color-foreground)" }}>{valueB}</p>
                            <p className="text-xs font-semibold uppercase tracking-wider leading-tight" style={{ color: "var(--color-muted)" }}>{shortLabelB || labelB}</p>
                            {labelB && <MetricExplanationSheet metricLabel={labelB} />}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Chart CTA buttons */}
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <button
                      onClick={() => { setChartTicker("AAPL"); setChartName(DEMO_GAME.companyAName); setChartColor("#009050"); }}
                      className="flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all active:scale-95"
                      style={{ background: "var(--color-brand-muted)", color: "var(--color-brand)", border: "1px solid var(--color-brand)" }}
                    >
                      <LineChart size={15} />
                      View AAPL Chart
                    </button>
                    <button
                      onClick={() => { setChartTicker("MSFT"); setChartName(DEMO_GAME.companyBName); setChartColor("#1d4ed8"); }}
                      className="flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all active:scale-95"
                      style={{ background: "oklch(0.45 0.18 260 / 0.08)", color: "oklch(0.45 0.18 260)", border: "1px solid oklch(0.45 0.18 260 / 0.4)" }}
                    >
                      <LineChart size={15} />
                      View MSFT Chart
                    </button>
                  </div>
                </div>
              </div>

              {/* Validation hint */}
              <div
                className="card-glass p-4 mb-4 flex items-start gap-3"
                style={{ borderColor: "var(--color-warning)" }}
              >
                <Timer size={16} className="mt-0.5 shrink-0" style={{ color: "var(--color-warning)" }} />
                <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                  After submitting your final selection, a{" "}
                  <strong style={{ color: "var(--color-foreground)" }}>timed Research Validation Question</strong>{" "}
                  will open worth <strong style={{ color: "var(--color-foreground)" }}>20% of your score</strong>.
                  Study the research carefully.
                </p>
              </div>

              <button
                className="btn-brand w-full justify-center"
                onClick={() => setStep("final")}
              >
                I've Read the Research — Make Final Pick
                <ArrowRight size={16} />
              </button>
            </div>
          )}



          {/* ── Step: Final ── */}
          {step === "final" && (
            <div className="card-glass p-6 animate-scale-in">
              <div className="flex items-center gap-3 mb-4">
                <TrendingUp size={20} style={{ color: "var(--color-brand)" }} />
                <h3 style={{ color: "var(--color-foreground)" }}>Final Selection</h3>
              </div>
              <p className="text-sm mb-6" style={{ color: "var(--color-muted)" }}>
                Having reviewed the research, confirm your official prediction. This is the pick
                that will be scored. You can change your mind from your gut pick.
              </p>
              <button
                className="btn-brand w-full justify-center"
                disabled={!finalSelection || isSubmitting}
                onClick={handleFinalConfirm}
              >
                {isSubmitting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <>Submit Final Selection <Lock size={15} /></>
                )}
              </button>
            </div>
          )}

          {/* ── Step: Result ── */}
          {step === "result" && (
            <div className="space-y-4 mt-4 animate-fade-up">
              {/* Winner announcement */}
              <div
                className="card-glass p-5 flex items-center gap-4"
                style={{ borderColor: "var(--color-brand)", boxShadow: "0 0 0 1px var(--color-brand)" }}
              >
                <Trophy size={28} style={{ color: "var(--color-brand)", flexShrink: 0 }} />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color: "var(--color-brand)" }}>
                    Result
                  </p>
                  <p className="font-semibold" style={{ color: "var(--color-foreground)" }}>
                    {DEMO_GAME.winnerName} outperformed
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>
                    AAPL {DEMO_GAME.companyAPerf} · MSFT {DEMO_GAME.companyBPerf}
                  </p>
                  {finalSelection && (
                    <p
                      className="text-sm mt-1 font-medium"
                      style={{
                        color:
                          (finalSelection === "B") // MSFT is B
                            ? "var(--color-success)"
                            : "var(--color-error)",
                      }}
                    >
                      {finalSelection === "B"
                        ? "✓ Your prediction was correct"
                        : "✗ Your prediction was incorrect"}
                    </p>
                  )}
                </div>
              </div>

              {/* Result summary */}
              <div className="card-glass p-5">
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--color-brand)" }}>
                  What Happened
                </p>
                <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                  {DEMO_GAME.resultSummary}
                </p>
              </div>

              {/* Hindsight Spotlight */}
              <div
                className="card-glass p-6"
                style={{ borderColor: "oklch(0.65 0.18 145)", background: "oklch(0.97 0.02 145 / 0.4)" }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <Lightbulb size={20} style={{ color: "oklch(0.55 0.18 145)" }} />
                  <div>
                    <h3 className="text-base font-semibold" style={{ color: "var(--color-foreground)" }}>
                      Hindsight Spotlight
                    </h3>
                    <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                      20/20 hindsight — what we know now that the result is in
                    </p>
                  </div>
                </div>
                <div
                  className="text-sm leading-relaxed whitespace-pre-wrap"
                  style={{ color: "var(--color-muted)" }}
                >
                  {DEMO_GAME.hindsightSpotlight}
                </div>
              </div>

              {/* CTA to real game */}
              <div
                className="card-glass p-6 text-center"
                style={{ borderColor: "oklch(0.45 0.2 250)", background: "oklch(0.97 0.03 250 / 0.3)" }}
              >
                <FlaskConical size={28} className="mx-auto mb-3" style={{ color: "oklch(0.45 0.2 250)" }} />
                <h3 className="mb-2" style={{ color: "var(--color-foreground)" }}>
                  Ready for the real thing?
                </h3>
                <p className="text-sm mb-5" style={{ color: "var(--color-muted)" }}>
                  This was a demo — nothing was saved. In the live game, your picks are scored,
                  tracked on the leaderboard, and contribute to your MunyIQ rating.
                </p>
                <Link href="/game" className="btn-brand inline-flex">
                  Play Today's Game <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          )}
        </div>
      </PublicLayout>
    </>
  );
}
