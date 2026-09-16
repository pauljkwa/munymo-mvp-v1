/**
 * SEO — GET /sitemap.xml + server-side page metadata.
 *
 * The sitemap is served dynamically (not a static file) so it always includes
 * every published archive game under /research/:id — that list grows every
 * trading day, and the archive pages are the most crawlable, content-rich URLs
 * on the site. Static marketing/legal routes are listed alongside.
 *
 * resolvePageMeta/injectPageMeta give crawlers per-route <title>, description,
 * and canonical in the INITIAL html response, plus a real 404 status for URLs
 * that don't exist. Without this, every route serves the identical homepage
 * shell (title and all) and Google files the pages as duplicates — the titles
 * set client-side by usePageMeta only appear after JS renders. The route table
 * below MUST mirror the usePageMeta calls in client/src/pages/*.
 *
 * robots.txt lives in client/public/ (Vite copies it into the build) and
 * points crawlers here via its Sitemap: line.
 */
import type { Express, Request, Response } from "express";
// Lesson content is pure data (type-only imports), so the server may bundle it
// directly — unlike client components. If a lesson file ever imports runtime
// client code, the server build breaks: split the data into shared/ instead.
import { ALL_LEVELS } from "../../client/src/content/lessons";

const BASE_URL = "https://munymo.com";

// Public, signed-out-accessible routes worth indexing. Auth-gated app pages
// (/game, /dashboard, /profile, /admin) are deliberately excluded.
const STATIC_PATHS = [
  "/",
  "/demo",
  "/research",
  "/learn",
  "/feedback",
  "/terms",
  "/privacy",
  "/disclaimer",
  "/responsible-gaming",
];

function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export interface ArchiveGame {
  id: number;
  gameDate: string;
  companyATicker: string;
  companyBTicker: string;
}

// The published-game list backs both the sitemap and the crawlable link list,
// and the link list is built on every shell request. Cache it so a burst of
// page views can't turn into a burst of identical queries; the archive only
// changes once per trading day, so a stale minute costs nothing.
const ARCHIVE_TTL_MS = 15 * 60 * 1000;
let archiveCache: { at: number; games: ArchiveGame[] } | null = null;

async function getPublishedGames(): Promise<ArchiveGame[]> {
  if (archiveCache && Date.now() - archiveCache.at < ARCHIVE_TTL_MS) {
    return archiveCache.games;
  }
  try {
    const { getDb } = await import("../db");
    const { dailyGames } = await import("../../drizzle/schema.js");
    const { eq, desc } = await import("drizzle-orm");
    const db = await getDb();
    if (!db) return archiveCache?.games ?? [];

    const rows = await db
      .select({
        id: dailyGames.id,
        gameDate: dailyGames.gameDate,
        companyATicker: dailyGames.companyATicker,
        companyBTicker: dailyGames.companyBTicker,
      })
      .from(dailyGames)
      .where(eq(dailyGames.status, "result_published"))
      .orderBy(desc(dailyGames.gameDate))
      .limit(5000);

    archiveCache = { at: Date.now(), games: rows };
    return rows;
  } catch (err) {
    // DB hiccup → serve the last good list if we have one, else nothing. Never
    // fail the request: a crawl with no archive links beats a 500.
    console.error("[seo] Could not load archive games:", err);
    return archiveCache?.games ?? [];
  }
}

async function sitemapHandler(_req: Request, res: Response) {
  try {
    const games = await getPublishedGames();
    const gameUrls = games.map((g) => ({
      loc: `${BASE_URL}/research/${g.id}`,
      lastmod: g.gameDate,
    }));

    const entries = [
      ...STATIC_PATHS.map((p) => `  <url><loc>${xmlEscape(`${BASE_URL}${p}`)}</loc></url>`),
      // Individual lessons were missing from the sitemap entirely: /learn was
      // listed but none of the lesson pages beneath it.
      ...ALL_LESSONS.map(
        (l) => `  <url><loc>${xmlEscape(`${BASE_URL}/learn/${l.id}`)}</loc></url>`
      ),
      ...gameUrls.map(
        (u) => `  <url><loc>${xmlEscape(u.loc)}</loc><lastmod>${u.lastmod}</lastmod></url>`
      ),
    ];

    const xml =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      entries.join("\n") +
      `\n</urlset>\n`;

    res
      .set("Content-Type", "application/xml; charset=utf-8")
      .set("Cache-Control", "public, max-age=3600")
      .send(xml);
  } catch (err) {
    console.error("[sitemap] Error:", err);
    res.status(500).send("sitemap unavailable");
  }
}

export function registerSeo(app: Express) {
  app.get("/sitemap.xml", sitemapHandler);
}

// ---------------------------------------------------------------------------
// Server-side page metadata
// ---------------------------------------------------------------------------

// Mirror DEFAULT_TITLE / DEFAULT_DESCRIPTION in client/src/hooks/usePageMeta.ts
// — keep the two in sync.
const DEFAULT_TITLE = "Munymo — Free Daily Stock Market Prediction Game";
const DEFAULT_DESCRIPTION =
  "Munymo is a free daily stock market game. Predict which of two companies will perform better, read the day's research, and build real market intuition in five minutes a day.";

export interface PageMeta {
  title: string;
  description: string;
  /** 200, or 404 for URLs that don't exist (the SPA shell still renders NotFound). */
  status: number;
  /** Absolute canonical URL, or null to omit the tag (private/unknown pages). */
  canonical: string | null;
  /** Auth-gated or nonexistent pages: tell crawlers not to index the shell. */
  noindex: boolean;
}

// Public routes with a fixed title/description — mirrors the usePageMeta call
// in each page component.
const STATIC_META: Record<string, { title: string; description?: string }> = {
  "/demo": {
    title: "How Munymo Works — Daily Stock Market Game Demo | Munymo",
    description:
      "Walk through a full Munymo game day: the gut pick, the research brief, the scored prediction, and the result. See how the free daily stock market game works.",
  },
  "/research": {
    title: "Stock Matchup Archive — Daily Company Comparisons | Munymo",
    description:
      "Every completed Munymo matchup: two real companies, the research brief, the market result, and how the community voted. A growing archive of daily stock comparisons.",
  },
  "/learn": {
    title: "Learn Stock Market Basics by Playing | Munymo Learning Hub",
    description:
      "Short lessons on stock market basics, analysis, and investing concepts — built to pair with Munymo's free daily stock market game.",
  },
  "/feedback": { title: "Feedback | Munymo" },
  "/leaderboard": { title: "Leaderboard | Munymo" },
  "/terms": { title: "Terms of Use | Munymo" },
  "/privacy": { title: "Privacy Policy | Munymo" },
  "/disclaimer": { title: "Disclaimer | Munymo" },
  "/responsible-gaming": { title: "Responsible Gaming | Munymo" },
};

// Auth-gated app routes: real pages (200) but excluded from the sitemap, so
// also tell crawlers not to index the signed-out shell they'd see.
const PRIVATE_META: Record<string, string> = {
  "/game": "Today's Game | Munymo",
  "/dashboard": "My Dashboard | Munymo",
  "/profile": "Profile | Munymo",
  "/email-landing": DEFAULT_TITLE,
};

const defaults = (over: Partial<PageMeta> = {}): PageMeta => ({
  title: DEFAULT_TITLE,
  description: DEFAULT_DESCRIPTION,
  status: 200,
  canonical: null,
  noindex: false,
  ...over,
});

const ALL_LESSONS = ALL_LEVELS.flatMap((level) => level.lessons);

/**
 * Route → metadata. Never throws: on any lookup failure it fails open to the
 * site defaults with a 200 so a DB hiccup can't 404 real pages.
 */
export async function resolvePageMeta(rawPath: string): Promise<PageMeta> {
  try {
    // Strip query/hash, collapse trailing slashes (/demo/ → /demo).
    let p = rawPath.split("?")[0].split("#")[0];
    if (p.length > 1) p = p.replace(/\/+$/, "");
    if (p === "") p = "/";

    if (p === "/") return defaults({ canonical: `${BASE_URL}/` });

    const staticMeta = STATIC_META[p];
    if (staticMeta) {
      return defaults({
        title: staticMeta.title,
        ...(staticMeta.description ? { description: staticMeta.description } : {}),
        canonical: `${BASE_URL}${p}`,
      });
    }

    if (PRIVATE_META[p] || p.startsWith("/admin") || /^\/game\/\d+\/result$/.test(p)) {
      return defaults({ title: PRIVATE_META[p] ?? DEFAULT_TITLE, noindex: true });
    }

    const lessonMatch = p.match(/^\/learn\/([^/]+)$/);
    if (lessonMatch) {
      const lesson = ALL_LESSONS.find((l) => l.id === lessonMatch[1]);
      if (!lesson) return defaults({ status: 404, noindex: true });
      return defaults({
        title: `${lesson.title} — Learn the Stock Market | Munymo`,
        description: `A short Munymo lesson: ${lesson.title}. Learn stock market basics and analysis skills alongside the free daily stock market game.`,
        canonical: `${BASE_URL}${p}`,
      });
    }

    const gameMatch = p.match(/^\/research\/(\d+)$/);
    if (gameMatch) return resolveArchiveGameMeta(parseInt(gameMatch[1], 10), p);

    // Anything else isn't a route the app knows — the SPA shell renders
    // NotFound, and the 404 status stops Google indexing soft-404s.
    return defaults({ status: 404, noindex: true });
  } catch (err) {
    console.error("[seo] resolvePageMeta failed:", err);
    return defaults();
  }
}

async function resolveArchiveGameMeta(id: number, p: string): Promise<PageMeta> {
  try {
    const { getDb } = await import("../db");
    const db = await getDb();
    // DB unavailable → fail open rather than 404-ing a real archive page.
    if (!db) return defaults({ canonical: `${BASE_URL}${p}` });

    const { dailyGames } = await import("../../drizzle/schema.js");
    const { eq } = await import("drizzle-orm");
    const rows = await db.select().from(dailyGames).where(eq(dailyGames.id, id)).limit(1);
    const game = rows[0];
    if (!game) return defaults({ status: 404, noindex: true });

    // Only published games are in the sitemap; a queued future game keeps the
    // default meta so tomorrow's matchup never leaks through the html head.
    if (game.status !== "result_published") return defaults({ noindex: true });

    return defaults({
      title: `${game.companyATicker} vs ${game.companyBTicker} — Which Stock Performed Better? | Munymo`,
      description: `${game.companyAName} (${game.companyATicker}) vs ${game.companyBName} (${game.companyBTicker}), ${game.gameDate}: research brief, result, and community stats from Munymo's daily stock market game.`,
      canonical: `${BASE_URL}${p}`,
    });
  } catch (err) {
    console.error("[seo] archive game meta lookup failed:", err);
    return defaults({ canonical: `${BASE_URL}${p}` });
  }
}

function htmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Remove the umami analytics tag while it is unconfigured.
 *
 * client/index.html carries the tag with Vite `%VAR%` placeholders. Vite only
 * substitutes those when the matching env vars exist — they never have been —
 * so production shipped a literal `src="%VITE_ANALYTICS_ENDPOINT%/umami"`.
 * The browser dutifully requested that path, the SPA catch-all answered with
 * html, and the browser refused to execute it: a failed request and a console
 * error on every single page load, collecting nothing. Analytics was silently
 * dead rather than merely absent, which is worse — it looks installed.
 *
 * Stripping rather than deleting the tag from index.html keeps the wiring: set
 * VITE_ANALYTICS_ENDPOINT and VITE_ANALYTICS_WEBSITE_ID, rebuild, and the
 * placeholders resolve so this function stops matching and the tag ships.
 *
 * GA4 (gtag) is a separate, working install and is untouched.
 */
export function stripUnconfiguredAnalytics(html: string): string {
  if (!html.includes("%VITE_ANALYTICS_ENDPOINT%")) return html;
  return html.replace(
    /<script[^>]*%VITE_ANALYTICS_ENDPOINT%[^>]*>[\s\S]*?<\/script>/g,
    ""
  );
}

// ---------------------------------------------------------------------------
// Crawlable link list
// ---------------------------------------------------------------------------

/**
 * Server-rendered <a> links placed inside the SPA shell.
 *
 * WHY: the app renders every link client-side, so the html Google actually
 * receives for /research contained ZERO anchor tags. The archive pages were
 * therefore reachable only via the sitemap, with no internal-link signal at
 * all — Search Console showed them stuck at "Discovered - currently not
 * indexed", meaning Google knew the URLs existed but never spent crawl budget
 * fetching them. Google does render JS on a second pass, but that pass is
 * lower priority and unreliable for a site with little authority.
 *
 * This is NOT cloaking: the links are real, lead to real pages, and point at
 * the same destinations the React app renders. They also make the site usable
 * with JS disabled. main.tsx uses createRoot (not hydrateRoot), so React
 * replaces this markup wholesale on mount — there is no hydration mismatch
 * and a normal visitor never sees it.
 */
const MAX_ARCHIVE_LINKS = 300;
const MAX_HOME_GAME_LINKS = 12;
/** Sibling links from a leaf page back into the archive, for crawl paths. */
const MAX_SIBLING_LINKS = 8;

function linkList(links: { href: string; text: string }[]): string {
  return links
    .map(
      (l) => `<li><a href="${htmlEscape(l.href)}">${htmlEscape(l.text)}</a></li>`
    )
    .join("");
}

/** Plain text with blank-line paragraph breaks → escaped <p> elements. */
function paragraphs(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${htmlEscape(p)}</p>`)
    .join("");
}

function gameLink(g: ArchiveGame): { href: string; text: string } {
  return {
    href: `/research/${g.id}`,
    // Ticker-pair anchor text, not "read more" — it is the phrase these pages
    // should rank for and the only anchor text Google gets for them.
    text: `${g.companyATicker} vs ${g.companyBTicker} — ${g.gameDate}`,
  };
}

/**
 * The unique body content for one archive game, or "" if it shouldn't be shown.
 *
 * WHY this exists as well as the link lists: once Google started crawling the
 * archive it reported "Duplicate, Google chose different canonical than user"
 * and folded every /research/:id into a single URL. Each page served a unique
 * <title> and a correct self-referential canonical, but an EMPTY
 * <div id="root"> — so all ~60 pages were byte-identical below the head.
 * Google dedupes on body content and overrode our canonical accordingly.
 * Unique metadata is not enough; the page needs unique words.
 *
 * Only result_published games render, mirroring resolveArchiveGameMeta's
 * guard, so a queued future matchup can never leak through the html.
 */
async function buildArchiveGameContent(id: number): Promise<string> {
  const { getDb } = await import("../db");
  const db = await getDb();
  if (!db) return "";

  const { dailyGames, gameResearch } = await import("../../drizzle/schema.js");
  const { eq } = await import("drizzle-orm");

  const [game] = await db.select().from(dailyGames).where(eq(dailyGames.id, id)).limit(1);
  if (!game || game.status !== "result_published") return "";

  const [research] = await db
    .select()
    .from(gameResearch)
    .where(eq(gameResearch.gameId, id))
    .limit(1);

  const a = `${game.companyAName} (${game.companyATicker})`;
  const b = `${game.companyBName} (${game.companyBTicker})`;

  const parts: string[] = [
    `<h1>${htmlEscape(`${game.companyATicker} vs ${game.companyBTicker} — which stock performed better?`)}</h1>`,
    `<p>${htmlEscape(`${a} versus ${b}${game.sector ? `, ${game.sector}` : ""}, on ${game.gameDate}.`)}</p>`,
  ];

  if (game.winner) {
    const winnerName = game.winner === "A" ? a : b;
    const perf =
      game.companyAPerf != null && game.companyBPerf != null
        ? ` ${game.companyATicker} moved ${game.companyAPerf}%, ${game.companyBTicker} moved ${game.companyBPerf}%.`
        : "";
    parts.push(
      `<h2>Result</h2><p>${htmlEscape(`${winnerName} performed better on ${game.gameDate}.${perf}`)}</p>`
    );
  }

  if (game.pairingRationale) {
    parts.push(`<h2>Why these two companies</h2>${paragraphs(game.pairingRationale)}`);
  }

  // researchSummary is the plain-English brief; content is the fuller markdown
  // narrative. Prefer the summary — it reads as prose without markdown syntax.
  const body = research?.researchSummary ?? research?.researchSnapshot ?? null;
  if (body) {
    parts.push(`<h2>The research</h2>${paragraphs(body)}`);
  }

  return `<article>${parts.join("")}</article>`;
}

/** Unique body content for one lesson. */
function buildLessonContent(lessonId: string): string {
  const lesson = ALL_LESSONS.find((l) => l.id === lessonId);
  if (!lesson) return "";

  const parts: string[] = [`<h1>${htmlEscape(lesson.title)}</h1>`];
  if (lesson.jargonTerm) {
    parts.push(`<p>${htmlEscape(`Key term: ${lesson.jargonTerm}`)}</p>`);
  }
  parts.push(paragraphs(lesson.body));
  if (lesson.matchupHook) {
    parts.push(`<h2>In the daily game</h2><p>${htmlEscape(lesson.matchupHook)}</p>`);
  }
  return `<article>${parts.join("")}</article>`;
}

/**
 * Server-rendered content for one route, or "" for routes that need none.
 *
 * Hub routes get a list of links (so the pages below them are discoverable);
 * leaf routes get their actual content (so they aren't all identical). Both
 * exist for the same underlying reason: the app renders everything
 * client-side, so without this the html Google receives is an empty shell.
 */
export async function buildCrawlContent(path: string): Promise<string> {
  try {
    let p = path.split("?")[0].split("#")[0];
    if (p.length > 1) p = p.replace(/\/+$/, "");

    const gameMatch = p.match(/^\/research\/(\d+)$/);
    if (gameMatch) {
      const content = await buildArchiveGameContent(parseInt(gameMatch[1], 10));
      if (!content) return "";
      // Sibling + hub links so a crawler landing here has somewhere to go, and
      // the archive gains an internal link graph rather than a flat sitemap.
      const games = await getPublishedGames();
      const siblings = games
        .filter((g) => `/research/${g.id}` !== p)
        .slice(0, MAX_SIBLING_LINKS)
        .map(gameLink);
      return (
        content +
        `<nav aria-label="More matchups"><h2>More matchups</h2><ul>` +
        linkList([{ href: "/research", text: "Matchup archive" }, ...siblings]) +
        `</ul></nav>`
      );
    }

    const lessonMatch = p.match(/^\/learn\/([^/]+)$/);
    if (lessonMatch) {
      const content = buildLessonContent(lessonMatch[1]);
      if (!content) return "";
      const others = ALL_LESSONS.filter((l) => l.id !== lessonMatch[1])
        .slice(0, MAX_SIBLING_LINKS)
        .map((l) => ({ href: `/learn/${l.id}`, text: l.title }));
      return (
        content +
        `<nav aria-label="More lessons"><h2>More lessons</h2><ul>` +
        linkList([{ href: "/learn", text: "Learning hub" }, ...others]) +
        `</ul></nav>`
      );
    }

    if (p === "/research") {
      const games = await getPublishedGames();
      if (!games.length) return "";
      return (
        `<nav aria-label="Matchup archive"><h2>Matchup archive</h2><ul>` +
        linkList(games.slice(0, MAX_ARCHIVE_LINKS).map(gameLink)) +
        `</ul></nav>`
      );
    }

    if (p === "/learn") {
      if (!ALL_LESSONS.length) return "";
      return (
        `<nav aria-label="Lessons"><h2>Lessons</h2><ul>` +
        linkList(ALL_LESSONS.map((l) => ({ href: `/learn/${l.id}`, text: l.title }))) +
        `</ul></nav>`
      );
    }

    if (p === "/") {
      // The homepage carries the most authority, so give it crawl paths into
      // both hubs and the newest archive pages.
      const games = await getPublishedGames();
      const hubs = [
        { href: "/demo", text: "How Munymo works" },
        { href: "/research", text: "Matchup archive" },
        { href: "/learn", text: "Learning hub" },
        { href: "/leaderboard", text: "Leaderboard" },
      ];
      return (
        `<nav aria-label="Munymo"><h2>Munymo</h2><ul>` +
        linkList([
          ...hubs,
          ...games.slice(0, MAX_HOME_GAME_LINKS).map(gameLink),
        ]) +
        `</ul></nav>`
      );
    }

    return "";
  } catch (err) {
    console.error("[seo] buildCrawlContent failed:", err);
    return "";
  }
}

/**
 * Place the server-rendered content inside the empty <div id="root">. React
 * clears it on mount. Returns html untouched when there is no content or the
 * mount point isn't found, so a markup change upstream can't break the page.
 */
export function injectCrawlContent(html: string, contentHtml: string): string {
  if (!contentHtml) return html;
  const rootDiv = '<div id="root"></div>';
  if (!html.includes(rootDiv)) return html;
  return html.replace(rootDiv, `<div id="root">${contentHtml}</div>`);
}

/**
 * Rewrite the head of the SPA shell for one route. Pure string surgery on the
 * built index.html — no parser, so the patterns must match the tags as written
 * in client/index.html. og:/twitter: tags are only rewritten when the route
 * has its own title/description, so the hand-written homepage social card
 * survives untouched.
 */
export function injectPageMeta(html: string, meta: PageMeta): string {
  let out = html;
  const title = htmlEscape(meta.title);
  const desc = htmlEscape(meta.description);

  if (meta.title !== DEFAULT_TITLE) {
    out = out
      .replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`)
      .replace(
        /(<meta[^>]*property="og:title"[^>]*content=")[^"]*(")/,
        `$1${title}$2`
      )
      .replace(
        /(<meta[^>]*name="twitter:title"[^>]*content=")[^"]*(")/,
        `$1${title}$2`
      );
  }
  if (meta.description !== DEFAULT_DESCRIPTION) {
    out = out
      .replace(/(<meta[^>]*name="description"[^>]*content=")[^"]*(")/, `$1${desc}$2`)
      .replace(/(<meta[^>]*property="og:description"[^>]*content=")[^"]*(")/, `$1${desc}$2`)
      .replace(/(<meta[^>]*name="twitter:description"[^>]*content=")[^"]*(")/, `$1${desc}$2`);
  }

  const extra: string[] = [];
  if (meta.canonical) {
    const href = htmlEscape(meta.canonical);
    extra.push(`<link rel="canonical" href="${href}" />`);
    out = out.replace(/(<meta[^>]*property="og:url"[^>]*content=")[^"]*(")/, `$1${href}$2`);
  }
  if (meta.noindex) extra.push(`<meta name="robots" content="noindex" />`);
  if (extra.length) {
    out = out.replace("</title>", `</title>\n    ${extra.join("\n    ")}`);
  }
  return out;
}
