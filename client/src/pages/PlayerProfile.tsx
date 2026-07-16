import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useClerk, useUser, SignInButton } from "@clerk/clerk-react";
import PublicLayout from "@/components/PublicLayout";
import { toast } from "sonner";
import {
  User,
  Shield,
  Crown,
  Clock,
  Edit2,
  Check,
  X,
  KeyRound,
  AlertTriangle,
  Lock,
  LogOut,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { Link } from "wouter";
import { NotificationSettings } from "@/components/NotificationSettings";

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

export default function PlayerProfile() {
  const { isAuthenticated, user, loading } = useAuth();
  const { signOut } = useClerk();
  const utils = trpc.useUtils();

  // Display name edit state
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");

  // Delete account confirmation state
  const [deleteStep, setDeleteStep] = useState<"idle" | "confirm" | "typing">("idle");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  // Permanent erasure — kept separate from the deactivate flow above so the two
  // confirmations can never be confused for one another.
  const [eraseStep, setEraseStep] = useState<"idle" | "confirm">("idle");
  const [eraseConfirmText, setEraseConfirmText] = useState("");

  // Password change/set state (Clerk under the hood — invisible to the user)
  const { user: clerkUser } = useUser();
  const [editingPassword, setEditingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const hasPassword = clerkUser?.passwordEnabled ?? false;
  const socialProvider = (() => {
    const raw = (clerkUser?.externalAccounts?.[0] as { provider?: string } | undefined)?.provider ?? "";
    const name = raw.replace(/^oauth_/, "");
    return name ? name.charAt(0).toUpperCase() + name.slice(1) : null;
  })();

  function resetPasswordForm() {
    setEditingPassword(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  async function handleSavePassword() {
    if (newPassword.length < 8) {
      toast.error("Your new password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New password and confirmation do not match.");
      return;
    }
    if (hasPassword && !currentPassword) {
      toast.error("Please enter your current password.");
      return;
    }
    if (!clerkUser) return;
    setSavingPassword(true);
    try {
      await clerkUser.updatePassword({
        newPassword,
        ...(hasPassword ? { currentPassword } : {}),
        signOutOfOtherSessions: false,
      });
      toast.success(
        hasPassword
          ? "Password updated."
          : "Password set — you can now sign in with your email and password."
      );
      resetPasswordForm();
    } catch (err: unknown) {
      const clerkErr = err as { errors?: { longMessage?: string; message?: string }[]; message?: string };
      const msg =
        clerkErr?.errors?.[0]?.longMessage ||
        clerkErr?.errors?.[0]?.message ||
        clerkErr?.message ||
        "Could not update your password. Please try again.";
      toast.error(msg);
    } finally {
      setSavingPassword(false);
    }
  }

  // ── Data queries ──────────────────────────────────────────────────────────
  const { data: profile } = trpc.dashboard.getProfile.useQuery(undefined, {
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

  const eraseAccount = trpc.dashboard.deleteAccount.useMutation({
    onSuccess: async () => {
      toast.success("Your account and personal data have been deleted.");
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
            Sign in to manage your profile
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

        {/* ── Profile Header ── */}
        <div className="flex items-center gap-4 mb-10 animate-fade-up">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold flex-shrink-0"
            style={{ background: "var(--color-brand)", color: "var(--color-brand-foreground)" }}
          >
            {displayName[0]?.toUpperCase()}
          </div>
          <div>
            <p className="section-label mb-1">My Profile</p>
            <h1 className="font-display text-2xl mb-0.5" style={{ color: "var(--color-foreground)" }}>
              {displayName}
            </h1>
            <p className="text-sm" style={{ color: "var(--color-muted)" }}>
              Member since {memberSince} · {tier === "premium" ? "Premium" : "Free"} tier ·{" "}
              <Link href="/dashboard" style={{ color: "var(--color-brand)" }}>
                View stats
              </Link>
            </p>
          </div>
        </div>

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

            {/* Password */}
            <div
              className="p-5"
              style={{ background: "var(--color-surface)", borderBottom: "1px solid var(--color-border)" }}
            >
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--color-subtle)" }}>
                Password
              </p>

              {editingPassword ? (
                <div className="flex flex-col gap-2">
                  {!hasPassword && (
                    <p className="text-xs leading-relaxed mb-1" style={{ color: "var(--color-muted)" }}>
                      Setting a password lets you sign in with your email and a password of your own,
                      rather than relying on {socialProvider ?? "your social login"}. Your{" "}
                      {socialProvider ?? "social"} sign-in will keep working too.
                    </p>
                  )}
                  {hasPassword && (
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Current password"
                      autoComplete="current-password"
                      className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                      style={{
                        background: "var(--color-surface-raised)",
                        border: "1px solid var(--color-border-strong)",
                        color: "var(--color-foreground)",
                      }}
                    />
                  )}
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New password (min 8 characters)"
                    autoComplete="new-password"
                    className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                    style={{
                      background: "var(--color-surface-raised)",
                      border: "1px solid var(--color-border-strong)",
                      color: "var(--color-foreground)",
                    }}
                  />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    autoComplete="new-password"
                    className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                    style={{
                      background: "var(--color-surface-raised)",
                      border: "1px solid var(--color-border-strong)",
                      color: "var(--color-foreground)",
                    }}
                  />
                  <div className="flex gap-2 mt-1">
                    <button
                      onClick={handleSavePassword}
                      disabled={savingPassword}
                      className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg"
                      style={{ background: "var(--color-brand)", color: "var(--color-brand-foreground)" }}
                    >
                      {savingPassword ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                      {hasPassword ? "Update Password" : "Set Password"}
                    </button>
                    <button
                      onClick={resetPasswordForm}
                      className="text-xs px-4 py-2 rounded-lg"
                      style={{ background: "var(--color-surface-raised)", color: "var(--color-muted)" }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : hasPassword ? (
                <div className="flex items-center justify-between">
                  <p className="text-sm tracking-widest" style={{ color: "var(--color-foreground)" }}>
                    ••••••••
                  </p>
                  <button
                    onClick={() => setEditingPassword(true)}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
                    style={{ background: "var(--color-surface-raised)", color: "var(--color-muted)" }}
                  >
                    <Edit2 size={12} />
                    Change
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-xs leading-relaxed mb-3" style={{ color: "var(--color-muted)" }}>
                    You signed up with {socialProvider ?? "a social login"}, so you don&apos;t have a
                    password yet. Set one to enable signing in with your email and password.
                  </p>
                  <button
                    onClick={() => setEditingPassword(true)}
                    className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg"
                    style={{
                      background: "var(--color-surface-raised)",
                      border: "1px solid var(--color-border-strong)",
                      color: "var(--color-foreground)",
                    }}
                  >
                    <KeyRound size={12} />
                    Set a Password
                  </button>
                </div>
              )}
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

            {/* ── Permanent deletion ── */}
            <div className="mt-5 pt-5" style={{ borderTop: "1px solid var(--color-border)" }}>
              {eraseStep === "idle" && (
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold mb-1" style={{ color: "var(--color-foreground)" }}>
                      Delete Account Permanently
                    </p>
                    <p className="text-xs leading-relaxed" style={{ color: "var(--color-muted)" }}>
                      This erases your personal data — your name, email and sign-in — for good. It
                      cannot be undone and support cannot recover it. Your past game results stay in
                      the leaderboard history, but anonymously, with nothing linking them to you.
                    </p>
                  </div>
                  <button
                    onClick={() => setEraseStep("confirm")}
                    className="flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg"
                    style={{ background: "transparent", color: "var(--color-error)", border: "1px solid var(--color-error)" }}
                  >
                    <Trash2 size={12} />
                    Delete
                  </button>
                </div>
              )}

              {eraseStep === "confirm" && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle size={16} style={{ color: "var(--color-error)" }} />
                    <p className="text-sm font-semibold" style={{ color: "var(--color-foreground)" }}>
                      Permanently delete everything?
                    </p>
                  </div>
                  <p className="text-xs mb-4" style={{ color: "var(--color-muted)" }}>
                    Type <strong>DELETE</strong> below to confirm. This is irreversible — your
                    sign-in will be removed and your personal data erased. No one can undo it, not
                    even us.
                  </p>
                  <input
                    type="text"
                    value={eraseConfirmText}
                    onChange={(e) => setEraseConfirmText(e.target.value)}
                    placeholder="Type DELETE to confirm"
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
                        if (eraseConfirmText !== "DELETE") {
                          toast.error("Please type DELETE exactly to confirm.");
                          return;
                        }
                        eraseAccount.mutate({ confirm: true });
                      }}
                      disabled={eraseAccount.isPending || eraseConfirmText !== "DELETE"}
                      className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg"
                      style={{
                        background: eraseConfirmText === "DELETE" ? "var(--color-error)" : "var(--color-surface-raised)",
                        color: eraseConfirmText === "DELETE" ? "#fff" : "var(--color-muted)",
                        cursor: eraseConfirmText === "DELETE" ? "pointer" : "not-allowed",
                      }}
                    >
                      {eraseAccount.isPending ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                      Permanently Delete
                    </button>
                    <button
                      onClick={() => { setEraseStep("idle"); setEraseConfirmText(""); }}
                      className="text-xs px-4 py-2 rounded-lg"
                      style={{ background: "var(--color-surface-raised)", color: "var(--color-muted)" }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Section>

      </div>
    </PublicLayout>
  );
}
