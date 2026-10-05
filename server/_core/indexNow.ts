/**
 * IndexNow: tell Bing (and the other IndexNow engines) about a new page the
 * moment it exists, instead of waiting for a crawl. ChatGPT search draws on
 * Bing's index, so this matters beyond Bing itself. Google does not take
 * IndexNow; never use Google's Indexing API for this (it's restricted to job
 * and livestream pages).
 *
 * The key is public by design: IndexNow proves site ownership by fetching it
 * from https://munymo.com/<key>.txt (client/public/<key>.txt). It is not a
 * secret and grants nothing beyond submitting munymo.com URLs.
 */
export const INDEXNOW_KEY = "4569fbf8fd2541c3d44bcd2274b3dea8";
const HOST = "munymo.com";
const ENDPOINT = "https://api.indexnow.org/indexnow";

export function buildIndexNowPayload(urls: string[]) {
  return {
    host: HOST,
    key: INDEXNOW_KEY,
    keyLocation: `https://${HOST}/${INDEXNOW_KEY}.txt`,
    urlList: Array.from(new Set(urls)).filter((u) => u.startsWith(`https://${HOST}/`)),
  };
}

/**
 * Fire-and-forget. Never throws: a failed ping only means Bing finds the page
 * on its next crawl via the sitemap, as it always has. Production only, so
 * local runs and tests never announce anything.
 */
export async function pingIndexNow(urls: string[]): Promise<boolean> {
  if (process.env.NODE_ENV !== "production") return false;
  const payload = buildIndexNowPayload(urls);
  if (payload.urlList.length === 0) return false;
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
    // 200 = accepted, 202 = accepted and key validation pending.
    if (res.ok) {
      console.log(`[indexnow] submitted ${payload.urlList.length} url(s): HTTP ${res.status}`);
      return true;
    }
    console.error(`[indexnow] rejected: HTTP ${res.status}`);
    return false;
  } catch (err) {
    console.error("[indexnow] ping failed:", err);
    return false;
  }
}
