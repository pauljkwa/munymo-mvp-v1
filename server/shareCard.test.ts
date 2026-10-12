import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { hasShareParams, parseShareParams, shareQuery } from "@shared/shareParams";
import { renderShareCard, shortCompanyName } from "./_core/shareCard";
import { injectPageMeta, resolvePageMeta } from "./_core/seo";

describe("share params — strict parse of the sharer's result", () => {
  it("round-trips a full result", () => {
    const p = parseShareParams("s=100&r=1&st=4&c=c");
    expect(p).toEqual({ score: 100, streak: 4, called: true, confidence: "Confident" });
    expect(shareQuery(p)).toBe("?s=100&r=1&st=4&c=c");
    expect(hasShareParams(p)).toBe(true);
  });

  it("drops anything outside the fixed vocabulary", () => {
    const p = parseShareParams("s=101&r=yes&st=-1&c=<script>&x=1");
    expect(p).toEqual({ score: null, streak: null, called: null, confidence: null });
    expect(shareQuery(p)).toBe("");
    expect(hasShareParams(p)).toBe(false);
    expect(parseShareParams("s=1e2").score).toBeNull();
  });

  it("omits a streak of one (not worth bragging about)", () => {
    expect(shareQuery({ score: 40, streak: 1, called: false, confidence: null })).toBe("?s=40&r=0");
  });
});

describe("share card", () => {
  it("shortens legal suffixes off company names", () => {
    expect(shortCompanyName("Constellation Energy Corporation")).toBe("Constellation Energy");
    expect(shortCompanyName("Vistra Corp.")).toBe("Vistra");
    expect(shortCompanyName("Apple Inc.")).toBe("Apple");
    expect(shortCompanyName("PepsiCo")).toBe("PepsiCo");
    expect(shortCompanyName("Inc.")).toBe("Inc.");
  });

  // Exercises the real fonts + renderer, so a missing font file or a broken
  // native binary fails here rather than as a 500 on every shared link.
  it("renders a 1200×630 PNG", async () => {
    const png = await renderShareCard(
      {
        gameDate: "2026-10-09",
        companyATicker: "PEP",
        companyBTicker: "KDP",
        companyAName: "PepsiCo",
        companyBName: "Keurig Dr Pepper Inc.",
        companyAPerf: "-0.890",
        companyBPerf: "1.820",
        winner: "B",
        sector: "Consumer Staples",
      },
      parseShareParams("s=100&r=1&st=4&c=c")
    );
    expect(png.subarray(1, 4).toString()).toBe("PNG");
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
  }, 30000);
});

describe("link-preview tags", () => {
  const html = fs.readFileSync(path.resolve(import.meta.dirname, "../client/index.html"), "utf-8");

  it("swaps in the card image, a large card, and the social title", () => {
    const out = injectPageMeta(html, {
      title: "PEP vs KDP — Which Stock Performed Better? | Munymo",
      description: "d",
      status: 200,
      canonical: "https://munymo.com/research/pep-vs-kdp-2026-10-09",
      noindex: false,
      image: "https://munymo.com/og/pep-vs-kdp-2026-10-09.png?s=100&r=1",
      socialTitle: "I called PEP vs KDP on Munymo — 100/100. Can you beat me?",
      socialDescription: "Every trading day…",
    });
    expect(out).toContain('property="og:image" content="https://munymo.com/og/pep-vs-kdp-2026-10-09.png?s=100&amp;r=1"');
    expect(out).toMatch(/name="twitter:card" content="summary_large_image"/);
    expect(out).toContain('property="og:title" content="I called PEP vs KDP on Munymo — 100/100. Can you beat me?"');
    expect(out).toContain('og:image:width" content="1200"');
    // The page's own <title> is untouched by the social title.
    expect(out).toContain("<title>PEP vs KDP — Which Stock Performed Better? | Munymo</title>");
  });

  it("leaves the site-wide card alone on pages without an image", async () => {
    const meta = await resolvePageMeta("/terms");
    const out = injectPageMeta(html, meta);
    expect(out).toContain('property="og:image" content="https://munymo.com/munymo-logo-cropped_e625fcf7.png"');
    expect(out).toMatch(/name="twitter:card" content="summary"/);
  });
});
