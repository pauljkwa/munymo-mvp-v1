/**
 * Magic links for emails and push notifications.
 *
 * ── Why this was rewritten (2026-09-16) ──────────────────────────────────────
 * Magic links never worked: every one reported "expired", including links
 * opened seconds after arrival.
 *
 * The old flow put Clerk's sign-in token *id* in the link, and `/api/magic`
 * then called `GET /v1/sign_in_tokens/{id}` to pre-check validity before
 * forwarding. Clerk's Backend API documents only CREATE and REVOKE for sign-in
 * tokens — there is no retrieve endpoint — so that request failed every time,
 * the handler took its "invalid token" branch, and the user landed on the
 * expired page. The pre-check could never succeed, which is why age made no
 * difference.
 *
 * The fix is to stop pre-checking. Clerk returns the ready-to-use sign-in `url`
 * at CREATION, so we carry that instead and let Clerk be the authority on
 * validity — which it already is:
 *
 *   - single use: Clerk flips the token's status pending → accepted on use,
 *     and refuses it thereafter. We do not need to track that ourselves.
 *   - expiry: set at creation via `expires_in_seconds`.
 *
 * We keep the friendly "this link has expired" page by stamping our own expiry
 * into the link, so the common too-late case is answered without any Clerk
 * call. That stamp is a courtesy, not a security control — a tampered `exp`
 * only skips our page and hands the user to Clerk, which enforces the real
 * check.
 */

const BASE_URL = "https://munymo.com";

/**
 * 24 hours, applied everywhere. Previously 24h in one caller and 2h in another,
 * which meant an evening result email could expire before morning.
 */
export const MAGIC_LINK_TTL_SECONDS = 86_400;

/**
 * Hosts a magic link is allowed to forward to.
 *
 * `url` arrives back through a query parameter, so without this check the
 * endpoint would be an open redirect — anyone could send a munymo.com link
 * that lands on a site of their choosing. Clerk serves sign-in tickets from
 * the app's Frontend API host (clerk.munymo.com in production) and from its
 * own domains in development.
 */
const ALLOWED_REDIRECT_HOSTS = ["munymo.com", "clerk.com", "accounts.dev"];

export function isAllowedMagicTarget(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== "https:") return false;
    return ALLOWED_REDIRECT_HOSTS.some(
      (h) => u.hostname === h || u.hostname.endsWith(`.${h}`)
    );
  } catch {
    return false;
  }
}

function encodeTarget(url: string): string {
  return Buffer.from(url, "utf8").toString("base64url");
}

export function decodeTarget(encoded: string): string | null {
  try {
    const s = Buffer.from(encoded, "base64url").toString("utf8");
    return s.startsWith("https://") ? s : null;
  } catch {
    return null;
  }
}

/** Assembles our wrapper URL around a Clerk sign-in url. Exported for tests. */
export function buildMagicUrl(clerkUrl: string, destination: string, expiresAt: number): string {
  const params = new URLSearchParams({
    u: encodeTarget(clerkUrl),
    exp: String(expiresAt),
    to: destination,
  });
  return `${BASE_URL}/api/magic?${params.toString()}`;
}

/**
 * Creates a single-use Clerk sign-in token and wraps it in a munymo.com link.
 *
 * Returns null when Clerk isn't configured, the user has no Clerk id, or the
 * API call fails — every caller treats null as "send the email without a magic
 * link", so a Clerk outage degrades to a normal sign-in rather than blocking
 * the notification entirely.
 */
export async function createMagicLink(
  clerkId: string | null,
  destination: string,
  clerkSecretKey: string
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
        expires_in_seconds: MAGIC_LINK_TTL_SECONDS,
      }),
    });
    if (!res.ok) {
      console.warn("[MagicLink] Clerk token creation failed:", res.status);
      return null;
    }

    // `url` is the whole point: it is only returned here, at creation. The old
    // implementation kept `id` and threw this away, then tried to look it back
    // up through an endpoint that does not exist.
    const data = (await res.json()) as { id?: string; url?: string };
    if (!data.url || !isAllowedMagicTarget(data.url)) {
      console.warn("[MagicLink] Clerk returned no usable sign-in url");
      return null;
    }

    const expiresAt = Math.floor(Date.now() / 1000) + MAGIC_LINK_TTL_SECONDS;
    return buildMagicUrl(data.url, destination, expiresAt);
  } catch (err) {
    console.warn("[MagicLink] Clerk token creation error:", err);
    return null;
  }
}
