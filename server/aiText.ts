/**
 * Cleans Claude's citation markup out of player-facing text.
 *
 * WHY: the curation agent researches with the web_search tool, and when it
 * writes prose grounded in a search result it sometimes wraps the sentence in
 * the citation tags it uses internally — `<cite index="1-10">…</cite>`. Those
 * tags are meaningless outside the API response, and the client renders every
 * text field verbatim (no markdown, no HTML), so on 2026-11-02 the Hindsight
 * Spotlight for GOOGL vs TTD showed the raw tags to players. Five games had
 * been affected since 2026-08; scripts/strip-ai-markup.ts cleaned them.
 *
 * Every path that stores agent-written text runs its payload through
 * sanitizeAiStrings() before anything is written, so this cannot recur no
 * matter what the model emits.
 */

// Opening and closing citation tags, any attributes, any case.
const CITE_TAG = /<\/?cite(?:\s[^<>]*)?>/gi;
// Any other HTML/XML-style tag. The agent's output is plain prose; the client
// never renders markup, so a tag can only ever be noise.
const ANY_TAG = /<\/?[a-zA-Z][a-zA-Z0-9:-]*(?:\s[^<>]*)?\/?>/g;

/** Returns true when the text still contains anything tag-shaped. */
export function hasAiMarkup(text: string): boolean {
  ANY_TAG.lastIndex = 0;
  return ANY_TAG.test(text);
}

/**
 * Strips citation tags (and any other tag-shaped markup) from a string,
 * keeping the text inside them, then tidies the spacing the tags leave behind
 * (a tag that sat between a word and a space, or around a full sentence).
 */
export function stripAiMarkup(text: string): string {
  let out = text.replace(CITE_TAG, "").replace(ANY_TAG, "");
  // Doubled spaces where a tag separated two spaces; space before punctuation
  // where a closing tag preceded it ("…four years. </cite>" style leftovers).
  out = out.replace(/[ \t]{2,}/g, " ").replace(/ +([.,;:!?])/g, "$1");
  // Spaces at either end of each line, which the tags often leave.
  out = out
    .split("\n")
    .map((line) => line.trim())
    .join("\n");
  return out.trim();
}

/**
 * Deep-walks any JSON-shaped value (payload, tRPC input, DB row) and strips
 * markup from every string in it. Arrays and nested objects are walked;
 * numbers, booleans and nulls pass through untouched. Returns a new value —
 * the input is never mutated.
 */
export function sanitizeAiStrings<T>(value: T): T {
  if (typeof value === "string") return stripAiMarkup(value) as T;
  if (Array.isArray(value)) return value.map((v) => sanitizeAiStrings(v)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = sanitizeAiStrings(v);
    return out as T;
  }
  return value;
}
