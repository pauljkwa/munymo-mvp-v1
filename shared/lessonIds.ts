/**
 * Every valid Learning Hub lesson id, kept in sync with
 * client/src/content/lessons/*.ts by server/lessonIds.test.ts.
 *
 * This lives under shared/ (not client/) so the server's learn.markComplete
 * validation can import it without pulling in client-only code.
 */
export const ALL_LESSON_IDS: string[] = [
  // Level 100 — How the Market Works
  "l100-1",
  "l100-2",
  "l100-3",
  "l100-4",
  "l100-5",
  "l100-6",
  // Level 200 — Game-Day Setup: What Moves a Stock in One Day
  "l200-1",
  "l200-2",
  "l200-3",
  "l200-4",
  "l200-5",
  "l200-6",
  "l200-7",
  // Level 300 — The Company Underneath
  "l300-1",
  "l300-2",
  "l300-3",
  "l300-4",
  "l300-5",
  "l300-6",
  "l300-7",
  // Level 400 — The Street: Who Else Is in This Trade
  "l400-1",
  "l400-2",
  "l400-3",
  "l400-4",
  "l400-5",
  "l400-6",
  // Level 500 — The Combined Picture
  "l500-1",
  "l500-2",
  "l500-3",
  "l500-4",
  "l500-5",
  "l500-6",
];
