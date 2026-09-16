/**
 * Server-side page metadata (server/_core/seo.ts).
 *
 * Verifies the route → meta table stays true to what the client pages set via
 * usePageMeta, that unknown URLs get a real 404 status (no more soft-404s),
 * and that injectPageMeta's string surgery actually lands on the tags as they
 * are written in client/index.html — the injector is regex-based, so this file
 * is the guard against someone reformatting the html head and silently
 * breaking SEO output.
 *
 * No DB in the test environment (getDb → null), so /research/:id exercises the
 * fail-open path here; the published-game path is covered by shape, not data.
 */
import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { ALL_LEVELS } from "@/content/lessons";
import {
  buildCrawlContent,
  injectCrawlContent,
  stripUnconfiguredAnalytics,
  injectPageMeta,
  resolvePageMeta,
  type PageMeta,
} from "./_core/seo";

const DEFAULT_TITLE = "Munymo — Free Daily Stock Market Prediction Game";

describe("resolvePageMeta — route table", () => {
  it("homepage keeps the default title and gets a canonical", async () => {
    const meta = await resolvePageMeta("/");
    expect(meta.title).toBe(DEFAULT_TITLE);
    expect(meta.status).toBe(200);
    expect(meta.canonical).toBe("https://munymo.com/");
    expect(meta.noindex).toBe(false);
  });

  it("static public routes get their own title + canonical", async () => {
    const demo = await resolvePageMeta("/demo");
    expect(demo.title).toBe("How Munymo Works — Daily Stock Market Game Demo | Munymo");
    expect(demo.canonical).toBe("https://munymo.com/demo");
    expect(demo.status).toBe(200);

    const legal = await resolvePageMeta("/privacy");
    expect(legal.title).toBe("Privacy Policy | Munymo");
  });

  it("normalizes trailing slashes and query strings", async () => {
    const meta = await resolvePageMeta("/demo/?ref=abc123");
    expect(meta.title).toBe("How Munymo Works — Daily Stock Market Game Demo | Munymo");
    expect(meta.canonical).toBe("https://munymo.com/demo");
  });

  it("real lesson ids get the lesson title; unknown lesson ids 404", async () => {
    const first = ALL_LEVELS[0].lessons[0];
    const meta = await resolvePageMeta(`/learn/${first.id}`);
    expect(meta.title).toBe(`${first.title} — Learn the Stock Market | Munymo`);
    expect(meta.status).toBe(200);

    const missing = await resolvePageMeta("/learn/does-not-exist");
    expect(missing.status).toBe(404);
    expect(missing.noindex).toBe(true);
  });

  it("unknown routes return 404 + noindex (kills soft-404s)", async () => {
    for (const p of ["/this-page-does-not-exist", "/research/not-a-number", "/404"]) {
      const meta = await resolvePageMeta(p);
      expect(meta.status, p).toBe(404);
      expect(meta.noindex, p).toBe(true);
    }
  });

  it("auth-gated routes stay 200 but are noindexed", async () => {
    for (const p of ["/game", "/dashboard", "/profile", "/admin", "/admin/players", "/game/12/result"]) {
      const meta = await resolvePageMeta(p);
      expect(meta.status, p).toBe(200);
      expect(meta.noindex, p).toBe(true);
      expect(meta.canonical, p).toBeNull();
    }
  });

  it("archive game pages fail open to defaults when the DB is unavailable", async () => {
    const meta = await resolvePageMeta("/research/150001");
    expect(meta.status).toBe(200);
    expect(meta.title).toBe(DEFAULT_TITLE);
    expect(meta.canonical).toBe("https://munymo.com/research/150001");
  });
});

describe("injectPageMeta — against the real client/index.html", () => {
  // vitest runs from the repo root.
  const template = fs.readFileSync(path.resolve(process.cwd(), "client", "index.html"), "utf-8");

  const custom: PageMeta = {
    title: 'OXY vs DVN — Which Stock Performed Better? | Munymo',
    description: 'Occidental "Oxy" & Devon <energy>, 2026-08-04: research brief.',
    status: 200,
    canonical: "https://munymo.com/research/150001",
    noindex: false,
  };

  it("replaces title, description, og:, twitter: tags and inserts a canonical", () => {
    const out = injectPageMeta(template, custom);
    expect(out).toContain("<title>OXY vs DVN — Which Stock Performed Better? | Munymo</title>");
    // Old title must be gone everywhere (og:title and twitter:title too).
    expect(out).not.toContain(DEFAULT_TITLE);
    expect(out).toContain('<link rel="canonical" href="https://munymo.com/research/150001" />');
    expect(out).toContain('property="og:url" content="https://munymo.com/research/150001"');
    // Escaping: quotes and angle brackets in company names can't break out of
    // the attribute.
    expect(out).toContain("&quot;Oxy&quot;");
    expect(out).toContain("&lt;energy&gt;");
    expect(out).not.toContain("<energy>");
  });

  it("leaves the homepage shell untouched except for the canonical", () => {
    const meta: PageMeta = {
      title: DEFAULT_TITLE,
      description:
        "Munymo is a free daily stock market game. Predict which of two companies will perform better, read the day's research, and build real market intuition in five minutes a day.",
      status: 200,
      canonical: "https://munymo.com/",
      noindex: false,
    };
    const out = injectPageMeta(template, meta);
    expect(out).toContain('<link rel="canonical" href="https://munymo.com/" />');
    // Hand-written social card survives.
    expect(out).toContain(
      'One matchup between two real companies every US trading day. Predict the winner, read the research, build real market intuition — five minutes, no real money.'
    );
    expect(out).toContain(`<title>${DEFAULT_TITLE}</title>`);
  });

  it("adds a robots noindex meta for private/404 pages", () => {
    const out = injectPageMeta(template, {
      title: DEFAULT_TITLE,
      description: "x",
      status: 404,
      canonical: null,
      noindex: true,
    });
    expect(out).toContain('<meta name="robots" content="noindex" />');
    expect(out).not.toContain('rel="canonical"');
  });
});

// ─── Crawlable link list ──────────────────────────────────────────────────────
// The served html for /research contained zero <a> tags, so the archive pages
// were reachable only via the sitemap and sat at "Discovered - currently not
// indexed" in Search Console. These guard the links actually being present.
describe("buildCrawlLinks — server-rendered internal links", () => {
  it("emits a lesson link for every lesson on /learn", async () => {
    const html = await buildCrawlContent("/learn");
    const lessons = ALL_LEVELS.flatMap((l) => l.lessons);
    expect(lessons.length).toBeGreaterThan(0);
    for (const lesson of lessons) {
      expect(html).toContain(`href="/learn/${lesson.id}"`);
    }
  });

  it("uses the lesson title as anchor text, not a bare url", async () => {
    const html = await buildCrawlContent("/learn");
    const first = ALL_LEVELS[0].lessons[0];
    expect(html).toContain(`>${first.title}<`);
  });

  it("links both hubs from the homepage", async () => {
    const html = await buildCrawlContent("/");
    expect(html).toContain('href="/research"');
    expect(html).toContain('href="/learn"');
  });

  it("ignores query strings and trailing slashes", async () => {
    const withCruft = await buildCrawlContent("/learn/?utm_source=x");
    expect(withCruft).toContain('href="/learn/');
  });

  it("returns nothing for routes that need no link list", async () => {
    expect(await buildCrawlContent("/privacy")).toBe("");
    expect(await buildCrawlContent("/game")).toBe("");
  });
});

describe("injectCrawlLinks — placement in the shell", () => {
  const shell = '<body><div id="root"></div><script></script></body>';

  it("puts the links inside the react mount point", () => {
    const out = injectCrawlContent(shell, "<nav><a href=\"/x\">X</a></nav>");
    expect(out).toContain('<div id="root"><nav><a href="/x">X</a></nav></div>');
  });

  it("leaves the html untouched when there are no links", () => {
    expect(injectCrawlContent(shell, "")).toBe(shell);
  });

  it("leaves the html untouched when the mount point is missing", () => {
    const odd = "<body><div id=\"app\"></div></body>";
    expect(injectCrawlContent(odd, "<nav></nav>")).toBe(odd);
  });

  it("does not disturb the head that injectPageMeta wrote", () => {
    const withHead = "<head><title>T</title></head>" + shell;
    const out = injectCrawlContent(withHead, "<nav></nav>");
    expect(out).toContain("<title>T</title>");
  });
});

// ─── Leaf-page content ────────────────────────────────────────────────────────
// Once Google crawled the archive it reported "Duplicate, Google chose
// different canonical than user" and folded every /research/:id into one URL:
// each page had a unique <title> and correct self-canonical, but an EMPTY
// <div id="root">, so all ~60 were byte-identical below the head. Unique
// metadata is not enough — the body needs unique words.
describe("buildCrawlContent — leaf pages carry unique body content", () => {
  it("renders the lesson's own prose, not just its title", async () => {
    const first = ALL_LEVELS[0].lessons[0];
    const html = await buildCrawlContent(`/learn/${first.id}`);
    expect(html).toContain(first.title);
    // A distinctive slice of the body must actually appear.
    const snippet = first.body.split(/\s+/).slice(0, 6).join(" ");
    expect(html).toContain(snippet.replace(/&/g, "&amp;"));
  });

  it("gives two different lessons genuinely different bodies", async () => {
    const [a, b] = ALL_LEVELS[0].lessons;
    const htmlA = await buildCrawlContent(`/learn/${a.id}`);
    const htmlB = await buildCrawlContent(`/learn/${b.id}`);
    expect(htmlA).not.toBe(htmlB);
    expect(htmlA.length).toBeGreaterThan(200);
    expect(htmlB.length).toBeGreaterThan(200);
  });

  it("links back to the hub and to sibling lessons", async () => {
    const first = ALL_LEVELS[0].lessons[0];
    const html = await buildCrawlContent(`/learn/${first.id}`);
    expect(html).toContain('href="/learn"');
    expect(html).toContain('href="/learn/');
    // Never links to itself.
    expect(html).not.toContain(`href="/learn/${first.id}"`);
  });

  it("returns nothing for a lesson id that does not exist", async () => {
    expect(await buildCrawlContent("/learn/not-a-real-lesson")).toBe("");
  });

  it("escapes html in content rather than emitting it raw", async () => {
    const first = ALL_LEVELS[0].lessons[0];
    const html = await buildCrawlContent(`/learn/${first.id}`);
    // Whatever the prose contains, no stray unescaped script tag can appear.
    expect(html).not.toContain("<script");
  });
});

// ─── Unconfigured analytics tag ───────────────────────────────────────────────
// The umami tag shipped with its Vite %VAR% placeholders unresolved, so every
// page load requested a literal "%VITE_ANALYTICS_ENDPOINT%/umami", got the SPA
// shell back, and logged a console error — analytics silently dead rather than
// absent. Stripped while unconfigured; ships again once the env vars are set.
describe("stripUnconfiguredAnalytics", () => {
  const tag =
    '<script\n      defer\n      src="%VITE_ANALYTICS_ENDPOINT%/umami"\n      data-website-id="%VITE_ANALYTICS_WEBSITE_ID%"></script>';

  it("removes the tag when the placeholder is unresolved", () => {
    const out = stripUnconfiguredAnalytics(`<body>${tag}</body>`);
    expect(out).not.toContain("VITE_ANALYTICS_ENDPOINT");
    expect(out).not.toContain("umami");
  });

  it("leaves a resolved tag alone, so setting the env vars re-enables it", () => {
    const resolved =
      '<script defer src="https://analytics.example.com/umami" data-website-id="abc-123"></script>';
    expect(stripUnconfiguredAnalytics(`<body>${resolved}</body>`)).toContain(resolved);
  });

  it("does not touch the working GA4 tag", () => {
    const ga =
      '<script async src="https://www.googletagmanager.com/gtag/js?id=G-RLCKFXCSF3"></script>';
    const out = stripUnconfiguredAnalytics(`<body>${ga}${tag}</body>`);
    expect(out).toContain(ga);
    expect(out).not.toContain("umami");
  });

  it("returns the html untouched when there is no placeholder at all", () => {
    const html = "<body><p>hello</p></body>";
    expect(stripUnconfiguredAnalytics(html)).toBe(html);
  });
});
