import { useAuth } from "@/_core/hooks/useAuth";
import { SignInButton } from "@clerk/clerk-react";
import { trpc } from "@/lib/trpc";
import PublicLayout from "@/components/PublicLayout";
import { Link } from "wouter";
import {
  User,
  Flame,
  Trophy,
  TrendingUp,
  ArrowRight,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";

export default function PlayerProfile() {
  const { isAuthenticated, user, loading } = useAuth();
  const { data: myStat } = trpc.scores.getMyLeaderboardStat.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: myStreak } = trpc.streaks.getMyStreak.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: myHistory } = trpc.scores.getMyHistory.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  if (loading) {
    return (
      <PublicLayout>
        <div className="container py-24 flex justify-center">
          <Loader2 size={28} className="animate-spin" style={{ color: "var(--color-brand)" }} />
        </div>
      </PublicLayout>
    );
  }

  if (!isAuthenticated) {
    return (
      <PublicLayout>
        <div className="container py-24 text-center">
          <User size={48} className="mx-auto mb-6" style={{ color: "var(--color-muted)" }} />
          <h2 className="font-display mb-3" style={{ color: "var(--color-foreground)" }}>
            Sign in to view your profile
          </h2>
          <SignInButton mode="modal">
            <button className="btn-brand">
              Sign in <ArrowRight size={16} />
            </button>
          </SignInButton>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="container py-10 max-w-2xl mx-auto">
        {/* Profile header */}
        <div className="flex items-center gap-4 mb-8 animate-fade-up">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold flex-shrink-0"
            style={{ background: "var(--color-brand)", color: "var(--color-brand-foreground)" }}
          >
            {(user?.name ?? "?")[0]?.toUpperCase()}
          </div>
          <div>
            <h1 className="font-display text-2xl" style={{ color: "var(--color-foreground)" }}>
              {user?.name ?? "Player"}
            </h1>
            <p className="text-sm" style={{ color: "var(--color-muted)" }}>
              {myStat?.qualificationStatus === "qualified" ? "Qualified player" : `${myStat?.gamesPlayed ?? 0} / 20 games to qualify`}
            </p>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mb-8 animate-fade-up delay-75">
          <div className="card-glass p-4 text-center">
            <Trophy size={18} className="mx-auto mb-2" style={{ color: "var(--color-brand)" }} />
            <p className="font-display text-2xl font-bold" style={{ color: "var(--color-brand)" }}>
              {myStat ? parseFloat(myStat.averageDailyScore).toFixed(1) : "—"}
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--color-subtle)" }}>Avg Score</p>
          </div>
          <div className="card-glass p-4 text-center">
            <TrendingUp size={18} className="mx-auto mb-2" style={{ color: "var(--color-brand)" }} />
            <p className="font-display text-2xl font-bold" style={{ color: "var(--color-foreground)" }}>
              {myStat?.gamesPlayed ?? 0}
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--color-subtle)" }}>Games Played</p>
          </div>
          <div className="card-glass p-4 text-center">
            <Flame size={18} className="mx-auto mb-2" style={{ color: "oklch(0.75 0.18 35)" }} />
            <p className="font-display text-2xl font-bold" style={{ color: "var(--color-foreground)" }}>
              {myStreak?.currentStreak ?? 0}
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--color-subtle)" }}>
              {myStreak?.awayStatus === "away" ? "Away (streak protected)" : "Day streak"}
            </p>
          </div>
        </div>

        {/* Streak status */}
        {myStreak?.awayStatus === "away" && (
          <div
            className="card-glass p-4 mb-6 flex items-center gap-3 animate-fade-up delay-100"
            style={{ borderColor: "oklch(0.75 0.18 35 / 0.5)" }}
          >
            <Flame size={18} style={{ color: "oklch(0.75 0.18 35)" }} />
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--color-foreground)" }}>
                Away Status Active
              </p>
              <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                Your streak is protected while you are marked as away.
              </p>
            </div>
          </div>
        )}

        {/* Score history */}
        <div className="animate-fade-up delay-150">
          <h2 className="font-display text-lg mb-4" style={{ color: "var(--color-foreground)" }}>
            Recent Games
          </h2>
          {!myHistory || myHistory.length === 0 ? (
            <div className="card-glass p-8 text-center">
              <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                No completed games yet. Play today's game to get started.
              </p>
              <Link href="/game" className="btn-brand mt-4 inline-flex">
                Play Today's Game <ArrowRight size={15} />
              </Link>
            </div>
          ) : (
            <div className="card-glass overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                    <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-subtle)" }}>
                      Date
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider hidden sm:table-cell" style={{ color: "var(--color-subtle)" }}>
                      Prediction
                    </th>
                    <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-subtle)" }}>
                      Score
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {myHistory.map((score, i) => (
                    <tr
                      key={score.id}
                      style={{ borderBottom: i < myHistory.length - 1 ? "1px solid var(--color-border)" : undefined }}
                    >
                      <td className="px-5 py-3 text-sm" style={{ color: "var(--color-muted)" }}>
                        {new Date(score.calculatedAt).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3 hidden sm:table-cell">
                        {score.predictionScore === 80 ? (
                          <span className="flex items-center gap-1 text-xs" style={{ color: "var(--color-success)" }}>
                            <CheckCircle2 size={12} /> Correct
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs" style={{ color: "var(--color-error)" }}>
                            <XCircle size={12} /> Incorrect
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span
                          className="font-display font-bold tabular-nums"
                          style={{
                            color: score.totalScore >= 80 ? "var(--color-success)" : score.totalScore >= 20 ? "var(--color-brand)" : "var(--color-muted)",
                          }}
                        >
                          {score.totalScore}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </PublicLayout>
  );
}
