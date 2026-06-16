/**
 * Magic Link Redirect Handler
 *
 * Wraps Clerk sign-in tokens in our own endpoint so we can intercept
 * expired/already-used tokens and show our custom fallback page instead
 * of Clerk's generic error screen.
 *
 * Email links point to:
 *   https://munymo.com/api/magic?token=<clerk_token_id>&to=/game/1/result
 *
 * Flow:
 *   1. Check if token is still valid via Clerk API
 *   2. If valid → redirect to the Clerk token URL (signs user in, then lands on /email-landing?to=...)
 *   3. If expired/used/invalid → redirect to /email-landing?to=... directly (shows friendly fallback)
 */

import type { Express } from "express";
import { ENV } from "./env";

const BASE_URL = "https://munymo.com";
const CLERK_API = "https://api.clerk.com/v1";

export function registerMagicLinkRedirect(app: Express) {
  app.get("/api/magic", async (req, res) => {
    const token = req.query.token as string | undefined;
    const to    = (req.query.to as string | undefined) || "/game";

    const landingUrl = `${BASE_URL}/email-landing?to=${encodeURIComponent(to)}`;

    if (!token) {
      return res.redirect(landingUrl);
    }

    try {
      // Check the token status via Clerk Backend API
      const clerkRes = await fetch(`${CLERK_API}/sign_in_tokens/${token}`, {
        headers: { Authorization: `Bearer ${ENV.clerkSecretKey}` },
      });

      if (!clerkRes.ok) {
        // Token not found or already revoked → send to friendly fallback
        return res.redirect(landingUrl);
      }

      const data = await clerkRes.json() as { status?: string; url?: string };

      if (data.status !== "pending" || !data.url) {
        // Already used (status = "accepted") or invalid → friendly fallback
        return res.redirect(landingUrl);
      }

      // Token is still valid — redirect to Clerk's sign-in URL
      // After sign-in Clerk will forward to our /email-landing?to=... page
      const clerkUrl = `${data.url}&redirect_url=${encodeURIComponent(landingUrl)}`;
      return res.redirect(clerkUrl);

    } catch (err) {
      console.warn("[MagicLink] Error checking token:", err);
      return res.redirect(landingUrl);
    }
  });
}
