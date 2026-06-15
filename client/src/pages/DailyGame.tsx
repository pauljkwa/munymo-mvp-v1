import { useAuth } from "@/_core/hooks/useAuth";
import { SignInButton } from "@clerk/clerk-react";
import { trpc } from "@/lib/trpc";
import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import PublicLayout from "@/components/PublicLayout";
import { CandlestickChart } from "@/components/CandlestickChart";
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
  result: { isCorrect: boolean; correctAnswer: string } | null;
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

        {/* ── Phase: Result ── */}
        {phase === "result" && result && (
          <>
            <div className="text-center mb-6">
              {result.isCorrect ? (
                <CheckCircle2 size={48} className="mx-auto mb-4" style={{ color: "#fff" }} />
              ) : (
                <XCircle size={48} className="mx-auto mb-4" style={{ color: "#fff" }} />
              )}
              <h3 className="font-display text-2xl mb-2" style={{ color: "#fff" }}>
                {result.isCorrect ? "Correct!" : "Incorrect"}
              </h3>
              {result.isCorrect ? (
                <p className="text-sm" style={{ color: "oklch(0.9 0.05 145)" }}>
                  Well done — your research paid off. The 20% validation score has been added.
                </p>
              ) : (
                <div>
                  <p className="text-sm mb-3" style={{ color: "oklch(0.9 0.05 25)" }}>
                    Not quite — the correct answer was:
                  </p>
                  <div
                    className="inline-block px-4 py-2 rounded-lg font-bold text-sm"
                    style={{ background: "oklch(0.25 0.1 25)", color: "#fff" }}
                  >
                    {result.correctAnswer}
                  </div>
                </div>
              )}
            </div>
            <button
              className="w-full py-3 rounded-xl font-semibold text-sm transition-all"
              style={{
                background: "oklch(1 0 0 / 0.15)",
                color: "#fff",
                border: "1px solid oklch(1 0 0 / 0.3)",
              }}
              onClick={onClose}
            >
              Continue
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main DailyGame Component ─────────────────────────────────────────────────

export default function DailyGame() {
  const { isAuthenticated } = useAuth();
  const { data: game, isLoading } = trpc.games.getToday.useQuery();

  const { data: myPick } = trpc.picks.getMyPick.useQuery(
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

  const [step, setStep] = useState<GameStep>("gut");
  const [gutSelection, setGutSelection] = useState<"A" | "B" | null>(null);
  const [finalSelection, setFinalSelection] = useState<"A" | "B" | null>(null);

  // Validation modal state
  const [modalPhase, setModalPhase] = useState<"confirm" | "question" | "result" | null>(null);
  const [validationResult, setValidationResult] = useState<{ isCorrect: boolean; correctAnswer: string } | null>(null);

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
      setValidationResult({ isCorrect: data.isCorrect, correctAnswer: data.correctAnswer });
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

  if (!isAuthenticated) {
    return (
      <PublicLayout>
        <div className="container py-24 text-center">
          <Brain size={48} className="mx-auto mb-6" style={{ color: "var(--color-brand)" }} />
          <h2 className="font-display mb-3" style={{ color: "var(--color-foreground)" }}>
            Sign in to Play
          </h2>
          <p className="mb-8" style={{ color: "var(--color-muted)" }}>
            Create a free account to make your daily prediction.
          </p>
          <SignInButton mode="modal">
            <button className="btn-brand">
              Sign in to Play
              <ArrowRight size={16} />
            </button>
          </SignInButton>
        </div>
      </PublicLayout>
    );
  }

  if (isLoading) {
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

  const stepLabels: GameStep[] = ["gut", "research", "final", "submitted"];
  const stepDisplayLabels = ["Gut Pick", "Research", "Final Pick", "Done"];
  const stepIndex = (s: GameStep) => stepLabels.indexOf(s);
  const currentIndex = stepIndex(step);

  return (
    <PublicLayout>
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
              Locks at {lockoutTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
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
                </div>
              )}
              {research?.content ? (
                <div>
                  <p
                    className="text-xs font-semibold uppercase tracking-wider mb-2"
                    style={{ color: "var(--color-brand)" }}
                  >
                    Research Notes
                  </p>
                  <div className="prose-munymo text-sm whitespace-pre-wrap">
                    {research.content}
                  </div>
                </div>
              ) : (
                <p className="text-sm" style={{ color: "var(--color-subtle)" }}>
                  No additional research notes provided for today's game.
                </p>
              )}

              {/* Research Metrics Table */}
              {research?.metrics && Object.keys(research.metrics as Record<string, string>).length > 0 && (
                <div className="mt-5">
                  <p
                    className="text-xs font-semibold uppercase tracking-wider mb-3"
                    style={{ color: "var(--color-brand)" }}
                  >
                    Key Metrics
                  </p>
                  <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--color-border)" }}>
                    <table className="w-full text-sm">
                      <tbody>
                        {Object.entries(research.metrics as Record<string, string>).map(([label, value], i, arr) => (
                          <tr
                            key={label}
                            style={{
                              borderBottom: i < arr.length - 1 ? "1px solid var(--color-border)" : undefined,
                              background: i % 2 === 0 ? "var(--color-surface)" : "transparent",
                            }}
                          >
                            <td className="px-4 py-2.5 font-medium" style={{ color: "var(--color-muted)" }}>
                              <div>{label}</div>
                              <MetricExplanationSheet metricLabel={label} />
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono font-semibold" style={{ color: "var(--color-foreground)" }}>{value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Candlestick Charts */}
              {game.companyATicker && game.companyBTicker && (
                <div className="mt-6 space-y-4">
                  <p
                    className="text-xs font-semibold uppercase tracking-wider"
                    style={{ color: "var(--color-brand)" }}
                  >
                    Price Charts
                  </p>
                  <CandlestickChart
                    ticker={game.companyATicker}
                    companyName={game.companyAName}
                    accentColor="#009050"
                  />
                  <CandlestickChart
                    ticker={game.companyBTicker}
                    companyName={game.companyBName}
                    accentColor="#1d4ed8"
                  />
                </div>
              )}
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
              onClick={() => setStep("final")}
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
        {step === "submitted" && (
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
            <Link href="/leaderboard" className="btn-ghost text-sm">
              View Leaderboard
            </Link>
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
            {/* Winner announcement */}
            {game.winner && (
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
                    {game.winner === "A" ? game.companyAName : game.companyBName} outperformed
                  </p>
                  {myPick?.finalSelection && (
                    <p className="text-sm mt-0.5" style={{ color: myPick.finalSelection === game.winner ? "var(--color-success)" : "var(--color-error)" }}>
                      {myPick.finalSelection === game.winner ? "✓ Your prediction was correct" : "✗ Your prediction was incorrect"}
                    </p>
                  )}
                </div>
              </div>
            )}

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
      </div>
    </PublicLayout>
  );
}
