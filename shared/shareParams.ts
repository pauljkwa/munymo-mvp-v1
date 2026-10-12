/**
 * The sharer's own result, carried on a shared archive link:
 *   /research/pep-vs-kdp-2026-10-09?s=100&r=1&st=4&c=c
 * The server reads it to put "I called it · 100/100" on the link-preview
 * image and title (server/_core/shareCard.ts); the canonical URL ignores it.
 *
 * User-editable by design (like a Wordle grid it's a brag, not a record), so
 * parsing is strict: small integers and fixed codes only, never free text.
 *   s  = score 0–100      st = streak 0–999
 *   r  = 1 called it / 0 missed it
 *   c  = t | l | c  (Toss-up / Leaning / Confident)
 */

export interface ShareParams {
  score: number | null;
  streak: number | null;
  called: boolean | null;
  confidence: "Toss-up" | "Leaning" | "Confident" | null;
}

const CONFIDENCE: Record<string, ShareParams["confidence"]> = {
  t: "Toss-up",
  l: "Leaning",
  c: "Confident",
};

/** Strict parse of the share query string; anything unexpected is dropped. */
export function parseShareParams(query: string | URLSearchParams): ShareParams {
  const q = typeof query === "string" ? new URLSearchParams(query.replace(/^\?/, "")) : query;
  const int = (k: string, max: number) => {
    const v = q.get(k);
    if (v === null || !/^\d{1,3}$/.test(v)) return null;
    const n = parseInt(v, 10);
    return n <= max ? n : null;
  };
  const r = q.get("r");
  return {
    score: int("s", 100),
    streak: int("st", 999),
    called: r === "1" ? true : r === "0" ? false : null,
    confidence: CONFIDENCE[q.get("c") ?? ""] ?? null,
  };
}

export function hasShareParams(p: ShareParams): boolean {
  return p.score !== null || p.called !== null;
}

/** Canonical query string for a share — the inverse of parseShareParams. */
export function shareQuery(p: ShareParams): string {
  const q = new URLSearchParams();
  if (p.score !== null) q.set("s", String(p.score));
  if (p.called !== null) q.set("r", p.called ? "1" : "0");
  if (p.streak !== null && p.streak > 1) q.set("st", String(p.streak));
  const c = Object.entries(CONFIDENCE).find(([, v]) => v === p.confidence)?.[0];
  if (c) q.set("c", c);
  const s = q.toString();
  return s ? `?${s}` : "";
}
