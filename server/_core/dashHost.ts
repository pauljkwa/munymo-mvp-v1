/**
 * The owner dashboard host (references/owner-dashboard-spec.md §3).
 *
 * dash.munymo.com is the same Railway service and the same single-page bundle
 * as munymo.com. The server recognises the host and (a) keeps it out of every
 * search index, (b) serves the bundle's html with the public metadata stripped
 * and the dashboard's own manifest and icon swapped in. The client then renders
 * the dashboard app instead of the game (client/src/App.tsx).
 *
 * The host name is NOT a security boundary: anyone can send this Host header.
 * What protects the data is ownerProcedure in server/routers.ts.
 */
import type { Express, Request } from "express";

export const DASH_HOSTS = ["dash.munymo.com", "dash.localhost"];

/** Dashboard colour: the manifest's theme/background and the shell's theme-color meta. */
export const DASH_THEME_COLOR = "#0b1f3a";

export const DASH_ROBOTS_TXT = "User-agent: *\nDisallow: /\n";
export const DASH_ROBOTS_HEADER = "noindex, nofollow";

/** Exact match, case-insensitive. A port, if present, is ignored. */
export function isDashHost(hostname: string | undefined | null): boolean {
  if (!hostname) return false;
  const host = hostname.trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
  return DASH_HOSTS.includes(host);
}

/**
 * Uses req.hostname, which Express derives from the Host header. Railway and
 * Cloudflare both pass the visitor's Host through unchanged, so "trust proxy"
 * is deliberately NOT turned on: it would also change req.ip, which the
 * market-survey rate limit reads.
 */
export function isDashRequest(req: Pick<Request, "hostname">): boolean {
  return isDashHost(req.hostname);
}

/**
 * Turns the SPA shell into the dashboard's shell: no public metadata, no
 * analytics, the dashboard manifest and icons, and a marker the client reads.
 * Pure string surgery on the html (like injectPageMeta in seo.ts), so the
 * patterns match the tags as written in client/index.html. Idempotent.
 */
export function buildDashShell(html: string): string {
  let out = html;

  // Public metadata: social cards, structured data, canonical, description, robots, icons, manifest, theme colour.
  out = out
    .replace(/<meta\b[^>]*\bproperty="og:[^"]*"[^>]*>\s*/gi, "")
    .replace(/<meta\b[^>]*\bname="twitter:[^"]*"[^>]*>\s*/gi, "")
    .replace(/<script\b[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>\s*/gi, "")
    .replace(/<link\b[^>]*\brel="canonical"[^>]*>\s*/gi, "")
    .replace(/<meta\b[^>]*\bname="description"[^>]*>\s*/gi, "")
    .replace(/<meta\b[^>]*\bname="robots"[^>]*>\s*/gi, "")
    .replace(/<meta\b[^>]*\bname="(?:theme-color|munymo-app|apple-mobile-web-app-title)"[^>]*>\s*/gi, "")
    .replace(/<link\b[^>]*\brel="(?:icon|apple-touch-icon|manifest)"[^>]*>\s*/gi, "");

  // Analytics: the owner's own visits must not count as game traffic.
  out = out
    .replace(/<script\b[^>]*googletagmanager\.com[^>]*>\s*<\/script>\s*/gi, "")
    .replace(/<script\b[^>]*>\s*window\.dataLayer[\s\S]*?<\/script>\s*/gi, "")
    .replace(/<script\b[^>]*data-website-id[^>]*>\s*<\/script>\s*/gi, "");

  const head = [
    `<title>Munymo Dash</title>`,
    `<meta name="description" content="Owner dashboard." />`,
    `<meta name="robots" content="${DASH_ROBOTS_HEADER}" />`,
    `<meta name="theme-color" content="${DASH_THEME_COLOR}" />`,
    `<meta name="munymo-app" content="dash" />`,
    `<meta name="apple-mobile-web-app-title" content="Dash" />`,
    `<link rel="icon" type="image/png" sizes="192x192" href="/dash/icon-192.png" />`,
    `<link rel="apple-touch-icon" href="/dash/apple-touch-icon.png" />`,
    `<link rel="manifest" href="/dash/manifest.webmanifest" />`,
  ].join("\n    ");

  // A function replacer: the head text must not be read for "$1"-style patterns.
  return out.replace(/<title>[\s\S]*?<\/title>/, () => head);
}

/**
 * First middleware in the chain. On the dashboard host every response carries
 * X-Robots-Tag, robots.txt is deny-all and there is no sitemap. Other hosts
 * pass straight through untouched.
 */
export function registerDashHost(app: Express) {
  app.use((req, res, next) => {
    if (!isDashRequest(req)) return next();
    res.setHeader("X-Robots-Tag", DASH_ROBOTS_HEADER);
    const readOnly = req.method === "GET" || req.method === "HEAD";
    if (readOnly && req.path === "/robots.txt") {
      res.status(200).type("text/plain").send(DASH_ROBOTS_TXT);
      return;
    }
    if (readOnly && req.path === "/sitemap.xml") {
      res.status(404).type("text/plain").send("Not found");
      return;
    }
    next();
  });
}
