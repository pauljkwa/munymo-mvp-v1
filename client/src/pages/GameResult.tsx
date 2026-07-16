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
  Lightbulb,
  FileText,
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
  const { data: myStreak } = trpc.streaks.getMyStreak.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

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
  const winnerName   = winner === "A" ? game.companyAName   : game.companyBName;
  const winnerTicker = winner === "A" ? game.companyATicker : game.companyBTicker;
  const loserTicker  = winner === "A" ? game.companyBTicker : game.companyATicker;

  const gutCorrect       = myPick?.gutSelection === winner;
  const finalCorrect     = myPick?.finalSelection === winner;
  const validationCorrect =
    validationQ && myPick?.validationAnswer === validationQ.correctAnswer;

  const totalPlayers = communityStats?.totalParticipants ?? 0;
  const hasParticipants = totalPlayers > 0;
  const gutPctA    = hasParticipants ? parseFloat(communityStats?.gutPctA   ?? "0") : null;
  const finalPctA  = hasParticipants ? parseFloat(communityStats?.finalPctA ?? "0") : null;
  const gutPctB    = gutPctA !== null ? 100 - gutPctA : null;
  const finalPctB  = finalPctA !== null ? 100 - finalPctA : null;

  const scoreColour =
    !myScore ? "var(--color-subtle)"
    : myScore.totalScore >= 80 ? "var(--color-success)"
    : myScore.totalScore >= 50 ? "var(--color-warning)"
    : "var(--color-danger)";

  return (
    <PublicLayout>
      <div className="container py-10 max-w-3xl mx-auto">
        <Link href="/game" className="btn-ghost text-sm mb-6 inline-flex">
          <ArrowLeft size={14} /> Back to Today's Game
        </Link>

        {/* ── Winner banner ── */}
        <div
          className="card-glass p-8 text-center mb-6 animate-fade-up"
          style={{
            borderColor: "var(--color-brand)",
            boxShadow: "0 0 0 1px var(--color-brand), 0 16px 48px oklch(0.35 0.10 160 / 0.12)",
          }}
        >
          <Trophy size={40} className="mx-auto mb-4" style={{ color: "var(--color-brand)" }} />
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--color-brand)" }}>
            {game.gameDate} — Winner
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
          <p className="text-sm mt-2" style={{ color: "var(--color-muted)" }}>
            defeated <span className="font-semibold">{loserTicker}</span>
          </p>
        </div>

        {/* ── Performance comparison ── */}
        {(game.companyAPerf != null || game.companyBPerf != null) && (() => {
          const perfA = game.companyAPerf != null ? parseFloat(String(game.companyAPerf)) : null;
          const perfB = game.companyBPerf != null ? parseFloat(String(game.companyBPerf)) : null;
          const startA = game.companyAStartPrice != null ? parseFloat(String(game.companyAStartPrice)) : null;
          const endA = game.companyAEndPrice != null ? parseFloat(String(game.companyAEndPrice)) : null;
          const startB = game.companyBStartPrice != null ? parseFloat(String(game.companyBStartPrice)) : null;
          const endB = game.companyBEndPrice != null ? parseFloat(String(game.companyBEndPrice)) : null;
          const fmt = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
          const fmtPrice = (v: number) => `$${v.toFixed(2)}`;
          const margin = perfA != null && perfB != null ? Math.abs(perfA - perfB) : null;
          return (
            <div className="card-glass p-5 mb-6 animate-fade-up delay-75">
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--color-brand)" }}>
                Price Movement
              </p>
              <div className="grid grid-cols-2 gap-3 mb-3">
                {(["A", "B"] as const).map((side) => {
                  const ticker = side === "A" ? game.companyATicker : game.companyBTicker;
                  const name = side === "A" ? game.companyAName : game.companyBName;
                  const perf = side === "A" ? perfA : perfB;
                  const start = side === "A" ? startA : startB;
                  const end = side === "A" ? endA : endB;
                  const isWinner = game.winner === side;
                  const perfColor = perf == null ? "var(--color-subtle)" : perf >= 0 ? "var(--color-success)" : "var(--color-danger)";
                  return (
                    <div
                      key={side}
                      className="rounded-xl p-4 text-center"
                      style={{
                        background: isWinner ? "var(--color-brand)10" : "var(--color-surface-raised)",
                        border: `1px solid ${isWinner ? "var(--color-brand)40" : "var(--color-border)"}`,
                      }}
                    >
                      <div className="flex items-center justify-center gap-1.5 mb-1">
                        {isWinner && <Trophy size={12} style={{ color: "var(--color-brand)" }} />}
                        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: isWinner ? "var(--color-brand)" : "var(--color-subtle)" }}>
                          {ticker}
                        </span>
                      </div>
                      <p className="text-[0.625rem] mb-2 truncate" style={{ color: "var(--color-subtle)" }}>{name}</p>
                      <p className="text-2xl font-bold font-mono" style={{ color: perfColor }}>
                        {perf != null ? fmt(perf) : "—"}
                      </p>
                      <p className="text-[0.625rem] mt-1" style={{ color: "var(--color-subtle)" }}>day's change</p>
                      {start != null && end != null && (
                        <p className="text-xs font-mono mt-2" style={{ color: "var(--color-muted)" }}>
                          {fmtPrice(start)} → {fmtPrice(end)}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
              {margin != null && (
                <p className="text-xs text-center" style={{ color: "var(--color-muted)" }}>
                  Winning margin: <span className="font-semibold" style={{ color: "var(--color-foreground)" }}>{margin.toFixed(2)}%</span>
                </p>
              )}
            </div>
          );
        })()}

        {/* ── Player result (played) ── */}
        {isAuthenticated && myPick && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 animate-fade-up delay-75">
            {/* Gut */}
            <div className="card-glass p-5 text-center">
              <Brain size={18} className="mx-auto mb-2" style={{ color: "var(--color-brand)" }} />
              <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--color-subtle)" }}>
                Gut Selection
              </p>
              <p className="font-semibold text-sm mb-2" style={{ color: "var(--color-foreground)" }}>
                {myPick.gutSelection === "A" ? game.companyATicker : myPick.gutSelection === "B" ? game.companyBTicker : "—"}
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
                {myPick.finalSelection === "A" ? game.companyATicker : myPick.finalSelection === "B" ? game.companyBTicker : "—"}
              </p>
              {finalCorrect ? (
                <span className="text-xs flex items-center justify-center gap-1" style={{ color: "var(--color-success)" }}>
                  <CheckCircle2 size={12} /> Correct
                </span>
              ) : (
                <span className="text-xs flex items-center justify-center gap-1" style={{ color: "var(--color-danger)" }}>
                  <XCircle size={12} /> Incorrect
                </span>
              )}
            </div>

            {/* Score */}
            <div
              className="card-glass p-5 text-center"
              style={{ borderColor: "var(--color-brand)" }}
            >
              <Trophy size={18} className="mx-auto mb-2" style={{ color: "var(--color-brand)" }} />
              <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--color-subtle)" }}>
                Daily Score
              </p>
              <p className="font-display text-3xl font-bold" style={{ color: scoreColour }}>
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

        {/* ── Didn't play state ── */}
        {isAuthenticated && !myPick && (
          <div className="card-glass p-5 mb-6 text-center animate-fade-up delay-75" style={{ borderColor: "var(--color-border)" }}>
            <p className="text-sm font-medium mb-1" style={{ color: "var(--color-foreground)" }}>
              You didn't play this game
            </p>
            <p className="text-xs" style={{ color: "var(--color-muted)" }}>
              No score recorded — but you can still read the full debrief below.
            </p>
          </div>
        )}

        {/* ── Streak summary ── */}
        {isAuthenticated && myPick && myStreak && (
          <>
            {/* Losing streak intervention */}
            {(myStreak.currentLoseStreak ?? 0) >= 5 && (
              <div
                className="card-glass p-4 mb-4 animate-fade-up delay-75"
                style={{
                  borderColor: "var(--color-border)",
                  background: "var(--color-surface-raised)",
                }}
              >
                <p className="text-sm italic" style={{ color: "var(--color-muted)" }}>
                  {myStreak.currentLoseStreak} losses in a row — even the best analysts hit rough patches. Keep showing up; the edge comes from staying in the game.
                </p>
              </div>
            )}
            {/* Streak row */}
            <div
              className="card-glass p-4 mb-6 flex flex-wrap items-center gap-4 animate-fade-up delay-75"
              style={{ borderColor: "var(--color-border)" }}
            >
              <span className="text-sm" style={{ color: "var(--color-muted)" }}>
                🔥 {myStreak.currentStreak > 0 ? `${myStreak.currentStreak}-day streak` : "—"}
              </span>
              <span className="text-xs" style={{ color: "var(--color-subtle)" }}>·</span>
              <span className="text-sm" style={{ color: "var(--color-muted)" }}>
                ✅ {(myStreak.currentWinStreak ?? 0) > 0 ? `${myStreak.currentWinStreak} wins in a row` : "—"}
              </span>
              <span className="text-xs" style={{ color: "var(--color-subtle)" }}>·</span>
              <span className="text-sm" style={{ color: "var(--color-muted)" }}>
                ❌ {(myStreak.currentLoseStreak ?? 0) > 0 ? `${myStreak.currentLoseStreak} losses in a row` : "—"}
              </span>
            </div>
          </>
        )}

        {/* ── Validation question result ── */}
        {validationQ && myPick?.validationAnswer && (
          <div className="card-glass p-5 mb-6 animate-fade-up delay-100">
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--color-brand)" }}>
              Validation Question
            </p>
            <p className="text-sm font-medium mb-3" style={{ color: "var(--color-foreground)" }}>
              {validationQ.questionText}
            </p>
            <div className="flex flex-wrap items-center gap-3 text-sm">
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
                <XCircle size={15} style={{ color: "var(--color-danger)" }} />
              )}
            </div>
          </div>
        )}

        {/* ── Community stats ── */}
        {communityStats && (
          <div className="card-glass p-6 mb-6 animate-fade-up delay-150">
            <div className="flex items-center gap-2 mb-1">
              <Users size={16} style={{ color: "var(--color-brand)" }} />
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-brand)" }}>
                How the Crowd Voted
              </p>
            </div>
            <p className="text-xs mb-4" style={{ color: "var(--color-subtle)" }}>
              {totalPlayers} {totalPlayers === 1 ? "player" : "players"} participated
            </p>

            {!hasParticipants ? (
              <p className="text-sm py-4 text-center" style={{ color: "var(--color-subtle)" }}>
                No participants for this game.
              </p>
            ) : (
              <>
                {/* Gut picks */}
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--color-subtle)" }}>
                  Gut Picks
                </p>
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-xs w-12 text-right font-semibold" style={{ color: "var(--color-foreground)" }}>
                    {game.companyATicker}
                  </span>
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--color-surface-raised)" }}>
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${gutPctA}%`, background: "var(--color-brand)" }}
                    />
                  </div>
                  <span className="text-xs w-10 font-semibold" style={{ color: "var(--color-foreground)" }}>
                    {gutPctA!.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center gap-3 mb-5">
                  <span className="text-xs w-12 text-right font-semibold" style={{ color: "var(--color-foreground)" }}>
                    {game.companyBTicker}
                  </span>
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--color-surface-raised)" }}>
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${gutPctB}%`, background: "var(--color-gold)" }}
                    />
                  </div>
                  <span className="text-xs w-10 font-semibold" style={{ color: "var(--color-foreground)" }}>
                    {gutPctB!.toFixed(1)}%
                  </span>
                </div>

                {/* Final picks */}
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--color-subtle)" }}>
                  Final Picks
                </p>
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-xs w-12 text-right font-semibold" style={{ color: "var(--color-foreground)" }}>
                    {game.companyATicker}
                  </span>
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--color-surface-raised)" }}>
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${finalPctA}%`, background: "var(--color-brand)" }}
                    />
                  </div>
                  <span className="text-xs w-10 font-semibold" style={{ color: "var(--color-foreground)" }}>
                    {finalPctA!.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs w-12 text-right font-semibold" style={{ color: "var(--color-foreground)" }}>
                    {game.companyBTicker}
                  </span>
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--color-surface-raised)" }}>
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${finalPctB}%`, background: "var(--color-gold)" }}
                    />
                  </div>
                  <span className="text-xs w-10 font-semibold" style={{ color: "var(--color-foreground)" }}>
                    {finalPctB!.toFixed(1)}%
                  </span>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Result Summary (what happened) ── */}
        {(game.resultSummary || game.resultCommentary) && (
          <div className="card-glass p-6 mb-6 animate-fade-up delay-200">
            <div className="flex items-center gap-2 mb-3">
              <FileText size={16} style={{ color: "var(--color-brand)" }} />
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-brand)" }}>
                What Happened
              </p>
            </div>
            <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--color-muted)" }}>
              {game.resultSummary || game.resultCommentary}
            </p>
          </div>
        )}

        {/* ── Hindsight Spotlight ── */}
        {game.hindsightSpotlight && (
          <div
            className="card-glass p-6 mb-6 animate-fade-up delay-200"
            style={{ borderColor: "var(--color-gold)", background: "var(--color-gold-muted)" }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb size={16} style={{ color: "var(--color-gold)" }} />
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-gold)" }}>
                Hindsight Spotlight
              </p>
            </div>
            <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--color-foreground)" }}>
              {game.hindsightSpotlight}
            </p>
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
