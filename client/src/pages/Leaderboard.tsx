import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import PublicLayout from "@/components/PublicLayout";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Trophy, Medal, Info, Loader2, TrendingUp, Dices, CalendarDays, History } from "lucide-react";
// Single source of truth, shared with the server's qualification logic —
// this was five separate hardcoded 20s that would drift the moment the
// threshold changed.
import { LEADERBOARD_QUALIFICATION_GAMES as QUALIFY_GAMES, PERCENTILE_MIN_PLAYERS } from "@shared/const";
// Golf-style ranking shared with the server so the two cannot disagree.
import { assignCompetitionRanks, formatAverageScore } from "@shared/leaderboard";

type Tab = "season" | "alltime";

const medalColors = [
  "oklch(0.78 0.14 75)", // gold
  "oklch(0.75 0.05 220)", // silver
  "oklch(0.65 0.08 40)", // bronze
];

const th = "px-3 sm:px-5 py-3 text-xs font-semibold uppercase tracking-wider";

function Avatar({ name, isMe, isBenchmark, size = 8 }: { name: string | null; isMe: boolean; isBenchmark: boolean; size?: 7 | 8 }) {
  return (
    <div
      // Literal class strings: Tailwind only emits classes it can see in source.
      className={`${size === 8 ? "w-8 h-8" : "w-7 h-7"} rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0`}
      style={{
        background: isMe ? "var(--color-brand)" : "var(--color-surface-raised)",
        color: isMe ? "var(--color-brand-foreground)" : "var(--color-muted)",
      }}
    >
      {isBenchmark ? <Dices size={14} /> : (name ?? "?")[0]?.toUpperCase()}
    </div>
  );
}

function BenchmarkPill() {
  return (
    <span
      className="hidden sm:inline-block ml-2 text-[0.625rem] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full align-middle"
      style={{ background: "var(--color-surface-raised)", color: "var(--color-subtle)", border: "1px solid var(--color-border)" }}
    >
      benchmark
    </span>
  );
}

export default function Leaderboard() {
  usePageMeta({ title: "Leaderboard | Munymo" });
  const { isAuthenticated, user } = useAuth();
  const [tab, setTab] = useState<Tab>("season");
  const [seasonKey, setSeasonKey] = useState<string | undefined>(undefined);

  const { data: season, isLoading: seasonLoading } = trpc.leaderboard.season.useQuery(
    seasonKey ? { season: seasonKey } : undefined
  );
  const { data: leaderboard, isLoading } = trpc.leaderboard.get.useQuery();
  const { data: provisional } = trpc.leaderboard.getProvisional.useQuery();
  const { data: myStat } = trpc.scores.getMyLeaderboardStat.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  // Computed once per render rather than per row. The server already returns
  // the rows in display order (score, then games played, then id).
  const qualifiedRanks = assignCompetitionRanks(leaderboard ?? []);
  const provisionalRanks = assignCompetitionRanks(provisional ?? []);

  const mine = season?.standings.find((s) => user && s.userId === user.id) ?? null;
  const showPercentile = (season?.playerCount ?? 0) >= PERCENTILE_MIN_PLAYERS;

  return (
    <PublicLayout>
      <div className="container py-10 max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-6 animate-fade-up">
          <div className="flex items-center gap-3 mb-2">
            <Trophy size={28} style={{ color: "var(--color-brand)" }} />
            <h1 className="font-display text-3xl" style={{ color: "var(--color-foreground)" }}>
              Leaderboard
            </h1>
          </div>
          {/* Tabs */}
          <div
            className="inline-flex rounded-xl p-1 mt-2"
            style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border)" }}
            role="tablist"
          >
            {(
              [
                { id: "season", label: "This season", icon: CalendarDays },
                { id: "alltime", label: "All-time", icon: History },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all"
                style={{
                  background: tab === t.id ? "var(--color-surface)" : "transparent",
                  color: tab === t.id ? "var(--color-foreground)" : "var(--color-muted)",
                  boxShadow: tab === t.id ? "0 1px 2px oklch(0 0 0 / 0.08)" : undefined,
                }}
              >
                <t.icon size={14} /> {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ══════════════ SEASON TAB ══════════════ */}
        {tab === "season" && (
          <div className="animate-fade-up">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
              <h2 className="font-display text-xl" style={{ color: "var(--color-foreground)" }}>
                {season?.label ?? "This season"}
                {season && !season.isCurrent && (
                  <span className="ml-2 text-xs font-normal" style={{ color: "var(--color-subtle)" }}>
                    (finished)
                  </span>
                )}
              </h2>
              {season && season.seasons.length > 1 && (
                <select
                  value={season.season}
                  onChange={(e) => setSeasonKey(e.target.value)}
                  className="text-xs rounded-lg px-2 py-1.5"
                  style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-foreground)" }}
                  aria-label="Choose a season"
                >
                  {season.seasons.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <p className="text-sm mb-1" style={{ color: "var(--color-muted)" }}>
              Ranked by total points this month. Every game you play adds to your total, so you're
              on the board from your first game. The board resets on the 1st.
            </p>
            <p className="text-xs mb-6" style={{ color: "var(--color-subtle)" }}>
              <Dices size={11} className="inline -mt-0.5 mr-1" />
              <strong>Coin Flip</strong> is a bot that picks at random and guesses the question. It's on
              every board so you can see whether you're beating chance. Tied totals share a position;
              among ties, the higher average is listed first.
            </p>

            {/* My season card */}
            {isAuthenticated && season && (
              <div
                className="card-glass p-4 mb-6 flex items-center gap-4 animate-fade-up delay-75"
                style={{ borderColor: "var(--color-brand-muted)" }}
              >
                <Info size={18} style={{ color: "var(--color-brand)" }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: "var(--color-foreground)" }}>
                    {mine
                      ? `You're ${mine.rank}${ordinal(mine.rank)} of ${season.playerCount} this month`
                      : season.isCurrent
                        ? "You're not on this month's board yet"
                        : "You didn't play this season"}
                  </p>
                  <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                    {mine
                      ? `${mine.points} points from ${mine.games} ${mine.games === 1 ? "game" : "games"} · average ${formatAverageScore(mine.average)}` +
                        (season.benchmark && !mine.isBenchmark
                          ? ` · ${describeVsBenchmark(mine.points, season.benchmark.points)}`
                          : "")
                      : season.isCurrent
                        ? "Play today's game and you're on it."
                        : ""}
                  </p>
                </div>
                {mine && (
                  <div className="text-right">
                    <p className="text-xs" style={{ color: "var(--color-subtle)" }}>Points</p>
                    <p className="font-display text-lg font-bold" style={{ color: "var(--color-brand)" }}>
                      {mine.points}
                    </p>
                  </div>
                )}
              </div>
            )}

            {seasonLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 size={28} className="animate-spin" style={{ color: "var(--color-brand)" }} />
              </div>
            ) : !season || season.standings.length === 0 ? (
              <div className="card-glass p-12 text-center">
                <TrendingUp size={40} className="mx-auto mb-4" style={{ color: "var(--color-subtle)" }} />
                <p className="font-medium mb-2" style={{ color: "var(--color-foreground)" }}>
                  No games scored yet this season
                </p>
                <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                  The board fills in after the first result of the month is published.
                </p>
              </div>
            ) : (
              <div className="card-glass overflow-hidden animate-fade-up delay-100">
                <table className="w-full table-fixed">
                  <colgroup>
                    <col className={showPercentile ? "w-20 sm:w-28" : "w-12 sm:w-16"} />
                    <col />
                    <col className="w-20 sm:w-24" />
                    <col className="hidden sm:table-column w-20" />
                    <col className="hidden sm:table-column w-20" />
                  </colgroup>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                      <th className={`text-left ${th}`} style={{ color: "var(--color-subtle)" }}>Rank</th>
                      <th className={`text-left ${th}`} style={{ color: "var(--color-subtle)" }}>Player</th>
                      <th className={`text-right ${th} whitespace-nowrap`} style={{ color: "var(--color-subtle)" }}>Points</th>
                      <th className={`text-right ${th} hidden sm:table-cell`} style={{ color: "var(--color-subtle)" }}>Games</th>
                      <th className={`text-right ${th} hidden sm:table-cell`} style={{ color: "var(--color-subtle)" }}>Avg</th>
                    </tr>
                  </thead>
                  <tbody>
                    {season.standings.map((entry, i) => {
                      const isMe = !!user && entry.userId === user.id;
                      const rank = entry.rank;
                      const muted = entry.isBenchmark;
                      return (
                        <tr
                          key={entry.userId}
                          style={{
                            borderBottom: i < season.standings.length - 1 ? "1px solid var(--color-border)" : undefined,
                            background: isMe ? "oklch(0.78 0.14 75 / 0.06)" : muted ? "var(--color-surface-raised)" : undefined,
                            opacity: muted ? 0.75 : 1,
                          }}
                        >
                          <td className="px-3 sm:px-5 py-4">
                            <div className="flex items-center gap-2">
                              {rank <= 3 && !muted ? (
                                <Medal size={18} style={{ color: medalColors[rank - 1] }} />
                              ) : (
                                <span className="text-sm font-semibold tabular-nums" style={{ color: "var(--color-subtle)" }}>
                                  {rank}
                                </span>
                              )}
                              {showPercentile && !muted && (
                                <span className="text-[0.625rem] whitespace-nowrap" style={{ color: "var(--color-subtle)" }}>
                                  Top {entry.percentile}%
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 sm:px-5 py-4 overflow-hidden">
                            <div className="flex items-center gap-3 min-w-0">
                              <Avatar name={entry.userName} isMe={isMe} isBenchmark={entry.isBenchmark} />
                              <div className="min-w-0">
                                <p
                                  className="text-sm font-medium truncate"
                                  style={{ color: isMe ? "var(--color-brand)" : "var(--color-foreground)" }}
                                >
                                  {entry.userName ?? "Anonymous"}
                                  {isMe && (
                                    <span className="ml-2 text-xs font-normal" style={{ color: "var(--color-brand)" }}>
                                      (you)
                                    </span>
                                  )}
                                  {entry.isBenchmark && <BenchmarkPill />}
                                </p>
                                <p className="sm:hidden text-[0.6875rem] truncate mt-0.5" style={{ color: "var(--color-subtle)" }}>
                                  {entry.isBenchmark ? "Benchmark · " : ""}{entry.games} {entry.games === 1 ? "game" : "games"} · avg {formatAverageScore(entry.average)}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 sm:px-5 py-4 text-right whitespace-nowrap">
                            <span
                              className="font-display text-lg font-bold tabular-nums"
                              style={{ color: rank <= 3 && !muted ? medalColors[rank - 1] : "var(--color-foreground)" }}
                            >
                              {entry.points}
                            </span>
                          </td>
                          <td className="px-3 sm:px-5 py-4 text-right hidden sm:table-cell">
                            <span className="text-sm tabular-nums" style={{ color: "var(--color-muted)" }}>
                              {entry.games}
                            </span>
                          </td>
                          <td className="px-3 sm:px-5 py-4 text-right hidden sm:table-cell">
                            <span className="text-sm tabular-nums" style={{ color: "var(--color-muted)" }}>
                              {formatAverageScore(entry.average)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Past seasons */}
            {season && season.pastSeasons.length > 0 && (
              <div className="mt-10 animate-fade-up delay-150">
                <div className="flex items-center gap-2 mb-3">
                  <History size={18} style={{ color: "var(--color-muted)" }} />
                  <h2 className="font-display text-lg" style={{ color: "var(--color-muted)" }}>
                    Past seasons
                  </h2>
                </div>
                <div className="card-glass overflow-hidden">
                  {season.pastSeasons.map((ps, i) => (
                    <button
                      key={ps.season}
                      onClick={() => setSeasonKey(ps.season)}
                      className="w-full flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 px-4 sm:px-5 py-3 text-left hover:opacity-80"
                      style={{ borderBottom: i < season.pastSeasons.length - 1 ? "1px solid var(--color-border)" : undefined }}
                    >
                      <span className="text-sm font-medium" style={{ color: "var(--color-foreground)" }}>
                        {ps.label}
                      </span>
                      <span className="text-xs" style={{ color: "var(--color-muted)" }}>
                        <Trophy size={11} className="inline -mt-0.5 mr-1" style={{ color: medalColors[0] }} />
                        {ps.winnerName ?? "Anonymous"} · {ps.winnerPoints} pts · {ps.players} {ps.players === 1 ? "player" : "players"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════ ALL-TIME TAB ══════════════ */}
        {tab === "alltime" && (
          <div className="animate-fade-up">
            <p className="text-sm" style={{ color: "var(--color-muted)" }}>
              Ranked by Average Daily Score over every game you've played. Qualification requires {QUALIFY_GAMES} completed games.
            </p>
            {/* The threshold reads as an arbitrary gamified gate unless the
                reasoning is visible. It is a sample-size rule and it protects
                the player as much as the board, so say so plainly. */}
            <p className="text-xs mt-2" style={{ color: "var(--color-subtle)" }}>
              Why {QUALIFY_GAMES}? An average over one or two games is mostly luck — a single
              lucky call would outrank someone with a long, consistent record. {QUALIFY_GAMES} games
              is enough for your average to reflect how you actually play. Even then, on a
              one-day head-to-head, averages within a few points of each other are not really
              different — which is why the season board counts total points instead.
            </p>
            {/* Shared positions are unusual enough to be worth stating, and the
                games-played ordering looks arbitrary unless the reasoning is
                given. It rewards a longer record without letting volume buy rank. */}
            <p className="text-xs mt-2 mb-6" style={{ color: "var(--color-subtle)" }}>
              Players on the same average share a position, as on a golf scoreboard. Where scores
              are level, whoever has played more games is listed first. "Games" shows how many of
              the games available since a player's first game they actually played — an average
              only counts the days you showed up.
            </p>

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
                    {myStat.gamesPlayed} / {QUALIFY_GAMES} games played — {QUALIFY_GAMES - myStat.gamesPlayed} more to qualify
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs" style={{ color: "var(--color-subtle)" }}>Avg Score</p>
                  <p className="font-display text-lg font-bold" style={{ color: "var(--color-brand)" }}>
                    {formatAverageScore(myStat.averageDailyScore)}
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
                  Players appear here after completing {QUALIFY_GAMES} games.
                </p>
              </div>
            ) : (
              <div className="card-glass overflow-hidden animate-fade-up delay-100">
                <table className="w-full table-fixed">
                  <colgroup>
                    <col className="w-12 sm:w-16" />
                    <col />
                    <col className="w-24 sm:w-28" />
                    <col className="hidden sm:table-column w-28" />
                  </colgroup>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                      <th className={`text-left ${th}`} style={{ color: "var(--color-subtle)" }}>Rank</th>
                      <th className={`text-left ${th}`} style={{ color: "var(--color-subtle)" }}>Player</th>
                      <th className={`text-right ${th} whitespace-nowrap`} style={{ color: "var(--color-subtle)" }}>Avg Score</th>
                      <th className={`text-right ${th} hidden sm:table-cell`} style={{ color: "var(--color-subtle)" }}>Games</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((entry, i) => {
                      const isMe = !!user && entry.userId === user.id;
                      // Shared position for equal scores — see @shared/leaderboard.
                      const rank = qualifiedRanks[i];
                      const muted = entry.isBenchmark;
                      return (
                        <tr
                          key={entry.userId}
                          style={{
                            borderBottom: i < leaderboard.length - 1 ? "1px solid var(--color-border)" : undefined,
                            background: isMe ? "oklch(0.78 0.14 75 / 0.06)" : muted ? "var(--color-surface-raised)" : undefined,
                            opacity: muted ? 0.75 : 1,
                          }}
                        >
                          <td className="px-3 sm:px-5 py-4">
                            {rank <= 3 && !muted ? (
                              <Medal size={18} style={{ color: medalColors[rank - 1] }} />
                            ) : (
                              <span className="text-sm font-semibold tabular-nums" style={{ color: "var(--color-subtle)" }}>
                                {rank}
                              </span>
                            )}
                          </td>
                          <td className="px-3 sm:px-5 py-4 overflow-hidden">
                            <div className="flex items-center gap-3 min-w-0">
                              <Avatar name={entry.userName} isMe={isMe} isBenchmark={entry.isBenchmark} />
                              <div className="min-w-0">
                                <p
                                  className="text-sm font-medium truncate"
                                  style={{ color: isMe ? "var(--color-brand)" : "var(--color-foreground)" }}
                                >
                                  {entry.userName ?? "Anonymous"}
                                  {isMe && (
                                    <span className="ml-2 text-xs font-normal" style={{ color: "var(--color-brand)" }}>
                                      (you)
                                    </span>
                                  )}
                                  {entry.isBenchmark && <BenchmarkPill />}
                                </p>
                                <p className="sm:hidden text-[0.6875rem] truncate mt-0.5" style={{ color: "var(--color-subtle)" }}>
                                  {entry.isBenchmark ? "Benchmark · " : ""}{entry.gamesPlayed} of {entry.availableGames} games
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 sm:px-5 py-4 text-right whitespace-nowrap">
                            <span
                              className="font-display text-lg font-bold tabular-nums"
                              style={{ color: rank <= 3 && !muted ? medalColors[rank - 1] : "var(--color-foreground)" }}
                            >
                              {formatAverageScore(entry.averageDailyScore)}
                            </span>
                          </td>
                          <td className="px-3 sm:px-5 py-4 text-right hidden sm:table-cell">
                            <span className="text-sm tabular-nums" style={{ color: "var(--color-muted)" }}>
                              {entry.gamesPlayed}
                              <span style={{ color: "var(--color-subtle)" }}> of {entry.availableGames}</span>
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
                    &lt; {QUALIFY_GAMES} games
                  </span>
                </div>
                <p className="text-xs mb-4" style={{ color: "var(--color-subtle)" }}>
                  Players still working toward the {QUALIFY_GAMES}-game qualification threshold. Scores are not yet official.
                </p>
                <div className="card-glass overflow-hidden opacity-70">
                  <table className="w-full table-fixed">
                    <colgroup>
                      <col className="w-12 sm:w-16" />
                      <col />
                      <col className="w-24 sm:w-28" />
                      <col className="hidden sm:table-column w-24" />
                    </colgroup>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                        <th className={`text-left ${th}`} style={{ color: "var(--color-subtle)" }}>Rank</th>
                        <th className={`text-left ${th}`} style={{ color: "var(--color-subtle)" }}>Player</th>
                        <th className={`text-right ${th} whitespace-nowrap`} style={{ color: "var(--color-subtle)" }}>Avg Score</th>
                        <th className={`text-right ${th} hidden sm:table-cell`} style={{ color: "var(--color-subtle)" }}>Games</th>
                      </tr>
                    </thead>
                    <tbody>
                      {provisional.map((entry, i) => {
                        const isMe = !!user && entry.userId === user.id;
                        const rank = provisionalRanks[i];
                        return (
                          <tr
                            key={entry.userId}
                            style={{
                              borderBottom: i < provisional.length - 1 ? "1px solid var(--color-border)" : undefined,
                              background: isMe ? "oklch(0.78 0.14 75 / 0.06)" : undefined,
                            }}
                          >
                            <td className="px-3 sm:px-5 py-3">
                              <span className="text-sm font-semibold tabular-nums" style={{ color: "var(--color-subtle)" }}>
                                {rank}
                              </span>
                            </td>
                            <td className="px-3 sm:px-5 py-3 overflow-hidden">
                              <div className="flex items-center gap-3 min-w-0">
                                <Avatar name={entry.userName} isMe={isMe} isBenchmark={entry.isBenchmark} size={7} />
                                <div className="min-w-0">
                                  <p className="text-sm truncate" style={{ color: isMe ? "var(--color-brand)" : "var(--color-foreground)" }}>
                                    {entry.userName ?? "Anonymous"}
                                    {isMe && <span className="ml-2 text-xs" style={{ color: "var(--color-brand)" }}>(you)</span>}
                                    {entry.isBenchmark && <BenchmarkPill />}
                                  </p>
                                  <p className="sm:hidden text-[0.6875rem] truncate mt-0.5" style={{ color: "var(--color-subtle)" }}>
                                    {entry.gamesPlayed} / {QUALIFY_GAMES} games
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 sm:px-5 py-3 text-right whitespace-nowrap">
                              <span className="font-display text-base font-bold tabular-nums" style={{ color: "var(--color-muted)" }}>
                                {formatAverageScore(entry.averageDailyScore)}
                              </span>
                            </td>
                            <td className="px-3 sm:px-5 py-3 text-right hidden sm:table-cell">
                              <span className="text-xs tabular-nums" style={{ color: "var(--color-subtle)" }}>
                                {entry.gamesPlayed} / {QUALIFY_GAMES}
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
        )}
      </div>
    </PublicLayout>
  );
}

function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return "th";
  switch (n % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
}

function describeVsBenchmark(mine: number, benchmark: number): string {
  const diff = mine - benchmark;
  if (diff > 0) return `${diff} points ahead of Coin Flip`;
  if (diff < 0) return `${-diff} points behind Coin Flip`;
  return "level with Coin Flip";
}
