/**
 * Tester Agent — simulates 6 synthetic players making daily picks.
 *
 * Called internally via node-cron at 22:00 UTC (6:00 AM Perth) Monday–Friday.
 * For each tester account it submits: gut pick → final pick → validation answer.
 * Picks are randomised so each tester behaves independently.
 *
 * The HTTP endpoint remains for manual triggering via curl.
 */

import type { Express, Request, Response } from "express";
import { notifyOwner } from "./notification";
import { ENV } from "./env";

const TESTER_IDS = [870002, 870004, 870006, 870008, 870010, 870012];

function randomPick(): "A" | "B" {
  return Math.random() < 0.5 ? "A" : "B";
}

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomAnswerTimeMs(): number {
  return Math.floor(Math.random() * 85_000) + 5_000;
}

export async function runTesterPicks(): Promise<void> {
  const { getActiveOrUpcomingGame, getPlayerPick, getValidationQuestion, getUserById } = await import("../db");
  const { appRouter } = await import("../routers");

  const game = await getActiveOrUpcomingGame();
  if (!game) {
    console.log("[tester-agent] No active game — skipping");
    return;
  }
  if (game.status !== "active") {
    console.log(`[tester-agent] Game status is '${game.status}' — skipping`);
    return;
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

      const caller = appRouter.createCaller({
        user: dbUser,
        req: {} as any,
        res: {} as any,
      });

      const gutSelection = randomPick();
      if (!existingPick?.gutSelection) {
        await caller.picks.submitGut({ gameId: game.id, selection: gutSelection });
      }

      const finalSelection = Math.random() < 0.8 ? gutSelection : (gutSelection === "A" ? "B" : "A");
      await caller.picks.submitFinal({ gameId: game.id, selection: finalSelection });

      if (options.length > 0) {
        const answer = randomElement(options);
        await caller.picks.submitValidation({ gameId: game.id, answer, answerTimeMs: randomAnswerTimeMs() });
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
}

export async function testerPicksHandler(req: Request, res: Response) {
  try {
    const secret = req.headers["x-tester-secret"] ?? req.query["secret"];
    if (!secret || secret !== ENV.testerAgentSecret) {
      return res.status(403).json({ error: "Forbidden" });
    }
    await runTesterPicks();
    return res.json({ ok: true });
  } catch (err: any) {
    console.error("[tester-agent] Error:", err);
    return res.status(500).json({ error: err?.message ?? String(err) });
  }
}

export function registerTesterAgent(app: Express) {
  app.post("/api/scheduled/tester-picks", testerPicksHandler);
}
