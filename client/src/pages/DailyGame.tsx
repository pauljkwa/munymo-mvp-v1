import { useAuth } from "@/_core/hooks/useAuth";
import { SignInButton } from "@clerk/clerk-react";
import { trpc } from "@/lib/trpc";
import { withReferralParams } from "@/lib/utils";
import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import PublicLayout from "@/components/PublicLayout";
import { ChartSheet } from "@/components/ChartSheet";
import { MetricExplanationSheet } from "@/components/MetricExplanationSheet";
import { toast } from "sonner";
import {
  Brain,
  BookOpen,
  CheckCircle2,
  XCircle,
  Lock,
  ArrowRight,
  Clock,
  AlertCircle,
  TrendingUp,
  Loader2,
  Timer,
  Lightbulb,
  Trophy,
  BarChart2,
  X as XIcon,
  ExternalLink,
} from "lucide-react";

type GameStep = "gut" | "research" | "final" | "submitted";

// ─── Timed Validation Modal ───────────────────────────────────────────────────

interface ValidationModalProps {
  phase: "confirm" | "question" | "result";
  question: {
    questionType: string;
    questionText: string;
    options?: string[] | null | undefined;
  } | null;
  onOpenQuestion: () => void;
  onSubmitAnswer: (answer: string, timeMs: number) => void;
  isSubmitting: boolean;
  result: { isCorrect: boolean; correctAnswer?: string } | null;
  onClose: () => void;
}

function ValidationModal({
  phase,
  question,
  onOpenQuestion,
  onSubmitAnswer,
  isSubmitting,
  result,
  onClose,
}: ValidationModalProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<string>("");
  const [elapsedMs, setElapsedMs] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start timer when question phase begins
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
    onSubmitAnswer(selectedAnswer, timeMs);
  };

  const bgColor =
    phase === "result"
      ? result?.isCorrect
        ? "oklch(0.35 0.12 145)"
        : "oklch(0.35 0.12 25)"
      : "var(--color-surface)";

  const textColor =
    phase === "result" ? "#fff" : "var(--color-foreground)";

  const options: string[] =
    question?.questionType === "multiple_choice"
      ? (question.options ?? [])
      : question?.questionType === "yes_no"
      ? ["Yes", "No"]
      : ["True", "False"];

  // Result phase: full-screen takeover so it can't be missed or accidentally dismissed
  if (phase === "result" && result) {
    const isCorrect = result.isCorrect;
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center p-8"
        style={{
          background: isCorrect ? "oklch(0.28 0.12 145)" : "oklch(0.28 0.12 25)",
          color: "#fff",
        }}
      >
        <div className="text-center max-w-sm">
          {isCorrect ? (
            <CheckCircle2 size={80} className="mx-auto mb-6" style={{ color: "oklch(0.85 0.18 145)" }} />
          ) : (
            <XCircle size={80} className="mx-auto mb-6" style={{ color: "oklch(0.85 0.18 25)" }} />
          )}
          <h2 className="font-display text-4xl font-bold mb-4">
            {isCorrect ? "Correct!" : "Incorrect"}
          </h2>
          {isCorrect ? (
            <p className="text-lg mb-8" style={{ color: "oklch(0.9 0.06 145)" }}>
              Well done — your research paid off. Your validation bonus has been added to your score.
            </p>
          ) : (
            <div className="mb-8">
              <p className="text-base mb-4" style={{ color: "oklch(0.9 0.06 25)" }}>
                {result.correctAnswer
                  ? "Not quite. The correct answer was:"
                  : "Not quite. The correct answer will be revealed when results are published."}
              </p>
              {result.correctAnswer && (
                <div
                  className="inline-block px-6 py-3 rounded-xl font-bold text-lg"
                  style={{ background: "oklch(0.2 0.1 25)", color: "#fff", border: "1px solid oklch(0.5 0.15 25)" }}
                >
                  {result.correctAnswer}
                </div>
              )}
            </div>
          )}
          <button
            className="w-full py-4 rounded-2xl font-bold text-lg transition-all active:scale-95"
            style={{
              background: "oklch(1 0 0 / 0.2)",
              color: "#fff",
              border: "2px solid oklch(1 0 0 / 0.4)",
            }}
            onClick={onClose}
          >
            Continue →
          </button>
        </div>
      </div>
    );
  }

  return (
    // Overlay — pointer-events blocked to prevent navigation
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "oklch(0 0 0 / 0.7)" }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div
        className="w-full max-w-md rounded-2xl p-8 shadow-2xl transition-colors duration-500"
        style={{ background: bgColor, color: textColor }}
      >
        {/* ── Phase: Confirm ── */}
        {phase === "confirm" && (
          <>
            <div className="flex items-center gap-3 mb-5">
              <CheckCircle2 size={28} style={{ color: "var(--color-success)" }} />
              <h3 className="font-display text-xl" style={{ color: "var(--color-foreground)" }}>
                Selection Confirmed
              </h3>
            </div>
            <p className="text-sm mb-2" style={{ color: "var(--color-muted)" }}>
              Your final company selection has been locked in.
            </p>
            <div
              className="rounded-xl p-4 mb-6"
              style={{
                background: "var(--color-surface-raised)",
                border: "1px solid var(--color-warning)",
              }}
            >
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "var(--color-warning)" }}>
                ⚠ Important — Read Before Continuing
              </p>
              <p className="text-sm" style={{ color: "var(--color-foreground)" }}>
                A <strong>Research Validation Question</strong> worth{" "}
                <strong>20% of your daily score</strong> will open when you press the button below.
              </p>
              <ul className="mt-3 text-sm space-y-1.5" style={{ color: "var(--color-muted)" }}>
                <li>• You have <strong>one attempt only</strong> — no second chances</li>
                <li>• Your answer will be <strong>timed</strong> — faster correct answers score higher</li>
                <li>• <strong>Do not close this window</strong> or navigate away once the question opens</li>
              </ul>
            </div>
            <button
              className="btn-brand w-full justify-center"
              onClick={onOpenQuestion}
            >
              I Understand — Open the Question
              <ArrowRight size={16} />
            </button>
          </>
        )}

        {/* ── Phase: Question ── */}
        {phase === "question" && question && (
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
              {question.questionText}
            </p>

            <div className={`flex flex-col gap-2 mb-6 ${question.questionType !== "multiple_choice" ? "flex-row" : ""}`}>
              {options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setSelectedAnswer(opt)}
                  className="px-4 py-3 rounded-xl text-sm font-semibold text-left transition-all"
                  style={{
                    background:
                      selectedAnswer === opt
                        ? "var(--color-brand)"
                        : "var(--color-surface-raised)",
                    color:
                      selectedAnswer === opt
                        ? "var(--color-brand-foreground)"
                        : "var(--color-foreground)",
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
              ⚠ Do not close this window or navigate away — your answer will be lost
            </div>

            <button
              className="btn-brand w-full justify-center"
              disabled={!selectedAnswer || isSubmitting}
              onClick={handleSubmit}
            >
              {isSubmitting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>Submit Answer</>
              )}
            </button>
          </>
        )}

        {/* Result phase is now handled as a full-screen early return above */}
      </div>
    </div>
  );
}

// ─── Main DailyGame Component ─────────────────────────────────────────────────

export default function DailyGame() {
  const { isAuthenticated } = useAuth();
  const { data: game, isLoading } = trpc.games.getToday.useQuery();
  const { data: recentPublished } = trpc.games.listArchive.useQuery(
    { limit: 1, offset: 0 },
    { staleTime: 5 * 60 * 1000 }
  );
  const previousGame = recentPublished?.[0] ?? null;

  const { data: myPick, isLoading: isLoadingPick } = trpc.picks.getMyPick.useQuery(
    { gameId: game?.id ?? 0 },
    { enabled: !!game?.id && isAuthenticated }
  );

  const { data: research } = trpc.games.getResearch.useQuery(
    { gameId: game?.id ?? 0 },
    { enabled: !!game?.id }
  );

  const { data: validationQ } = trpc.games.getValidationQuestion.useQuery(
    { gameId: game?.id ?? 0 },
    { enabled: !!game?.id }
  );

  // Fire-and-forget: log clicks on the source-article link for referral reporting.
  const recordOutboundClick = trpc.games.recordOutboundClick.useMutation();

  const [step, setStep] = useState<GameStep>("gut");
  const [showFullResearch, setShowFullResearch] = useState(false);
  const researchNotesRef = useRef<HTMLDivElement>(null);

  const toggleFullResearch = (next: boolean) => {
    setShowFullResearch(next);
    requestAnimationFrame(() =>
      researchNotesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    );
  };

  const goToFinalStep = () => {
    setStep("final");
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  };

  const [gutSelection, setGutSelection] = useState<"A" | "B" | null>(null);
  const [finalSelection, setFinalSelection] = useState<"A" | "B" | null>(null);

  // Chart panel state (hoisted here because hooks can't be inside IIFEs)
  const [chartTicker, setChartTicker] = useState<string | null>(null);
  const [chartName, setChartName] = useState("");
  const [chartColor, setChartColor] = useState("#009050");

  // Validation modal state
  const [modalPhase, setModalPhase] = useState<"confirm" | "question" | "result" | null>(null);
  const [validationResult, setValidationResult] = useState<{ isCorrect: boolean; correctAnswer?: string } | null>(null);

  // Sync step with existing pick on load
  useEffect(() => {
    if (myPick?.finalSelection) setStep("submitted");
    else if (myPick?.gutSelection) setStep("research");
  }, [myPick]);

  const submitGut = trpc.picks.submitGut.useMutation({
    onSuccess: () => {
      setStep("research");
      toast.success("Gut selection saved — now read the research.");
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const submitFinal = trpc.picks.submitFinal.useMutation({
    onSuccess: () => {
      // Open the validation confirmation modal
      if (validationQ) {
        setModalPhase("confirm");
      } else {
        setStep("submitted");
        toast.success("Final selection submitted. Good luck!");
      }
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const submitValidation = trpc.picks.submitValidation.useMutation({
    onSuccess: (data) => {
      setValidationResult({ isCorrect: data.isCorrect });
      setModalPhase("result");
    },
    onError: (e: { message: string }) => {
      toast.error(e.message);
      setModalPhase(null);
      setStep("submitted");
    },
  });

  const handleCloseModal = () => {
    setModalPhase(null);
    setStep("submitted");
    toast.success("All done — your picks are locked in!");
  };

  if (isLoading) {
    return (
      <PublicLayout>
        <div className="container py-24 flex justify-center">
          <Loader2 size={32} className="animate-spin" style={{ color: "var(--color-brand)" }} />
        </div>
      </PublicLayout>
    );
  }

  // Wait for myPick to resolve before rendering the game UI so the step
  // doesn't flicker from "gut" to the correct step on navigation back
  if (isAuthenticated && isLoadingPick) {
    return (
      <PublicLayout>
        <div className="container py-24 flex justify-center">
          <Loader2 size={32} className="animate-spin" style={{ color: "var(--color-brand)" }} />
        </div>
      </PublicLayout>
    );
  }

  if (!game) {
    return (
      <PublicLayout>
        <div className="container py-24 text-center">
          <AlertCircle size={48} className="mx-auto mb-6" style={{ color: "var(--color-muted)" }} />
          <h2 className="font-display mb-3" style={{ color: "var(--color-foreground)" }}>
            No Game Today
          </h2>
          <p style={{ color: "var(--color-muted)" }}>
            There is no active game scheduled for today. Check back tomorrow.
          </p>
        </div>
      </PublicLayout>
    );
  }

  const isLocked = game.status === "locked" || game.status === "result_published";
  const lockoutTime = game.lockoutAt ? new Date(game.lockoutAt) : null;
  // True only when the cron auto-submitted at lockout (finalSubmittedAt >= lockoutAt).
  // Using timing avoids false positives for players who rationally pick the same gut+final.
  const wasAutoSubmitted = (() => {
    if (!myPick?.finalSubmittedAt || !lockoutTime) return false;
    return new Date(myPick.finalSubmittedAt) >= lockoutTime;
  })();

  const stepLabels: GameStep[] = ["gut", "research", "final", "submitted"];
  const stepDisplayLabels = ["Gut Pick", "Research", "Final Pick", "Done"];
  const stepIndex = (s: GameStep) => stepLabels.indexOf(s);
  const currentIndex = stepIndex(step);

  return (
    <PublicLayout>
      {/* Chart Sheet — rendered at top level so fixed positioning covers full viewport on iOS */}
      {chartTicker && (
        <ChartSheet
          ticker={chartTicker}
          companyName={chartName}
          accentColor={chartColor}
          onClose={() => setChartTicker(null)}
        />
      )}

      {/* Timed Validation Modal — rendered outside normal flow */}
      {modalPhase && (
        <ValidationModal
          phase={modalPhase}
          question={validationQ ?? null}
          onOpenQuestion={() => setModalPhase("question")}
          onSubmitAnswer={(answer, timeMs) => {
            if (!game.id) return;
            submitValidation.mutate({ gameId: game.id, answer, answerTimeMs: timeMs });
          }}
          isSubmitting={submitValidation.isPending}
          result={validationResult}
          onClose={handleCloseModal}
        />
      )}

      <div className="container py-10 max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8 animate-fade-up">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
            <h1 className="font-display text-3xl" style={{ color: "var(--color-foreground)" }}>
              Today's Matchup
            </h1>
            {isLocked ? (
              <span className="status-pill status-locked">
                <Lock size={11} /> Locked
              </span>
            ) : (
              <span className="status-pill status-active">
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                Live
              </span>
            )}
          </div>
          {lockoutTime && !isLocked && (
            <p className="text-sm flex items-center gap-1.5" style={{ color: "var(--color-muted)" }}>
              <Clock size={13} />
              Locks at {lockoutTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} your time
              <span style={{ color: "var(--color-subtle)" }}>
                ({lockoutTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })} New York)
              </span>
            </p>
          )}
          {game.sector && (
            <p className="text-sm mt-1" style={{ color: "var(--color-subtle)" }}>
              Sector: {game.sector}
            </p>
          )}
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
                      background: isDone || isCurrent ? "var(--color-brand)" : "var(--color-surface-raised)",
                      color: isDone || isCurrent ? "var(--color-brand-foreground)" : "var(--color-subtle)",
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
                {i < 3 && (
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
            const name = side === "A" ? game.companyAName : game.companyBName;
            const ticker = side === "A" ? game.companyATicker : game.companyBTicker;
            const isGutSelected = gutSelection === side || myPick?.gutSelection === side;
            const isFinalSelected = finalSelection === side || myPick?.finalSelection === side;
            const showSelected =
              step === "submitted"
                ? isFinalSelected
                : step === "gut"
                ? isGutSelected
                : step === "final"
                ? isFinalSelected
                : isGutSelected;
            const canSelect = !isLocked && step !== "submitted" && step !== "research";

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
        {step === "gut" && !isLocked && (
          <div className="card-glass p-6 animate-scale-in">
            <div className="flex items-center gap-3 mb-4">
              <Brain size={20} style={{ color: "var(--color-brand)" }} />
              <h3 style={{ color: "var(--color-foreground)" }}>Gut Selection</h3>
            </div>
            <p className="text-sm mb-6" style={{ color: "var(--color-muted)" }}>
              Before reading any research, pick the company you instinctively believe will
              outperform today. Your raw, unfiltered intuition.
            </p>
            {isAuthenticated ? (
              <button
                className="btn-brand w-full justify-center"
                disabled={!gutSelection || submitGut.isPending}
                onClick={() => {
                  if (!gutSelection || !game.id) return;
                  submitGut.mutate({ gameId: game.id, selection: gutSelection });
                }}
              >
                {submitGut.isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <>Confirm Gut Selection <ArrowRight size={16} /></>
                )}
              </button>
            ) : (
              <SignInButton mode="modal">
                <button className="btn-brand w-full justify-center">
                  Sign in to Play
                  <ArrowRight size={16} />
                </button>
              </SignInButton>
            )}
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
              {game.pairingRationale && (
                <div className="mb-5">
                  <p
                    className="text-xs font-semibold uppercase tracking-wider mb-2"
                    style={{ color: "var(--color-brand)" }}
                  >
                    Pairing Rationale
                  </p>
                  <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                    {game.pairingRationale}
                  </p>
                  {game.sourceUrl && (
                    <a
                      href={withReferralParams(game.sourceUrl)}
                      target="_blank"
                      onClick={() =>
                        recordOutboundClick.mutate({
                          gameId: game.id,
                          publisher: game.sourcePublisher ?? undefined,
                          sourceUrl: game.sourceUrl ?? undefined,
                        })
                      }
                      // Only "noopener" — deliberately NOT "noreferrer": we WANT
                      // the publisher to see munymo.com as the referrer so our
                      // outbound traffic shows up in their analytics.
                      rel="noopener"
                      className="inline-flex items-center gap-1 text-xs mt-2 hover:underline"
                      style={{ color: "var(--color-subtle)" }}
                    >
                      <ExternalLink size={12} />
                      Source: {game.sourcePublisher ?? "Read the article"}
                      {game.sourceTitle ? ` — "${game.sourceTitle}"` : ""}
                    </a>
                  )}
                </div>
              )}
              {research?.content ? (
                <div ref={researchNotesRef} className="scroll-mt-20">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-brand)" }}>
                      {research.researchSummary && !showFullResearch ? "Summary" : "Research Notes"}
                    </p>
                    {research.researchSummary && (
                      <button
                        type="button"
                        onClick={() => toggleFullResearch(!showFullResearch)}
                        className="text-xs font-semibold"
                        style={{ color: "var(--color-brand)" }}
                      >
                        {showFullResearch ? "← Show summary" : "Show full analysis →"}
                      </button>
                    )}
                  </div>
                  {research.researchSummary && !showFullResearch ? (
                    <div>
                      <div className="prose-munymo text-sm whitespace-pre-wrap">
                        {research.researchSummary}
                      </div>
                      <div
                        className="mt-4 rounded-xl p-3 flex items-start gap-2"
                        style={{ background: "var(--color-brand)0d", border: "1px solid var(--color-brand)30" }}
                      >
                        <Lightbulb size={14} className="mt-0.5 shrink-0" style={{ color: "var(--color-brand)" }} />
                        <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                          This is the beginner summary. Tap{" "}
                          <button
                            type="button"
                            onClick={() => toggleFullResearch(true)}
                            className="font-semibold underline"
                            style={{ color: "var(--color-brand)" }}
                          >
                            Show full analysis
                          </button>{" "}
                          for the complete research breakdown.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="prose-munymo text-sm whitespace-pre-wrap">
                      {research.content}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm" style={{ color: "var(--color-subtle)" }}>
                  No additional research notes provided for today's game.
                </p>
              )}

              {/* Company Cards: metrics + chart side by side */}
              {research?.metrics && (() => {
                // Split flat metrics array into per-company groups by ticker prefix
                const allMetrics = Object.entries(research.metrics as Record<string, string>);
                const tickerA = (game.companyATicker ?? "").toUpperCase();
                const tickerB = (game.companyBTicker ?? "").toUpperCase();

                // Match labels that start with the ticker followed by a space, dash, or em-dash
                const matchesTicker = (label: string, ticker: string) => {
                  const upper = label.toUpperCase();
                  return (
                    upper.startsWith(ticker + " ") ||
                    upper.startsWith(ticker + "—") ||
                    upper.startsWith(ticker + "-") ||
                    upper.startsWith(ticker + ":") ||
                    upper === ticker
                  );
                };

                let metricsA = allMetrics.filter(([label]) => matchesTicker(label, tickerA));
                let metricsB = allMetrics.filter(([label]) => matchesTicker(label, tickerB));

                // Fallback: if ticker matching fails (e.g. labels don't include ticker prefix),
                // split the list in half — first half to A, second half to B
                if (metricsA.length === 0 && metricsB.length === 0 && allMetrics.length > 0) {
                  const mid = Math.ceil(allMetrics.length / 2);
                  metricsA = allMetrics.slice(0, mid);
                  metricsB = allMetrics.slice(mid);
                }

                // Normalise metric labels to strip ticker prefix for display
                const shortLabel = (label: string, ticker: string) =>
                  label.replace(new RegExp(`^${ticker}\\s*[—\\-:]\\s*`, "i"), "");

                // Build a unified row list: [{label, valueA, valueB}]
                const metricLabelsA = metricsA.map(([l]) => shortLabel(l, tickerA));
                const metricLabelsB = metricsB.map(([l]) => shortLabel(l, tickerB));
                // Use the longer list as the row driver
                const rowCount = Math.max(metricLabelsA.length, metricLabelsB.length);
                const rows = Array.from({ length: rowCount }, (_, i) => ({
                  labelA: metricLabelsA[i] ?? "",
                  valueA: metricsA[i]?.[1] ?? "—",
                  rawLabelA: metricsA[i]?.[0] ?? "",
                  labelB: metricLabelsB[i] ?? "",
                  valueB: metricsB[i]?.[1] ?? "—",
                  rawLabelB: metricsB[i]?.[0] ?? "",
                }));

                return (
                  <>
                    <div className="mt-5">
                      <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--color-brand)" }}>
                        Key Metrics
                      </p>

                      {/* Two-column comparison table */}
                      <div
                        className="rounded-xl overflow-hidden"
                        style={{ border: "1px solid var(--color-border)", background: "var(--color-surface)" }}
                      >
                        {/* Column headers */}
                        <div
                          className="grid grid-cols-2"
                          style={{ borderBottom: "2px solid var(--color-border)", background: "var(--color-surface-raised)" }}
                        >
                          {[{ ticker: tickerA, name: game.companyAName ?? "", color: "#009050" }, { ticker: tickerB, name: game.companyBName ?? "", color: "#1d4ed8" }].map((co) => (
                            <div
                              key={co.ticker}
                              className="px-3 py-3 flex items-center gap-2"
                              style={{ borderRight: co.ticker === tickerA ? "1px solid var(--color-border)" : undefined }}
                            >
                              <span
                                className="ticker-chip shrink-0"
                                style={{ fontSize: "0.6rem", background: co.color, color: "#fff", borderColor: co.color }}
                              >
                                {co.ticker}
                              </span>
                              <span className="text-xs font-semibold leading-tight" style={{ color: "var(--color-foreground)" }}>
                                {co.name}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Metric rows */}
                        {rows.map((row, i) => (
                          <div
                            key={i}
                            className="grid grid-cols-2"
                            style={{
                              borderBottom: i < rows.length - 1 ? "1px solid var(--color-border)" : undefined,
                              background: i % 2 === 0 ? "var(--color-surface)" : "var(--color-surface-raised)",
                            }}
                          >
                            {/* Company A cell */}
                            <div
                              className="px-3 py-2.5 flex flex-col gap-0.5"
                              style={{ borderRight: "1px solid var(--color-border)" }}
                            >
                              <p className="text-[0.625rem] font-semibold uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>
                                {row.labelA}
                              </p>
                              <p className="text-sm font-bold font-display" style={{ color: "var(--color-foreground)" }}>
                                {row.valueA}
                              </p>
                              {row.rawLabelA && <MetricExplanationSheet metricLabel={row.rawLabelA} />}
                            </div>
                            {/* Company B cell */}
                            <div className="px-3 py-2.5 flex flex-col gap-0.5">
                              <p className="text-[0.625rem] font-semibold uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>
                                {row.labelB}
                              </p>
                              <p className="text-sm font-bold font-display" style={{ color: "var(--color-foreground)" }}>
                                {row.valueB}
                              </p>
                              {row.rawLabelB && <MetricExplanationSheet metricLabel={row.rawLabelB} />}
                            </div>
                          </div>
                        ))}

                        {/* Chart CTAs */}
                        <div
                          className="grid grid-cols-2"
                          style={{ borderTop: "2px solid var(--color-border)", background: "var(--color-surface-raised)" }}
                        >
                          {[{ ticker: tickerA, name: game.companyAName ?? "", color: "#009050" }, { ticker: tickerB, name: game.companyBName ?? "", color: "#1d4ed8" }].map((co) => (
                            <div
                              key={co.ticker}
                              style={{ borderRight: co.ticker === tickerA ? "1px solid var(--color-border)" : undefined }}
                              className="p-2"
                            >
                              <button
                                onClick={() => { setChartTicker(co.ticker); setChartName(co.name); setChartColor(co.color); }}
                                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all active:scale-95"
                                style={{
                                  background: co.color + "18",
                                  color: co.color,
                                  border: `1px solid ${co.color}40`,
                                }}
                              >
                                <BarChart2 size={13} />
                                View Chart
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Validation question hint */}
            {validationQ && (
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
            )}

            <button
              className="btn-brand w-full justify-center"
              onClick={goToFinalStep}
            >
              I've Read the Research — Make Final Pick
              <ArrowRight size={16} />
            </button>
          </div>
        )}

        {/* ── Step: Final ── */}
        {step === "final" && !isLocked && (
          <div className="card-glass p-6 animate-scale-in">
            <div className="flex items-center gap-3 mb-4">
              <TrendingUp size={20} style={{ color: "var(--color-brand)" }} />
              <h3 style={{ color: "var(--color-foreground)" }}>Final Selection</h3>
            </div>
            <p className="text-sm mb-6" style={{ color: "var(--color-muted)" }}>
              Having reviewed the research, confirm your official prediction. This is the pick
              that will be scored.
            </p>
            <button
              className="btn-brand w-full justify-center"
              disabled={!finalSelection || submitFinal.isPending}
              onClick={() => {
                if (!finalSelection || !game.id) return;
                submitFinal.mutate({ gameId: game.id, selection: finalSelection });
              }}
            >
              {submitFinal.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>Submit Final Selection <Lock size={15} /></>
              )}
            </button>
          </div>
        )}

        {/* ── Submitted ── */}
        {step === "submitted" && !wasAutoSubmitted && (
          <div
            className="card-glass p-6 text-center animate-scale-in"
            style={{
              borderColor: "var(--color-success)",
              boxShadow: "0 0 0 1px var(--color-success)",
            }}
          >
            <CheckCircle2
              size={36}
              className="mx-auto mb-3"
              style={{ color: "var(--color-success)" }}
            />
            <h3 className="mb-2" style={{ color: "var(--color-foreground)" }}>
              Picks Submitted
            </h3>
            <p className="text-sm mb-5" style={{ color: "var(--color-muted)" }}>
              Your final selection is locked in. Results will be published after the game closes.
            </p>
            {validationQ && !myPick?.validationAnswer ? (
              <button
                className="btn-brand w-full justify-center mb-3"
                onClick={() => setModalPhase("confirm")}
              >
                Answer Validation Question
                <ArrowRight size={16} />
              </button>
            ) : null}
            <Link href="/leaderboard" className="btn-ghost text-sm">
              View Leaderboard
            </Link>
          </div>
        )}

        {/* ── Auto-submitted (gut pick was submitted by cron at lockout) ── */}
        {(step === "submitted" && wasAutoSubmitted) && (
          <div
            className="card-glass p-6 animate-scale-in"
            style={{ borderColor: "var(--color-warning)", boxShadow: "0 0 0 1px var(--color-warning)" }}
          >
            <div className="flex items-center gap-3 mb-3">
              <Timer size={24} style={{ color: "var(--color-warning)", flexShrink: 0 }} />
              <div>
                <h3 style={{ color: "var(--color-foreground)" }}>Time Ran Out</h3>
                <p className="text-xs" style={{ color: "var(--color-muted)" }}>Your gut pick was automatically submitted</p>
              </div>
            </div>
            <p className="text-sm mb-5" style={{ color: "var(--color-muted)" }}>
              The submission window closed while you were away. Your gut pick —{" "}
              <strong style={{ color: "var(--color-foreground)" }}>
                {myPick?.finalSelection === "A" ? game.companyAName : game.companyBName}
              </strong>{" "}
              — was automatically locked in as your final selection.
            </p>
            {validationQ && (
              <div
                className="p-4 rounded-xl mb-4"
                style={{ background: "var(--color-warning)18", border: "1px solid var(--color-warning)40" }}
              >
                <p className="text-sm font-semibold mb-1" style={{ color: "var(--color-foreground)" }}>
                  You can still earn bonus points
                </p>
                <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                  Answer the Research Validation Question to earn{" "}
                  <strong style={{ color: "var(--color-foreground)" }}>20% of your score</strong> as a bonus.
                </p>
              </div>
            )}
            {validationQ ? (
              <button
                className="btn-brand w-full justify-center"
                onClick={() => setModalPhase("confirm")}
              >
                Answer Validation Question
                <ArrowRight size={16} />
              </button>
            ) : (
              <Link href="/leaderboard" className="btn-ghost text-sm">
                View Leaderboard
              </Link>
            )}
          </div>
        )}

        {/* ── Locked without pick ── */}
        {isLocked && step !== "submitted" && !myPick?.finalSelection && (
          <div
            className="card-glass p-6 text-center"
            style={{ borderColor: "var(--color-warning)" }}
          >
            <Lock
              size={36}
              className="mx-auto mb-3"
              style={{ color: "var(--color-warning)" }}
            />
            <h3 className="mb-2" style={{ color: "var(--color-foreground)" }}>
              Game Locked
            </h3>
            <p className="text-sm" style={{ color: "var(--color-muted)" }}>
              The submission window has closed. You did not submit a pick for today's game.
            </p>
          </div>
        )}

        {/* ── Result + Hindsight Spotlight (shown when result_published) ── */}
        {game.status === "result_published" && (
          <div className="space-y-4 mt-4 animate-fade-up">
            {/* Winner announcement + performance */}
            {game.winner && (() => {
              const perfA = game.companyAPerf != null ? parseFloat(String(game.companyAPerf)) : null;
              const perfB = game.companyBPerf != null ? parseFloat(String(game.companyBPerf)) : null;
              const fmt = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
              return (
                <div className="card-glass p-5" style={{ borderColor: "var(--color-brand)", boxShadow: "0 0 0 1px var(--color-brand)" }}>
                  <div className="flex items-center gap-4 mb-4">
                    <Trophy size={28} style={{ color: "var(--color-brand)", flexShrink: 0 }} />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color: "var(--color-brand)" }}>
                        Result
                      </p>
                      <p className="font-semibold" style={{ color: "var(--color-foreground)" }}>
                        {game.winner === "A" ? game.companyAName : game.companyBName} outperformed
                      </p>
                      {myPick?.finalSelection && (
                        <p className="text-sm mt-0.5" style={{ color: myPick.finalSelection === game.winner ? "var(--color-success)" : "var(--color-error)" }}>
                          {myPick.finalSelection === game.winner ? "✓ Your prediction was correct" : "✗ Your prediction was incorrect"}
                        </p>
                      )}
                    </div>
                  </div>
                  {(perfA != null || perfB != null) && (
                    <div className="grid grid-cols-2 gap-2">
                      {(["A", "B"] as const).map((side) => {
                        const ticker = side === "A" ? game.companyATicker : game.companyBTicker;
                        const name = side === "A" ? game.companyAName : game.companyBName;
                        const perf = side === "A" ? perfA : perfB;
                        const isWinner = game.winner === side;
                        const perfColor = perf == null ? "var(--color-subtle)" : perf >= 0 ? "var(--color-success)" : "var(--color-danger)";
                        return (
                          <div
                            key={side}
                            className="rounded-xl p-3"
                            style={{
                              background: isWinner ? "var(--color-brand)10" : "var(--color-surface-raised)",
                              border: `1px solid ${isWinner ? "var(--color-brand)40" : "var(--color-border)"}`,
                            }}
                          >
                            <div className="flex items-center gap-1.5 mb-1">
                              {isWinner && <Trophy size={11} style={{ color: "var(--color-brand)" }} />}
                              <span className="text-xs font-bold" style={{ color: isWinner ? "var(--color-brand)" : "var(--color-foreground)" }}>
                                {ticker}
                              </span>
                            </div>
                            <p className="text-[0.625rem] mb-1" style={{ color: "var(--color-subtle)" }}>{name}</p>
                            {perf != null && (
                              <span className="text-lg font-bold font-mono" style={{ color: perfColor }}>
                                {fmt(perf)}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Hindsight Spotlight */}
            {research?.hindsightSpotlight && (
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
                  {research.hindsightSpotlight}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Yesterday's result card — shown after today's game elements, not between them */}
        {previousGame && (() => {
          const perfA = previousGame.companyAPerf != null ? parseFloat(String(previousGame.companyAPerf)) : null;
          const perfB = previousGame.companyBPerf != null ? parseFloat(String(previousGame.companyBPerf)) : null;
          const fmt = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
          const winnerTicker = previousGame.winner === "A" ? previousGame.companyATicker : previousGame.companyBTicker;
          return (
            <a
              href={`/game/${previousGame.id}/result`}
              className="block mt-6 animate-fade-up"
              style={{ textDecoration: "none" }}
            >
              <div
                className="card-glass p-4 transition-all hover:shadow-md"
                style={{ borderColor: "var(--color-border)" }}
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-subtle)" }}>
                    Yesterday's Result
                  </p>
                  <span className="text-xs font-semibold" style={{ color: "var(--color-brand)" }}>
                    View full result →
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(["A", "B"] as const).map((side) => {
                    const ticker = side === "A" ? previousGame.companyATicker : previousGame.companyBTicker;
                    const perf = side === "A" ? perfA : perfB;
                    const isWinner = previousGame.winner === side;
                    const perfColor = perf == null ? "var(--color-subtle)" : perf >= 0 ? "var(--color-success)" : "var(--color-danger)";
                    return (
                      <div
                        key={side}
                        className="rounded-xl p-3 flex items-center justify-between gap-2"
                        style={{
                          background: isWinner ? "var(--color-brand)10" : "var(--color-surface-raised)",
                          border: `1px solid ${isWinner ? "var(--color-brand)40" : "var(--color-border)"}`,
                        }}
                      >
                        <div className="flex items-center gap-2">
                          {isWinner && <Trophy size={12} style={{ color: "var(--color-brand)", flexShrink: 0 }} />}
                          <span className="text-sm font-bold" style={{ color: isWinner ? "var(--color-brand)" : "var(--color-foreground)" }}>
                            {ticker}
                          </span>
                        </div>
                        {perf != null && (
                          <span className="text-sm font-bold font-mono" style={{ color: perfColor }}>
                            {fmt(perf)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                {winnerTicker && (
                  <p className="text-xs mt-2 text-center" style={{ color: "var(--color-muted)" }}>
                    <span style={{ color: "var(--color-brand)", fontWeight: 600 }}>{winnerTicker}</span> outperformed
                  </p>
                )}
              </div>
            </a>
          );
        })()}
      </div>

      {/* Floating Lockout Countdown Footer */}
      {lockoutTime && !isLocked && step !== "submitted" && (
        <LockoutCountdown lockoutTime={lockoutTime} />
      )}
    </PublicLayout>
  );
}

// ─── Lockout Countdown Footer ─────────────────────────────────────────────────

function LockoutCountdown({ lockoutTime }: { lockoutTime: Date }) {
  const [timeLeft, setTimeLeft] = useState(() => lockoutTime.getTime() - Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = lockoutTime.getTime() - Date.now();
      setTimeLeft(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutTime]);

  if (timeLeft <= 0) return null;

  const totalSeconds = Math.floor(timeLeft / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");

  const isUrgent = timeLeft < 30 * 60 * 1000;    // under 30 min → amber
  const isCritical = timeLeft < 5 * 60 * 1000;   // under 5 min → red
  const isFlashing = timeLeft < 60 * 1000;        // under 1 min → flash

  const bgColor = isCritical
    ? "oklch(0.45 0.2 25)"
    : isUrgent
    ? "oklch(0.45 0.15 60)"
    : "var(--color-primary)";

  return (
    <>
      {/* Spacer so page content isn't hidden behind this bar + bottom nav */}
      <div className="h-[56px] md:h-[48px]" />
      <div
        className={[
          "fixed left-0 right-0 z-40 flex items-center justify-center gap-3 px-4 py-3 shadow-[0_-2px_16px_rgba(0,0,0,0.15)]",
          // On mobile sit above the 56px bottom nav; on desktop sit at bottom-0
          "bottom-[56px] md:bottom-0",
          isFlashing ? "animate-pulse" : "",
        ].join(" ")}
        style={{ background: bgColor, transition: "background 1s ease" }}
      >
        <Timer size={15} className="shrink-0" style={{ color: "rgba(255,255,255,0.8)" }} />
        <span className="text-white text-sm font-medium" style={{ opacity: 0.9 }}>
          Locks in
        </span>
        <span
          className="text-white font-mono font-bold text-base tabular-nums"
          style={{ letterSpacing: "0.1em" }}
        >
          {hours > 0 ? `${pad(hours)}:` : ""}{pad(minutes)}:{pad(seconds)}
        </span>
        {isCritical && (
          <span className="text-white text-xs font-semibold" style={{ opacity: 0.9 }}>
            — Make your pick now!
          </span>
        )}
      </div>
    </>
  );
}
