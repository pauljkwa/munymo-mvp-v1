/**
 * Magic links for emails.
 *
 * ── Third design (2026-09-20). Why the first two failed ─────────────────────
 * v1 put Clerk's sign-in token *id* in the link and pre-checked it against an
 * endpoint Clerk does not have, so every link reported "expired".
 *
 * v2 (2026-09-16) forwarded the browser to Clerk's hosted ticket url and hoped
 * to be sent back signed in. In practice Paul landed on Clerk's sign-in /
 * sign-up page and had to log in with Google by hand, every time, and each of
 * those was a brand-new session that Clerk reported as a new device. v2 also
 * stamped a flat 24 hours on every link, so Friday's "today's game" link was
 * dead by Sunday morning although the game it pointed at stayed open until
 * Monday's bell — an unused link showing "This link has expired".
 *
 * v3 stops depending on Clerk's hosted pages. The link carries the raw ticket;
 * `/api/magic` applies Munymo's own validity rules and hands the ticket to
 * OUR landing page in the url fragment; the landing page:
 *   - if the browser is already signed in, goes straight to the destination
 *     and never touches the ticket (no new session, no new-device email);
 *   - otherwise redeems the ticket in place with Clerk's SDK
 *     (`signIn.create({ strategy: "ticket" })`) and then goes to the
 *     destination. No auth page in between.
 *
 * ── Validity rules (Paul, 2026-09-20) ────────────────────────────────────────
 * A link stays good until (1) it has been used once, or (2) a newer link has
 * been issued for the same purpose.
 *   (1) is Clerk's: sign-in tokens are single-use.
 *   (2) is ours and is STATELESS: each link names its purpose and the game
 *       date it was issued for, and it is superseded the moment a later game
 *       exists for that purpose — which is exactly when the next email goes
 *       out. "play" links die when the next game is activated; "result" links
 *       die when the next result is published. A weekend is one issue, so
 *       Friday's link works until Monday's replaces it.
 * A 7-day cap on the Clerk token is the security backstop for a link that is
 * never superseded (a long market closure, a paused game) — a sign-in link is
 * a bearer credential and should not live in an inbox indefinitely.
 *
 * Redeeming happens in the browser with JavaScript, so mail scanners and link
 * previewers that merely fetch the url cannot burn the single use.
 */

const BASE_URL = "https://munymo.com";

/** Security backstop only — supersession is what normally ends a link's life. */
export const MAGIC_LINK_MAX_TTL_SECONDS = 7 * 86_400;

/** What the link is for. One live issue per purpose at a time. */
export type MagicPurpose = "play" | "result";

export interface MagicIssue {
  purpose: MagicPurpose;
  /** Game date (YYYY-MM-DD) this link was issued for. */
  date: string;
}

export function isMagicPurpose(v: unknown): v is MagicPurpose {
  return v === "play" || v === "result";
}

/**
 * Rule (2): a link is superseded once a later game exists for its purpose.
 * `latestDate` is the newest game date for that purpose (see
 * getLatestGameDateForPurpose in db.ts); null means "nothing to compare", in
 * which case the link stands.
 */
export function isSuperseded(issueDate: string, latestDate: string | null): boolean {
  if (!latestDate || !/^\d{4}-\d{2}-\d{2}$/.test(issueDate)) return false;
  return latestDate > issueDate;
}

/**
 * Hosts a LEGACY (v2) magic link is allowed to name. v2 links carried Clerk's
 * whole url back through a query parameter; we still read the ticket out of
 * those for emails already in inboxes, and only from a host we recognise.
 */
const ALLOWED_LEGACY_HOSTS = ["munymo.com", "clerk.com", "accounts.dev"];

export function isAllowedMagicTarget(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== "https:") return false;
    return ALLOWED_LEGACY_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

export function decodeTarget(encoded: string): string | null {
  try {
    const s = Buffer.from(encoded, "base64url").toString("utf8");
    return s.startsWith("https://") ? s : null;
  } catch {
    return null;
  }
}

/** Pulls the ticket out of a Clerk sign-in url (`?ticket=` or `?__clerk_ticket=`). */
export function ticketFromClerkUrl(clerkUrl: string): string | null {
  try {
    const p = new URL(clerkUrl).searchParams;
    return p.get("ticket") || p.get("__clerk_ticket") || null;
  } catch {
    return null;
  }
}

/** Only ever send people to a path on this site, never to a caller-supplied host. */
export function safeDestination(to: string | undefined | null): string {
  return to && to.startsWith("/") && !to.startsWith("//") ? to : "/game";
}

/** Assembles the emailed link. Exported for tests. */
export function buildMagicUrl(ticket: string, destination: string, issue: MagicIssue, expiresAt: number): string {
  const params = new URLSearchParams({
    to: safeDestination(destination),
    p: issue.purpose,
    d: issue.date,
    exp: String(expiresAt),
    t: ticket,
  });
  return `${BASE_URL}/api/magic?${params.toString()}`;
}

/**
 * Where `/api/magic` sends the browser. The ticket travels in the FRAGMENT so
 * it is never sent to a server again or written to an access log, and an
 * inline script in index.html lifts it out of the address bar before analytics
 * loads. A `reason` replaces the ticket when the link is no longer good.
 */
export function buildLandingPath(
  destination: string,
  outcome: { ticket: string } | { reason: "superseded" | "expired" | "invalid" }
): string {
  const base = `/email-landing?to=${encodeURIComponent(safeDestination(destination))}`;
  return "ticket" in outcome
    ? `${base}#t=${encodeURIComponent(outcome.ticket)}`
    : `${base}&r=${outcome.reason}`;
}

/**
 * Creates a single-use Clerk sign-in token and wraps it in a munymo.com link.
 *
 * Returns null when Clerk isn't configured, the user has no Clerk id, or the
 * API call fails — every caller treats null as "send the email with a plain
 * link", so a Clerk outage degrades to a normal sign-in rather than blocking
 * the notification.
 */
export async function createMagicLink(
  clerkId: string | null,
  destination: string,
  clerkSecretKey: string,
  issue: MagicIssue
): Promise<string | null> {
  if (!clerkId || !clerkSecretKey) return null;
  try {
    const res = await fetch("https://api.clerk.com/v1/sign_in_tokens", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${clerkSecretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: clerkId,
        expires_in_seconds: MAGIC_LINK_MAX_TTL_SECONDS,
      }),
    });
    if (!res.ok) {
      console.warn("[MagicLink] Clerk token creation failed:", res.status);
      return null;
    }

    // `token` is the ticket itself and is only returned here, at creation.
    // Older API responses expose it only inside `url`, so fall back to that.
    const data = (await res.json()) as { id?: string; token?: string; url?: string };
    const ticket = data.token || (data.url ? ticketFromClerkUrl(data.url) : null);
    if (!ticket) {
      console.warn("[MagicLink] Clerk returned no usable ticket");
      return null;
    }

    const expiresAt = Math.floor(Date.now() / 1000) + MAGIC_LINK_MAX_TTL_SECONDS;
    return buildMagicUrl(ticket, destination, issue, expiresAt);
  } catch (err) {
    console.warn("[MagicLink] Clerk token creation error:", err);
    return null;
  }
}
