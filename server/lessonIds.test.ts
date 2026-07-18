import { describe, expect, it } from "vitest";
import { ALL_LEVELS } from "@/content/lessons";
import { ALL_LESSON_IDS } from "@shared/lessonIds";

describe("shared/lessonIds.ts stays in sync with client/src/content/lessons", () => {
  it("contains exactly the ids present in ALL_LEVELS", () => {
    const contentIds = ALL_LEVELS.flatMap((level) => level.lessons.map((l) => l.id)).sort();
    const sharedIds = [...ALL_LESSON_IDS].sort();
    expect(sharedIds).toEqual(contentIds);
  });
});

describe("Learning Hub content — structural rules", () => {
  const allLessons = ALL_LEVELS.flatMap((level) => level.lessons);

  it("has unique lesson ids", () => {
    const ids = allLessons.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("ids follow the l{level}-{n} format and match their level", () => {
    for (const lesson of allLessons) {
      expect(lesson.id).toMatch(/^l\d{3}-\d+$/);
      expect(lesson.id.startsWith(`l${lesson.level}-`)).toBe(true);
    }
  });

  it("has unique, sequential 1-based order within each level", () => {
    for (const level of ALL_LEVELS) {
      const orders = level.lessons.map((l) => l.order).sort((a, b) => a - b);
      const expected = level.lessons.map((_, i) => i + 1);
      expect(orders).toEqual(expected);
    }
  });

  it("has a non-empty body and matchupHook for every lesson", () => {
    for (const lesson of allLessons) {
      expect(lesson.body.trim().length).toBeGreaterThan(0);
      expect(lesson.matchupHook.trim().length).toBeGreaterThan(0);
    }
  });

  it("keeps lesson bodies within the 150-400 word tolerance", () => {
    for (const lesson of allLessons) {
      const wordCount = lesson.body.trim().split(/\s+/).length;
      expect(wordCount, `${lesson.id} (${lesson.title}): ${wordCount} words`).toBeGreaterThanOrEqual(150);
      expect(wordCount, `${lesson.id} (${lesson.title}): ${wordCount} words`).toBeLessThanOrEqual(400);
    }
  });

  it("has a quiz whose correctAnswer is one of its options (multiple_choice) or True/False", () => {
    for (const lesson of allLessons) {
      const { quiz } = lesson;
      if (quiz.questionType === "multiple_choice") {
        expect(quiz.options, lesson.id).not.toBeNull();
        expect(quiz.options).toHaveLength(4);
        expect(quiz.options).toContain(quiz.correctAnswer);
      } else {
        expect(quiz.options, lesson.id).toBeNull();
        expect(["True", "False"]).toContain(quiz.correctAnswer);
      }
      expect(quiz.explanation.trim().length).toBeGreaterThan(0);
      expect(quiz.questionText.trim().length).toBeGreaterThan(0);
    }
  });

  it("marks capstones only as the last lesson in a level with content", () => {
    for (const level of ALL_LEVELS) {
      if (level.lessons.length === 0) continue;
      const capstoneIndices = level.lessons
        .map((l, i) => (l.isCapstone ? i : -1))
        .filter((i) => i >= 0);
      expect(capstoneIndices).toEqual([level.lessons.length - 1]);
    }
  });
});
