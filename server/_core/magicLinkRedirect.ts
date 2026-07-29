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
 * WHY THE INTERSTITIAL (2026-07-29):
 * Clerk sign-in tokens are SINGLE USE. This endpoint used to 302 straight to
 * Clerk's sign-in URL, which meant anything that merely *followed* the link
 * consumed the token — mail security scanners, link previewers and prefetchers
 * all do exactly that, before the human ever taps. The token was then
 * `accepted`, and the real click landed on the "link expired" fallback, often
 * within minutes of the email arriving. Raising the expiry could never fix
 * this, because the token wasn't expiring — it was being spent.
 *
 * So GET no longer consumes anything. It renders a tiny page that POSTs to
 * /api/magic (auto-submitted by script, with a real button as the no-JS
 * fallback). Scanners issue GETs, not POSTs, so the token survives until a
 * genuine browser arrives.
 *
 * Flow:
 *   GET  /api/magic  → interstitial page (no Clerk call, nothing consumed)
 *   POST /api/magic  → check token validity via Clerk API
 *                      valid   → redirect to the Clerk token URL (signs the
 *                                user in, then lands on /email-landing?to=…)
 *                      expired → redirect to /email-landing?to=… (friendly
 *                                fallback explaining the link is spent)
 */

import express, { type Express } from "express";
import { ENV } from "./env";

const BASE_URL = "https://munymo.com";
const CLERK_API = "https://api.clerk.com/v1";

/** Minimal HTML-attribute escaping for values echoed into the interstitial. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Only ever forward to a path on our own site. `to` arrives from a query
 * string, so without this an email link could be rewritten into an open
 * redirect (and `//evil.com` is a protocol-relative URL, not a local path).
 */
export function safeDestination(raw: unknown): string {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//")) {
    return "/game";
  }
  return raw;
}

function landingUrlFor(to: string): string {
  return `${BASE_URL}/email-landing?to=${encodeURIComponent(to)}`;
}

/**
 * The interstitial. Auto-submits on real browsers so the user still gets a
 * one-tap experience; the button is what a no-JS browser (and a suspicious
 * human) sees. Deliberately no external assets — this renders before sign-in.
 */
export function interstitialHtml(token: string, to: string): string {
  const safeToken = escapeHtml(token);
  const safeTo = escapeHtml(to);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Signing you in… | Munymo</title>
<style>
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
         font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
         background:#0b1220; color:#e6edf7; text-align:center; padding:24px; }
  .card { max-width:22rem; }
  h1 { font-size:1.15rem; font-weight:600; margin:0 0 .5rem; }
  p { font-size:.9rem; line-height:1.5; color:#9fb0c9; margin:0 0 1.25rem; }
  button { font:inherit; font-weight:600; cursor:pointer; border:0; border-radius:.6rem;
           padding:.8rem 1.6rem; background:#22c55e; color:#04120a; }
</style>
</head>
<body>
  <div class="card">
    <h1>Signing you in…</h1>
    <p>One moment while we open your game.</p>
    <form id="f" method="POST" action="/api/magic">
      <input type="hidden" name="token" value="${safeToken}">
      <input type="hidden" name="to" value="${safeTo}">
      <button type="submit">Continue to Munymo</button>
    </form>
  </div>
  <script>document.getElementById("f").submit();</script>
</body>
</html>`;
}

export function registerMagicLinkRedirect(app: Express) {
  // GET: render the interstitial only. Nothing here touches Clerk, so a
  // scanner following the link cannot spend the token.
  app.get("/api/magic", (req, res) => {
    const token = typeof req.query.token === "string" ? req.query.token : undefined;
    const to = safeDestination(req.query.to);

    if (!token) {
      return res.redirect(landingUrlFor(to));
    }

    res.set("Cache-Control", "no-store, private");
    res.set("X-Robots-Tag", "noindex, nofollow");
    return res.type("html").send(interstitialHtml(token, to));
  });

  // POST: the real thing. Only reached from the interstitial's form.
  app.post("/api/magic", express.urlencoded({ extended: false }), async (req, res) => {
    const body = (req.body ?? {}) as { token?: string; to?: string };
    const token = typeof body.token === "string" ? body.token : undefined;
    const to = safeDestination(body.to);
    const landingUrl = landingUrlFor(to);

    res.set("Cache-Control", "no-store, private");

    if (!token) {
      return res.redirect(landingUrl);
    }

    try {
      const clerkRes = await fetch(`${CLERK_API}/sign_in_tokens/${encodeURIComponent(token)}`, {
        headers: { Authorization: `Bearer ${ENV.clerkSecretKey}` },
      });

      if (!clerkRes.ok) {
        // Token not found or already revoked → friendly fallback
        return res.redirect(landingUrl);
      }

      const data = (await clerkRes.json()) as { status?: string; url?: string };

      if (data.status !== "pending" || !data.url) {
        // Already used (status = "accepted") or invalid → friendly fallback
        return res.redirect(landingUrl);
      }

      // Token is still valid — hand off to Clerk, which signs the user in and
      // then forwards to our /email-landing?to=… page.
      const clerkUrl = `${data.url}&redirect_url=${encodeURIComponent(landingUrl)}`;
      return res.redirect(clerkUrl);
    } catch (err) {
      console.warn("[MagicLink] Error checking token:", err);
      return res.redirect(landingUrl);
    }
  });
}
