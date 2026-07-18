import { describe, expect, it } from "vitest";
import { selectLessonOfTheDay } from "@/lib/lessonOfTheDay";
import { ALL_LEVELS } from "@/content/lessons";

const allLessons = ALL_LEVELS.flatMap((level) => level.lessons);

const base = {
  gameId: 42,
  gameDate: "2026-07-20",
  metrics: {} as Record<string, string>,
  pairingRationale: null as string | null,
  completedLessonIds: [] as string[],
  lessons: allLessons,
};

describe("selectLessonOfTheDay", () => {
  it("rule 1: picks the earnings lesson when Next Earnings falls on the game date", () => {
    const lesson = selectLessonOfTheDay({
      ...base,
      metrics: { "NVDA Next Earnings": "Jul 20" },
    });
    expect(lesson?.tags).toContain("earnings");
  });

  it("rule 2: picks the beta lesson when beta >= 1.3", () => {
    const lesson = selectLessonOfTheDay({
      ...base,
      metrics: { "NVDA Beta": "1.8", "MSFT Beta": "0.9" },
    });
    expect(lesson?.tags).toContain("beta");
  });

  it("does not trigger rule 2 when beta is below 1.3", () => {
    const lesson = selectLessonOfTheDay({
      ...base,
      metrics: { "NVDA Beta": "1.1" },
    });
    expect(lesson?.tags).not.toContain("beta");
  });

  it("rule 3: picks the momentum lesson when within 5% of the 52-week high", () => {
    const lesson = selectLessonOfTheDay({
      ...base,
      metrics: { "NVDA vs 52-Week High": "-3.2%" },
    });
    expect(lesson?.tags).toContain("momentum");
  });

  it("rule 4: picks the analyst lesson when the rationale mentions an upgrade", () => {
    const lesson = selectLessonOfTheDay({
      ...base,
      pairingRationale: "Analysts issued a surprise upgrade ahead of the session.",
    });
    expect(lesson?.tags).toContain("analyst");
  });

  it("falls through to the next rule when the matched candidate is already completed", () => {
    const betaLesson = firstWithTag("beta");
    const lesson = selectLessonOfTheDay({
      ...base,
      metrics: { "NVDA Beta": "1.8" },
      completedLessonIds: [betaLesson.id],
    });
    expect(lesson?.id).not.toBe(betaLesson.id);
  });

  it("rule 5: rotates deterministically over the eligible pool when no rule matches", () => {
    const first = selectLessonOfTheDay({ ...base, gameId: 5 });
    const second = selectLessonOfTheDay({ ...base, gameId: 5 });
    expect(first?.id).toBe(second?.id);
  });

  it("rotation skips lessons the player already completed", () => {
    const first = selectLessonOfTheDay({ ...base, gameId: 5 });
    expect(first).not.toBeNull();
    const next = selectLessonOfTheDay({
      ...base,
      gameId: 5,
      completedLessonIds: [first!.id],
    });
    expect(next?.id).not.toBe(first!.id);
  });

  it("returns null when every eligible lesson has been completed", () => {
    const rotationEligible = allLessons.filter((l) =>
      ["catalyst", "fundamentals", "valuation", "sector-story", "basics"].some((t) =>
        l.tags.includes(t)
      )
    );
    const lesson = selectLessonOfTheDay({
      ...base,
      completedLessonIds: rotationEligible.map((l) => l.id),
    });
    expect(lesson).toBeNull();
  });
});

function firstWithTag(tag: string) {
  const found = [...allLessons]
    .sort((a, b) => a.level - b.level || a.order - b.order)
    .find((l) => l.tags.includes(tag));
  if (!found) throw new Error(`no lesson tagged ${tag}`);
  return found;
}
