/**
 * usePushNotifications hook
 *
 * Manages the full lifecycle of web push notification subscriptions:
 * - Registers the service worker
 * - Requests notification permission
 * - Creates/removes push subscriptions via the server
 * - Exposes current subscription state
 *
 * iOS requirement: notifications only work when the app is installed as a PWA
 * (added to home screen). The hook detects this and surfaces a helpful message.
 */
import { useCallback, useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PushState =
  | "unsupported"       // Browser doesn't support push or service workers
  | "needs_install"     // iOS but not installed as PWA
  | "permission_denied" // User has blocked notifications
  | "not_subscribed"    // Supported, permission not yet requested
  | "subscribed"        // Active subscription exists
  | "loading";          // Checking state

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert a base64 URL-safe string to a Uint8Array (for VAPID key) */
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer;
}

/** Detect iOS (iPhone/iPad) */
function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/** Detect if running as an installed PWA (standalone mode) */
function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePushNotifications() {
  const [state, setState] = useState<PushState>("loading");
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: vapidData } = trpc.push.vapidPublicKey.useQuery();
  const { data: statusData, refetch: refetchStatus } = trpc.push.status.useQuery(
    undefined,
    { retry: false }
  );

  const subscribeMutation = trpc.push.subscribe.useMutation();
  const unsubscribeMutation = trpc.push.unsubscribe.useMutation();

  // ─── Determine initial state ────────────────────────────────────────────────

  useEffect(() => {
    async function checkState() {
      // Check basic support
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        // iOS without PWA install
        if (isIOS() && !isStandalone()) {
          setState("needs_install");
        } else {
          setState("unsupported");
        }
        return;
      }

      // iOS PWA check
      if (isIOS() && !isStandalone()) {
        setState("needs_install");
        return;
      }

      // Check permission
      const permission = Notification.permission;
      if (permission === "denied") {
        setState("permission_denied");
        return;
      }

      // Check for existing subscription
      try {
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (existing) {
          setSubscription(existing);
          setState("subscribed");
        } else {
          setState("not_subscribed");
        }
      } catch {
        setState("not_subscribed");
      }
    }

    checkState();
  }, []);

  // ─── Register service worker ─────────────────────────────────────────────────

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch((err) => console.warn("[push] SW registration failed:", err));
    }
  }, []);

  // ─── Subscribe ───────────────────────────────────────────────────────────────

  const subscribe = useCallback(async () => {
    setError(null);
    if (!vapidData?.key) {
      setError("Push notifications are not configured.");
      return;
    }

    try {
      // Request permission
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState("permission_denied");
        setError("Notification permission was denied. You can enable it in your browser settings.");
        return;
      }

      // Get service worker registration
      const reg = await navigator.serviceWorker.ready;

      // Subscribe to push
      const pushSub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidData.key),
      });

      const subJson = pushSub.toJSON();

      // Save to server
      await subscribeMutation.mutateAsync({
        endpoint: pushSub.endpoint,
        p256dh: subJson.keys?.p256dh ?? "",
        auth: subJson.keys?.auth ?? "",
        userAgent: navigator.userAgent.slice(0, 512),
      });

      setSubscription(pushSub);
      setState("subscribed");
      await refetchStatus();
    } catch (err: any) {
      console.error("[push] subscribe error:", err);
      setError(err?.message ?? "Failed to enable notifications.");
    }
  }, [vapidData, subscribeMutation, refetchStatus]);

  // ─── Unsubscribe ─────────────────────────────────────────────────────────────

  const unsubscribe = useCallback(async () => {
    setError(null);
    try {
      if (subscription) {
        await unsubscribeMutation.mutateAsync({ endpoint: subscription.endpoint });
        await subscription.unsubscribe();
        setSubscription(null);
      }
      setState("not_subscribed");
      await refetchStatus();
    } catch (err: any) {
      console.error("[push] unsubscribe error:", err);
      setError(err?.message ?? "Failed to disable notifications.");
    }
  }, [subscription, unsubscribeMutation, refetchStatus]);

  return {
    state,
    subscription,
    error,
    subscribe,
    unsubscribe,
    isLoading: state === "loading" || subscribeMutation.isPending || unsubscribeMutation.isPending,
    serverSubscribed: statusData?.subscribed ?? false,
  };
}
