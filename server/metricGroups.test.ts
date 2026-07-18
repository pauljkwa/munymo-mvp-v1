import { describe, expect, it } from "vitest";
import { metricGroupInfo } from "@/lib/metricGroups";
import { getStaticMetricExplanation } from "./_core/metricExplanations";

describe("metricGroupInfo — metrics panel v2 grouping", () => {
  it("maps the new 8-metric panel into its two groups", () => {
    expect(metricGroupInfo("NVDA Market Cap").id).toBe("long");
    expect(metricGroupInfo("NVDA P/E Ratio").id).toBe("long");
    expect(metricGroupInfo("NVDA Revenue Growth").id).toBe("long");
    expect(metricGroupInfo("NVDA Analyst Consensus").id).toBe("long");
    expect(metricGroupInfo("NVDA Next Earnings").id).toBe("setup");
    expect(metricGroupInfo("NVDA Beta").id).toBe("setup");
    expect(metricGroupInfo("NVDA Last Session Move").id).toBe("setup");
    expect(metricGroupInfo("NVDA vs 52-Week High").id).toBe("setup");
  });

  it("keeps every legacy 6-metric game in a single group so no headers render", () => {
    const legacy = [
      "AAPL Market Cap",
      "AAPL P/E Ratio",
      "AAPL Revenue Growth",
      "AAPL EPS (TTM)",
      "AAPL 52-Week Range",
      "AAPL Analyst Consensus",
    ];
    const ids = new Set(legacy.map((l) => metricGroupInfo(l).id));
    expect(ids).toEqual(new Set(["long"]));
  });

  it("matches label variants and respects word boundaries", () => {
    expect(metricGroupInfo("MSFT Revenue Growth (YoY)").id).toBe("long");
    // "Alphabet" must not word-boundary-match the "beta" key
    expect(metricGroupInfo("GOOGL Alphabet Index").id).toBe("other");
    expect(metricGroupInfo("Custom Admin Metric").id).toBe("other");
  });

  it("ranks The Long Game before Game-Day Setup, unknowns last", () => {
    const longRank = metricGroupInfo("NVDA Analyst Consensus").rank;
    const setupRank = metricGroupInfo("NVDA Next Earnings").rank;
    const otherRank = metricGroupInfo("Custom Admin Metric").rank;
    expect(longRank).toBeLessThan(setupRank);
    expect(setupRank).toBeLessThan(otherRank);
  });
});

describe("getStaticMetricExplanation — new panel metrics", () => {
  it("has a static explanation for every metric the curation agent now produces", () => {
    const labels = [
      "NVDA Market Cap",
      "NVDA P/E Ratio",
      "NVDA Revenue Growth",
      "NVDA Analyst Consensus",
      "NVDA Next Earnings",
      "NVDA Beta",
      "NVDA Last Session Move",
      "NVDA vs 52-Week High",
      // legacy metrics on archived games still need explanations
      "NVDA EPS (TTM)",
      "NVDA 52-Week Range",
    ];
    for (const label of labels) {
      expect(getStaticMetricExplanation(label), label).toBeTruthy();
    }
  });
});
