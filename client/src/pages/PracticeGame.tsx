import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useState, useEffect, useRef } from "react";
import { Link, useRoute } from "wouter";
import PublicLayout from "@/components/PublicLayout";
import { usePageMeta } from "@/hooks/usePageMeta";
import { toast } from "sonner";
import ResearchMetricsPanel from "@/components/ResearchMetricsPanel";
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

type Step = "gut" | "research" | "final" | "done";

/**
 * Playing one archived game.
 *
 * Mirrors the live game's shape deliberately — gut pick, research, final pick,
 * timed question, result — because the point of practice is to rehearse the
 * real loop, not a simplified version of it.
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
  const [answer, setAnswer] = useState<string>("");
  const [showFullResearch, setShowFullResearch] = useState(false);
  const [result, setResult] = useState<null | {
    predictionScore: number;
    validationScore: number;
    dailyScore: number;
    winner: "A" | "B";
    correctAnswer: string | null;
    gameDate: string;
    companyAPerf: string | null;
    companyBPerf: string | null;
  }>(null);
  const questionShownAt = useRef<number | null>(null);

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
      setStep("final");
      questionShownAt.current = Date.now();
      utils.practice.getGame.invalidate({ gameId });
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const submitValidation = trpc.practice.submitValidation.useMutation({
    onSuccess: (r) => {
      setResult(r as typeof result);
      setStep("done");
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

  const options: string[] =
    question?.questionType === "multiple_choice"
      ? question.options ?? []
      : question?.questionType === "yes_no"
      ? ["Yes", "No"]
      : ["True", "False"];

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
            <ResearchMetricsPanel
              metrics={metrics}
              tickerA={game.companyATicker}
              tickerB={game.companyBTicker}
              companyAName={game.companyAName}
              companyBName={game.companyBName}
            />

            <div className="card-glass p-6">
              <h2 className="mb-4" style={{ color: "var(--color-foreground)" }}>
                Final Selection
              </h2>
              <CompanyButtons selected={finalChoice} onSelect={setFinalChoice} />
              <button
                className="btn-gold text-sm px-6 py-3 w-full justify-center"
                disabled={!finalChoice || submitFinal.isPending}
                onClick={() =>
                  finalChoice && submitFinal.mutate({ gameId, selection: finalChoice })
                }
              >
                {submitFinal.isPending ? <Loader2 size={15} className="animate-spin" /> : null}
                Submit final pick <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: validation question ── */}
        {step === "final" && (
          <div className="card-glass p-6 animate-scale-in">
            <h2 className="mb-2" style={{ color: "var(--color-foreground)" }}>
              Validation Question
            </h2>
            <p className="text-xs mb-5" style={{ color: "var(--color-subtle)" }}>
              Worth 20% of the score. Answering faster scores higher.
            </p>
            {!question ? (
              <div className="flex justify-center py-8">
                <Loader2 size={22} className="animate-spin" style={{ color: "var(--color-brand)" }} />
              </div>
            ) : (
              <>
                <p className="text-sm mb-5" style={{ color: "var(--color-foreground)" }}>
                  {question.questionText}
                </p>
                <div className="space-y-2 mb-5">
                  {options.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setAnswer(opt)}
                      className="w-full p-3 rounded-xl text-left text-sm transition-all active:scale-95"
                      style={{
                        background:
                          answer === opt
                            ? "var(--color-brand-muted)"
                            : "var(--color-surface-raised)",
                        border: `2px solid ${
                          answer === opt ? "var(--color-brand)" : "var(--color-border)"
                        }`,
                        color: "var(--color-foreground)",
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                <button
                  className="btn-gold text-sm px-6 py-3 w-full justify-center"
                  disabled={!answer || submitValidation.isPending}
                  onClick={() =>
                    submitValidation.mutate({
                      gameId,
                      answer,
                      answerTimeMs: questionShownAt.current
                        ? Date.now() - questionShownAt.current
                        : undefined,
                    })
                  }
                >
                  {submitValidation.isPending ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : null}
                  Submit answer
                </button>
              </>
            )}
          </div>
        )}

        {/* ── Step 4: result ── */}
        {step === "done" && (
          <div className="card-glass p-6 animate-scale-in text-center">
            <Trophy size={36} className="mx-auto mb-4" style={{ color: "var(--color-brand)" }} />
            {result ? (
              <>
                <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "var(--color-subtle)" }}>
                  Practice score
                </p>
                <p
                  className="font-display text-5xl font-bold mb-5"
                  style={{ color: "var(--color-brand)" }}
                >
                  {result.dailyScore}
                </p>
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
    </PublicLayout>
  );
}
