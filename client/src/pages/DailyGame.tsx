import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import { Link } from "wouter";
import PublicLayout from "@/components/PublicLayout";
import { toast } from "sonner";
import {
  Brain,
  BookOpen,
  CheckCircle2,
  Lock,
  ArrowRight,
  Clock,
  AlertCircle,
  TrendingUp,
  Loader2,
} from "lucide-react";

type GameStep = "gut" | "research" | "final" | "submitted";

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
  const [validationAnswer, setValidationAnswer] = useState<string>("");

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
    onError: (e: {message: string}) => toast.error(e.message),
  });

  const submitFinal = trpc.picks.submitFinal.useMutation({
    onSuccess: () => {
      setStep("submitted");
      toast.success("Final selection submitted. Good luck!");
    },
    onError: (e: {message: string}) => toast.error(e.message),
  });

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
          <a href={getLoginUrl()} className="btn-brand">
            Sign in to Play
            <ArrowRight size={16} />
          </a>
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
            const showSelected = step === "submitted"
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

            {/* Validation question */}
            {validationQ && (
              <div
                className="mb-6 p-4 rounded-xl"
                style={{
                  background: "var(--color-surface-raised)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <p
                  className="text-xs font-semibold uppercase tracking-wider mb-3"
                  style={{ color: "var(--color-brand)" }}
                >
                  Validation Question (20% of score)
                </p>
                <p
                  className="text-sm font-medium mb-4"
                  style={{ color: "var(--color-foreground)" }}
                >
                  {validationQ.questionText}
                </p>
                {/* Options */}
                {validationQ.questionType === "multiple_choice" && validationQ.options ? (
                  <div className="flex flex-col gap-2">
                    {validationQ.options.map((opt: string) => (
                      <button
                        key={opt}
                        onClick={() => setValidationAnswer(opt)}
                        className="text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-all"
                        style={{
                          background:
                            validationAnswer === opt
                              ? "var(--color-brand-muted)"
                              : "var(--color-surface)",
                          border: `1px solid ${validationAnswer === opt ? "var(--color-brand)" : "var(--color-border)"}`,
                          color:
                            validationAnswer === opt
                              ? "var(--color-brand)"
                              : "var(--color-muted)",
                        }}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex gap-3">
                    {(validationQ.questionType === "yes_no"
                      ? ["Yes", "No"]
                      : ["True", "False"]
                    ).map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setValidationAnswer(opt)}
                        className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all"
                        style={{
                          background:
                            validationAnswer === opt
                              ? "var(--color-brand-muted)"
                              : "var(--color-surface)",
                          border: `1px solid ${validationAnswer === opt ? "var(--color-brand)" : "var(--color-border)"}`,
                          color:
                            validationAnswer === opt
                              ? "var(--color-brand)"
                              : "var(--color-muted)",
                        }}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button
              className="btn-brand w-full justify-center"
              disabled={
                !finalSelection ||
                (!!validationQ && !validationAnswer) ||
                submitFinal.isPending
              }
              onClick={() => {
                if (!finalSelection || !game.id) return;
                submitFinal.mutate({
                  gameId: game.id,
                  selection: finalSelection,
                  validationAnswer: validationAnswer || "",
                });
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
              Your final selection is locked in. Results will be published after the game
              closes.
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
      </div>
    </PublicLayout>
  );
}
