/**
 * Magic links, third design (2026-09-20). History in server/_core/magicLink.ts:
 * v1 pre-checked tokens against an endpoint Clerk doesn't have; v2 bounced
 * through Clerk's hosted sign-in page and expired every link after a flat 24
 * hours, so Friday's link was dead by Sunday. These pin down v3's rules.
 */
import { describe, expect, it } from "vitest";
import {
  MAGIC_LINK_MAX_TTL_SECONDS,
  buildLandingPath,
  buildMagicUrl,
  decodeTarget,
  isAllowedMagicTarget,
  isMagicPurpose,
  isSuperseded,
  safeDestination,
  ticketFromClerkUrl,
} from "./_core/magicLink";

const CLERK_URL = "https://clerk.munymo.com/v1/tickets/accept?ticket=abc123";

describe("validity rules", () => {
  it("the hard cap is a week — a backstop, not the normal end of a link's life", () => {
    expect(MAGIC_LINK_MAX_TTL_SECONDS).toBe(7 * 86_400);
  });

  it("a link is superseded only by a LATER issue for the same purpose", () => {
    expect(isSuperseded("2026-09-18", "2026-09-21")).toBe(true);
    expect(isSuperseded("2026-09-21", "2026-09-21")).toBe(false);
    expect(isSuperseded("2026-09-21", "2026-09-18")).toBe(false);
  });

  it("Friday's link survives the weekend: nothing newer exists until Monday's game", () => {
    // Opened Sunday; the latest activated game is still Monday's (issued Friday).
    expect(isSuperseded("2026-09-21", "2026-09-21")).toBe(false);
  });

  it("stands when there is nothing to compare or the date is malformed", () => {
    expect(isSuperseded("2026-09-21", null)).toBe(false);
    expect(isSuperseded("garbage", "2026-09-21")).toBe(false);
  });

  it("recognises only the two purposes", () => {
    expect(isMagicPurpose("play")).toBe(true);
    expect(isMagicPurpose("result")).toBe(true);
    expect(isMagicPurpose("admin")).toBe(false);
    expect(isMagicPurpose(undefined)).toBe(false);
  });
});

describe("buildMagicUrl", () => {
  const link = buildMagicUrl("tkt_123", "/game/5/result", { purpose: "result", date: "2026-09-18" }, 1_800_000_000);
  const p = new URL(link).searchParams;

  it("points at munymo.com, never at Clerk", () => {
    expect(link.startsWith("https://munymo.com/api/magic?")).toBe(true);
  });

  it("carries destination, purpose, issue date, backstop expiry and the ticket", () => {
    expect(p.get("to")).toBe("/game/5/result");
    expect(p.get("p")).toBe("result");
    expect(p.get("d")).toBe("2026-09-18");
    expect(p.get("exp")).toBe("1800000000");
    expect(p.get("t")).toBe("tkt_123");
  });

  it("refuses an off-site destination", () => {
    const evil = buildMagicUrl("t", "//evil.example.com", { purpose: "play", date: "2026-09-21" }, 1);
    expect(new URL(evil).searchParams.get("to")).toBe("/game");
  });
});

describe("safeDestination — open redirect guard", () => {
  it("keeps site paths and rejects everything else", () => {
    expect(safeDestination("/dashboard")).toBe("/dashboard");
    expect(safeDestination("https://evil.example.com")).toBe("/game");
    expect(safeDestination("//evil.example.com")).toBe("/game");
    expect(safeDestination(undefined)).toBe("/game");
  });
});

describe("buildLandingPath", () => {
  it("puts the ticket in the fragment, which is never sent to a server", () => {
    const path = buildLandingPath("/game", { ticket: "a.b+c" });
    expect(path).toBe("/email-landing?to=%2Fgame#t=a.b%2Bc");
    expect(path.split("#")[0]).not.toContain("a.b");
  });

  it("carries a reason instead of a ticket when the link is no longer good", () => {
    expect(buildLandingPath("/game", { reason: "superseded" })).toBe("/email-landing?to=%2Fgame&r=superseded");
  });

  it("is a relative path, so it can never redirect off-site", () => {
    expect(buildLandingPath("//evil.example.com", { reason: "invalid" }).startsWith("/email-landing?")).toBe(true);
  });
});

describe("legacy (v2) links still in inboxes", () => {
  it("reads the ticket out of a Clerk url in either spelling", () => {
    expect(ticketFromClerkUrl(CLERK_URL)).toBe("abc123");
    expect(ticketFromClerkUrl("https://accounts.munymo.com/sign-in?__clerk_ticket=xyz")).toBe("xyz");
    expect(ticketFromClerkUrl("not a url")).toBeNull();
  });

  it("only trusts a recognised host", () => {
    expect(isAllowedMagicTarget(CLERK_URL)).toBe(true);
    expect(isAllowedMagicTarget("https://foo.accounts.dev/v1/tickets")).toBe(true);
    expect(isAllowedMagicTarget("https://evil.example.com/steal")).toBe(false);
    expect(isAllowedMagicTarget("https://munymo.com.evil.net/x")).toBe(false);
    expect(isAllowedMagicTarget("http://munymo.com/x")).toBe(false);
  });

  it("decodes the old base64 wrapper and returns null for junk", () => {
    const encoded = Buffer.from(CLERK_URL, "utf8").toString("base64url");
    expect(decodeTarget(encoded)).toBe(CLERK_URL);
    expect(decodeTarget("!!!not-base64!!!")).toBeNull();
  });
});
