import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useParams } from "wouter";
import PublicLayout from "@/components/PublicLayout";
import { Link } from "wouter";
import {
  Trophy,
  Brain,
  TrendingUp,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Loader2,
  Users,
} from "lucide-react";

export default function GameResult() {
  const { id } = useParams<{ id: string }>();
  const gameId = parseInt(id ?? "0", 10);
  const { isAuthenticated } = useAuth();

  const { data: game, isLoading } = trpc.games.getById.useQuery({ id: gameId });
  const { data: myPick } = trpc.picks.getMyPick.useQuery(
    { gameId },
    { enabled: isAuthenticated && !!gameId }
  );
  const { data: myScore } = trpc.scores.getMyScoreForGame.useQuery(
    { gameId },
    { enabled: isAuthenticated && !!gameId }
  );
  const { data: communityStats } = trpc.games.getCommunityStats.useQuery({ gameId });
  const { data: validationQ } = trpc.games.getValidationQuestion.useQuery({ gameId });

  if (isLoading) {
    return (
      <PublicLayout>
        <div className="container py-24 flex justify-center">
          <Loader2 size={32} className="animate-spin" style={{ color: "var(--color-brand)" }} />
        </div>
      </PublicLayout>
    );
  }

  if (!game || game.status !== "result_published") {
    return (
      <PublicLayout>
        <div className="container py-24 text-center">
          <p style={{ color: "var(--color-muted)" }}>
            Results are not yet published for this game.
          </p>
          <Link href="/game" className="btn-ghost mt-4 inline-flex">
            <ArrowLeft size={15} /> Back to Today's Game
          </Link>
        </div>
      </PublicLayout>
    );
  }

  const winner = game.winner;
  const winnerName = winner === "A" ? game.companyAName : game.companyBName;
  const winnerTicker = winner === "A" ? game.companyATicker : game.companyBTicker;

  const gutCorrect = myPick?.gutSelection === winner;
  const finalCorrect = myPick?.finalSelection === winner;
  const validationCorrect =
    validationQ && myPick?.validationAnswer === validationQ.correctAnswer;

  return (
    <PublicLayout>
      <div className="container py-10 max-w-3xl mx-auto">
        <Link href="/game" className="btn-ghost text-sm mb-6 inline-flex">
          <ArrowLeft size={14} /> Back to Today's Game
        </Link>

        {/* Winner banner */}
        <div
          className="card-glass p-8 text-center mb-6 animate-fade-up"
          style={{
            borderColor: "var(--color-brand)",
            boxShadow: "0 0 0 1px var(--color-brand), 0 16px 48px oklch(0.78 0.14 75 / 0.15)",
          }}
        >
          <Trophy size={40} className="mx-auto mb-4" style={{ color: "var(--color-brand)" }} />
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--color-brand)" }}>
            Today's Winner
          </p>
          <div className="ticker-chip mx-auto mb-2">{winnerTicker}</div>
          <h2 className="font-display text-2xl" style={{ color: "var(--color-foreground)" }}>
            {winnerName}
          </h2>
          {game.sector && (
            <p className="text-sm mt-1" style={{ color: "var(--color-subtle)" }}>
              {game.sector}
            </p>
          )}
        </div>

        {/* Player result */}
        {isAuthenticated && myPick && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 animate-fade-up delay-75">
            {/* Gut */}
            <div className="card-glass p-5 text-center">
              <Brain size={18} className="mx-auto mb-2" style={{ color: "var(--color-brand)" }} />
              <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--color-subtle)" }}>
                Gut Selection
              </p>
              <p className="font-semibold text-sm mb-2" style={{ color: "var(--color-foreground)" }}>
                {myPick.gutSelection === "A" ? game.companyATicker : game.companyBTicker}
              </p>
              {gutCorrect ? (
                <span className="text-xs flex items-center justify-center gap-1" style={{ color: "var(--color-success)" }}>
                  <CheckCircle2 size={12} /> Correct instinct
                </span>
              ) : (
                <span className="text-xs flex items-center justify-center gap-1" style={{ color: "var(--color-muted)" }}>
                  <XCircle size={12} /> Wrong instinct
                </span>
              )}
            </div>

            {/* Final */}
            <div className="card-glass p-5 text-center">
              <TrendingUp size={18} className="mx-auto mb-2" style={{ color: "var(--color-brand)" }} />
              <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--color-subtle)" }}>
                Final Selection
              </p>
              <p className="font-semibold text-sm mb-2" style={{ color: "var(--color-foreground)" }}>
                {myPick.finalSelection === "A" ? game.companyATicker : game.companyBTicker}
              </p>
              {finalCorrect ? (
                <span className="text-xs flex items-center justify-center gap-1" style={{ color: "var(--color-success)" }}>
                  <CheckCircle2 size={12} /> Correct
                </span>
              ) : (
                <span className="text-xs flex items-center justify-center gap-1" style={{ color: "var(--color-error)" }}>
                  <XCircle size={12} /> Incorrect
                </span>
              )}
            </div>

            {/* Score */}
            <div
              className="card-glass p-5 text-center"
              style={{
                borderColor: "var(--color-brand)",
                background: "oklch(0.18 0.02 75 / 0.6)",
              }}
            >
              <Trophy size={18} className="mx-auto mb-2" style={{ color: "var(--color-brand)" }} />
              <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--color-subtle)" }}>
                Daily Score
              </p>
              <p
                className="font-display text-3xl font-bold"
                style={{ color: "var(--color-brand)" }}
              >
                {myScore?.totalScore ?? "—"}
              </p>
              {myScore && (
                <p className="text-xs mt-1" style={{ color: "var(--color-subtle)" }}>
                  {myScore.predictionScore} prediction + {myScore.validationScore} validation
                </p>
              )}
            </div>
          </div>
        )}

        {/* Validation result */}
        {validationQ && myPick?.validationAnswer && (
          <div className="card-glass p-5 mb-6 animate-fade-up delay-100">
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--color-brand)" }}>
              Validation Question
            </p>
            <p className="text-sm font-medium mb-3" style={{ color: "var(--color-foreground)" }}>
              {validationQ.questionText}
            </p>
            <div className="flex items-center gap-3 text-sm">
              <span style={{ color: "var(--color-muted)" }}>
                Your answer: <strong>{myPick.validationAnswer}</strong>
              </span>
              <span style={{ color: "var(--color-subtle)" }}>·</span>
              <span style={{ color: "var(--color-muted)" }}>
                Correct: <strong>{validationQ.correctAnswer}</strong>
              </span>
              {validationCorrect ? (
                <CheckCircle2 size={15} style={{ color: "var(--color-success)" }} />
              ) : (
                <XCircle size={15} style={{ color: "var(--color-error)" }} />
              )}
            </div>
          </div>
        )}

        {/* Commentary */}
        {game.resultCommentary && (
          <div className="card-glass p-6 mb-6 animate-fade-up delay-150">
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--color-brand)" }}>
              Educational Commentary
            </p>
            <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--color-muted)" }}>
              {game.resultCommentary}
            </p>
          </div>
        )}

        {/* Community stats */}
        {communityStats && (
          <div className="card-glass p-6 animate-fade-up delay-200">
            <div className="flex items-center gap-2 mb-4">
              <Users size={16} style={{ color: "var(--color-brand)" }} />
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-brand)" }}>
                Community Stats
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs mb-1" style={{ color: "var(--color-subtle)" }}>
                  Gut picks for {game.companyATicker}
                </p>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--color-surface-raised)" }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${parseFloat(communityStats.gutPctA ?? '50')}%`, background: "var(--color-brand)",
                    }}
                  />
                </div>
                <p className="text-xs mt-1" style={{ color: "var(--color-muted)" }}>
                  {parseFloat(communityStats.gutPctA ?? '50').toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-xs mb-1" style={{ color: "var(--color-subtle)" }}>
                  Final picks for {game.companyATicker}
                </p>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--color-surface-raised)" }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${parseFloat(communityStats.finalPctA ?? '50')}%`, background: "var(--color-brand)",
                    }}
                  />
                </div>
                <p className="text-xs mt-1" style={{ color: "var(--color-muted)" }}>
                  {parseFloat(communityStats.finalPctA ?? '50').toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-center gap-4 mt-8">
          <Link href="/leaderboard" className="btn-brand">
            <Trophy size={15} /> View Leaderboard
          </Link>
          <Link href="/research" className="btn-ghost">
            Research Hub
          </Link>
        </div>
      </div>
    </PublicLayout>
  );
}
