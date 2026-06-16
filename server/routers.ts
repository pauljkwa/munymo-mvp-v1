import { TRPCError } from "@trpc/server";
import { calculateScore, checkLockout, computeNewStreak, isQualified } from "./scoring";
import {
  broadcastEmail,
  buildGameAvailableEmail,
  buildMissedGameEmail,
  buildResultPublishedEmail,
} from "./email";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { ENV } from "./_core/env";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  computeAndStoreCommunityStats,
  createGame,
  getAllUsers,
  getAuditLog,
  getCommunityStats,
  getGameById,
  getLeaderboard,
  getLeaderboardStatForUser,
  getUserById,
  getPicksForGame,
  getPlayerPick,
  getPlayerScoreForGame,
  getPlayerScoreHistory,
  getResearchByGameId,
  getActiveOrUpcomingGame,
  getStreakForUser,
  getTodayGame,
  getValidationQuestion,
  initStreakForUser,
  insertDailyScore,
  listGames,
  listPublishedGames,
  lockPicksForGame,
  setAwayStatus,
  snapshotResearch,
  submitValidationAnswer,
  updateGame,
  updateStreak,
  upsertFinalSelection,
  upsertGutSelection,
  upsertLeaderboardStat,
  updateUserProfile,
  upsertResearch,
  upsertResearchWithMetrics,
  upsertValidationQuestion,
  writeAuditLog,
  getMetricExplanation,
  upsertMetricExplanation,
} from "./db";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns today's date string in YYYY-MM-DD (UTC). */
function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Admin guard middleware */
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

/** Server-side lockout check: throws if the game is locked or past deadline */
async function assertNotLocked(gameId: number) {
  const game = await getGameById(gameId);
  if (!game) throw new TRPCError({ code: "NOT_FOUND", message: "Game not found" });
  const lockoutDate = game.lockoutAt ? new Date(game.lockoutAt) : null;
  const check = checkLockout(game.status, lockoutDate, new Date());
  if (!check.allowed) {
    throw new TRPCError({ code: "FORBIDDEN", message: check.reason ?? "Game is locked" });
  }
  return game;
}

// calculateScore, checkLockout, computeNewStreak imported from ./scoring

// ─── Games Router ─────────────────────────────────────────────────────────────

const gamesRouter = router({
  getToday: publicProcedure.query(async () => {
    // Returns the nearest active/locked game — allows game to be visible
    // from the afternoon before trading day through to lockout
    const game = await getActiveOrUpcomingGame();
    if (!game) return null;
    return game;
  }),

  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const game = await getGameById(input.id);
      if (!game) throw new TRPCError({ code: "NOT_FOUND" });
      return game;
    }),

  getResearch: publicProcedure
    .input(z.object({ gameId: z.number() }))
    .query(async ({ input }) => {
      const game = await getGameById(input.gameId);
      if (!game) throw new TRPCError({ code: "NOT_FOUND" });
      // For archived games, return the immutable snapshot
      const research = await getResearchByGameId(input.gameId);
      if (!research) return null;
      // researchMetrics is stored as an array of {label, value} objects; convert to a plain record
      const rawMetrics = (research.researchMetrics ?? []) as Array<{ label: string; value: string }>;
      const metrics: Record<string, string> = Object.fromEntries(rawMetrics.map((m) => [m.label, m.value]));
      if (game.status === "result_published" && research.researchSnapshot) {
        return {
          content: research.researchSnapshot,
          isSnapshot: true,
          metrics,
          hindsightSpotlight: game.hindsightSpotlight ?? null,
          winner: game.winner ?? null,
          winnerName: game.winner === "A" ? game.companyAName : game.winner === "B" ? game.companyBName : null,
        };
      }
      return { content: research.content, isSnapshot: false, metrics, hindsightSpotlight: null, winner: null, winnerName: null };
    }),

  getValidationQuestion: publicProcedure
    .input(z.object({ gameId: z.number() }))
    .query(async ({ input }) => {
      const game = await getGameById(input.gameId);
      if (!game) throw new TRPCError({ code: "NOT_FOUND" });
      // Only expose question when game is active; hide correct answer until published
      const q = await getValidationQuestion(input.gameId);
      if (!q) return null;
      const isPublished = game.status === "result_published";
      return {
        id: q.id,
        questionType: q.questionType,
        questionText: q.questionText,
        options: q.options,
        // Only reveal correct answer after result is published
        correctAnswer: isPublished ? q.correctAnswer : undefined,
      };
    }),

  list: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(20), offset: z.number().default(0) }))
    .query(async ({ input }) => {
      return listGames(input.limit, input.offset);
    }),

  listArchive: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(20), offset: z.number().default(0) }))
    .query(async ({ input }) => {
      return listPublishedGames(input.limit, input.offset);
    }),

  getCommunityStats: publicProcedure
    .input(z.object({ gameId: z.number() }))
    .query(async ({ input }) => {
      const game = await getGameById(input.gameId);
      if (!game || game.status !== "result_published") return null;
      const stats = await getCommunityStats(input.gameId);
      return stats ?? null;
    }),
});

// ─── Picks Router ─────────────────────────────────────────────────────────────

const picksRouter = router({
  getMyPick: protectedProcedure
    .input(z.object({ gameId: z.number() }))
    .query(async ({ ctx, input }) => {
      const pick = await getPlayerPick(ctx.user.id, input.gameId);
      return pick ?? null;
    }),

  submitGut: protectedProcedure
    .input(z.object({ gameId: z.number(), selection: z.enum(["A", "B"]) }))
    .mutation(async ({ ctx, input }) => {
      const game = await assertNotLocked(input.gameId);
      if (game.status !== "active") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Game is not active" });
      }
      // Cannot change Gut Selection once Final Selection is submitted
      const existing = await getPlayerPick(ctx.user.id, input.gameId);
      if (existing?.finalSelection) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Gut Selection cannot be changed after Final Selection is submitted",
        });
      }
      await upsertGutSelection(ctx.user.id, input.gameId, input.selection);
      await initStreakForUser(ctx.user.id);
      return { success: true };
    }),

  submitFinal: protectedProcedure
    .input(
      z.object({
        gameId: z.number(),
        selection: z.enum(["A", "B"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const game = await assertNotLocked(input.gameId);
      if (game.status !== "active") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Game is not active" });
      }
      // Must have submitted a Gut Selection first
      const existing = await getPlayerPick(ctx.user.id, input.gameId);
      if (!existing?.gutSelection) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You must submit a Gut Selection before your Final Selection",
        });
      }
      // Store final selection without validation answer (submitted separately via timed modal)
      await upsertFinalSelection(ctx.user.id, input.gameId, input.selection);
      return { success: true };
    }),

  /** Submit validation answer separately after the timed modal flow */
  submitValidation: protectedProcedure
    .input(
      z.object({
        gameId: z.number(),
        answer: z.string().min(1),
        answerTimeMs: z.number().int().min(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const game = await assertNotLocked(input.gameId);
      if (game.status !== "active") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Game is not active" });
      }
      const existing = await getPlayerPick(ctx.user.id, input.gameId);
      if (!existing?.finalSelection) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You must submit your Final Selection before answering the validation question",
        });
      }
      if (existing.validationAnswer && existing.validationAnswer !== "") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Validation question already answered — no second chances",
        });
      }
      await submitValidationAnswer(ctx.user.id, input.gameId, input.answer, input.answerTimeMs);
      // Immediately reveal whether the answer was correct
      const question = await getValidationQuestion(input.gameId);
      const isCorrect = question?.correctAnswer === input.answer;
      return { success: true, isCorrect, correctAnswer: question?.correctAnswer ?? "" };
    }),
});

// ─── Scores Router ────────────────────────────────────────────────────────────

const scoresRouter = router({
  getMyScoreForGame: protectedProcedure
    .input(z.object({ gameId: z.number() }))
    .query(async ({ ctx, input }) => {
      const score = await getPlayerScoreForGame(ctx.user.id, input.gameId);
      return score ?? null;
    }),

  getMyHistory: protectedProcedure.query(async ({ ctx }) => {
    return getPlayerScoreHistory(ctx.user.id);
  }),

  getMyLeaderboardStat: protectedProcedure.query(async ({ ctx }) => {
    const stat = await getLeaderboardStatForUser(ctx.user.id);
    return stat ?? null;
  }),
});

// ─── Leaderboard Router ───────────────────────────────────────────────────────

const leaderboardRouter = router({
  get: publicProcedure.query(async () => {
    return getLeaderboard();
  }),
});

// ─── Streaks Router ───────────────────────────────────────────────────────────

const streaksRouter = router({
  getMyStreak: protectedProcedure.query(async ({ ctx }) => {
    const streak = await getStreakForUser(ctx.user.id);
    return streak ?? null;
  }),

  getStockChart: publicProcedure
    .input(
      z.object({
        ticker: z.string().min(1),
        range: z.enum(["1d", "5d", "1mo", "3mo", "6mo", "1y"]).default("1mo"),
      })
    )
    .query(async ({ input }) => {
      const intervalMap: Record<string, string> = {
        "1d": "5m",
        "5d": "1h",
        "1mo": "1d",
        "3mo": "1d",
        "6mo": "1wk",
        "1y": "1wk",
      };
      const interval = intervalMap[input.range] ?? "1d";
      try {
        return await fetchYahooOHLCV(input.ticker, input.range, interval);
      } catch (err) {
        throw new TRPCError({ code: "BAD_REQUEST", message: String(err) });
      }
    }),
});

// ─── Stock Chart Proxy ───────────────────────────────────────────────────────
// Fetches OHLCV candlestick data from Yahoo Finance server-side to avoid CORS
async function fetchYahooOHLCV(
  ticker: string,
  range: string, // "1d" | "5d" | "1mo" | "3mo" | "6mo" | "1y"
  interval: string // "5m" | "1h" | "1d"
) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=${range}&interval=${interval}&includePrePost=false`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!res.ok) throw new Error(`Yahoo Finance returned ${res.status}`);
  const json = (await res.json()) as {
    chart: {
      result: Array<{
        timestamp: number[];
        indicators: {
          quote: Array<{
            open: (number | null)[];
            high: (number | null)[];
            low: (number | null)[];
            close: (number | null)[];
            volume: (number | null)[];
          }>;
        };
        meta: { currency: string; regularMarketPrice: number };
      }> | null;
      error: unknown;
    };
  };
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error("No data returned from Yahoo Finance");
  const { timestamp, indicators } = result;
  const q = indicators.quote[0];
  const candles = timestamp
    .map((t, i) => ({
      time: t,
      open: q.open[i],
      high: q.high[i],
      low: q.low[i],
      close: q.close[i],
      volume: q.volume[i],
    }))
    .filter((c) => c.open !== null && c.close !== null);
  return { candles, meta: result.meta };
}

// ─── Admin Router ─────────────────────────────────────────────────────────────

const adminRouter = router({
  createGame: adminProcedure
    .input(
      z.object({
        gameDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        exchange: z.string().default("NASDAQ"),
        companyAName: z.string().min(1),
        companyATicker: z.string().min(1),
        companyBName: z.string().min(1),
        companyBTicker: z.string().min(1),
        sector: z.string().optional(),
        pairingRationale: z.string().optional(),
        lockoutAt: z.string().datetime().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { lockoutAt: lockoutAtStr, ...rest } = input;
      await createGame({
        ...rest,
        lockoutAt: lockoutAtStr ? new Date(lockoutAtStr) : undefined,
        createdBy: ctx.user.id,
        status: "draft",
      });
      await writeAuditLog(ctx.user.id, "create_game", "game", undefined, JSON.stringify(input));
      return { success: true };
    }),

  activateGame: adminProcedure
    .input(z.object({ gameId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const game = await getGameById(input.gameId);
      if (!game) throw new TRPCError({ code: "NOT_FOUND" });
      if (game.status !== "draft") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only draft games can be activated" });
      }
      await updateGame(input.gameId, { status: "active" });
      await writeAuditLog(ctx.user.id, "activate_game", "game", input.gameId);

      // Notify all registered players that today's game is live
      try {
        const allUsers = await getAllUsers();
        const players = allUsers.filter((u) => u.role !== "admin");
        const { subject, html } = buildGameAvailableEmail({
          companyAName: game.companyAName,
          companyATicker: game.companyATicker,
          companyBName: game.companyBName,
          companyBTicker: game.companyBTicker,
          sector: game.sector,
          gameDate: game.gameDate,
          lockoutAt: game.lockoutAt ? new Date(game.lockoutAt) : null,
        });
        const { sent, failed } = await broadcastEmail({ recipients: players, subject, html });
        console.log(`[Email] Game available notifications: ${sent} sent, ${failed} failed`);
      } catch (err) {
        console.warn("[Email] Failed to send game available notifications:", err);
      }

      return { success: true };
    }),

  updateGame: adminProcedure
    .input(
      z.object({
        gameId: z.number(),
        companyAName: z.string().min(1).optional(),
        companyATicker: z.string().min(1).optional(),
        companyBName: z.string().min(1).optional(),
        companyBTicker: z.string().min(1).optional(),
        sector: z.string().optional(),
        pairingRationale: z.string().optional(),
        lockoutAt: z.string().datetime().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { gameId, lockoutAt: lockoutAtStr, ...rest } = input;
      const game = await getGameById(gameId);
      if (!game) throw new TRPCError({ code: "NOT_FOUND" });
      if (game.status === "result_published" || game.status === "cancelled") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot edit a closed game" });
      }
      const data = { ...rest, ...(lockoutAtStr !== undefined ? { lockoutAt: new Date(lockoutAtStr) } : {}) };
      await updateGame(gameId, data);
      await writeAuditLog(ctx.user.id, "update_game", "game", gameId, JSON.stringify(data));
      return { success: true };
    }),

  updateResearch: adminProcedure
    .input(z.object({ gameId: z.number(), content: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const game = await getGameById(input.gameId);
      if (!game) throw new TRPCError({ code: "NOT_FOUND" });
      if (game.status === "result_published" || game.status === "cancelled") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot edit research for a closed game" });
      }
      await upsertResearch(input.gameId, input.content);
      await writeAuditLog(ctx.user.id, "update_research", "game", input.gameId);
      return { success: true };
    }),

  setValidationQuestion: adminProcedure
    .input(
      z.object({
        gameId: z.number(),
        questionType: z.enum(["multiple_choice", "yes_no", "true_false"]),
        questionText: z.string().min(1),
        options: z.array(z.string()).optional(),
        correctAnswer: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { gameId, ...data } = input;
      const game = await getGameById(gameId);
      if (!game) throw new TRPCError({ code: "NOT_FOUND" });
      if (game.status === "result_published" || game.status === "cancelled") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot edit a closed game" });
      }
      await upsertValidationQuestion(gameId, data);
      await writeAuditLog(ctx.user.id, "set_validation_question", "game", gameId);
      return { success: true };
    }),

  publishResult: adminProcedure
    .input(
      z.object({
        gameId: z.number(),
        winner: z.enum(["A", "B"]),
        companyAPerf: z.number().optional(),
        companyBPerf: z.number().optional(),
        resultSummary: z.string().optional(),
        hindsightSpotlight: z.string().optional(),
        resultCommentary: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const game = await getGameById(input.gameId);
      if (!game) throw new TRPCError({ code: "NOT_FOUND" });
      if (game.status === "result_published") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Result already published" });
      }
      if (game.status === "cancelled") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot publish result for cancelled game" });
      }

      // 1. Lock all picks
      await lockPicksForGame(input.gameId);

      // 2. Snapshot research
      await snapshotResearch(input.gameId);

      // 3. Get validation question
      const question = await getValidationQuestion(input.gameId);

      // 4. Calculate and store scores for all participants
      const picks = await getPicksForGame(input.gameId);
      // Collect scored picks for email notifications after all DB writes
      const scoredPicks: Array<{
        userId: number;
        predictionScore: number;
        validationScore: number;
        totalScore: number;
      }> = [];

      for (const pick of picks) {
        if (!pick.finalSelection) continue; // skip players who only submitted Gut
        const { predictionScore, validationScore } = calculateScore(
          pick.finalSelection,
          input.winner,
          pick.validationAnswer,
          question?.correctAnswer ?? ""
        );
        await insertDailyScore(pick.userId, input.gameId, predictionScore, validationScore);
        scoredPicks.push({ userId: pick.userId, predictionScore, validationScore, totalScore: predictionScore + validationScore });

        // 5. Update leaderboard stats
        await upsertLeaderboardStat(pick.userId);

        // 6. Update streaks
        await updateStreakForPlayer(pick.userId, game.gameDate);
      }

      // 7. Compute community stats
      await computeAndStoreCommunityStats(input.gameId);

      // 8. Mark game as result_published
      await updateGame(input.gameId, {
        status: "result_published",
        winner: input.winner,
        companyAPerf: input.companyAPerf !== undefined ? String(input.companyAPerf) : undefined,
        companyBPerf: input.companyBPerf !== undefined ? String(input.companyBPerf) : undefined,
        resultSummary: input.resultSummary,
        hindsightSpotlight: input.hindsightSpotlight,
        resultCommentary: input.resultCommentary,
        publishedAt: new Date(),
      });

      await writeAuditLog(
        ctx.user.id,
        "publish_result",
        "game",
        input.gameId,
        JSON.stringify({ winner: input.winner })
      );

      // 9. Send personalised result emails to each participant
      try {
        const allUsers = await getAllUsers();
        const userMap = new Map(allUsers.map((u) => [u.id, u]));
        let emailsSent = 0;
        let emailsFailed = 0;
        for (const scored of scoredPicks) {
          const user = userMap.get(scored.userId);
          if (!user?.email) { emailsFailed++; continue; }
          const { subject, html } = buildResultPublishedEmail({
            playerName: user.name,
            companyAName: game.companyAName,
            companyATicker: game.companyATicker,
            companyBName: game.companyBName,
            companyBTicker: game.companyBTicker,
            winner: input.winner,
            predictionScore: scored.predictionScore,
            validationScore: scored.validationScore,
            totalScore: scored.totalScore,
            resultCommentary: input.resultCommentary,
            gameDate: game.gameDate,
          });
          const result = await import("./email").then((m) =>
            m.sendEmail({ to: user.email!, subject, html })
          );
          if (result.success) emailsSent++; else emailsFailed++;
        }
        console.log(`[Email] Result notifications: ${emailsSent} sent, ${emailsFailed} failed`);
      } catch (err) {
        console.warn("[Email] Failed to send result notifications:", err);
      }

      return { success: true };
    }),

  cancelGame: adminProcedure
    .input(z.object({ gameId: z.number(), reason: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const game = await getGameById(input.gameId);
      if (!game) throw new TRPCError({ code: "NOT_FOUND" });
      if (game.status === "result_published") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot cancel a published game" });
      }
      await updateGame(input.gameId, { status: "cancelled", cancelledAt: new Date() });
      await writeAuditLog(
        ctx.user.id,
        "cancel_game",
        "game",
        input.gameId,
        input.reason
      );
      return { success: true };
    }),

  setPlayerAwayStatus: adminProcedure
    .input(
      z.object({
        userId: z.number(),
        status: z.enum(["active", "away", "missing"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await setAwayStatus(input.userId, input.status, ctx.user.id);
      // If missing, break the streak immediately
      if (input.status === "missing") {
        const streak = await getStreakForUser(input.userId);
        if (streak) {
          await updateStreak(
            input.userId,
            0,
            streak.longestStreak,
            streak.lastParticipationDate ?? todayUTC()
          );
        }
      }
      await writeAuditLog(
        ctx.user.id,
        "set_away_status",
        "player",
        input.userId,
        JSON.stringify({ status: input.status })
      );
      return { success: true };
    }),

  getAuditLog: adminProcedure
    .input(z.object({ limit: z.number().default(50), offset: z.number().default(0) }))
    .query(async ({ input }) => {
      return getAuditLog(input.limit, input.offset);
    }),

  // Unified end-of-day procedure: atomically close today's game and pre-load tomorrow's
  endOfDay: adminProcedure
    .input(
      z.object({
        // ── Close today's game (optional — omit for Game 1 / first game) ──
        closeGameId: z.number().optional(),
        winner: z.enum(["A", "B"]).optional(),
        companyAPerf: z.number().optional(),
        companyBPerf: z.number().optional(),
        resultSummary: z.string().optional(),
        hindsightSpotlight: z.string().optional(),
        // ── Tomorrow's game ──
        nextGameDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        nextExchange: z.string().default("NASDAQ"),
        nextCompanyAName: z.string().min(1),
        nextCompanyATicker: z.string().min(1),
        nextCompanyBName: z.string().min(1),
        nextCompanyBTicker: z.string().min(1),
        nextSector: z.string().optional(),
        nextPairingRationale: z.string().optional(),
        nextLockoutAt: z.string().datetime().optional(),
        // ── Tomorrow's research ──
        nextResearchContent: z.string().optional(),
        nextResearchMetrics: z.record(z.string(), z.string()).optional(),
        // ── Tomorrow's validation question ──
        nextQuestionType: z.enum(["multiple_choice", "yes_no", "true_false"]).optional(),
        nextQuestionText: z.string().optional(),
        nextQuestionOptions: z.array(z.string()).optional(),
        nextCorrectAnswer: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await import("./db").then((m) => m.getDb());
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // ── 1. Close today's game (skipped if no closeGameId — Game 1 / first game) ──
      let game: Awaited<ReturnType<typeof getGameById>> | null = null;
      const scoredPicks: Array<{ userId: number; predictionScore: number; validationScore: number; totalScore: number }> = [];

      if (input.closeGameId) {
        game = await getGameById(input.closeGameId);
        if (!game) throw new TRPCError({ code: "NOT_FOUND", message: "Game not found" });
        if (game.status === "result_published") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Result already published" });
        }
        await lockPicksForGame(input.closeGameId);
        await snapshotResearch(input.closeGameId);
        const question = await getValidationQuestion(input.closeGameId);
        const picks = await getPicksForGame(input.closeGameId);

        for (const pick of picks) {
          if (!pick.finalSelection) continue;
          const { predictionScore, validationScore } = calculateScore(
            pick.finalSelection,
            input.winner!,
            pick.validationAnswer,
            question?.correctAnswer ?? ""
          );
          await insertDailyScore(pick.userId, input.closeGameId, predictionScore, validationScore);
          scoredPicks.push({ userId: pick.userId, predictionScore, validationScore, totalScore: predictionScore + validationScore });
          await upsertLeaderboardStat(pick.userId);
          await updateStreakForPlayer(pick.userId, game.gameDate);
        }
        await computeAndStoreCommunityStats(input.closeGameId);
        await updateGame(input.closeGameId, {
          status: "result_published",
          winner: input.winner!,
          companyAPerf: String(input.companyAPerf ?? 0),
          companyBPerf: String(input.companyBPerf ?? 0),
          resultSummary: input.resultSummary ?? "",
          hindsightSpotlight: input.hindsightSpotlight ?? "",
          publishedAt: new Date(),
        });
      }

      // ── 2. Create tomorrow's game ──
      await createGame({
        gameDate: input.nextGameDate,
        exchange: input.nextExchange,
        companyAName: input.nextCompanyAName,
        companyATicker: input.nextCompanyATicker,
        companyBName: input.nextCompanyBName,
        companyBTicker: input.nextCompanyBTicker,
        sector: input.nextSector,
        pairingRationale: input.nextPairingRationale,
        lockoutAt: input.nextLockoutAt ? new Date(input.nextLockoutAt) : undefined,
        createdBy: ctx.user.id,
        status: "active",
      });

      // Get the newly created game to attach research/question
      const allGames = await listGames(1, 0);
      const nextGame = allGames[0];

      if (nextGame && input.nextResearchContent) {
        // Convert record to label/value array for upsertResearchWithMetrics
        const metricsArray = input.nextResearchMetrics
          ? Object.entries(input.nextResearchMetrics).map(([label, value]) => ({ label, value: String(value) }))
          : [];
        await upsertResearchWithMetrics(
          nextGame.id,
          input.nextResearchContent,
          metricsArray
        );
      }
      if (nextGame && input.nextQuestionType && input.nextQuestionText && input.nextCorrectAnswer) {
        await upsertValidationQuestion(nextGame.id, {
          questionType: input.nextQuestionType,
          questionText: input.nextQuestionText,
          options: input.nextQuestionOptions,
          correctAnswer: input.nextCorrectAnswer,
        });
      }

      await writeAuditLog(ctx.user.id, "end_of_day", "game", input.closeGameId ?? 0, JSON.stringify({ winner: input.winner, nextGameDate: input.nextGameDate }));

      // ── 3. Send result emails to ALL registered users (only if a game was closed) ──
      // Players who participated get a score summary; non-players get a re-engagement email.
      if (game) {
        try {
          const allUsers = await getAllUsers();
          const scoredMap = new Map(scoredPicks.map((s) => [s.userId, s]));
          // Build next-game teaser data if available
          const nextTicker = nextGame ? { a: input.nextCompanyATicker, b: input.nextCompanyBTicker, aName: input.nextCompanyAName, bName: input.nextCompanyBName } : null;
          let emailsSent = 0;
          let emailsFailed = 0;

          // Helper: generate a Clerk sign-in token and return a /api/magic wrapper URL.
          // The wrapper checks token validity server-side before forwarding to Clerk,
          // so expired/used tokens show our custom fallback instead of Clerk's error screen.
          const createMagicLink = async (clerkId: string | null, destination: string): Promise<string | null> => {
            if (!clerkId || !ENV.clerkSecretKey) return null;
            try {
              const res = await fetch("https://api.clerk.com/v1/sign_in_tokens", {
                method: "POST",
                headers: { "Authorization": `Bearer ${ENV.clerkSecretKey}`, "Content-Type": "application/json" },
                body: JSON.stringify({ user_id: clerkId, expires_in_seconds: 86400 }),
              });
              const data = await res.json() as { id?: string; url?: string };
              if (!data.id) return null;
              // Wrap in our own redirect endpoint — token ID + destination, not the raw Clerk URL
              return `https://munymo.com/api/magic?token=${encodeURIComponent(data.id)}&to=${encodeURIComponent(destination)}`;
            } catch { return null; }
          };

          for (const user of allUsers) {
            if (!user.email) continue;
            const scored = scoredMap.get(user.id);
            let subject: string;
            let html: string;

            // Generate two separate magic links — one per CTA
            const resultDest = `/game/${game.id}/result`;
            const playDest   = `/game`;
            const [resultMagicLink, playMagicLink] = await Promise.all([
              createMagicLink(user.clerkId, resultDest),
              createMagicLink(user.clerkId, playDest),
            ]);

            if (scored) {
              // User played — send score result
              ({ subject, html } = buildResultPublishedEmail({
                playerName: user.name,
                companyAName: game.companyAName,
                companyATicker: game.companyATicker,
                companyBName: game.companyBName,
                companyBTicker: game.companyBTicker,
                winner: input.winner!,
                predictionScore: scored.predictionScore,
                validationScore: scored.validationScore,
                totalScore: scored.totalScore,
                resultCommentary: input.resultSummary ?? "",
                gameDate: game.gameDate,
                resultMagicLink,
                magicLink: playMagicLink,
              }));
            } else {
              // User didn't play — send re-engagement email with result + next game teaser
              ({ subject, html } = buildMissedGameEmail({
                playerName: user.name,
                companyAName: game.companyAName,
                companyATicker: game.companyATicker,
                companyBName: game.companyBName,
                companyBTicker: game.companyBTicker,
                winner: input.winner!,
                gameDate: game.gameDate,
                nextCompanyAName: nextTicker?.aName ?? null,
                nextCompanyATicker: nextTicker?.a ?? null,
                nextCompanyBName: nextTicker?.bName ?? null,
                nextCompanyBTicker: nextTicker?.b ?? null,
                resultMagicLink,
                magicLink: playMagicLink,
              }));
            }
            const result = await import("./email").then((m) => m.sendEmail({ to: user.email!, subject, html }));
            if (result.success) emailsSent++; else emailsFailed++;
          }
          console.log(`[Email] End-of-day notifications: ${emailsSent} sent, ${emailsFailed} failed (${scoredPicks.length} players, ${allUsers.length - scoredPicks.length} non-players)`);
        } catch (err) {
          console.warn("[Email] End-of-day result notifications failed:", err);
        }
      }

      return { success: true, nextGameId: nextGame?.id };
    }),

  listPlayers: adminProcedure.query(async () => {
    return getAllUsers();
  }),

  resetPlayerPick: adminProcedure
    .input(z.object({ userId: z.number(), gameId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await import("./db").then((m) => m.getDb());
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { playerPicks } = await import("../drizzle/schema.js");
      const { and, eq } = await import("drizzle-orm");
      await db.delete(playerPicks).where(
        and(eq(playerPicks.userId, input.userId), eq(playerPicks.gameId, input.gameId))
      );
      return { success: true };
    }),

  listAllGames: adminProcedure
    .input(z.object({ limit: z.number().default(50), offset: z.number().default(0) }))
    .query(async ({ input }) => {
      return listGames(input.limit, input.offset);
    }),

  getGameDetail: adminProcedure
    .input(z.object({ gameId: z.number() }))
    .query(async ({ input }) => {
      const game = await getGameById(input.gameId);
      if (!game) throw new TRPCError({ code: "NOT_FOUND" });
      const research = await getResearchByGameId(input.gameId);
      const question = await getValidationQuestion(input.gameId);
      const picks = await getPicksForGame(input.gameId);
      const stats = await getCommunityStats(input.gameId);
      return { game, research, question, picks, stats };
    }),
});

// ─── Streak Helper ────────────────────────────────────────────────────────────

async function updateStreakForPlayer(userId: number, gameDate: string) {
  const streak = await getStreakForUser(userId);
  if (!streak) {
    await initStreakForUser(userId);
    await updateStreak(userId, 1, 1, gameDate);
    return;
  }
  const awayStatus = streak.awayStatus as "active" | "away" | "missing";
  const { newCurrent, newLongest, updated } = computeNewStreak(
    awayStatus,
    streak.lastParticipationDate,
    streak.currentStreak,
    streak.longestStreak,
    gameDate
  );
  // Away status: computeNewStreak returns updated=false, so we skip the DB write
  if (!updated) return;
  await updateStreak(userId, newCurrent, newLongest, gameDate);
}

// ─── Dashboard Router ───────────────────────────────────────────────────────────

const dashboardRouter = router({
  /** Get the current user's full profile including dashboard fields */
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const profile = await getUserById(ctx.user.id);
    return profile ?? null;
  }),

  /** Update the user's custom display name (max 64 chars) */
  updateDisplayName: protectedProcedure
    .input(z.object({ displayName: z.string().min(1).max(64).nullable() }))
    .mutation(async ({ ctx, input }) => {
      await updateUserProfile(ctx.user.id, { displayName: input.displayName });
      return { success: true };
    }),

  /** Toggle Away Status on/off */
  setAwayStatus: protectedProcedure
    .input(z.object({ active: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await updateUserProfile(ctx.user.id, {
        awayStatus: input.active,
        awayStatusUntil: input.active ? null : null,
      });
      return { success: true };
    }),

  /** Soft-delete the account — sets deactivated=true and signs the user out */
  deactivateAccount: protectedProcedure
    .input(z.object({ confirm: z.literal(true) }))
    .mutation(async ({ ctx }) => {
      await updateUserProfile(ctx.user.id, { deactivated: true });
      return { success: true };
    }),

  /** Get paginated game history for the dashboard */
  getHistory: protectedProcedure
    .input(z.object({ page: z.number().int().min(1).default(1), pageSize: z.number().int().min(1).max(50).default(20) }))
    .query(async ({ ctx, input }) => {
      const all = await getPlayerScoreHistory(ctx.user.id);
      const total = all.length;
      const start = (input.page - 1) * input.pageSize;
      const items = all.slice(start, start + input.pageSize);
      return { items, total, page: input.page, pageSize: input.pageSize, totalPages: Math.ceil(total / input.pageSize) };
    }),

  /** Get a summary of the user's stats for the dashboard */
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const [stat, streak, history] = await Promise.all([
      getLeaderboardStatForUser(ctx.user.id),
      getStreakForUser(ctx.user.id),
      getPlayerScoreHistory(ctx.user.id),
    ]);

    const totalGames = history.length;
    const correctPredictions = history.filter((h) => h.predictionScore > 0).length;
    const accuracy = totalGames > 0 ? Math.round((correctPredictions / totalGames) * 100) : 0;
    const totalScore = history.reduce((sum, h) => sum + (h.totalScore ?? 0), 0);
    const validationCorrect = history.filter((h) => (h.validationScore ?? 0) > 0).length;
    const validationAccuracy = totalGames > 0 ? Math.round((validationCorrect / totalGames) * 100) : 0;

    // Compute leaderboard rank from the full leaderboard
    const leaderboard = await getLeaderboard();
    const rankIndex = leaderboard.findIndex((entry) => entry.userId === ctx.user.id);
    const leaderboardRank = rankIndex >= 0 ? rankIndex + 1 : null;

    return {
      totalGames,
      accuracy,
      totalScore,
      validationAccuracy,
      currentStreak: streak?.currentStreak ?? 0,
      longestStreak: streak?.longestStreak ?? 0,
      awayStatus: streak?.awayStatus ?? "active",
      leaderboardRank,
      isQualified: stat ? isQualified(stat.gamesPlayed) : false,
      gamesPlayed: stat?.gamesPlayed ?? 0,
    };
  }),
});

// ─── Metrics Router ───────────────────────────────────────────────────────────

/**
 * Provides AI-generated plain-English explanations for research metrics.
 * Explanations are generated by LLM on first request and cached in the DB.
 */
const metricsRouter = router({
  /** Get (or generate) an explanation for a named metric */
  getExplanation: publicProcedure
    .input(z.object({ metricLabel: z.string().min(1).max(256) }))
    .query(async ({ input }) => {
      // 1. Check cache
      const cached = await getMetricExplanation(input.metricLabel);
      if (cached) return { explanation: cached.explanation, aiGenerated: cached.aiGenerated };

      // 2. Generate via LLM
      const { invokeLLM } = await import("./_core/llm");
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content:
              "You are a financial educator writing for beginner investors. " +
              "Explain financial metrics clearly, concisely, and without jargon. " +
              "Always include: what the metric measures, what a high vs low value typically signals, " +
              "and why it might matter when comparing two companies. " +
              "Write in a friendly, conversational tone. Keep it under 120 words.",
          },
          {
            role: "user",
            content: `Please explain the financial metric: "${input.metricLabel}"`,
          },
        ],
      });

      const explanation: string =
        (response as { choices?: Array<{ message?: { content?: string } }> })
          ?.choices?.[0]?.message?.content ?? "No explanation available.";

      // 3. Cache for future use
      await upsertMetricExplanation(input.metricLabel, explanation, true);

      return { explanation, aiGenerated: true };
    }),
});

// ─── App Router ───────────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    // Logout is handled client-side by Clerk; this endpoint exists for compatibility
    logout: publicProcedure.mutation(() => {
      return { success: true } as const;
    }),
  }),
  games: gamesRouter,
  picks: picksRouter,
  scores: scoresRouter,
  leaderboard: leaderboardRouter,
  streaks: streaksRouter,
  admin: adminRouter,
  dashboard: dashboardRouter,
  metrics: metricsRouter,
});

export type AppRouter = typeof appRouter;
