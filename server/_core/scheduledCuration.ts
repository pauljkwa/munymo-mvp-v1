/**
 * Scheduled curation endpoints — called by the AGENT cron each trading day.
 *
 * GET  /api/scheduled/recent-games   → returns last 30 days of games for freshness checks
 * POST /api/scheduled/daily-curation → accepts the full curation JSON, validates freshness rules,
 *                                       runs End of Day logic (close today + create tomorrow)
 */
import type { Express, Request, Response } from "express";
import { sdk } from "./sdk";
import { notifyOwner } from "./notification";
import { ENV } from "./env";

// ─── Freshness rule constants ────────────────────────────────────────────────
const SECTOR_REPEAT_DAYS = 7;
const COMPANY_REPEAT_DAYS = 30;
const MATCHUP_REPEAT_DAYS = 365;

// ─── GET /api/scheduled/recent-games ─────────────────────────────────────────
async function recentGamesHandler(_req: Request, res: Response) {
  try {
    const { getDb } = await import("../db");
    const { dailyGames } = await import("../../drizzle/schema.js");
    const { desc, gte } = await import("drizzle-orm");
    const db = await getDb();
    if (!db) return res.status(500).json({ error: "Database unavailable" });

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - MATCHUP_REPEAT_DAYS);
    const cutoffStr = cutoff.toISOString().slice(0, 10); // YYYY-MM-DD

    const games = await db
      .select({
        id: dailyGames.id,
        gameDate: dailyGames.gameDate,
        sector: dailyGames.sector,
        companyATicker: dailyGames.companyATicker,
        companyBTicker: dailyGames.companyBTicker,
        companyAName: dailyGames.companyAName,
        companyBName: dailyGames.companyBName,
        status: dailyGames.status,
      })
      .from(dailyGames)
      .where(gte(dailyGames.gameDate, cutoffStr))
      .orderBy(desc(dailyGames.gameDate))
      .limit(100);

    return res.json({ games, rules: {
      sectorRepeatDays: SECTOR_REPEAT_DAYS,
      companyRepeatDays: COMPANY_REPEAT_DAYS,
      matchupRepeatDays: MATCHUP_REPEAT_DAYS,
    }});
  } catch (err) {
    console.error("[recent-games] Error:", err);
    return res.status(500).json({ error: String(err) });
  }
}

// ─── POST /api/scheduled/daily-curation ──────────────────────────────────────
async function dailyCurationHandler(req: Request, res: Response) {
  const startTime = Date.now();
  try {
    // ── 1. Authenticate — must be a cron call ──
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) {
      return res.status(403).json({ error: "cron-only endpoint" });
    }

    const body = req.body as CurationPayload;
    const { today, tomorrow } = body;

    if (!tomorrow) {
      return res.status(400).json({ error: "Missing 'tomorrow' block in payload" });
    }

    const { getDb } = await import("../db");
    const { dailyGames } = await import("../../drizzle/schema.js");
    const { desc, gte, or, eq, and } = await import("drizzle-orm");
    const db = await getDb();
    if (!db) return res.status(500).json({ error: "Database unavailable" });

    // ── 2. Freshness validation ──
    const now = new Date();
    const sectorCutoff = new Date(now); sectorCutoff.setDate(now.getDate() - SECTOR_REPEAT_DAYS);
    const companyCutoff = new Date(now); companyCutoff.setDate(now.getDate() - COMPANY_REPEAT_DAYS);
    const matchupCutoff = new Date(now); matchupCutoff.setDate(now.getDate() - MATCHUP_REPEAT_DAYS);

    const recentGames = await db
      .select({
        gameDate: dailyGames.gameDate,
        sector: dailyGames.sector,
        companyATicker: dailyGames.companyATicker,
        companyBTicker: dailyGames.companyBTicker,
      })
      .from(dailyGames)
      .where(gte(dailyGames.gameDate, matchupCutoff.toISOString().slice(0, 10)))
      .orderBy(desc(dailyGames.gameDate));

    const violations: string[] = [];
    const tickerA = tomorrow.companyATicker.toUpperCase();
    const tickerB = tomorrow.companyBTicker.toUpperCase();
    const sectorCutoffStr = sectorCutoff.toISOString().slice(0, 10);
    const companyCutoffStr = companyCutoff.toISOString().slice(0, 10);
    const matchupCutoffStr = matchupCutoff.toISOString().slice(0, 10);

    for (const g of recentGames) {
      const gA = g.companyATicker.toUpperCase();
      const gB = g.companyBTicker.toUpperCase();
      const gDate = g.gameDate;

      // Sector repeat within 7 days
      if (g.sector && tomorrow.sector && g.sector.toLowerCase() === tomorrow.sector.toLowerCase() && gDate >= sectorCutoffStr) {
        violations.push(`Sector '${tomorrow.sector}' was used on ${gDate} (within ${SECTOR_REPEAT_DAYS} days)`);
      }
      // Company repeat within 30 days
      if ((gA === tickerA || gB === tickerA) && gDate >= companyCutoffStr) {
        violations.push(`Company ${tickerA} was used on ${gDate} (within ${COMPANY_REPEAT_DAYS} days)`);
      }
      if ((gA === tickerB || gB === tickerB) && gDate >= companyCutoffStr) {
        violations.push(`Company ${tickerB} was used on ${gDate} (within ${COMPANY_REPEAT_DAYS} days)`);
      }
      // Matchup repeat within 365 days
      const sameMatchup = (gA === tickerA && gB === tickerB) || (gA === tickerB && gB === tickerA);
      if (sameMatchup && gDate >= matchupCutoffStr) {
        violations.push(`Matchup ${tickerA} vs ${tickerB} was used on ${gDate} (within ${MATCHUP_REPEAT_DAYS} days)`);
      }
    }

    if (violations.length > 0) {
      const msg = `Freshness rule violations:\n${violations.join("\n")}`;
      console.warn("[daily-curation] Rejected:", msg);
      await notifyOwner({ title: "⚠️ Curation rejected — freshness violations", content: msg });
      return res.status(422).json({ error: "Freshness rule violations", violations });
    }

    // ── 3. Determine active game to close ──
    let closeGameId: number | undefined;
    if (today && today.winnerTicker) {
      // Find the active/locked game to close
      const activeGame = await db
        .select({ id: dailyGames.id, companyATicker: dailyGames.companyATicker, companyBTicker: dailyGames.companyBTicker })
        .from(dailyGames)
        .where(or(eq(dailyGames.status, "active"), eq(dailyGames.status, "locked")))
        .orderBy(desc(dailyGames.gameDate))
        .limit(1);
      if (activeGame[0]) closeGameId = activeGame[0].id;
    }

    // ── 4. Determine winner ──
    let winner: "A" | "B" | undefined;
    if (today && today.winnerTicker && closeGameId) {
      const game = await db.select().from(dailyGames).where(eq(dailyGames.id, closeGameId)).limit(1);
      if (game[0]) {
        winner = game[0].companyATicker.toUpperCase() === today.winnerTicker.toUpperCase() ? "A" : "B";
      }
    }

    // ── 5. Map question type ──
    const qtMap: Record<string, "multiple_choice" | "yes_no" | "true_false"> = {
      mc: "multiple_choice", multiple_choice: "multiple_choice",
      yn: "yes_no", yes_no: "yes_no",
      tf: "true_false", true_false: "true_false",
    };
    const questionType = tomorrow.validationQuestion?.questionType
      ? qtMap[tomorrow.validationQuestion.questionType] ?? "multiple_choice"
      : undefined;

    // ── 6. Build the endOfDay input ──
    const lockoutAt = tomorrow.lockoutTime ?? tomorrow.lockoutAt;
    const endOfDayInput = {
      closeGameId,
      winner,
      companyAPerf: today?.companyAPerf,
      companyBPerf: today?.companyBPerf,
      resultSummary: today?.resultSummary,
      hindsightSpotlight: today?.hindsightSpotlight,
      nextGameDate: tomorrow.gameDate,
      nextExchange: tomorrow.exchange ?? "NASDAQ",
      nextCompanyAName: tomorrow.companyAName,
      nextCompanyATicker: tomorrow.companyATicker,
      nextCompanyBName: tomorrow.companyBName,
      nextCompanyBTicker: tomorrow.companyBTicker,
      nextSector: tomorrow.sector,
      nextPairingRationale: tomorrow.pairingRationale,
      nextLockoutAt: lockoutAt ? new Date(lockoutAt).toISOString() : undefined,
      nextResearchContent: tomorrow.researchContent,
      nextResearchMetrics: tomorrow.researchMetrics as Record<string, string> | undefined,
      nextQuestionType: questionType,
      nextQuestionText: tomorrow.validationQuestion?.questionText,
      nextQuestionOptions: tomorrow.validationQuestion?.options ?? undefined,
      nextCorrectAnswer: tomorrow.validationQuestion?.correctAnswer,
    };

    // ── 7. Call the endOfDay logic directly ──
    const { appRouter } = await import("../routers");
    // Build a minimal admin context for the cron caller
    const caller = appRouter.createCaller({
      user: { id: 1, role: "admin" as const, clerkId: null, openId: null, email: null, name: "Cron", loginMethod: null, createdAt: new Date(), updatedAt: new Date(), displayName: null, awayStatus: false, awayStatusUntil: null, deactivated: false, tier: "free" as const, lastSignedIn: new Date() },
      req: req as any,
      res: res as any,
    });

    const result = await caller.admin.endOfDay(endOfDayInput);

    const elapsed = Date.now() - startTime;
    const summary = `Daily curation completed in ${elapsed}ms. Next game: ${tomorrow.companyATicker} vs ${tomorrow.companyBTicker} on ${tomorrow.gameDate}. ${closeGameId ? `Closed game #${closeGameId} (winner: ${winner}).` : "No game closed (first game)."}`;
    console.log("[daily-curation]", summary);

    await notifyOwner({
      title: `✅ Daily curation complete — ${tomorrow.companyATicker} vs ${tomorrow.companyBTicker}`,
      content: summary,
    });

    return res.json({ ok: true, nextGameId: result.nextGameId, summary });

  } catch (err: any) {
    const elapsed = Date.now() - startTime;
    const errMsg = err?.message ?? String(err);
    console.error("[daily-curation] Error:", errMsg);
    try {
      await notifyOwner({
        title: "❌ Daily curation FAILED",
        content: `Error after ${elapsed}ms: ${errMsg}\n\nPlease run End of Day manually before 9:00 PM Perth time.`,
      });
    } catch {}
    return res.status(500).json({
      error: errMsg,
      stack: err?.stack,
      context: { elapsed },
      timestamp: new Date().toISOString(),
    });
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface CurationPayload {
  today?: {
    gameId?: number | null;
    companyAPerf?: number;
    companyBPerf?: number;
    winnerTicker?: string;
    winningMargin?: number;
    crowdVotePctA?: null;
    crowdVotePctB?: null;
    resultSummary?: string;
    hindsightSpotlight?: string;
    resultSourceNote?: string;
  };
  tomorrow: {
    exchange?: string;
    gameDate: string;
    sector?: string;
    companyAName: string;
    companyATicker: string;
    companyBName: string;
    companyBTicker: string;
    pairingRationale?: string;
    lockoutTime?: string;
    lockoutAt?: string;
    researchContent?: string;
    researchMetrics?: Record<string, string>;
    validationQuestion?: {
      questionType: string;
      questionText: string;
      options?: string[] | null;
      correctAnswer: string;
    };
  };
}

// ─── Registration ─────────────────────────────────────────────────────────────
export function registerScheduledCuration(app: Express) {
  app.get("/api/scheduled/recent-games", recentGamesHandler);
  app.post("/api/scheduled/daily-curation", dailyCurationHandler);
}
