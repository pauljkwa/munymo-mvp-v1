import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";
import { decorateShell, resolveLegacyRedirect } from "./seo";
import { buildDashShell, isDashRequest } from "./dashHost";

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      // The owner dashboard host never redirects and carries no public
      // metadata; every path serves the same shell (the dash app routes itself).
      const dash = isDashRequest(req);
      const legacy = dash ? null : await resolveLegacyRedirect(url);
      if (legacy) return res.redirect(301, legacy);

      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      if (dash) {
        res.status(200).set({ "Content-Type": "text/html" }).end(buildDashShell(page));
        return;
      }
      // Same per-route decoration the production server sends, so SEO output
      // is inspectable in dev. decorateShell never throws.
      const out = await decorateShell(page, url);
      res.status(out.status).set({ "Content-Type": "text/html" }).end(out.html);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../..", "dist", "public")
      : path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  // index.html must always be revalidated — it references content-hashed
  // asset filenames (e.g. index-C1S_GvlP.js) that change on every deploy.
  // Without this, a browser can cache index.html and keep requesting a JS
  // bundle filename that no longer exists after a later deploy replaces it,
  // producing a blank page until the user manually clears their cache.
  // Only /assets/* is content-hashed and safe to cache forever; stable-named
  // files (sw.js, favicon.png, apple-touch-icon.png) keep the same filename
  // across deploys, so they must revalidate too or an update would strand
  // clients on the old copy for up to a year.
  app.use(
    express.static(distPath, {
      index: false,
      setHeaders: (res, filePath) => {
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        } else {
          res.setHeader("Cache-Control", "no-cache");
        }
      },
    })
  );

  // A hashed asset that isn't on disk no longer exists in this build — return
  // a real 404 so a stale client logs a clear failed request, instead of the
  // SPA fallback answering with index.html (HTML where a JS module was
  // expected — the source of cryptic blank-page MIME errors).
  app.use("/assets", (_req, res) => {
    res.status(404).end();
  });

  // The dashboard host's shell is the same file with different head tags, built
  // once per process (the build output never changes while the server runs).
  let dashShell: string | null = null;

  // fall through to index.html if the file doesn't exist (client-side routing),
  // with per-route title/description/canonical injected server-side and a real
  // 404 status for unknown URLs — crawlers never execute the JS that sets
  // these client-side, so this html IS the page as far as Google is concerned.
  app.use("*", async (req, res) => {
    const indexPath = path.resolve(distPath, "index.html");
    res.set("Cache-Control", "no-cache");
    try {
      // Owner dashboard host (dashHost.ts): one shell for every path, status 200,
      // no legacy redirects, none of the public SEO decoration.
      if (isDashRequest(req)) {
        if (dashShell === null) {
          dashShell = buildDashShell(await fs.promises.readFile(indexPath, "utf-8"));
        }
        res.status(200).set("Content-Type", "text/html; charset=utf-8").send(dashShell);
        return;
      }
      // req.originalUrl, not req.path: inside app.use("*") Express rewrites
      // req.path relative to the matched mount.
      // Pre-slug URLs (/research/810001, /learn/l100-1) move permanently to
      // their descriptive address — every old link and email keeps working.
      const legacy = await resolveLegacyRedirect(req.originalUrl);
      if (legacy) return res.redirect(301, legacy);
      const html = await fs.promises.readFile(indexPath, "utf-8");
      // Head metadata, server-rendered content and prefetched page data: without
      // these the html Google receives is an empty shell, and the rendered page
      // depends on API calls (see buildPrefetch in seo.ts).
      const out = await decorateShell(html, req.originalUrl);
      res.status(out.status).set("Content-Type", "text/html; charset=utf-8").send(out.html);
    } catch (err) {
      // Never let SEO decoration take the site down — serve the plain shell.
      console.error("[seo] falling back to plain index.html:", err);
      res.sendFile(indexPath);
    }
  });
}
