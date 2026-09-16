/**
 * Magic Link Redirect Handler
 *
 * Email and push links point at:
 *   https://munymo.com/api/magic?u=<base64url clerk url>&exp=<unix>&to=/game
 *
 * Flow:
 *   1. Past our own expiry stamp → friendly fallback page, no Clerk call
 *   2. Target missing or not an allowed host → friendly fallback
 *   3. Otherwise → forward to Clerk's sign-in url, which signs the user in and
 *      then lands them on /email-landing?to=...
 *
 * Clerk remains the authority on whether a token is actually still good: it is
 * single-use by design and enforces its own expiry. Our `exp` stamp only saves
 * a round trip for the common too-late case — see magicLink.ts for why this no
 * longer pre-checks the token against Clerk (that check could never succeed).
 */

import type { Express } from "express";
import { decodeTarget, isAllowedMagicTarget } from "./magicLink";

const BASE_URL = "https://munymo.com";

export function registerMagicLinkRedirect(app: Express) {
  app.get("/api/magic", async (req, res) => {
    const to = (req.query.to as string | undefined) || "/game";
    // Only ever redirect internally to a path, never to a caller-supplied host.
    const safeTo = to.startsWith("/") && !to.startsWith("//") ? to : "/game";
    const landingUrl = `${BASE_URL}/email-landing?to=${encodeURIComponent(safeTo)}`;

    const encoded = req.query.u as string | undefined;
    const exp = Number(req.query.exp);

    // Links from before the 2026-09-16 rewrite carry `token=<id>` and cannot be
    // honoured — the id alone is not enough to build a sign-in url. Send those
    // to the fallback, which is what they already did in practice.
    if (!encoded) {
      return res.redirect(landingUrl);
    }

    if (Number.isFinite(exp) && exp > 0 && Date.now() / 1000 > exp) {
      return res.redirect(landingUrl);
    }

    const target = decodeTarget(encoded);
    if (!target || !isAllowedMagicTarget(target)) {
      console.warn("[MagicLink] Rejected redirect target");
      return res.redirect(landingUrl);
    }

    try {
      const url = new URL(target);
      // Clerk sends the user here once the ticket is accepted.
      url.searchParams.set("redirect_url", landingUrl);
      return res.redirect(url.toString());
    } catch {
      return res.redirect(landingUrl);
    }
  });
}
