/**
 * Web Push notification helper for Munymo.
 *
 * Uses the Web Push API (VAPID) — no third-party service required.
 * Each browser/device has a unique endpoint URL; we POST encrypted
 * payloads to those endpoints via the `web-push` npm library.
 */
import webpush from "web-push";
import { createHash } from "crypto";
import { getDb } from "./db";
import { pushSubscriptions } from "../drizzle/schema";
import { inArray } from "drizzle-orm";
import type { PushSubscription as DBPushSub } from "../drizzle/schema";

// ─── VAPID Configuration ─────────────────────────────────────────────────────

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY!;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY!;
const VAPID_SUBJECT = "mailto:admin@munymo.com";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PushPayload {
  title: string;
  body: string;
  /** URL to open when notification is tapped */
  url?: string;
  /** Icon URL — defaults to Munymo logo */
  icon?: string;
  /** Badge icon (small monochrome icon shown in status bar on Android) */
  badge?: string;
  /** Notification tag — replaces existing notification with same tag */
  tag?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** SHA-256 hash of an endpoint URL for use as a unique index key */
export function hashEndpoint(endpoint: string): string {
  return createHash("sha256").update(endpoint).digest("hex");
}

// ─── Send to a single subscription ───────────────────────────────────────────

async function sendToSubscription(
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload
): Promise<"ok" | "expired" | "error"> {
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      JSON.stringify({
        title: payload.title,
        body: payload.body,
        url: payload.url ?? "/",
        icon: payload.icon ?? "https://munymo.com/munymo-logo-cropped_e625fcf7.png",
        badge: payload.badge ?? "https://munymo.com/munymo-logo-cropped_e625fcf7.png",
        tag: payload.tag,
      }),
      { TTL: 86400 } // 24 hours TTL
    );
    return "ok";
  } catch (err: any) {
    // 410 Gone or 404 Not Found = subscription expired/unsubscribed
    if (err?.statusCode === 410 || err?.statusCode === 404) {
      return "expired";
    }
    console.error("[push] send error:", err?.message ?? err);
    return "error";
  }
}

// ─── Send to all subscriptions for a list of user IDs ────────────────────────

export async function sendPushToUsers(
  userIds: number[],
  payload: PushPayload
): Promise<{ sent: number; expired: number; errors: number }> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn("[push] VAPID keys not configured — skipping push");
    return { sent: 0, expired: 0, errors: 0 };
  }

  if (userIds.length === 0) return { sent: 0, expired: 0, errors: 0 };

  // Fetch all subscriptions for these users
  const db = await getDb();
  if (!db) return { sent: 0, expired: 0, errors: 0 };
  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(inArray(pushSubscriptions.userId, userIds));

  if (subs.length === 0) return { sent: 0, expired: 0, errors: 0 };

  let sent = 0;
  let expired = 0;
  let errors = 0;
  const expiredEndpointHashes: string[] = [];

  // Send in parallel (with a concurrency cap to avoid hammering push services)
  const BATCH = 50;
  for (let i = 0; i < subs.length; i += BATCH) {
    const batch = subs.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map((sub: DBPushSub) => sendToSubscription(sub, payload))
    );
    results.forEach((result: string, idx: number) => {
      if (result === "ok") sent++;
      else if (result === "expired") {
        expired++;
        expiredEndpointHashes.push(batch[idx].endpointHash);
      } else errors++;
    });
  }

  // Clean up expired subscriptions
  if (expiredEndpointHashes.length > 0) {
    const cleanupDb = await getDb();
    if (cleanupDb) {
      await cleanupDb
        .delete(pushSubscriptions)
        .where(inArray(pushSubscriptions.endpointHash, expiredEndpointHashes));
      console.log(`[push] Removed ${expiredEndpointHashes.length} expired subscriptions`);
    }
  }

  console.log(`[push] Sent: ${sent}, Expired: ${expired}, Errors: ${errors}`);
  return { sent, expired, errors };
}

// ─── Send to ALL subscribed users ─────────────────────────────────────────────

export async function sendPushToAll(
  payload: PushPayload
): Promise<{ sent: number; expired: number; errors: number }> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn("[push] VAPID keys not configured — skipping push");
    return { sent: 0, expired: 0, errors: 0 };
  }

  const db = await getDb();
  if (!db) return { sent: 0, expired: 0, errors: 0 };
  const subs = await db.select().from(pushSubscriptions);
  if (subs.length === 0) return { sent: 0, expired: 0, errors: 0 };

  const userIds = Array.from(new Set(subs.map((s: DBPushSub) => s.userId))) as number[];
  return sendPushToUsers(userIds, payload);
}
