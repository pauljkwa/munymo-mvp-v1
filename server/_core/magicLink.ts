/**
 * Magic sign-in links for outbound email.
 *
 * One helper, one TTL — before this, `routers.ts` minted 24h tokens and
 * `scheduledCuration.ts` minted 2h ones, so streak-at-risk links died while
 * the game they pointed at was still open.
 *
 * TTL policy: a link must outlive the game it points to. A game is created
 * just after the US close (~20:15 UTC) and locks at 13:30 UTC the following
 * day — roughly 17 hours — and result links stay useful well past that. 48h
 * covers the whole window with room for a late reader.
 *
 * NOTE: expiry was never the main reason links "expired". Clerk sign-in
 * tokens are SINGLE USE, and mail scanners/prefetchers that follow links
 * burn them before the human clicks. That's handled in magicLinkRedirect.ts —
 * the token is only consumed behind a POST, which scanners don't issue.
 */
import { ENV } from "./env";

const BASE_URL = "https://munymo.com";

/** How long a magic link stays valid. Must exceed a game's open window. */
export const MAGIC_LINK_TTL_SECONDS = 48 * 60 * 60;

/**
 * Mints a Clerk sign-in token and wraps it in our own /api/magic URL.
 * Returns null when Clerk isn't configured or the call fails — every caller
 * treats a null link as "send the email without a one-tap link", never as a
 * fatal error.
 */
export async function createMagicLink(
  clerkId: string | null,
  destination: string
): Promise<string | null> {
  if (!clerkId || !ENV.clerkSecretKey) return null;
  try {
    const res = await fetch("https://api.clerk.com/v1/sign_in_tokens", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ENV.clerkSecretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: clerkId,
        expires_in_seconds: MAGIC_LINK_TTL_SECONDS,
      }),
    });
    const data = (await res.json()) as { id?: string };
    if (!data.id) return null;
    return `${BASE_URL}/api/magic?token=${encodeURIComponent(data.id)}&to=${encodeURIComponent(destination)}`;
  } catch {
    return null;
  }
}
