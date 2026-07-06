/**
 * Referral QR Code System
 * =======================
 * Handles the /r/[code] redirect endpoint that is embedded in every merch QR code.
 *
 * Flow:
 *   1. Visitor scans QR → GET /r/X7K2M9PQ
 *   2. Server looks up the code in referral_codes
 *   3. If active: records a scan event, sets a referral cookie, redirects to /
 *   4. If unassigned/suspended/not found: redirects to / with no cookie
 *
 * The referral cookie (munymo_ref) is read during Clerk's post-signup webhook
 * to attribute the new user to the code owner.
 *
 * Attribution window: 30 days from scan.
 */

import type { Express, Request, Response } from "express";
import crypto from "crypto";
import { getDb } from "./db";
import { referralCodes, referralEvents } from "../drizzle/schema";
import { eq, and, gte } from "drizzle-orm";

// ─── Constants ────────────────────────────────────────────────────────────────

export const REFERRAL_COOKIE = "munymo_ref";
export const REFERRAL_ATTRIBUTION_DAYS = 30;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Anonymised device fingerprint: SHA-256(ip + userAgent). Never stored raw. */
function deviceFingerprint(req: Request): string {
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
    ?? req.socket.remoteAddress
    ?? "unknown";
  const ua = req.headers["user-agent"] ?? "unknown";
  return crypto.createHash("sha256").update(`${ip}:${ua}`).digest("hex").slice(0, 64);
}

/** Generate a cryptographically random 8-character alphanumeric code. */
export function generateReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to avoid confusion
  let code = "";
  const bytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

// ─── Route Registration ───────────────────────────────────────────────────────

export function registerReferralRoutes(app: Express): void {

  /**
   * GET /r/:code
   * The QR code URL. Records a scan event and redirects to the landing page
   * with a referral cookie set.
   */
  app.get("/r/:code", async (req: Request, res: Response) => {
    const { code } = req.params;

    try {
      // Look up the code
      const db = await getDb();
      if (!db) return res.redirect(302, "/");

      const [referral] = await db
        .select()
        .from(referralCodes)
        .where(eq(referralCodes.code, code.toUpperCase()))
        .limit(1);

      // Unknown or suspended code — silent redirect, no cookie
      if (!referral || referral.status !== "active") {
        return res.redirect(302, "/");
      }

      const fingerprint = deviceFingerprint(req);
      const cookieValue = `${code.toUpperCase()}:${Date.now()}`;

      // Check for a recent scan from this device to avoid duplicate scan counts
      const windowStart = new Date(Date.now() - 60 * 60 * 1000); // 1-hour dedup window
      const [recentScan] = await db
        .select({ id: referralEvents.id })
        .from(referralEvents)
        .where(
          and(
            eq(referralEvents.referralCodeId, referral.id),
            eq(referralEvents.eventType, "scan"),
            eq(referralEvents.deviceFingerprint, fingerprint),
            gte(referralEvents.createdAt, windowStart)
          )
        )
        .limit(1);

      if (!recentScan) {
        // Record scan event
        await db.insert(referralEvents).values({
          referralCodeId: referral.id,
          eventType: "scan",
          ownerIdAtEvent: referral.ownerId ?? undefined,
          deviceFingerprint: fingerprint,
          referralCookie: cookieValue,
          attributed: false,
        });

        // Increment scan counter on the code
        await db
          .update(referralCodes)
          .set({ totalScans: (referral.totalScans ?? 0) + 1 })
          .where(eq(referralCodes.id, referral.id));
      }

      // Set referral cookie — 30-day attribution window
      res.cookie(REFERRAL_COOKIE, cookieValue, {
        maxAge: REFERRAL_ATTRIBUTION_DAYS * 24 * 60 * 60 * 1000,
        httpOnly: false, // must be readable by client JS for Clerk post-signup hook
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
      });

      // Redirect to landing page
      return res.redirect(302, "/");

    } catch (err) {
      console.error("[referral] Error handling QR scan:", err);
      return res.redirect(302, "/");
    }
  });
}
