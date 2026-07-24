import { useEffect } from "react";

const BASE_URL = "https://munymo.com";

export const DEFAULT_TITLE = "Munymo — Free Daily Stock Market Prediction Game";
export const DEFAULT_DESCRIPTION =
  "Munymo is a free daily stock market game. Predict which of two companies will perform better, read the day's research, and build real market intuition in five minutes a day.";

/**
 * Per-route SEO metadata for a client-rendered SPA. The static defaults live
 * in client/index.html (that's what social-share scrapers see, since most
 * don't execute JS); this hook keeps title/description/canonical correct for
 * Google, which does render JS, and for the browser tab.
 *
 * Every routed page should call this — pages that don't will silently keep
 * the previous route's title.
 */
export function usePageMeta(opts?: { title?: string; description?: string }) {
  const title = opts?.title ?? DEFAULT_TITLE;
  const description = opts?.description ?? DEFAULT_DESCRIPTION;

  useEffect(() => {
    document.title = title;

    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content = description;

    // Canonical always mirrors the current path — this also strips referral
    // and tracking query params from what search engines index.
    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = `${BASE_URL}${window.location.pathname === "/" ? "/" : window.location.pathname}`;
  }, [title, description]);
}
