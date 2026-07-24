import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import PublicLayout from "@/components/PublicLayout";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Trophy, Medal, Info, Loader2, TrendingUp } from "lucide-react";

export default function Leaderboard() {
  usePageMeta({ title: "Leaderboard | Munymo" });
  const { isAuthenticated, user } = useAuth();
  const { data: leaderboard, isLoading } = trpc.leaderboard.get.useQuery();
  const { data: provisional } = trpc.leaderboard.getProvisional.useQuery();
  const { data: myStat } = trpc.scores.getMyLeaderboardStat.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const medalColors = [
    "oklch(0.78 0.14 75)", // gold
    "oklch(0.75 0.05 220)", // silver
    "oklch(0.65 0.08 40)", // bronze
  ];

  return (
    <PublicLayout>
      <div className="container py-10 max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8 animate-fade-up">
          <div className="flex items-center gap-3 mb-2">
            <Trophy size={28} style={{ color: "var(--color-brand)" }} />
            <h1 className="font-display text-3xl" style={{ color: "var(--color-foreground)" }}>
              Leaderboard
            </h1>
          </div>
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            Ranked by Average Daily Score. Qualification requires 20 completed games.
          </p>
        </div>

        {/* My stat card (if authenticated and not yet qualified) */}
        {isAuthenticated && myStat && myStat.qualificationStatus === "pending" && (
          <div
            className="card-glass p-4 mb-6 flex items-center gap-4 animate-fade-up delay-75"
            style={{ borderColor: "var(--color-brand-muted)" }}
          >
            <Info size={18} style={{ color: "var(--color-brand)" }} />
            <div className="flex-1">
              <p className="text-sm font-medium" style={{ color: "var(--color-foreground)" }}>
                Your Progress
              </p>
              <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                {myStat.gamesPlayed} / 20 games played — {20 - myStat.gamesPlayed} more to qualify
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs" style={{ color: "var(--color-subtle)" }}>Avg Score</p>
              <p className="font-display text-lg font-bold" style={{ color: "var(--color-brand)" }}>
                {parseFloat(myStat.averageDailyScore).toFixed(1)}
              </p>
            </div>
          </div>
        )}

        {/* Leaderboard table */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={28} className="animate-spin" style={{ color: "var(--color-brand)" }} />
          </div>
        ) : !leaderboard || leaderboard.length === 0 ? (
          <div className="card-glass p-12 text-center">
            <TrendingUp size={40} className="mx-auto mb-4" style={{ color: "var(--color-subtle)" }} />
            <p className="font-medium mb-2" style={{ color: "var(--color-foreground)" }}>
              No qualified players yet
            </p>
            <p className="text-sm" style={{ color: "var(--color-muted)" }}>
              Players appear here after completing 20 games.
            </p>
          </div>
        ) : (
          <div className="card-glass overflow-hidden animate-fade-up delay-100">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                  <th
                    className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider"
                    style={{ color: "var(--color-subtle)" }}
                  >
                    Rank
                  </th>
                  <th
                    className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider"
                    style={{ color: "var(--color-subtle)" }}
                  >
                    Player
                  </th>
                  <th
                    className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wider"
                    style={{ color: "var(--color-subtle)" }}
                  >
                    Avg Score
                  </th>
                  <th
                    className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wider hidden sm:table-cell"
                    style={{ color: "var(--color-subtle)" }}
                  >
                    Games
                  </th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((entry, i) => {
                  const isMe = user && entry.userId === user.id;
                  const rank = i + 1;
                  return (
                    <tr
                      key={entry.userId}
                      style={{
                        borderBottom: i < leaderboard.length - 1 ? "1px solid var(--color-border)" : undefined,
                        background: isMe ? "oklch(0.78 0.14 75 / 0.06)" : undefined,
                      }}
                    >
                      <td className="px-5 py-4">
                        {rank <= 3 ? (
                          <Medal size={18} style={{ color: medalColors[rank - 1] }} />
                        ) : (
                          <span
                            className="text-sm font-semibold tabular-nums"
                            style={{ color: "var(--color-subtle)" }}
                          >
                            {rank}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                            style={{
                              background: isMe ? "var(--color-brand)" : "var(--color-surface-raised)",
                              color: isMe ? "var(--color-brand-foreground)" : "var(--color-muted)",
                            }}
                          >
                            {(entry.userName ?? "?")[0]?.toUpperCase()}
                          </div>
                          <div>
                            <p
                              className="text-sm font-medium"
                              style={{ color: isMe ? "var(--color-brand)" : "var(--color-foreground)" }}
                            >
                              {entry.userName ?? "Anonymous"}
                              {isMe && (
                                <span
                                  className="ml-2 text-xs font-normal"
                                  style={{ color: "var(--color-brand)" }}
                                >
                                  (you)
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span
                          className="font-display text-lg font-bold tabular-nums"
                          style={{ color: rank <= 3 ? medalColors[rank - 1] : "var(--color-foreground)" }}
                        >
                          {parseFloat(entry.averageDailyScore).toFixed(1)}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right hidden sm:table-cell">
                        <span className="text-sm tabular-nums" style={{ color: "var(--color-muted)" }}>
                          {entry.gamesPlayed}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Provisional Rankings */}
        {provisional && provisional.length > 0 && (
          <div className="mt-10 animate-fade-up delay-150">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={18} style={{ color: "var(--color-muted)" }} />
              <h2 className="font-display text-lg" style={{ color: "var(--color-muted)" }}>
                Provisional Rankings
              </h2>
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: "var(--color-surface-raised)", color: "var(--color-subtle)" }}
              >
                &lt; 20 games
              </span>
            </div>
            <p className="text-xs mb-4" style={{ color: "var(--color-subtle)" }}>
              Players still working toward the 20-game qualification threshold. Scores are not yet official.
            </p>
            <div className="card-glass overflow-hidden opacity-70">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                    <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-subtle)" }}>Rank</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-subtle)" }}>Player</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-subtle)" }}>Avg Score</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wider hidden sm:table-cell" style={{ color: "var(--color-subtle)" }}>Games</th>
                  </tr>
                </thead>
                <tbody>
                  {provisional.map((entry, i) => {
                    const isMe = user && entry.userId === user.id;
                    return (
                      <tr
                        key={entry.userId}
                        style={{
                          borderBottom: i < provisional.length - 1 ? "1px solid var(--color-border)" : undefined,
                          background: isMe ? "oklch(0.78 0.14 75 / 0.06)" : undefined,
                        }}
                      >
                        <td className="px-5 py-3">
                          <span className="text-sm font-semibold tabular-nums" style={{ color: "var(--color-subtle)" }}>
                            {i + 1}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                              style={{
                                background: isMe ? "var(--color-brand)" : "var(--color-surface-raised)",
                                color: isMe ? "var(--color-brand-foreground)" : "var(--color-muted)",
                              }}
                            >
                              {(entry.userName ?? "?")[0]?.toUpperCase()}
                            </div>
                            <p className="text-sm" style={{ color: isMe ? "var(--color-brand)" : "var(--color-foreground)" }}>
                              {entry.userName ?? "Anonymous"}
                              {isMe && <span className="ml-2 text-xs" style={{ color: "var(--color-brand)" }}>(you)</span>}
                            </p>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span className="font-display text-base font-bold tabular-nums" style={{ color: "var(--color-muted)" }}>
                            {parseFloat(entry.averageDailyScore).toFixed(1)}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right hidden sm:table-cell">
                          <span className="text-xs tabular-nums" style={{ color: "var(--color-subtle)" }}>
                            {entry.gamesPlayed} / 20
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
