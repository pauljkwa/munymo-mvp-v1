import { describe, it, expect } from "vitest";
import {
  escapeHtml,
  safeDestination,
  interstitialHtml,
} from "./_core/magicLinkRedirect";
import { MAGIC_LINK_TTL_SECONDS } from "./_core/magicLink";

describe("magic link TTL", () => {
  it("outlives a game's open window", () => {
    // A game is created just after the US close (~20:15 UTC) and locks at
    // 13:30 UTC the next day — about 17 hours. The old streak-at-risk token
    // was 2h, which expired while the game was still open.
    const gameOpenWindowSeconds = 17 * 60 * 60;
    expect(MAGIC_LINK_TTL_SECONDS).toBeGreaterThan(gameOpenWindowSeconds);
  });
});

describe("safeDestination", () => {
  it("keeps ordinary in-app paths", () => {
    expect(safeDestination("/game")).toBe("/game");
    expect(safeDestination("/game/810001/result")).toBe("/game/810001/result");
  });

  it("rejects absolute URLs to other origins", () => {
    expect(safeDestination("https://evil.com/steal")).toBe("/game");
  });

  it("rejects protocol-relative URLs", () => {
    // "//evil.com" is a URL, not a local path — the trap a naive
    // startsWith("/") check walks straight into.
    expect(safeDestination("//evil.com")).toBe("/game");
  });

  it("falls back for missing or non-string input", () => {
    expect(safeDestination(undefined)).toBe("/game");
    expect(safeDestination(["/game", "/other"])).toBe("/game");
  });
});

describe("escapeHtml", () => {
  it("neutralises quote and tag characters", () => {
    expect(escapeHtml(`" onload="alert(1)`)).toBe(
      "&quot; onload=&quot;alert(1)"
    );
    expect(escapeHtml("<script>")).toBe("&lt;script&gt;");
  });

  it("escapes ampersands before other entities", () => {
    expect(escapeHtml("&lt;")).toBe("&amp;lt;");
  });
});

describe("interstitialHtml", () => {
  it("POSTs rather than linking, so scanners can't spend the token", () => {
    const html = interstitialHtml("tok_123", "/game");
    expect(html).toContain('method="POST"');
    expect(html).toContain('action="/api/magic"');
    // A bare href to Clerk is exactly what caused single-use tokens to be
    // burned by link prefetchers.
    expect(html).not.toContain("clerk.com");
  });

  it("carries the token and destination as form fields", () => {
    const html = interstitialHtml("tok_123", "/game/7/result");
    expect(html).toContain('name="token" value="tok_123"');
    expect(html).toContain('name="to" value="/game/7/result"');
  });

  it("escapes hostile values instead of interpolating them raw", () => {
    const html = interstitialHtml(`"><script>alert(1)</script>`, "/game");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&quot;&gt;&lt;script&gt;");
  });

  it("asks robots not to index the page", () => {
    expect(interstitialHtml("t", "/game")).toContain("noindex");
  });
});
