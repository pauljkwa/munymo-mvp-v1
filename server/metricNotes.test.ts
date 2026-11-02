import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveMetricNotes, describeHighlightedMetricsForAgent } from "./highlightedMetrics";
import { objectiveSideForMetric } from "./scoring";
import { objectiveSideForMetric as sharedObjectiveSide } from "@shared/metricValues";
import { SYSTEM_PROMPT, STAGING_SYSTEM_PROMPT, RESULTS_ONLY_SYSTEM_PROMPT } from "./_core/curationAgent";
import { extractHighlightRules } from "./_core/backfillHighlights";
import { withholdMetricReasons } from "./routers";
import { metricNotesIndicator } from "./_core/scheduledCuration";

const HIGHLIGHTS = ["Revenue Growth", "P/E Ratio", "Beta", "Price trend"];

describe("resolveMetricNotes", () => {
  afterEach(() => vi.restoreAllMocks());

  it("keeps exact keys", () => {
    const raw = { "Revenue Growth": "a", "P/E Ratio": "b", Beta: "c", "Price trend": "d" };
    expect(resolveMetricNotes(raw, HIGHLIGHTS, "t")).toEqual(raw);
  });

  it("re-keys case and whitespace variants to the stored label", () => {
    const out = resolveMetricNotes({ "  revenue growth ": "a", "P/E RATIO": "b", price_trend: "x", "PRICE TREND": "d" }, HIGHLIGHTS, "t");
    expect(out).toEqual({ "Revenue Growth": "a", "P/E Ratio": "b", "Price trend": "d" });
  });

  it("drops unknown keys with one warning that names them", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const out = resolveMetricNotes({ "Revenue Growth": "a", "Market Cap": "nope" }, HIGHLIGHTS, "ctx");
    expect(out).toEqual({ "Revenue Growth": "a" });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain("Market Cap");
    expect(String(warn.mock.calls[0][0])).toContain("[ctx]");
  });

  it("returns null for non-objects, arrays and empty results", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    for (const raw of [undefined, null, "text", 42, ["a"], {}]) {
      expect(resolveMetricNotes(raw, HIGHLIGHTS, "t")).toBeNull();
    }
    expect(resolveMetricNotes({ "Market Cap": "x" }, HIGHLIGHTS, "t")).toBeNull();
    expect(resolveMetricNotes({ Beta: "   " }, HIGHLIGHTS, "t")).toBeNull();
    expect(resolveMetricNotes({ Beta: 7 }, HIGHLIGHTS, "t")).toBeNull();
  });

  it("trims values and caps them at 400 characters", () => {
    const out = resolveMetricNotes({ Beta: `  ${"x".repeat(500)}  `, "P/E Ratio": "  short  " }, HIGHLIGHTS, "t");
    expect(out?.Beta).toHaveLength(400);
    expect(out?.["P/E Ratio"]).toBe("short");
  });

  it("returns null when the game has no highlights", () => {
    expect(resolveMetricNotes({ Beta: "x" }, null, "t")).toBeNull();
    expect(resolveMetricNotes({ Beta: "x" }, [], "t")).toBeNull();
  });

  it("never throws, even on a hostile object", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const hostile = new Proxy({}, { ownKeys() { throw new Error("boom"); } });
    expect(() => resolveMetricNotes(hostile, HIGHLIGHTS, "t")).not.toThrow();
    expect(resolveMetricNotes(hostile, HIGHLIGHTS, "t")).toBeNull();
  });
});

describe("describeHighlightedMetricsForAgent", () => {
  const rows = [
    { label: "GOOGL Revenue Growth", value: "+14% YoY" },
    { label: "TTD Revenue Growth", value: "+3% YoY" },
    { label: "GOOGL P/E Ratio", value: "24.1" },
    { label: "TTD P/E Ratio", value: "38.2" },
    { label: "GOOGL Beta", value: "1.05" },
    { label: "TTD Beta", value: "1.60" },
  ];
  const game = {
    companyATicker: "GOOGL",
    companyBTicker: "TTD",
    highlightedMetrics: HIGHLIGHTS,
    highlightedMetricNotes: {
      "Revenue Growth": "GOOGL grows faster.",
      "P/E Ratio": "TTD is pricier.",
      Beta: "TTD swings more.",
      "Price trend": "TTD broke down.",
    } as Record<string, string>,
  };

  it("lists all four with both values and the note", () => {
    const out = describeHighlightedMetricsForAgent(game, rows);
    expect(out).toContain("write highlightedMetricDebrief with exactly these keys");
    expect(out).toContain('- Revenue Growth: GOOGL +14% YoY | TTD +3% YoY — Mo\'s pre-open note: "GOOGL grows faster."');
    expect(out).toContain("- P/E Ratio: GOOGL 24.1 | TTD 38.2");
    expect(out).toContain("- Beta: GOOGL 1.05 | TTD 1.60");
    expect(out.split("\n").filter((l) => l.startsWith("- "))).toHaveLength(4);
  });

  it("gives the Price trend line no values", () => {
    const line = describeHighlightedMetricsForAgent(game, rows).split("\n").find((l) => l.startsWith("- Price trend"))!;
    expect(line).toContain("(the 20-session chart)");
    expect(line).not.toContain("GOOGL");
    expect(line).toContain("TTD broke down.");
  });

  it("omits the note when none was stored", () => {
    const out = describeHighlightedMetricsForAgent({ ...game, highlightedMetricNotes: null }, rows);
    expect(out).not.toContain("pre-open note");
    expect(out).toContain("- Revenue Growth: GOOGL +14% YoY | TTD +3% YoY");
  });

  it("returns an empty string for a game without highlights", () => {
    expect(describeHighlightedMetricsForAgent({ ...game, highlightedMetrics: null }, rows)).toBe("");
    expect(describeHighlightedMetricsForAgent({ ...game, highlightedMetrics: [] }, rows)).toBe("");
  });
});

describe("prompt structure", () => {
  const block = (text: string, key: string) => {
    const start = text.indexOf(`"${key}": {`);
    expect(start).toBeGreaterThan(-1);
    let depth = 0;
    for (let i = text.indexOf("{", start); i < text.length; i++) {
      if (text[i] === "{") depth++;
      else if (text[i] === "}" && --depth === 0) return text.slice(text.indexOf("{", start), i + 1);
    }
    throw new Error("unbalanced");
  };

  it("the results-only today block asks for highlightedMetricDebrief", () => {
    expect(block(RESULTS_ONLY_SYSTEM_PROMPT, "today")).toContain("highlightedMetricDebrief");
    expect(RESULTS_ONLY_SYSTEM_PROMPT).toContain("Also write highlightedMetricDebrief");
  });

  it("the staging tomorrow block asks for highlightedMetricNotes, right after highlightedMetrics", () => {
    const tomorrow = block(STAGING_SYSTEM_PROMPT, "tomorrow");
    expect(tomorrow).toContain("highlightedMetricNotes");
    expect(tomorrow.indexOf("highlightedMetricNotes")).toBeGreaterThan(tomorrow.indexOf('"highlightedMetrics"'));
    expect(tomorrow.indexOf("highlightedMetricNotes")).toBeLessThan(tomorrow.indexOf('"validationQuestion"'));
  });

  it("the full prompt's two blocks carry both fields", () => {
    expect(block(SYSTEM_PROMPT, "today")).toContain("highlightedMetricDebrief");
    expect(block(SYSTEM_PROMPT, "tomorrow")).toContain("highlightedMetricNotes");
  });

  it("the weaving rule is in the staging prompt and appears once in the full prompt", () => {
    expect(STAGING_SYSTEM_PROMPT).toContain("Do NOT label them, list them");
    expect(SYSTEM_PROMPT.split("Do NOT label them, list them").length - 1).toBe(1);
    expect(RESULTS_ONLY_SYSTEM_PROMPT).not.toContain("Do NOT label them, list them");
  });

  it("the notes rule forbids hindsight and naming a winner", () => {
    expect(STAGING_SYSTEM_PROMPT).toContain("never say or hint which company will win");
  });
});

describe("backfill prompt", () => {
  it("still gets only the choosing rules, not the notes or weaving paragraphs", () => {
    const rules = extractHighlightRules();
    expect(rules).toContain("NEVER choose a metric where both companies have the same value");
    expect(rules).not.toContain("highlightedMetricNotes");
    expect(rules).not.toContain("Do NOT label them");
    expect(SYSTEM_PROMPT).toContain(rules);
  });
});

describe("the Numbers favored chip", () => {
  it("uses the very function settlement uses", () => {
    expect(sharedObjectiveSide).toBe(objectiveSideForMetric);
    expect(sharedObjectiveSide("Revenue Growth", "+14% YoY", "+3% YoY")).toBe("A");
    expect(sharedObjectiveSide("P/E Ratio", "24.1", "38.2")).toBeNull();
  });
});

describe("metricNotesIndicator (owner email line)", () => {
  it("reports full, partial, missing and not-applicable", () => {
    const notes = { "Revenue Growth": "a", "P/E Ratio": "b", Beta: "c", "Price trend": "d" };
    expect(metricNotesIndicator("Metric notes", notes, HIGHLIGHTS)).toBe("Metric notes: 4/4");
    expect(metricNotesIndicator("Metric notes", { Beta: "c" }, HIGHLIGHTS)).toBe("Metric notes: 1/4");
    expect(metricNotesIndicator("Metric notes", null, HIGHLIGHTS)).toBe("Metric notes: missing");
    expect(metricNotesIndicator("Metric debrief", null, null)).toBe("Metric debrief: n/a (no highlighted metrics)");
  });
});

describe("withholdMetricReasons — nothing about Mo's reasoning before the result", () => {
  const row = { status: "active", highlightedMetricNotes: { Beta: "n" }, highlightedMetricDebrief: { Beta: "d" }, other: 1 };

  it("nulls both fields until the result is published", () => {
    for (const status of ["draft", "active", "locked", "cancelled"]) {
      const out = withholdMetricReasons({ ...row, status });
      expect(out.highlightedMetricNotes).toBeNull();
      expect(out.highlightedMetricDebrief).toBeNull();
      expect(out.other).toBe(1);
    }
  });

  it("returns them untouched once the result is published", () => {
    const out = withholdMetricReasons({ ...row, status: "result_published" });
    expect(out.highlightedMetricNotes).toEqual({ Beta: "n" });
    expect(out.highlightedMetricDebrief).toEqual({ Beta: "d" });
  });
});
