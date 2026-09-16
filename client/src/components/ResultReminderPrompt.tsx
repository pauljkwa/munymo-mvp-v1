import { useState } from "react";
import { Bell, X, Loader2, Smartphone } from "lucide-react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { toast } from "sonner";

/**
 * Offers push notifications at the one moment a player is motivated to say yes:
 * straight after their gut pick, when they have money on the table (figuratively)
 * and the result is hours away.
 *
 * WHY here rather than only on /profile: `users.pushOptIn` defaults to true at
 * signup, so every new player LOOKS reachable while having no subscription at
 * all — a push needs a `push_subscriptions` row holding a real browser
 * endpoint. The first real signup had pushOptIn true, zero devices, made a gut
 * pick, and was never contacted again because nothing could reach them. Asking
 * on a settings page they may never open does not fix that; asking here does.
 *
 * Deliberately quiet: one dismissal is remembered forever, and the prompt never
 * appears for players who already subscribed, blocked notifications, or are on
 * a browser that can't support them.
 */
const DISMISS_KEY = "munymo-result-reminder-dismissed";

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

export default function ResultReminderPrompt() {
  const { state, subscribe, isLoading, serverSubscribed } = usePushNotifications();
  const [dismissed, setDismissed] = useState(wasDismissed);

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* a dismissal we can't persist is still honoured for this session */
    }
  }

  // Nothing useful to offer in these states, so stay out of the way entirely.
  if (dismissed || serverSubscribed) return null;
  if (state === "loading" || state === "subscribed") return null;
  if (state === "unsupported" || state === "permission_denied") return null;

  // iOS can only receive push once the site is installed to the home screen,
  // so there is no button to offer — just the one instruction that unblocks it.
  const iosNeedsInstall = state === "needs_install";

  return (
    <div
      className="card-glass p-4 mb-6 flex items-start gap-3"
      style={{ borderColor: "var(--color-brand-muted)" }}
    >
      <div className="flex-shrink-0 mt-0.5" style={{ color: "var(--color-brand)" }}>
        {iosNeedsInstall ? <Smartphone size={18} /> : <Bell size={18} />}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium mb-1" style={{ color: "var(--color-foreground)" }}>
          Want to know how you did?
        </p>
        <p className="text-xs mb-3" style={{ color: "var(--color-muted)" }}>
          {iosNeedsInstall
            ? "Add Munymo to your home screen (Share → Add to Home Screen), then turn on notifications to get the result when the market closes."
            : "Today's result lands after the market closes. We can ping you when it does — and remind you before your pick locks."}
        </p>

        {!iosNeedsInstall && (
          <button
            className="btn-gold text-xs py-1.5 px-3"
            disabled={isLoading}
            onClick={async () => {
              try {
                await subscribe();
                toast.success("Notifications on — we'll let you know when the result is in.");
              } catch {
                // subscribe() surfaces its own error state; don't claim success.
                toast.error("Couldn't turn on notifications. You can try again from your profile.");
              }
            }}
          >
            {isLoading ? <Loader2 size={13} className="animate-spin" /> : <Bell size={13} />}
            Notify me
          </button>
        )}
      </div>

      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="flex-shrink-0 p-1 rounded hover:opacity-70"
        style={{ color: "var(--color-subtle)" }}
      >
        <X size={14} />
      </button>
    </div>
  );
}
