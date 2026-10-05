/**
 * Custom Google Analytics events. Page views are already tracked by the one
 * gtag install in client/index.html; this only adds named events on top.
 * Never pass personal data (names, emails, ids) in params.
 */
type GtagWindow = Window & { gtag?: (...args: unknown[]) => void };

export type AnalyticsEvent =
  | "guest_gut_pick"
  | "guest_final_pick"
  | "guest_ask_shown"
  | "guest_converted";

export function trackEvent(name: AnalyticsEvent, params?: Record<string, string | number>): void {
  try {
    (window as GtagWindow).gtag?.("event", name, params ?? {});
  } catch {
    /* analytics must never break the game */
  }
}
