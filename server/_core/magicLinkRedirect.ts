/**
 * Magic Link Redirect Handler — GET /api/magic
 *
 * Emailed links look like:
 *   https://munymo.com/api/magic?to=/game&p=play&d=2026-09-21&exp=<unix>&t=<ticket>
 *
 * This endpoint applies Munymo's validity rules and then hands off to OUR
 * landing page (never to Clerk's hosted sign-in):
 *
 *   1. No ticket, or junk            → landing with r=invalid
 *   2. Past the 7-day backstop       → landing with r=expired
 *   3. A newer link has been issued  → landing with r=superseded
 *   4. Otherwise                     → landing with the ticket in the fragment
 *
 * In every case the landing page first checks whether this browser is already
 * signed in, and if so goes straight to the destination — so a superseded or
 * used link is still a perfectly good link for someone who doesn't need
 * signing in. See magicLink.ts for the full reasoning.
 */

import type { Express } from "express";
import {
  buildLandingPath,
  decodeTarget,
  isAllowedMagicTarget,
  isMagicPurpose,
  isSuperseded,
  safeDestination,
  ticketFromClerkUrl,
} from "./magicLink";

export function registerMagicLinkRedirect(app: Express) {
  app.get("/api/magic", async (req, res) => {
    const to = safeDestination(req.query.to as string | undefined);
    // Never cache: the answer changes when a newer link is issued.
    res.setHeader("Cache-Control", "no-store");

    let ticket = typeof req.query.t === "string" ? req.query.t : null;

    // Links sent between 2026-09-16 and 2026-09-20 carried Clerk's whole url,
    // base64-encoded, as `u`. They are still in inboxes; read the ticket out.
    if (!ticket && typeof req.query.u === "string") {
      const legacy = decodeTarget(req.query.u);
      if (legacy && isAllowedMagicTarget(legacy)) ticket = ticketFromClerkUrl(legacy);
    }

    if (!ticket) return res.redirect(buildLandingPath(to, { reason: "invalid" }));

    const exp = Number(req.query.exp);
    if (Number.isFinite(exp) && exp > 0 && Date.now() / 1000 > exp) {
      return res.redirect(buildLandingPath(to, { reason: "expired" }));
    }

    const purpose = req.query.p;
    const issueDate = typeof req.query.d === "string" ? req.query.d : "";
    if (isMagicPurpose(purpose) && issueDate) {
      try {
        const { getLatestGameDateForPurpose } = await import("../db");
        const latest = await getLatestGameDateForPurpose(purpose);
        if (isSuperseded(issueDate, latest)) {
          return res.redirect(buildLandingPath(to, { reason: "superseded" }));
        }
      } catch (err) {
        // A database hiccup must not strand someone holding a good link.
        console.warn("[MagicLink] supersession check failed — honouring the link:", err);
      }
    }

    return res.redirect(buildLandingPath(to, { ticket }));
  });
}
