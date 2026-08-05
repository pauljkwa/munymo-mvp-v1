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
import { injectPageMeta, resolvePageMeta, type PageMeta } from "./_core/seo";

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
