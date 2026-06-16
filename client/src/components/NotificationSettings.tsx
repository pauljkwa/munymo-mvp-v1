/**
 * NotificationSettings component
 *
 * Displays the current push notification status and allows the user to
 * enable or disable notifications. Handles all edge cases:
 * - iOS not installed as PWA
 * - Permission denied
 * - Unsupported browser
 * - Already subscribed
 */
import { Bell, BellOff, BellRing, Smartphone, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { cn } from "@/lib/utils";

interface NotificationSettingsProps {
  /** Compact mode for embedding in nav/profile menus */
  compact?: boolean;
  className?: string;
}

export function NotificationSettings({ compact = false, className }: NotificationSettingsProps) {
  const { state, error, subscribe, unsubscribe, isLoading } = usePushNotifications();

  if (state === "loading") {
    return null;
  }

  // ─── Unsupported ────────────────────────────────────────────────────────────
  if (state === "unsupported") {
    if (compact) return null;
    return (
      <div className={cn("flex items-start gap-3 text-sm text-muted-foreground", className)}>
        <BellOff className="h-4 w-4 mt-0.5 shrink-0" />
        <span>Push notifications are not supported in this browser.</span>
      </div>
    );
  }

  // ─── iOS not installed ───────────────────────────────────────────────────────
  if (state === "needs_install") {
    if (compact) return null;
    return (
      <div className={cn("rounded-lg border border-amber-200 bg-amber-50 p-4", className)}>
        <div className="flex items-start gap-3">
          <Smartphone className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-amber-900 text-sm">Add to Home Screen first</p>
            <p className="text-amber-700 text-sm mt-1">
              To receive push notifications on iPhone, you need to add Munymo to your Home Screen.
              Tap the share icon in Safari, then choose <strong>Add to Home Screen</strong>. Then
              open the app from your Home Screen and enable notifications here.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Permission denied ───────────────────────────────────────────────────────
  if (state === "permission_denied") {
    if (compact) {
      return (
        <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
          <BellOff className="h-4 w-4 shrink-0" />
          <span>Notifications blocked</span>
        </div>
      );
    }
    return (
      <div className={cn("rounded-lg border border-red-200 bg-red-50 p-4", className)}>
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-red-900 text-sm">Notifications are blocked</p>
            <p className="text-red-700 text-sm mt-1">
              You&apos;ve blocked notifications for Munymo. To re-enable them, go to your browser
              or device settings and allow notifications for munymo.com.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Subscribed ─────────────────────────────────────────────────────────────
  if (state === "subscribed") {
    if (compact) {
      return (
        <button
          onClick={unsubscribe}
          disabled={isLoading}
          className={cn(
            "flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors",
            className
          )}
        >
          <BellRing className="h-4 w-4 text-[#009050] shrink-0" />
          <span>Notifications on</span>
        </button>
      );
    }
    return (
      <div className={cn("flex items-center justify-between gap-4", className)}>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#009050]/10">
            <BellRing className="h-4 w-4 text-[#009050]" />
          </div>
          <div>
            <p className="font-medium text-sm">Push notifications enabled</p>
            <p className="text-xs text-muted-foreground">
              You&apos;ll be notified when results are published and new games go live.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={unsubscribe}
          disabled={isLoading}
          className="shrink-0"
        >
          <BellOff className="h-3.5 w-3.5 mr-1.5" />
          Turn off
        </Button>
      </div>
    );
  }

  // ─── Not subscribed ──────────────────────────────────────────────────────────
  if (compact) {
    return (
      <button
        onClick={subscribe}
        disabled={isLoading}
        className={cn(
          "flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors",
          className
        )}
      >
        <Bell className="h-4 w-4 shrink-0" />
        <span>{isLoading ? "Enabling…" : "Enable notifications"}</span>
      </button>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
            <Bell className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium text-sm">Push notifications</p>
            <p className="text-xs text-muted-foreground">
              Get notified when results are in and new games go live.
            </p>
          </div>
        </div>
        <Button
          size="sm"
          onClick={subscribe}
          disabled={isLoading}
          className="bg-[#009050] hover:bg-[#007a42] text-white shrink-0"
        >
          <Bell className="h-3.5 w-3.5 mr-1.5" />
          {isLoading ? "Enabling…" : "Enable"}
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-sm text-red-600">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

/** Small bell icon button for nav bars — shows current state at a glance */
export function NotificationBell({ className }: { className?: string }) {
  const { state, subscribe, unsubscribe, isLoading } = usePushNotifications();

  if (state === "loading" || state === "unsupported" || state === "needs_install") {
    return null;
  }

  const isOn = state === "subscribed";

  return (
    <button
      onClick={isOn ? unsubscribe : subscribe}
      disabled={isLoading}
      title={isOn ? "Notifications on — click to turn off" : "Enable push notifications"}
      className={cn(
        "flex items-center justify-center rounded-full p-1.5 transition-colors",
        isOn
          ? "text-[#009050] hover:bg-[#009050]/10"
          : "text-muted-foreground hover:text-foreground hover:bg-muted",
        className
      )}
    >
      {isOn ? (
        <BellRing className="h-5 w-5" />
      ) : (
        <Bell className="h-5 w-5" />
      )}
    </button>
  );
}
