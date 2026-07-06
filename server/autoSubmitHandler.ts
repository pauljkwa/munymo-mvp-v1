/**
 * POST /api/scheduled/auto-submit-locked-picks
 *
 * Internal node-cron handler — fires 5 min after lockout (see server/_core/index.ts).
 * Finds every "active" game whose lockoutAt has passed (no time window — a missed
 * run self-heals on the next sweep), copies gutSelection → finalSelection for any
 * pick where gut is set but final is null, then flips the game to "locked".
 *
 * Idempotent: re-runs safely if the platform retries or a sweep is missed.
 */

import type { Request, Response } from "express";
import { and, eq, isNull, isNotNull, lte } from "drizzle-orm";
import { getDb } from "./db";
import { dailyGames, playerPicks } from "../drizzle/schema";
import { ENV } from "./_core/env";

function isAuthorisedCron(req: Request): boolean {
  const provided = req.headers["x-curation-secret"] ?? req.query["secret"];
  return (
    typeof ENV.curationAgentSecret === "string" &&
    ENV.curationAgentSecret.length > 0 &&
    provided === ENV.curationAgentSecret
  );
}

export async function runLockoutSweep(): Promise<{ processed: number; games: number[] }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const now = new Date();

  // 1. Find active games whose lockoutAt has passed — no time window, so a
  //    missed run just picks up everything still pending on the next sweep.
  const eligibleGames = await db
    .select()
    .from(dailyGames)
    .where(
      and(
        eq(dailyGames.status, "active"),
        isNotNull(dailyGames.lockoutAt),
        lte(dailyGames.lockoutAt, now)
      )
    );

  let totalAutoSubmitted = 0;

  for (const game of eligibleGames) {
    // 2. Copy gutSelection → finalSelection for picks with gut set but final null
    const picksToAutoSubmit = await db
      .select()
      .from(playerPicks)
      .where(
        and(
          eq(playerPicks.gameId, game.id),
          isNotNull(playerPicks.gutSelection),
          isNull(playerPicks.finalSelection)
        )
      );

    for (const pick of picksToAutoSubmit) {
      await db
        .update(playerPicks)
        .set({
          finalSelection: pick.gutSelection,
          finalSubmittedAt: now,
        })
        .where(
          and(
            eq(playerPicks.userId, pick.userId),
            eq(playerPicks.gameId, game.id),
            isNull(playerPicks.finalSelection) // extra idempotency guard
          )
        );
      totalAutoSubmitted++;
    }

    if (picksToAutoSubmit.length > 0) {
      console.log(
        `[lockout-sweep] Game ${game.id} (${game.companyATicker} vs ${game.companyBTicker}): auto-submitted ${picksToAutoSubmit.length} picks`
      );
    }

    // 3. Flip the game to "locked" now that lockout has passed
    await db.update(dailyGames).set({ status: "locked" }).where(eq(dailyGames.id, game.id));
  }

  return { processed: totalAutoSubmitted, games: eligibleGames.map((g) => g.id) };
}

export async function autoSubmitLockedPicksHandler(req: Request, res: Response) {
  if (!isAuthorisedCron(req)) {
    return res.status(403).json({ error: "cron-only endpoint" });
  }

  try {
    const result = await runLockoutSweep();
    return res.json({ ok: true, ...result });
  } catch (error) {
    console.error("[lockout-sweep] Handler error:", error);
    return res.status(500).json({
      error: String(error),
      timestamp: new Date().toISOString(),
    });
  }
}
