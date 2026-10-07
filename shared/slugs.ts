/**
 * Descriptive public URLs for archive games and lessons.
 *
 *   /research/fcx-vs-scco-2026-07-28   (was /research/810001)
 *   /learn/what-a-share-actually-is    (was /learn/l100-1)
 *
 * Numeric game ids and l{level}-{n} lesson ids stay the internal keys (DB rows,
 * lesson progress); only the URL changes. The old URLs 301 to these on the
 * server and are rewritten client-side, so every link ever sent keeps working.
 *
 * Shared by client and server so the sitemap, canonical tags, crawl links and
 * in-app links can never disagree about a page's address.
 */

export interface SluggableGame {
  companyATicker: string;
  companyBTicker: string;
  gameDate: string; // YYYY-MM-DD, unique per game
}

const tickerPart = (t: string) =>
  t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/** "fcx-vs-scco-2026-07-28". Game date is unique, so the slug is too. */
export function archiveSlug(g: SluggableGame): string {
  return `${tickerPart(g.companyATicker)}-vs-${tickerPart(g.companyBTicker)}-${g.gameDate}`;
}

export function archivePath(g: SluggableGame): string {
  return `/research/${archiveSlug(g)}`;
}

/** The game date at the end of an archive slug, or null if it isn't one. */
export function archiveSlugDate(slug: string): string | null {
  const m = slug.match(/^[a-z0-9-]+-vs-[a-z0-9-]+-(\d{4}-\d{2}-\d{2})$/);
  return m ? m[1] : null;
}

/**
 * Lesson id → URL slug. FROZEN on purpose rather than derived from the title:
 * editing a lesson title must never silently change (and break) its URL. A new
 * lesson needs an entry here — server/lessonIds.test.ts fails until it has one.
 */
export const LESSON_SLUGS: Record<string, string> = {
  "l100-1": "what-a-share-actually-is",
  "l100-2": "why-stock-prices-move",
  "l100-3": "the-trading-day",
  "l100-4": "percentage-change-not-price",
  "l100-5": "market-cap",
  "l100-6": "reading-a-stock-matchup",
  "l200-1": "stock-catalysts",
  "l200-2": "earnings-day",
  "l200-3": "expectations-vs-surprise",
  "l200-4": "beta-and-volatility",
  "l200-5": "momentum-and-the-52-week-high",
  "l200-6": "short-interest",
  "l200-7": "decoding-the-pairing-rationale",
  "l300-1": "revenue-and-growth",
  "l300-2": "earnings-and-eps",
  "l300-3": "the-pe-ratio",
  "l300-4": "profit-margins",
  "l300-5": "debt-and-the-balance-sheet",
  "l300-6": "moats-and-competition",
  "l300-7": "fundamentals-dont-predict-a-day",
  "l400-1": "stock-analysts",
  "l400-2": "price-targets",
  "l400-3": "institutions-vs-retail-investors",
  "l400-4": "market-sentiment-and-narrative",
  "l400-5": "reading-financial-news-critically",
  "l400-6": "the-hindsight-habit",
  "l500-1": "no-metric-works-alone",
  "l500-2": "factor-investing-value-quality-momentum",
  "l500-3": "investing-checklists-beat-hunches",
  "l500-4": "investment-horizon-discipline",
  "l500-5": "the-munymo-matchup-scorecard",
  "l500-6": "run-it-live",
};

const LESSON_ID_BY_SLUG: Record<string, string> = Object.fromEntries(
  Object.entries(LESSON_SLUGS).map(([id, slug]) => [slug, id])
);

export function lessonPath(lessonId: string): string {
  return `/learn/${LESSON_SLUGS[lessonId] ?? lessonId}`;
}

/** Resolve a /learn/:x segment (new slug or legacy id) to a lesson id. */
export function lessonIdFromSegment(segment: string): string | null {
  if (LESSON_ID_BY_SLUG[segment]) return LESSON_ID_BY_SLUG[segment];
  if (LESSON_SLUGS[segment]) return segment;
  return null;
}
