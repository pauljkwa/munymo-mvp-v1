/**
 * SEO endpoints — GET /sitemap.xml
 *
 * Served dynamically (not a static file) so the sitemap always includes every
 * published archive game under /research/:id — that list grows every trading
 * day, and the archive pages are the most crawlable, content-rich URLs on the
 * site. Static marketing/legal routes are listed alongside.
 *
 * robots.txt lives in client/public/ (Vite copies it into the build) and
 * points crawlers here via its Sitemap: line.
 */
import type { Express, Request, Response } from "express";

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
