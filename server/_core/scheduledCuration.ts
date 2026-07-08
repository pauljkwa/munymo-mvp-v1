/**
 * Scheduled curation endpoints — called by the AGENT cron each trading day.
 *
 * GET  /api/scheduled/recent-games   → returns last 30 days of games for freshness checks
 * POST /api/scheduled/daily-curation → accepts the full curation JSON, validates freshness rules,
 *                                       runs End of Day logic (close today + create tomorrow)
 */
import type { Express, Request, Response } from "express";
import { notifyOwner } from "./notification";
import { ENV } from "./env";
import { resolveWinner } from "../scoring";

/**
 * Shared-secret auth for the scheduled endpoints.
 *
 * Replaces the previous Manus-issued session-cookie check (sdk.authenticateRequest
 * + isCron). Callers present the secret via the `x-curation-secret` header or a
 * `?secret=` query param — the same pattern used by the tester agent. Returns true
 * when the request is authorised.
 */
function isAuthorisedCron(req: Request): boolean {
  const provided = req.headers["x-curation-secret"] ?? req.query["secret"];
  return (
    typeof ENV.curationAgentSecret === "string" &&
    ENV.curationAgentSecret.length > 0 &&
    provided === ENV.curationAgentSecret
  );
}

// ─── Freshness rule constants ────────────────────────────────────────────────
const SECTOR_REPEAT_DAYS = 7;
const COMPANY_REPEAT_DAYS = 30;
const MATCHUP_REPEAT_DAYS = 365;

// ─── GET /api/scheduled/recent-games ─────────────────────────────────────────
async function recentGamesHandler(_req: Request, res: Response) {
  try {
    const { getDb } = await import("../db");
    const { dailyGames, validationQuestions } = await import("../../drizzle/schema.js");
    const { desc, gte, eq } = await import("drizzle-orm");
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
        // Included so the curation agent can see recent validation-question
        // types and avoid repeating the same one two days running.
        questionType: validationQuestions.questionType,
      })
      .from(dailyGames)
      .leftJoin(validationQuestions, eq(validationQuestions.gameId, dailyGames.id))
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
    // ── 1. Authenticate — shared-secret cron call ──
    if (!isAuthorisedCron(req)) {
      return res.status(403).json({ error: "cron-only endpoint" });
    }

    const body = req.body as CurationPayload;
    const { today, tomorrow, marketClosed } = body;

    if (!tomorrow) {
      return res.status(400).json({ error: "Missing 'tomorrow' block in payload" });
    }

    // ── Market-closed day handling ──
    // If the agent signals the market was closed today (public holiday),
    // we skip all scoring/closing logic and only create tomorrow's game.
    if (marketClosed) {
      console.log("[daily-curation] Market closed today — skipping result scoring, creating next game only.");
    }

    const { getDb } = await import("../db");
    const { dailyGames } = await import("../../drizzle/schema.js");
    const { desc, gte, lte, ne, or, eq, and, asc } = await import("drizzle-orm");
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
    // Skip closing if the market was closed today (holiday) or no winner data provided.
    const todayUtc = new Date().toISOString().slice(0, 10);
    let closeGameId: number | undefined;
    if (!marketClosed && today && today.winnerTicker) {
      // Find the active/locked game to close — the EARLIEST-dated one, i.e. the
      // game whose trading day has just concluded. Using desc() here would pick
      // the latest (a future, not-yet-played) game instead if more than one
      // active/locked game ever exists at once — which is exactly how games
      // piled up unresolved in the past (see references/munymo-handover-v2.md).
      // The lte(gameDate, today) guard excludes future-dated games whose session
      // hasn't happened yet — closing one of those would record a result from
      // the wrong trading day (2026-07-07 incident: a pre-open recovery run
      // created tomorrow's game, and that night's cron had only that future
      // game to "close").
      const activeGame = await db
        .select({ id: dailyGames.id, companyATicker: dailyGames.companyATicker, companyBTicker: dailyGames.companyBTicker })
        .from(dailyGames)
        .where(
          and(
            or(eq(dailyGames.status, "active"), eq(dailyGames.status, "locked")),
            lte(dailyGames.gameDate, todayUtc)
          )
        )
        .orderBy(asc(dailyGames.gameDate))
        .limit(1);
      if (activeGame[0]) closeGameId = activeGame[0].id;
    }

    // ── 3b. No-op guard ──
    // Nothing to close AND the next game already exists → this run has no work
    // (e.g. the nightly cron fired while the only active game's trading day is
    // still in the future). Succeed quietly instead of failing with a CONFLICT
    // from endOfDay's duplicate-game guard and emailing a false alarm.
    if (!closeGameId) {
      const [existingNext] = await db
        .select({ id: dailyGames.id, status: dailyGames.status })
        .from(dailyGames)
        .where(and(eq(dailyGames.gameDate, tomorrow.gameDate), ne(dailyGames.status, "cancelled")))
        .limit(1);
      if (existingNext) {
        const msg = `Nothing to close and a game already exists for ${tomorrow.gameDate} (id ${existingNext.id}, ${existingNext.status}) — no-op.`;
        console.log("[daily-curation]", msg);
        return res.json({ ok: true, skipped: true, reason: msg });
      }
    }

    // ── 4. Determine winner ──
    let winner: "A" | "B" | undefined;
    if (!marketClosed && today && today.winnerTicker && closeGameId) {
      const game = await db.select().from(dailyGames).where(eq(dailyGames.id, closeGameId)).limit(1);
      if (game[0]) {
        const resolved = resolveWinner(
          game[0].companyATicker,
          game[0].companyBTicker,
          today.winnerTicker,
          today.companyAPerf,
          today.companyBPerf
        );
        if ("error" in resolved) {
          console.error("[daily-curation] T3 winner validation failed:", resolved.error);
          await notifyOwner({ title: "⚠️ Curation rejected — winner validation failed", content: resolved.error });
          return res.status(422).json({ error: "Winner validation failed", detail: resolved.error });
        }
        winner = resolved.winner;
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
      companyAStartPrice: today?.companyAStartPrice,
      companyAEndPrice: today?.companyAEndPrice,
      companyBStartPrice: today?.companyBStartPrice,
      companyBEndPrice: today?.companyBEndPrice,
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
      nextResearchSummary: tomorrow.researchSummary,
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
      user: { id: 1, role: "admin" as const, clerkId: null, openId: null, email: null, name: "Cron", loginMethod: null, createdAt: new Date(), updatedAt: new Date(), displayName: null, awayStatus: false, awayStatusUntil: null, deactivated: false, tier: "free" as const, lastSignedIn: new Date(), emailOptIn: true, pushOptIn: true },
      req: req as any,
      res: res as any,
    });

    const result = await caller.admin.endOfDay(endOfDayInput);

    const elapsed = Date.now() - startTime;
    const closedNote = marketClosed
      ? "Market was closed today (public holiday) — no game scored."
      : closeGameId
        ? `Closed game #${closeGameId} (winner: ${winner}).`
        : "No game closed (first game).";
    const summary = `Daily curation completed in ${elapsed}ms. Next game: ${tomorrow.companyATicker} vs ${tomorrow.companyBTicker} on ${tomorrow.gameDate}. ${closedNote}`;
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
  /** Set to true by the agent when the market was closed today (holiday). */
  marketClosed?: boolean;
  today?: {
    gameId?: number | null;
    companyAPerf?: number;
    companyBPerf?: number;
    companyAStartPrice?: number;
    companyAEndPrice?: number;
    companyBStartPrice?: number;
    companyBEndPrice?: number;
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
    researchSummary?: string;
    researchMetrics?: Record<string, string>;
    validationQuestion?: {
      questionType: string;
      questionText: string;
      options?: string[] | null;
      correctAnswer: string;
    };
  };
}

// ─── POST /api/scheduled/streak-at-risk ──────────────────────────────────────
/**
 * Sends streak-at-risk emails to players who:
 *   - have an active streak > 0
 *   - have NOT yet submitted a final pick for today's game
 *   - the game's lockoutAt is within the next 2 hours
 *   - emailOptIn is not false
 *
 * Called once daily by the internal node-cron 60 min before lockout (see
 * server/_core/index.ts). Dedup: only fires while game status is "active" —
 * once runLockoutSweep() flips the game to "locked" at lockout (Phase 1),
 * this handler stops sending for that game even if invoked again.
 */
async function streakAtRiskHandler(req: Request, res: Response) {
  try {
    if (!isAuthorisedCron(req)) {
      return res.status(403).json({ error: "cron-only endpoint" });
    }

    const { getDb } = await import("../db");
    const { getActiveOrUpcomingGame, getAllUsers, getPlayerPick, getStreakForUser } = await import("../db");
    const { buildStreakAtRiskEmail, sendEmail } = await import("../email");
    const { ENV } = await import("./env");

    const game = await getActiveOrUpcomingGame();
    if (!game || game.status !== "active" || !game.lockoutAt) {
      return res.json({ ok: true, skipped: true, reason: "No active game with lockoutAt" });
    }

    const now = new Date();
    const lockoutAt = new Date(game.lockoutAt);
    const msUntilLockout = lockoutAt.getTime() - now.getTime();
    const twoHoursMs = 2 * 60 * 60 * 1000;

    if (msUntilLockout > twoHoursMs || msUntilLockout <= 0) {
      return res.json({ ok: true, skipped: true, reason: `Lockout not within 2h window (${Math.round(msUntilLockout / 60000)}min away)` });
    }

    const allUsers = await getAllUsers();
    let sent = 0;
    let skipped = 0;

    for (const u of allUsers) {
      if (!u.email || u.emailOptIn === false || u.deactivated) { skipped++; continue; }

      const streak = await getStreakForUser(u.id);
      if (!streak || (streak.currentStreak ?? 0) <= 0 || streak.awayStatus === "away") { skipped++; continue; }

      const pick = await getPlayerPick(u.id, game.id);
      if (pick?.finalSelection) { skipped++; continue; } // already submitted

      // Generate magic link if Clerk is configured
      let magicLink: string | null = null;
      if (u.clerkId && ENV.clerkSecretKey) {
        try {
          const res2 = await fetch("https://api.clerk.com/v1/sign_in_tokens", {
            method: "POST",
            headers: { "Authorization": `Bearer ${ENV.clerkSecretKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: u.clerkId, expires_in_seconds: 7200 }),
          });
          const data = await res2.json() as { id?: string };
          if (data.id) magicLink = `https://munymo.com/api/magic?token=${encodeURIComponent(data.id)}&to=${encodeURIComponent("/game")}`;
        } catch { /* non-fatal */ }
      }

      const { subject, html } = buildStreakAtRiskEmail({
        playerName: u.name,
        currentStreak: streak.currentStreak ?? 1,
        companyAName: game.companyAName,
        companyATicker: game.companyATicker,
        companyBName: game.companyBName,
        companyBTicker: game.companyBTicker,
        lockoutAt,
        magicLink,
      });

      const result = await sendEmail({ to: u.email, subject, html });
      if (result.success) sent++; else skipped++;
    }

    console.log(`[streak-at-risk] Sent: ${sent}, skipped: ${skipped}`);
    return res.json({ ok: true, sent, skipped });

  } catch (err) {
    console.error("[streak-at-risk] Error:", err);
    return res.status(500).json({ error: String(err) });
  }
}

// ─── Registration ─────────────────────────────────────────────────────────────
export function registerScheduledCuration(app: Express) {
  app.get("/api/scheduled/recent-games", recentGamesHandler);
  app.post("/api/scheduled/daily-curation", dailyCurationHandler);
  app.post("/api/scheduled/streak-at-risk", streakAtRiskHandler);
}
