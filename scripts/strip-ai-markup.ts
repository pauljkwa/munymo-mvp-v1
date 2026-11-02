/**
 * Strips Claude citation markup (`<cite index="…">…</cite>`) out of every
 * AI-written text column in the live database.
 *
 * WHY: see server/aiText.ts. Found 2026-11-02 in the Hindsight Spotlight for
 * GOOGL vs TTD (game 2820001); the scan found four earlier games with the same
 * tags (1170001, 2370001, 2400001, 2730001). The server now sanitizes every
 * agent payload on receipt, so this script is for the rows written before that
 * fix — and as a periodic check that nothing slipped through.
 *
 * Usage (DATABASE_URL in the environment — `set -a; source .env; set +a`):
 *   npx tsx scripts/strip-ai-markup.ts          # dry run: lists affected rows and the cleaned text
 *   npx tsx scripts/strip-ai-markup.ts --apply  # writes the cleaned text back
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { getDb } from "../server/db";
import { dailyGames, gameResearch, metricExplanations, validationQuestions } from "../drizzle/schema";
import { hasAiMarkup, sanitizeAiStrings } from "../server/aiText";

const APPLY = process.argv.includes("--apply");

// Every column the curation agent (or an admin pasting its output) writes.
const TARGETS = [
  { table: dailyGames, name: "daily_games", key: dailyGames.id, cols: ["pairingRationale", "sourceTitle", "sourcePublisher", "resultSummary", "hindsightSpotlight", "resultCommentary"] },
  { table: gameResearch, name: "game_research", key: gameResearch.gameId, cols: ["content", "researchSummary", "researchSnapshot", "researchMetrics", "metricsSnapshot"] },
  { table: validationQuestions, name: "validation_questions", key: validationQuestions.gameId, cols: ["questionText", "correctAnswer", "options"] },
  { table: metricExplanations, name: "metric_explanations", key: metricExplanations.id, cols: ["metricLabel", "explanation"] },
] as const;

function containsMarkup(v: unknown): boolean {
  if (typeof v === "string") return hasAiMarkup(v);
  if (Array.isArray(v)) return v.some(containsMarkup);
  if (v && typeof v === "object") return Object.values(v as Record<string, unknown>).some(containsMarkup);
  return false;
}

async function main() {
  const db = await getDb();
  if (!db) throw new Error("No database connection (DATABASE_URL missing?)");

  let dirtyRows = 0;
  for (const t of TARGETS) {
    const rows = (await db.select().from(t.table as any)) as Array<Record<string, unknown>>;
    for (const row of rows) {
      const changes: Record<string, unknown> = {};
      for (const col of t.cols) {
        const v = row[col];
        if (v == null || !containsMarkup(v)) continue;
        changes[col] = sanitizeAiStrings(v);
      }
      if (Object.keys(changes).length === 0) continue;
      dirtyRows++;
      const keyName = (t.key as any).name as string;
      console.log(`\n── ${t.name} ${keyName}=${row[keyName]} → ${Object.keys(changes).join(", ")}`);
      for (const [col, cleaned] of Object.entries(changes)) {
        const text = typeof cleaned === "string" ? cleaned : JSON.stringify(cleaned);
        console.log(`   ${col} (cleaned, ${text.length} chars):\n   ${text.replace(/\n/g, "\n   ")}`);
      }
      if (APPLY) {
        await db
          .update(t.table as any)
          .set(changes as any)
          .where(eq(t.key as any, row[keyName]));
        console.log(`   ✔ written`);
      }
    }
  }
  console.log(`\n${dirtyRows} row(s) with markup${APPLY ? " — cleaned" : " — dry run, nothing written (add --apply)"}.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
