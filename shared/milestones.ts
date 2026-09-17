/**
 * Milestones — the small celebrations between day one and qualification.
 *
 * The result page used to acknowledge exactly one thing: a perfect 100, with
 * confetti. Everything else a player achieved (their first game, a streak
 * worth naming, beating their own record) passed in silence. These are cheap
 * to say and they are the moments a player screenshots.
 *
 * Pure so the wording is testable. The caller decides whether this result is
 * the player's most recent game — milestones only make sense on the game that
 * just happened, not on an archive page from July.
 */
export interface MilestoneInput {
  /** games on the player's record after this one */
  totalGames: number;
  currentStreak: number;
  longestStreak: number;
  currentWinStreak: number;
  /** this game's total score */
  score: number;
  /** games needed for the all-time board */
  qualificationGames: number;
  /** perfect games on the record after this one */
  perfectGames: number;
}

export interface Milestone {
  emoji: string;
  title: string;
  body: string;
}

const STREAK_MARKS = new Set([5, 10, 20, 30, 50, 100, 200]);
const WIN_MARKS = new Set([3, 5, 7, 10]);

export function computeMilestones(m: MilestoneInput): Milestone[] {
  const out: Milestone[] = [];

  if (m.totalGames === 1) {
    out.push({
      emoji: "🎬",
      title: "First game on the record",
      body: "Every game from here builds the history your ranking and MunyIQ are made of.",
    });
  }

  if (m.score === 100) {
    out.push({
      emoji: "💯",
      title: m.perfectGames === 1 ? "Your first perfect game" : `Perfect game number ${m.perfectGames}`,
      body: "Right pick, right answer, inside fifteen seconds. That is the whole loop done cleanly.",
    });
  }

  if (m.totalGames === m.qualificationGames) {
    out.push({
      emoji: "🏁",
      title: "You've qualified for the all-time board",
      body: `${m.qualificationGames} games is enough for an average that means something. You're ranked.`,
    });
  }

  if (STREAK_MARKS.has(m.currentStreak)) {
    out.push({
      emoji: "🔥",
      title: `${m.currentStreak}-day streak`,
      body:
        m.currentStreak >= 20
          ? "Showing up is the skill. This is what it looks like."
          : "One decision a day, every trading day. Keep the chain going.",
    });
  } else if (m.currentStreak >= 3 && m.currentStreak === m.longestStreak && m.totalGames > 1) {
    out.push({
      emoji: "📈",
      title: `New longest streak: ${m.currentStreak} days`,
      body: "Your best run yet. Tomorrow makes it one longer.",
    });
  }

  if (WIN_MARKS.has(m.currentWinStreak)) {
    out.push({
      emoji: "🎯",
      title: `${m.currentWinStreak} correct in a row`,
      body:
        m.currentWinStreak >= 7
          ? "On a coin flip that would be rare. Whatever you're reading, keep reading it."
          : "Three or more takes more than luck. Notice what you did.",
    });
  }

  // Two at most: a card with five badges reads as noise, not recognition.
  return out.slice(0, 2);
}
