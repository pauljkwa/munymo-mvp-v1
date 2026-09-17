import { useAuth } from "@/_core/hooks/useAuth";
import { LEADERBOARD_QUALIFICATION_GAMES as QUALIFY_GAMES } from "@shared/const";
import { trpc } from "@/lib/trpc";
import { SignInButton } from "@clerk/clerk-react";
import PublicLayout from "@/components/PublicLayout";
import { usePageMeta } from "@/hooks/usePageMeta";
import {
  User,
  Flame,
  Trophy,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  XCircle,
  BarChart2,
  BookOpen,
  Lock,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { Link } from "wouter";
import { Brain, Microscope } from "lucide-react";
import { seasonLabel } from "@shared/leaderboard";

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: accent ? "var(--color-brand-muted)" : "var(--color-surface)",
        border: `1px solid ${accent ? "var(--color-brand)" : "var(--color-border)"}`,
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: accent ? "var(--color-brand)" : "var(--color-surface-raised)" }}
        >
          <Icon size={16} style={{ color: accent ? "var(--color-brand-foreground)" : "var(--color-brand)" }} />
        </div>
      </div>
      <p className="text-2xl font-display font-bold mb-1" style={{ color: "var(--color-foreground)" }}>
        {value}
      </p>
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>
        {label}
      </p>
      {sub && (
        <p className="text-xs mt-1" style={{ color: "var(--color-subtle)" }}>
          {sub}
        </p>
      )}
    </div>
  );
}

// ─── Section Wrapper ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2
        className="text-xs font-bold uppercase tracking-widest mb-4"
        style={{ color: "var(--color-subtle)" }}
      >
        {title}
      </h2>
      {children}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MyDashboard() {
  usePageMeta({ title: "My Dashboard | Munymo" });
  const { isAuthenticated, user, loading } = useAuth();

  // ── Data queries ──────────────────────────────────────────────────────────
  const { data: stats, isLoading: statsLoading } = trpc.dashboard.getStats.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: profile } = trpc.dashboard.getProfile.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: history, isLoading: historyLoading } = trpc.scores.getMyHistory.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  // ── Auth guard ────────────────────────────────────────────────────────────
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
            Sign in to view your dashboard
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

  const displayName = profile?.displayName || user?.name || "Player";
  const tier = profile?.tier ?? "free";
  const memberSince = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "—";

  return (
    <PublicLayout>
      <div className="container py-10 max-w-2xl mx-auto">

        {/* ── Page Header ── */}
        <div className="mb-10 animate-fade-up">
          <p className="section-label mb-2">My Dashboard</p>
          <h1 className="font-display mb-1" style={{ color: "var(--color-foreground)" }}>
            {displayName}
          </h1>
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            Member since {memberSince} · {tier === "premium" ? "Premium" : "Free"} tier ·{" "}
            <Link href="/profile" style={{ color: "var(--color-brand)" }}>
              Manage account
            </Link>
          </p>
        </div>

        {/* ── Stats ── */}
        <Section title="My Stats">
          {statsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 size={24} className="animate-spin" style={{ color: "var(--color-brand)" }} />
            </div>
          ) : stats ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatCard icon={BarChart2} label="Games Played" value={stats.totalGames} />
              <StatCard icon={TrendingUp} label="Accuracy" value={`${stats.accuracy}%`} accent />
              <StatCard icon={Trophy} label="Total Score" value={stats.totalScore} />
              <StatCard
                icon={Flame}
                label="Current Streak"
                value={stats.currentStreak}
                sub={`Best: ${stats.longestStreak}`}
              />
              <StatCard
                icon={TrendingUp}
                label="Win Streak"
                value={stats.currentWinStreak}
                sub={`Best: ${stats.longestWinStreak}`}
              />
              {/* A red zero on your home screen helps nobody. Shown only when
                  there is actually a run to talk about. */}
              {stats.currentLoseStreak > 0 && (
                <StatCard
                  icon={TrendingDown}
                  label="Losing run"
                  value={stats.currentLoseStreak}
                  sub="Wrong in a row"
                />
              )}
              <StatCard
                icon={BookOpen}
                label="Research Score"
                value={`${stats.validationAccuracy}%`}
                sub="Validation accuracy"
              />
              <StatCard
                icon={Trophy}
                label={`${stats.season.label} season`}
                value={stats.season.rank ? `#${stats.season.rank} of ${stats.season.players}` : "—"}
                sub={
                  stats.season.games > 0
                    ? `${stats.season.points} pts · ${stats.season.games} ${stats.season.games === 1 ? "game" : "games"}`
                    : "Play a game to join this month's board"
                }
              />
              <StatCard
                icon={Trophy}
                label="All-time board"
                value={
                  stats.isQualified
                    ? stats.leaderboardRank
                      ? `#${stats.leaderboardRank}`
                      : "Ranked"
                    : `${stats.gamesPlayed}/${QUALIFY_GAMES}`
                }
                sub={stats.isQualified ? "By average score" : "Games to qualify"}
              />
            </div>
          ) : (
            <p className="text-sm" style={{ color: "var(--color-muted)" }}>
              No stats yet — play your first game to start building your record.
            </p>
          )}
        </Section>

        {/* ── Gut vs Research ── */}
        {stats && (
          <Section title="Gut vs Research">
            <div
              className="rounded-2xl p-5"
              style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
            >
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="rounded-xl p-4 text-center" style={{ background: "var(--color-surface-raised)" }}>
                  <Brain size={16} className="mx-auto mb-1" style={{ color: "var(--color-brand)" }} />
                  <p className="text-2xl font-display font-bold" style={{ color: "var(--color-foreground)" }}>
                    {stats.insight.games > 0 ? `${stats.insight.gutAccuracy}%` : "—"}
                  </p>
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>
                    Instinct alone
                  </p>
                  <p className="text-[0.625rem] mt-0.5" style={{ color: "var(--color-subtle)" }}>
                    if your gut pick had been final
                  </p>
                </div>
                <div className="rounded-xl p-4 text-center" style={{ background: "var(--color-brand-muted)", border: "1px solid var(--color-brand)" }}>
                  <Microscope size={16} className="mx-auto mb-1" style={{ color: "var(--color-brand)" }} />
                  <p className="text-2xl font-display font-bold" style={{ color: "var(--color-foreground)" }}>
                    {stats.insight.games > 0 ? `${stats.insight.finalAccuracy}%` : "—"}
                  </p>
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>
                    After research
                  </p>
                  <p className="text-[0.625rem] mt-0.5" style={{ color: "var(--color-subtle)" }}>
                    your scored picks
                  </p>
                </div>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: "var(--color-foreground)" }}>
                {stats.insightSummary}
              </p>

              {stats.insight.bySector.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--color-subtle)" }}>
                    By sector (3+ games)
                  </p>
                  <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--color-border)" }}>
                    {stats.insight.bySector.map((sec, i) => (
                      <div
                        key={sec.sector}
                        className="flex items-center justify-between px-3 py-2 text-xs"
                        style={{
                          background: i % 2 === 0 ? "var(--color-surface)" : "var(--color-surface-raised)",
                          borderBottom: i < stats.insight.bySector.length - 1 ? "1px solid var(--color-border)" : "none",
                        }}
                      >
                        <span style={{ color: "var(--color-foreground)" }}>{sec.sector}</span>
                        <span className="tabular-nums" style={{ color: "var(--color-muted)" }}>
                          {sec.correct}/{sec.games} · <strong style={{ color: sec.accuracy >= 50 ? "var(--color-success)" : "var(--color-foreground)" }}>{sec.accuracy}%</strong>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {stats.insight.byMonth.length > 1 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--color-subtle)" }}>
                    Accuracy by month
                  </p>
                  <div className="flex items-end gap-2">
                    {stats.insight.byMonth.map((m) => (
                      <div key={m.month} className="flex-1 text-center">
                        <div className="mx-auto w-full rounded-t-md" style={{ height: `${Math.max(6, m.accuracy * 0.6)}px`, background: "var(--color-brand)", opacity: 0.35 + (m.accuracy / 100) * 0.65 }} />
                        <p className="text-[0.625rem] mt-1 tabular-nums" style={{ color: "var(--color-foreground)" }}>{m.accuracy}%</p>
                        <p className="text-[0.625rem]" style={{ color: "var(--color-subtle)" }}>{seasonLabel(m.month).slice(0, 3)} · {m.games}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* ── Game History ── */}
        <Section title="Game History">
          {historyLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 size={20} className="animate-spin" style={{ color: "var(--color-brand)" }} />
            </div>
          ) : history && history.length > 0 ? (
            <div
              className="rounded-2xl overflow-hidden"
              style={{ border: "1px solid var(--color-border)" }}
            >
              {history.slice(0, 20).map((entry, i) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between px-4 py-3 gap-3"
                  style={{
                    background: i % 2 === 0 ? "var(--color-surface)" : "var(--color-surface-raised)",
                    borderBottom: i < Math.min(history.length, 20) - 1 ? "1px solid var(--color-border)" : "none",
                  }}
                >
                  <div className="flex items-center gap-3">
                    {entry.predictionScore > 0 ? (
                      <CheckCircle2 size={16} style={{ color: "var(--color-success)", flexShrink: 0 }} />
                    ) : (
                      <XCircle size={16} style={{ color: "var(--color-error)", flexShrink: 0 }} />
                    )}
                    <div>
                      <p className="text-xs font-mono" style={{ color: "var(--color-muted)" }}>
                        {entry.gameDate
                          ? new Date(entry.gameDate + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
                          : `Game #${entry.gameId}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p
                        className="text-sm font-bold tabular-nums"
                        style={{ color: entry.totalScore >= 80 ? "var(--color-success)" : "var(--color-muted)" }}
                      >
                        {entry.totalScore}
                        <span className="text-xs font-normal ml-0.5">pts</span>
                      </p>
                    </div>
                    <Link
                      href={`/research/${entry.gameId}`}
                      className="text-xs"
                      style={{ color: "var(--color-brand)" }}
                    >
                      View
                    </Link>
                  </div>
                </div>
              ))}
              {history.length > 20 && (
                <div
                  className="px-4 py-3 text-center text-xs"
                  style={{ color: "var(--color-muted)", background: "var(--color-surface)" }}
                >
                  Showing 20 most recent games · {history.length} total
                </div>
              )}
            </div>
          ) : (
            <div
              className="rounded-2xl p-8 text-center"
              style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
            >
              <BarChart2 size={32} className="mx-auto mb-3" style={{ color: "var(--color-muted)" }} />
              <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                No games played yet.{" "}
                <Link href="/game" style={{ color: "var(--color-brand)" }}>
                  Play today's game
                </Link>{" "}
                to start your record.
              </p>
            </div>
          )}
        </Section>

        {/* ── MunyIQ Placeholder ── */}
        <Section title="MunyIQ Score">
          <div
            className="rounded-2xl p-5"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              opacity: 0.7,
            }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ background: "var(--color-surface-raised)" }}
              >
                <Lock size={16} style={{ color: "var(--color-muted)" }} />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--color-foreground)" }}>
                  MunyIQ — Coming Soon
                </p>
                <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                  Premium tier feature
                </p>
              </div>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: "var(--color-muted)" }}>
              MunyIQ is a composite intelligence score calculated from your prediction accuracy,
              research engagement, consistency, and improvement over time. Every game you play now
              is building the history that your future MunyIQ will be calculated from.
            </p>
          </div>
        </Section>

      </div>
    </PublicLayout>
  );
}
