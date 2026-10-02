import { describe, expect, it } from "vitest";
import {
  MARKET_CODES,
  MAX_MARKET_PICKS,
  joinMarketLabels,
  marketLabel,
  normalizeMarketPicks,
  resolveVoterKey,
  tallyMarketVotes,
} from "@shared/markets";

describe("market survey — options", () => {
  it("offers the US even though its game is already live", () => {
    expect(MARKET_CODES).toContain("US");
  });

  it("names markets by country, never by exchange", () => {
    for (const code of MARKET_CODES) {
      expect(marketLabel(code)).not.toMatch(/NASDAQ|NYSE|LSE|ASX|TSX/i);
    }
  });

  it("joins labels the way the confirmation pop-up reads them", () => {
    expect(joinMarketLabels(["AU"])).toBe("Australia");
    expect(joinMarketLabels(["AU", "IN"])).toBe("Australia and India");
    expect(joinMarketLabels(["AU", "IN", "JP"])).toBe("Australia, India and Japan");
  });
});

describe("market survey — one vote per voter", () => {
  it("keys a signed-in player by account, ignoring any browser id", () => {
    expect(resolveVoterKey(42, "abcdefghijklmnop")).toBe("user:42");
  });

  it("keys an anonymous visitor by their browser id", () => {
    expect(resolveVoterKey(null, "abcdefghijklmnop")).toBe("anon:abcdefghijklmnop");
  });

  it("rejects a missing or malformed browser id rather than storing an unkeyed vote", () => {
    expect(resolveVoterKey(null, undefined)).toBeNull();
    expect(resolveVoterKey(null, "short")).toBeNull();
    expect(resolveVoterKey(null, "has spaces and <tags> in it!!")).toBeNull();
  });
});

describe("market survey — picks", () => {
  it("keeps order, drops duplicates and enforces the cap", () => {
    expect(normalizeMarketPicks(["AU", "AU", "IN", "JP", "GB"])).toEqual(["AU", "IN", "JP"]);
    expect(normalizeMarketPicks(["AU", "IN", "JP", "GB"]).length).toBe(MAX_MARKET_PICKS);
  });
});

describe("market survey — tally", () => {
  const row = (
    firstChoice: string,
    secondChoice: string | null = null,
    thirdChoice: string | null = null,
    visitorCountry: string | null = null,
    otherText: string | null = null
  ) => ({ firstChoice, secondChoice, thirdChoice, visitorCountry, otherText });

  it("ranks by first choice, and counts mentions at any rank separately", () => {
    const t = tallyMarketVotes([
      row("AU", "IN"),
      row("AU"),
      row("IN", "AU", "JP"),
    ]);
    expect(t.totalVoters).toBe(3);
    expect(t.byMarket[0]).toMatchObject({ code: "AU", first: 2, mentions: 3 });
    expect(t.byMarket[1]).toMatchObject({ code: "IN", first: 1, mentions: 2 });
    expect(t.byMarket[2]).toMatchObject({ code: "JP", first: 0, mentions: 1 });
  });

  it("counts voters who ranked more than one market — the multiple-play signal", () => {
    const t = tallyMarketVotes([row("AU", "IN"), row("AU"), row("IN", "AU", "JP")]);
    expect(t.multiPickVoters).toBe(2);
  });

  it("groups by where the visit came from, and collects free-text answers", () => {
    const t = tallyMarketVotes([
      row("AU", null, null, "AU"),
      row("OTHER", null, null, "NG", "Nigeria"),
      row("GB", null, null, null),
    ]);
    expect(t.byVisitorCountry).toEqual(
      expect.arrayContaining([
        { country: "AU", voters: 1 },
        { country: "NG", voters: 1 },
        { country: "Unknown", voters: 1 },
      ])
    );
    expect(t.otherTexts).toEqual(["Nigeria"]);
  });

  it("handles no votes", () => {
    expect(tallyMarketVotes([])).toEqual({
      totalVoters: 0,
      multiPickVoters: 0,
      byMarket: [],
      byVisitorCountry: [],
      otherTexts: [],
    });
  });
});
