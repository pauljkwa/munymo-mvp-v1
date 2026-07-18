import type { Lesson } from "@/content/lessons/types";

export interface LessonOfTheDayInput {
  gameId: number;
  gameDate: string; // YYYY-MM-DD
  metrics: Record<string, string>; // ticker-prefixed label -> value, e.g. "NVDA Beta" -> "1.8"
  pairingRationale: string | null;
  completedLessonIds: Set<string> | string[];
  lessons: Lesson[]; // pass ALL_LEVELS flattened
}

const MONTH_SHORT = [
  "jan", "feb", "mar", "apr", "may", "jun",
  "jul", "aug", "sep", "oct", "nov", "dec",
];
const MONTH_LONG = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

// Rotation pool for rule 5 — the vocabulary named in spec Section 7.
const ROTATION_TAGS = ["catalyst", "fundamentals", "valuation", "sector-story", "basics"];

function findMetricValues(metrics: Record<string, string>, keyPhrase: string): string[] {
  return Object.entries(metrics)
    .filter(([label]) => label.toLowerCase().includes(keyPhrase))
    .map(([, value]) => value);
}

function parseNumeric(value: string): number | null {
  const match = value.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : null;
}

/** Does an earnings-date metric value (whatever format it's authored in) fall on gameDate's month+day? */
function earningsMatchesGameDate(value: string, gameDate: string): boolean {
  const d = new Date(`${gameDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;
  const month = d.getUTCMonth();
  const day = d.getUTCDate();
  const v = value.toLowerCase();

  const monthHit = v.includes(MONTH_SHORT[month]) || v.includes(MONTH_LONG[month]);
  const dayBoundary = new RegExp(`(^|[^0-9])0?${day}(?:st|nd|rd|th)?([^0-9]|$)`);
  if (monthHit && dayBoundary.test(v)) return true;

  const mm = String(month + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return v.includes(`${mm}/${dd}`) || v.includes(`${mm}-${dd}`);
}

function byLevelOrder(a: Lesson, b: Lesson): number {
  return a.level - b.level || a.order - b.order;
}

function firstLessonWithTag(lessons: Lesson[], tag: string): Lesson | undefined {
  return [...lessons].sort(byLevelOrder).find((l) => l.tags.includes(tag));
}

/**
 * Deterministic, zero-AI-call lesson-of-the-day selection for the game page.
 * First matching rule wins; a rule whose candidate lesson is already
 * completed falls through to the next rule, then to the rotation.
 */
export function selectLessonOfTheDay(input: LessonOfTheDayInput): Lesson | null {
  const completed =
    input.completedLessonIds instanceof Set
      ? input.completedLessonIds
      : new Set(input.completedLessonIds);

  const rules: Array<() => Lesson | undefined> = [
    // 1. Either company's Next Earnings falls on the game date
    () => {
      const values = findMetricValues(input.metrics, "next earnings");
      if (!values.some((v) => earningsMatchesGameDate(v, input.gameDate))) return undefined;
      return firstLessonWithTag(input.lessons, "earnings");
    },
    // 2. Either company's Beta parses >= 1.3
    () => {
      const values = findMetricValues(input.metrics, "beta").map(parseNumeric);
      if (!values.some((v) => v != null && v >= 1.3)) return undefined;
      return firstLessonWithTag(input.lessons, "beta");
    },
    // 3. Either company's "vs 52-Week High" parses <= 5% below high
    () => {
      const values = findMetricValues(input.metrics, "52-week high").map(parseNumeric);
      if (!values.some((v) => v != null && Math.abs(v) <= 5)) return undefined;
      return firstLessonWithTag(input.lessons, "momentum");
    },
    // 4. Pairing rationale mentions an analyst action
    () => {
      const rationale = (input.pairingRationale ?? "").toLowerCase();
      if (!/upgrade|downgrade|price target/.test(rationale)) return undefined;
      return firstLessonWithTag(input.lessons, "analyst");
    },
  ];

  for (const rule of rules) {
    const candidate = rule();
    if (candidate && !completed.has(candidate.id)) return candidate;
  }

  // 5. Rotate over the remaining eligible lessons in the rotation pool
  const eligible = [...input.lessons]
    .filter((l) => l.tags.some((t) => ROTATION_TAGS.includes(t)) && !completed.has(l.id))
    .sort(byLevelOrder);
  if (eligible.length === 0) return null;
  const index = ((input.gameId % eligible.length) + eligible.length) % eligible.length;
  return eligible[index];
}
