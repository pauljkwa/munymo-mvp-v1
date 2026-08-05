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

async function sitemapHandler(_req: Request, res: Response) {
  try {
    let gameUrls: { loc: string; lastmod: string }[] = [];
    try {
      const { getDb } = await import("../db");
      const { dailyGames } = await import("../../drizzle/schema.js");
      const { eq, desc } = await import("drizzle-orm");
      const db = await getDb();
      if (db) {
        const rows = await db
          .select({ id: dailyGames.id, gameDate: dailyGames.gameDate })
          .from(dailyGames)
          .where(eq(dailyGames.status, "result_published"))
          .orderBy(desc(dailyGames.gameDate))
          .limit(5000);
        gameUrls = rows.map((r) => ({
          loc: `${BASE_URL}/research/${r.id}`,
          lastmod: r.gameDate,
        }));
      }
    } catch (err) {
      // DB hiccup → still serve the static routes rather than failing the crawl.
      console.error("[sitemap] Could not load archive games:", err);
    }

    const entries = [
      ...STATIC_PATHS.map((p) => `  <url><loc>${xmlEscape(`${BASE_URL}${p}`)}</loc></url>`),
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
