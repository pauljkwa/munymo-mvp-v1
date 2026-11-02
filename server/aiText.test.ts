import { describe, expect, it } from "vitest";
import { hasAiMarkup, sanitizeAiStrings, stripAiMarkup } from "./aiText";

describe("stripAiMarkup", () => {
  it("removes cite tags and keeps the quoted sentence (the 2026-11-02 GOOGL vs TTD case)", () => {
    const raw =
      'badly missed Street expectations. <cite index="1-10">Alphabet missed Q3 expectations on earnings and revenue, ' +
      "its first top-and-bottom-line miss in nearly four years.</cite> That report triggered a severe one-day shock — " +
      '<cite index="1-11">Alphabet shares slumped more than 10%.</cite> By the time';
    expect(stripAiMarkup(raw)).toBe(
      "badly missed Street expectations. Alphabet missed Q3 expectations on earnings and revenue, " +
        "its first top-and-bottom-line miss in nearly four years. That report triggered a severe one-day shock — " +
        "Alphabet shares slumped more than 10%. By the time"
    );
  });

  it("tidies the spacing the tags leave behind", () => {
    expect(stripAiMarkup('Sentence one. <cite index="1-0">Sentence two. </cite> Sentence three.')).toBe(
      "Sentence one. Sentence two. Sentence three."
    );
    expect(stripAiMarkup('<cite index="2-3">First line.</cite>\n\n<cite index="2-4">Second line. </cite>')).toBe(
      "First line.\n\nSecond line."
    );
  });

  it("strips any other tag-shaped markup too, in any case", () => {
    expect(stripAiMarkup("<CITE INDEX=\"1-1\">Upper</CITE> <b>bold</b> <br/> <span class='x'>s</span> end")).toBe(
      "Upper bold s end"
    );
  });

  it("leaves clean prose, comparisons and percentages alone", () => {
    const clean =
      "Today was decisive: the two stocks finished 1.96 points apart.\n\nEIX rose +0.54% while DUK fell -1.42%; " +
      "a P/E < 20 and revenue growth > 10% were the tells — see the 'Price trend' metric.";
    expect(stripAiMarkup(clean)).toBe(clean);
    expect(hasAiMarkup(clean)).toBe(false);
    expect(hasAiMarkup('x <cite index="1-0">y</cite>')).toBe(true);
  });
});

describe("sanitizeAiStrings", () => {
  it("cleans every string in a nested payload without touching other types", () => {
    const payload = {
      marketClosed: false,
      today: { gameId: 2820001, companyAPerf: -0.44, hindsightSpotlight: 'a <cite index="1-0">b</cite> c' },
      tomorrow: {
        researchContent: "<cite index=\"3-1\">Plain.</cite>",
        researchMetrics: { "Revenue growth": '<cite index="1-2">12%</cite>' },
        highlightedMetrics: ["P/E", '<cite index="9-9">Price trend</cite>'],
        validationQuestion: { options: ["A", "B"], correctAnswer: "A" },
      },
      note: null,
    };
    const out = sanitizeAiStrings(payload);
    expect(out).toEqual({
      marketClosed: false,
      today: { gameId: 2820001, companyAPerf: -0.44, hindsightSpotlight: "a b c" },
      tomorrow: {
        researchContent: "Plain.",
        researchMetrics: { "Revenue growth": "12%" },
        highlightedMetrics: ["P/E", "Price trend"],
        validationQuestion: { options: ["A", "B"], correctAnswer: "A" },
      },
      note: null,
    });
    // Input is not mutated.
    expect(payload.today.hindsightSpotlight).toContain("<cite");
  });
});
