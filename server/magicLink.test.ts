/**
 * Magic links reported "expired" for every link, including ones opened seconds
 * after arrival. Cause: the link carried Clerk's sign-in token *id*, and the
 * handler pre-checked it via GET /v1/sign_in_tokens/{id} — an endpoint Clerk
 * does not provide. That request failed every time, so the handler always took
 * its invalid-token branch. These guard the rewrite.
 */
import { describe, expect, it } from "vitest";
import {
  MAGIC_LINK_TTL_SECONDS,
  buildMagicUrl,
  decodeTarget,
  isAllowedMagicTarget,
} from "./_core/magicLink";

const CLERK_URL = "https://clerk.munymo.com/v1/tickets/accept?ticket=abc123";

describe("MAGIC_LINK_TTL_SECONDS", () => {
  it("is 24 hours everywhere — one caller previously used 2h", () => {
    expect(MAGIC_LINK_TTL_SECONDS).toBe(86_400);
  });
});

describe("isAllowedMagicTarget — open redirect guard", () => {
  it("allows the app's own Clerk frontend host", () => {
    expect(isAllowedMagicTarget(CLERK_URL)).toBe(true);
  });

  it("allows Clerk's own domains", () => {
    expect(isAllowedMagicTarget("https://accounts.clerk.com/sign-in?x=1")).toBe(true);
    expect(isAllowedMagicTarget("https://foo.accounts.dev/v1/tickets")).toBe(true);
  });

  it("rejects an unrelated host — the whole point of the guard", () => {
    expect(isAllowedMagicTarget("https://evil.example.com/steal")).toBe(false);
  });

  it("rejects a lookalike host that merely ends with the brand", () => {
    expect(isAllowedMagicTarget("https://munymo.com.evil.net/x")).toBe(false);
    expect(isAllowedMagicTarget("https://notmunymo.com/x")).toBe(false);
  });

  it("rejects non-https and unparseable urls", () => {
    expect(isAllowedMagicTarget("http://munymo.com/x")).toBe(false);
    expect(isAllowedMagicTarget("javascript:alert(1)")).toBe(false);
    expect(isAllowedMagicTarget("not a url")).toBe(false);
  });
});

describe("buildMagicUrl / decodeTarget round trip", () => {
  it("preserves the Clerk url exactly, query string and all", () => {
    const link = buildMagicUrl(CLERK_URL, "/game", 1_800_000_000);
    const encoded = new URL(link).searchParams.get("u")!;
    expect(decodeTarget(encoded)).toBe(CLERK_URL);
  });

  it("carries the destination and expiry so the handler can answer without Clerk", () => {
    const link = buildMagicUrl(CLERK_URL, "/game/5/result", 1_800_000_000);
    const p = new URL(link).searchParams;
    expect(p.get("to")).toBe("/game/5/result");
    expect(p.get("exp")).toBe("1800000000");
  });

  it("points at munymo.com, not directly at Clerk", () => {
    expect(buildMagicUrl(CLERK_URL, "/game", 1).startsWith("https://munymo.com/api/magic?")).toBe(true);
  });

  it("never carries the raw clerk url in readable form", () => {
    // Not a security property — just confirms encoding happened, so mail
    // clients can't mangle the nested query string.
    expect(buildMagicUrl(CLERK_URL, "/game", 1)).not.toContain("ticket=abc123");
  });

  it("returns null for junk rather than throwing", () => {
    expect(decodeTarget("!!!not-base64!!!")).toBeNull();
    expect(decodeTarget(Buffer.from("http://insecure", "utf8").toString("base64url"))).toBeNull();
  });
});
