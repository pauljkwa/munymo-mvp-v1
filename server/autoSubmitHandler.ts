/**
 * POST /api/scheduled/auto-submit-locked-picks
 *
 * Heartbeat cron handler — fires at lockout time (13:30 UTC summer, 14:30 UTC winter).
 * Finds any active game whose lockoutAt is in the past (within 15-minute safety window)
 * and copies gutSelection → finalSelection for all picks where gut is set but final is null.
 *
 * Idempotent: re-runs safely if the platform retries.
 */

import type { Request, Response } from "express";
import { and, eq, isNull, isNotNull, lte, gte } from "drizzle-orm";
import { getDb } from "./db";
import { dailyGames, playerPicks } from "../drizzle/schema";
import { sdk } from "./_core/sdk";

export async function autoSubmitLockedPicksHandler(req: Request, res: Response) {
  try {
    // 1. Authenticate — cron only
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) {
      return res.status(403).json({ error: "cron-only" });
    }

    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: "Database not available" });
    }

    const now = new Date();
    const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);

    // 2. Find active games whose lockoutAt has passed within the last 15 minutes
    //    (safety window prevents re-processing old games on retry)
    const eligibleGames = await db
      .select()
      .from(dailyGames)
      .where(
        and(
          eq(dailyGames.status, "active"),
          isNotNull(dailyGames.lockoutAt),
          lte(dailyGames.lockoutAt, now),
          gte(dailyGames.lockoutAt, fifteenMinutesAgo)
        )
      );

    if (eligibleGames.length === 0) {
      return res.json({ ok: true, skipped: "no eligible games", processed: 0 });
    }

    let totalAutoSubmitted = 0;

    for (const game of eligibleGames) {
      // 3. Find picks with gutSelection set but finalSelection null
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

      if (picksToAutoSubmit.length === 0) continue;

      // 4. Copy gutSelection → finalSelection for each pick
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

      console.log(
        `[auto-submit] Game ${game.id} (${game.companyATicker} vs ${game.companyBTicker}): auto-submitted ${picksToAutoSubmit.length} picks`
      );
    }

    return res.json({
      ok: true,
      processed: totalAutoSubmitted,
      games: eligibleGames.map((g) => g.id),
    });
  } catch (error) {
    console.error("[auto-submit] Handler error:", error);
    return res.status(500).json({
      error: String(error),
      timestamp: new Date().toISOString(),
    });
  }
}
