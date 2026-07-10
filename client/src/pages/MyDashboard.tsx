import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useClerk, SignInButton } from "@clerk/clerk-react";
import PublicLayout from "@/components/PublicLayout";
import { toast } from "sonner";
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
  Shield,
  Crown,
  Loader2,
  ArrowRight,
  Edit2,
  Check,
  X,
  AlertTriangle,
  Lock,
  LogOut,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Clock,
} from "lucide-react";
import { Link } from "wouter";
import { NotificationSettings } from "@/components/NotificationSettings";

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
  const { isAuthenticated, user, loading } = useAuth();
  const { signOut } = useClerk();
  const utils = trpc.useUtils();

  // Display name edit state
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");

  // Delete account confirmation state
  const [deleteStep, setDeleteStep] = useState<"idle" | "confirm" | "typing">("idle");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  // ── Data queries ──────────────────────────────────────────────────────────
  const { data: stats, isLoading: statsLoading } = trpc.dashboard.getStats.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: profile, isLoading: profileLoading } = trpc.dashboard.getProfile.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: history, isLoading: historyLoading } = trpc.scores.getMyHistory.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const updateName = trpc.dashboard.updateDisplayName.useMutation({
    onSuccess: () => {
      toast.success("Display name updated.");
      utils.dashboard.getProfile.invalidate();
      setEditingName(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const setAway = trpc.dashboard.setAwayStatus.useMutation({
    onSuccess: (_, vars) => {
      toast.success(vars.active ? "Away Status activated — your streak is protected." : "Away Status deactivated.");
      utils.dashboard.getStats.invalidate();
      utils.dashboard.getProfile.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const setNotifPrefs = trpc.dashboard.setNotificationPrefs.useMutation({
    onSuccess: () => utils.dashboard.getProfile.invalidate(),
    onError: (e) => toast.error(e.message),
  });

  const deactivate = trpc.dashboard.deactivateAccount.useMutation({
    onSuccess: async () => {
      toast.success("Account deactivated. Signing you out...");
      await signOut();
    },
    onError: (e) => toast.error(e.message),
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
  const awayActive = profile?.awayStatus ?? false;
  const emailOptIn = profile?.emailOptIn ?? true;
  const tier = profile?.tier ?? "free";
  const memberSince = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString("en-GB", { month: "long", year: "numeric" })
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
            Member since {memberSince} · {tier === "premium" ? "Premium" : "Free"} tier
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
              <StatCard
                icon={TrendingDown}
                label="Lose Streak"
                value={stats.currentLoseStreak}
              />
              <StatCard
                icon={BookOpen}
                label="Research Score"
                value={`${stats.validationAccuracy}%`}
                sub="Validation accuracy"
              />
              <StatCard
                icon={Trophy}
                label="Leaderboard"
                value={
                  stats.isQualified
                    ? stats.leaderboardRank
                      ? `#${stats.leaderboardRank}`
                      : "Ranked"
                    : `${stats.gamesPlayed}/20`
                }
                sub={stats.isQualified ? "Qualified" : "Games to qualify"}
              />
            </div>
          ) : (
            <p className="text-sm" style={{ color: "var(--color-muted)" }}>
              No stats yet — play your first game to start building your record.
            </p>
          )}
        </Section>

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
                          ? new Date(entry.gameDate + "T12:00:00Z").toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })
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

        {/* ── Away Status ── */}
        <Section title="Away Status">
          <div
            className="rounded-2xl p-5"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
          >
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Shield size={16} style={{ color: awayActive ? "var(--color-brand)" : "var(--color-muted)" }} />
                  <p className="text-sm font-semibold" style={{ color: "var(--color-foreground)" }}>
                    {awayActive ? "Away Status is Active" : "Away Status is Off"}
                  </p>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: "var(--color-muted)" }}>
                  When Away Status is active, missing a day will not break your streak. Use it when
                  life gets in the way — travel, illness, or anything else that keeps you from the game.
                  It is not a cheat code; it is a fair acknowledgement that life happens.
                </p>
              </div>
              <button
                onClick={() => setAway.mutate({ active: !awayActive })}
                disabled={setAway.isPending}
                className="flex-shrink-0 transition-opacity"
                style={{ opacity: setAway.isPending ? 0.5 : 1 }}
                aria-label="Toggle Away Status"
              >
                {awayActive ? (
                  <ToggleRight size={36} style={{ color: "var(--color-brand)" }} />
                ) : (
                  <ToggleLeft size={36} style={{ color: "var(--color-muted)" }} />
                )}
              </button>
            </div>
            {awayActive && (
              <div
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
                style={{ background: "var(--color-brand-muted)", color: "var(--color-brand)" }}
              >
                <Clock size={13} />
                Your streak is currently protected.
              </div>
            )}
          </div>
        </Section>

        {/* ── Notifications ── */}
        <Section title="Notifications">
          <div
            className="rounded-2xl overflow-hidden"
            style={{ border: "1px solid var(--color-border)" }}
          >
            {/* Email notifications */}
            <div
              className="p-5"
              style={{ background: "var(--color-surface)", borderBottom: "1px solid var(--color-border)" }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="text-sm font-semibold mb-0.5" style={{ color: "var(--color-foreground)" }}>
                    Email notifications
                  </p>
                  <p className="text-xs leading-relaxed" style={{ color: "var(--color-muted)" }}>
                    Receive result emails and streak reminders
                  </p>
                </div>
                <button
                  onClick={() => setNotifPrefs.mutate({ emailOptIn: !emailOptIn })}
                  disabled={setNotifPrefs.isPending}
                  className="flex-shrink-0 transition-opacity"
                  style={{ opacity: setNotifPrefs.isPending ? 0.5 : 1 }}
                  aria-label="Toggle email notifications"
                >
                  {emailOptIn ? (
                    <ToggleRight size={36} style={{ color: "var(--color-brand)" }} />
                  ) : (
                    <ToggleLeft size={36} style={{ color: "var(--color-muted)" }} />
                  )}
                </button>
              </div>
            </div>

            {/* Push notifications — real subscription control (registers this
                device with the push service; not just a preference flag) */}
            <div
              className="p-5"
              style={{ background: "var(--color-surface)" }}
            >
              <NotificationSettings />
            </div>
          </div>
        </Section>

        {/* ── Account Settings ── */}
        <Section title="Account Settings">
          <div
            className="rounded-2xl overflow-hidden"
            style={{ border: "1px solid var(--color-border)" }}
          >
            {/* Display Name */}
            <div
              className="p-5"
              style={{ background: "var(--color-surface)", borderBottom: "1px solid var(--color-border)" }}
            >
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--color-subtle)" }}>
                Display Name
              </p>
              {editingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    maxLength={64}
                    placeholder="Enter display name"
                    className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
                    style={{
                      background: "var(--color-surface-raised)",
                      border: "1px solid var(--color-border-strong)",
                      color: "var(--color-foreground)",
                    }}
                    autoFocus
                  />
                  <button
                    onClick={() => updateName.mutate({ displayName: nameInput.trim() || null })}
                    disabled={updateName.isPending}
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: "var(--color-brand)", color: "var(--color-brand-foreground)" }}
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={() => setEditingName(false)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: "var(--color-surface-raised)", color: "var(--color-muted)" }}
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <p className="text-sm" style={{ color: "var(--color-foreground)" }}>
                    {profile?.displayName || (
                      <span style={{ color: "var(--color-muted)" }}>Not set — using account name</span>
                    )}
                  </p>
                  <button
                    onClick={() => {
                      setNameInput(profile?.displayName ?? "");
                      setEditingName(true);
                    }}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
                    style={{ background: "var(--color-surface-raised)", color: "var(--color-muted)" }}
                  >
                    <Edit2 size={12} />
                    Edit
                  </button>
                </div>
              )}
            </div>

            {/* Password — managed by Clerk */}
            <div
              className="p-5"
              style={{ background: "var(--color-surface)", borderBottom: "1px solid var(--color-border)" }}
            >
              <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--color-subtle)" }}>
                Password
              </p>
              <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                Your password is managed by your Clerk account.{" "}
                <a
                  href="https://accounts.clerk.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--color-brand)" }}
                >
                  Manage it at accounts.clerk.com
                </a>
              </p>
            </div>

            {/* Email */}
            <div
              className="p-5"
              style={{ background: "var(--color-surface)", borderBottom: "1px solid var(--color-border)" }}
            >
              <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--color-subtle)" }}>
                Email
              </p>
              <p className="text-sm" style={{ color: "var(--color-foreground)" }}>
                {user?.email ?? (
                  <span style={{ color: "var(--color-muted)" }}>Not available</span>
                )}
              </p>
            </div>

            {/* Sign Out */}
            <div className="p-5" style={{ background: "var(--color-surface)" }}>
              <button
                onClick={() => signOut()}
                className="flex items-center gap-2 text-sm font-semibold"
                style={{ color: "var(--color-muted)" }}
              >
                <LogOut size={15} />
                Sign out
              </button>
            </div>
          </div>
        </Section>

        {/* ── Tier / Upgrade ── */}
        <Section title="Membership Tier">
          <div
            className="rounded-2xl p-5"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ background: tier === "premium" ? "var(--color-brand-muted)" : "var(--color-surface-raised)" }}
              >
                <Crown size={16} style={{ color: tier === "premium" ? "var(--color-brand)" : "var(--color-muted)" }} />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--color-foreground)" }}>
                  {tier === "premium" ? "Premium Member" : "Free Tier"}
                </p>
                <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                  {tier === "premium"
                    ? "Full access to all current and future features."
                    : "Access to the daily game, leaderboard, and research archive."}
                </p>
              </div>
            </div>

            {tier === "free" && (
              <div
                className="rounded-xl p-4"
                style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border)" }}
              >
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--color-subtle)" }}>
                  Coming Soon — Premium
                </p>
                <p className="text-xs leading-relaxed mb-3" style={{ color: "var(--color-muted)" }}>
                  Premium membership will unlock MunyIQ scoring, extended game history, advanced
                  analytics, and priority access to new features as they launch.
                </p>
                <button
                  className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg"
                  style={{
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-border-strong)",
                    color: "var(--color-muted)",
                    cursor: "not-allowed",
                  }}
                  disabled
                >
                  <Lock size={12} />
                  Upgrade — Available Soon
                </button>
              </div>
            )}
          </div>
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

        {/* ── Danger Zone ── */}
        <Section title="Danger Zone">
          <div
            className="rounded-2xl p-5"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-error)",
            }}
          >
            {deleteStep === "idle" && (
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold mb-1" style={{ color: "var(--color-foreground)" }}>
                    Deactivate Account
                  </p>
                  <p className="text-xs leading-relaxed" style={{ color: "var(--color-muted)" }}>
                    This will deactivate your account. Your data is preserved — you will not lose
                    your game history or stats. If you ever change your mind, contact us and we can
                    reactivate it.
                  </p>
                </div>
                <button
                  onClick={() => setDeleteStep("confirm")}
                  className="flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg"
                  style={{
                    background: "var(--color-error)",
                    color: "#fff",
                  }}
                >
                  <Trash2 size={12} />
                  Deactivate
                </button>
              </div>
            )}

            {deleteStep === "confirm" && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle size={16} style={{ color: "var(--color-error)" }} />
                  <p className="text-sm font-semibold" style={{ color: "var(--color-foreground)" }}>
                    Are you sure?
                  </p>
                </div>
                <p className="text-xs mb-4" style={{ color: "var(--color-muted)" }}>
                  Type <strong>DEACTIVATE</strong> below to confirm. This cannot be undone without
                  contacting support.
                </p>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="Type DEACTIVATE to confirm"
                  className="w-full rounded-lg px-3 py-2 text-sm mb-3 outline-none"
                  style={{
                    background: "var(--color-surface-raised)",
                    border: "1px solid var(--color-error)",
                    color: "var(--color-foreground)",
                  }}
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (deleteConfirmText !== "DEACTIVATE") {
                        toast.error("Please type DEACTIVATE exactly to confirm.");
                        return;
                      }
                      deactivate.mutate({ confirm: true });
                    }}
                    disabled={deactivate.isPending || deleteConfirmText !== "DEACTIVATE"}
                    className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg"
                    style={{
                      background: deleteConfirmText === "DEACTIVATE" ? "var(--color-error)" : "var(--color-surface-raised)",
                      color: deleteConfirmText === "DEACTIVATE" ? "#fff" : "var(--color-muted)",
                      cursor: deleteConfirmText === "DEACTIVATE" ? "pointer" : "not-allowed",
                    }}
                  >
                    {deactivate.isPending ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                    Confirm Deactivation
                  </button>
                  <button
                    onClick={() => { setDeleteStep("idle"); setDeleteConfirmText(""); }}
                    className="text-xs px-4 py-2 rounded-lg"
                    style={{ background: "var(--color-surface-raised)", color: "var(--color-muted)" }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </Section>

      </div>
    </PublicLayout>
  );
}
