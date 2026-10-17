/**
 * Owner dashboard host (server/_core/dashHost.ts, references/owner-dashboard-spec.md §3).
 * No server is started: the middleware is driven with plain fake req/res objects
 * and the shell substitution is a pure string function.
 */
import fs from "fs";
import path from "path";
import { describe, expect, it, vi } from "vitest";
import { DASH_THEME_COLOR, buildDashShell, isDashHost, isDashRequest, registerDashHost } from "./_core/dashHost";

describe("isDashHost", () => {
  it("accepts the two dashboard hosts", () => {
    expect(isDashHost("dash.munymo.com")).toBe(true);
    expect(isDashHost("dash.localhost")).toBe(true);
  });

  it("ignores case, a port and a trailing dot", () => {
    expect(isDashHost("DASH.Munymo.COM")).toBe(true);
    expect(isDashHost("dash.localhost:3000")).toBe(true);
    expect(isDashHost("dash.munymo.com.")).toBe(true);
  });

  it("rejects near-misses and the game host", () => {
    expect(isDashHost("munymo.com")).toBe(false);
    expect(isDashHost("www.munymo.com")).toBe(false);
    expect(isDashHost("dashboard.munymo.com")).toBe(false);
    expect(isDashHost("dash.munymo.com.evil.example")).toBe(false);
    expect(isDashHost("evildash.munymo.com")).toBe(false);
    expect(isDashHost("localhost")).toBe(false);
    expect(isDashHost("")).toBe(false);
    expect(isDashHost(undefined)).toBe(false);
    expect(isDashHost(null)).toBe(false);
  });

  it("isDashRequest reads req.hostname", () => {
    expect(isDashRequest({ hostname: "dash.munymo.com" })).toBe(true);
    expect(isDashRequest({ hostname: "munymo.com" })).toBe(false);
  });
});

function fakeRes() {
  const res = {
    headers: {} as Record<string, string>,
    statusCode: 200,
    body: undefined as string | undefined,
    contentType: undefined as string | undefined,
    setHeader(k: string, v: string) {
      res.headers[k.toLowerCase()] = v;
      return res;
    },
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    type(t: string) {
      res.contentType = t;
      return res;
    },
    send(b: string) {
      res.body = b;
      return res;
    },
  };
  return res;
}

function middleware() {
  let mw: (req: unknown, res: unknown, next: () => void) => void = () => {};
  registerDashHost({ use: (fn: typeof mw) => (mw = fn) } as never);
  return mw;
}

describe("registerDashHost middleware", () => {
  const run = (hostname: string, reqPath: string, method = "GET") => {
    const res = fakeRes();
    const next = vi.fn();
    middleware()({ hostname, path: reqPath, method }, res, next);
    return { res, next };
  };

  it("marks every dashboard response noindex, nofollow and passes ordinary paths through", () => {
    const { res, next } = run("dash.munymo.com", "/anything");
    expect(res.headers["x-robots-tag"]).toBe("noindex, nofollow");
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("serves a deny-all robots.txt", () => {
    const { res, next } = run("dash.munymo.com", "/robots.txt");
    expect(res.statusCode).toBe(200);
    expect(res.contentType).toBe("text/plain");
    expect(res.body).toBe("User-agent: *\nDisallow: /\n");
    expect(res.headers["x-robots-tag"]).toBe("noindex, nofollow");
    expect(next).not.toHaveBeenCalled();
  });

  it("answers 404 for the sitemap", () => {
    const { res, next } = run("dash.munymo.com", "/sitemap.xml");
    expect(res.statusCode).toBe(404);
    expect(res.headers["x-robots-tag"]).toBe("noindex, nofollow");
    expect(next).not.toHaveBeenCalled();
  });

  it("does nothing at all on the game host", () => {
    for (const p of ["/", "/robots.txt", "/sitemap.xml"]) {
      const { res, next } = run("munymo.com", p);
      expect(res.headers).toEqual({});
      expect(res.body).toBeUndefined();
      expect(res.statusCode).toBe(200);
      expect(next).toHaveBeenCalledTimes(1);
    }
  });
});

describe("buildDashShell", () => {
  const shell = fs.readFileSync(path.resolve(__dirname, "../client/index.html"), "utf8");
  const out = buildDashShell(shell);

  it("sets the dashboard title and description", () => {
    expect(out).toContain("<title>Munymo Dash</title>");
    expect(out).toContain('<meta name="description" content="Owner dashboard." />');
    expect(out).not.toContain("Free Daily Stock Market");
    expect(out.match(/<title>/g)).toHaveLength(1);
    expect(out.match(/name="description"/g)).toHaveLength(1);
  });

  it("strips every public metadata tag", () => {
    expect(out).not.toMatch(/property="og:/);
    expect(out).not.toMatch(/name="twitter:/);
    expect(out).not.toContain("application/ld+json");
    expect(out).not.toContain("schema.org");
    expect(out).not.toMatch(/rel="canonical"/);
    expect(out).not.toContain("munymo.com/");
  });

  it("drops the analytics tags", () => {
    expect(out).not.toContain("googletagmanager");
    expect(out).not.toContain("dataLayer");
    expect(out).not.toContain("data-website-id");
  });

  it("swaps in the dashboard manifest, icons, theme colour and app marker", () => {
    expect(out).toContain('<link rel="manifest" href="/dash/manifest.webmanifest" />');
    expect(out).not.toContain('href="/manifest.webmanifest"');
    expect(out).toContain('<link rel="apple-touch-icon" href="/dash/apple-touch-icon.png" />');
    expect(out).not.toContain('href="/apple-touch-icon.png');
    expect(out).not.toContain("/favicon");
    expect(out).toContain(`<meta name="theme-color" content="${DASH_THEME_COLOR}" />`);
    expect(out).toContain('<meta name="munymo-app" content="dash" />');
    expect(out).toContain('<meta name="robots" content="noindex, nofollow" />');
  });

  it("keeps the app itself: root element, module script, viewport", () => {
    expect(out).toContain('<div id="root"></div>');
    expect(out).toContain('src="/src/main.tsx"');
    expect(out).toContain('name="viewport"');
  });

  it("is idempotent apart from whitespace: running it twice changes nothing that matters", () => {
    const squash = (h: string) => h.replace(/\s+/g, " ");
    expect(squash(buildDashShell(out))).toBe(squash(out));
  });

  it("does not touch a shell with different attribute order or a built asset filename", () => {
    const built =
      '<!doctype html><html><head><meta charset="UTF-8" /><title>X</title>' +
      '<meta content="Hello" name="description"><meta content="t" property="og:title">' +
      '<link href="/manifest.webmanifest" rel="manifest">' +
      '<script type="module" crossorigin src="/assets/index-abc123.js"></script></head><body><div id="root"></div></body></html>';
    const r = buildDashShell(built);
    expect(r).toContain("<title>Munymo Dash</title>");
    expect(r).not.toContain("og:title");
    expect(r).not.toContain("Hello");
    expect(r).toContain('src="/assets/index-abc123.js"');
    expect(r).toContain("/dash/manifest.webmanifest");
  });
});

describe("the dashboard manifest", () => {
  const manifestPath = path.resolve(__dirname, "../client/public/dash/manifest.webmanifest");
  it("is the spec's manifest and every icon it names exists", () => {
    const m = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    expect(m.name).toBe("Munymo Dash");
    expect(m.short_name).toBe("Dash");
    expect(m.start_url).toBe("/");
    expect(m.scope).toBe("/");
    expect(m.display).toBe("standalone");
    expect(m.background_color).toBe(DASH_THEME_COLOR);
    expect(m.theme_color).toBe(DASH_THEME_COLOR);
    for (const icon of m.icons) {
      expect(fs.existsSync(path.resolve(__dirname, "../client/public", icon.src.slice(1)))).toBe(true);
    }
    expect(fs.existsSync(path.resolve(__dirname, "../client/public/dash/apple-touch-icon.png"))).toBe(true);
  });
});
