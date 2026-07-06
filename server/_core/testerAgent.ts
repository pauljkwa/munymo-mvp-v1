/**
 * Tester Agent — simulates 6 synthetic players making daily picks.
 *
 * POST /api/scheduled/tester-picks
 *
 * Called once per trading day after the game goes live (e.g. 6:00 AM Perth / 22:00 UTC).
 * For each tester account it submits: gut pick → final pick → validation answer.
 * Picks and answers are randomised so each tester behaves independently.
 *
 * Auth: same SCHEDULED_TASK_COOKIE used by the daily curation cron.
 */

import type { Express, Request, Response } from "express";
import { sdk } from "./sdk";
import { notifyOwner } from "./notification";

// Tester user IDs (DB ids, not Clerk ids)
const TESTER_IDS = [870002, 870004, 870006, 870008, 870010, 870012];

function randomPick(): "A" | "B" {
  return Math.random() < 0.5 ? "A" : "B";
}

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Simulate human-ish answer time: 5–90 seconds
function randomAnswerTimeMs(): number {
  return Math.floor(Math.random() * 85_000) + 5_000;
}

export async function testerPicksHandler(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) {
      return res.status(403).json({ error: "cron-only endpoint" });
    }

    const { getActiveOrUpcomingGame, getPlayerPick, getValidationQuestion, getUserById } = await import("../db");
    const { appRouter } = await import("../routers");

    const game = await getActiveOrUpcomingGame();
    if (!game) {
      return res.json({ ok: true, skipped: true, reason: "No active game" });
    }
    if (game.status !== "active") {
      return res.json({ ok: true, skipped: true, reason: `Game status is '${game.status}' — not accepting picks` });
    }

    const question = await getValidationQuestion(game.id);
    const options: string[] = question?.options ?? [];

    const results: Array<{ userId: number; status: string; pick?: string }> = [];

    for (const userId of TESTER_IDS) {
      try {
        const dbUser = await getUserById(userId);
        if (!dbUser || dbUser.deactivated) {
          results.push({ userId, status: "skipped — user not found or deactivated" });
          continue;
        }

        const existingPick = await getPlayerPick(userId, game.id);
        if (existingPick?.finalSelection) {
          results.push({ userId, status: "skipped — already submitted final pick" });
          continue;
        }

        // Build a caller with this tester's user context
        const caller = appRouter.createCaller({
          user: dbUser,
          req: req as any,
          res: res as any,
        });

        const gutSelection = randomPick();

        // Submit gut pick (skip if already done)
        if (!existingPick?.gutSelection) {
          await caller.picks.submitGut({ gameId: game.id, selection: gutSelection });
        }

        // Final pick — 80% of the time matches gut, 20% changes mind
        const finalSelection = Math.random() < 0.8 ? gutSelection : (gutSelection === "A" ? "B" : "A");
        await caller.picks.submitFinal({ gameId: game.id, selection: finalSelection });

        // Validation answer — random from available options
        if (options.length > 0) {
          const answer = randomElement(options);
          const answerTimeMs = randomAnswerTimeMs();
          await caller.picks.submitValidation({ gameId: game.id, answer, answerTimeMs });
        }

        results.push({ userId, status: "ok", pick: finalSelection });
      } catch (err: any) {
        results.push({ userId, status: `error: ${err?.message ?? String(err)}` });
      }
    }

    const summary = results.map(r => `User ${r.userId}: ${r.status}`).join("\n");
    console.log("[tester-agent]", summary);

    const successCount = results.filter(r => r.status === "ok").length;
    if (successCount > 0) {
      await notifyOwner({
        title: `🤖 Tester picks submitted — ${successCount}/${TESTER_IDS.length} played`,
        content: summary,
      });
    }

    return res.json({ ok: true, results });
  } catch (err: any) {
    console.error("[tester-agent] Error:", err);
    return res.status(500).json({ error: err?.message ?? String(err) });
  }
}

export function registerTesterAgent(app: Express) {
  app.post("/api/scheduled/tester-picks", testerPicksHandler);
}
