import { TRPCError } from "@trpc/server";
import { calculateScore, checkLockout, computeNewStreak, isQualified } from "./scoring";
import {
  broadcastEmail,
  buildGameAvailableEmail,
  buildResultPublishedEmail,
} from "./email";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
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
  getPicksForGame,
  getPlayerPick,
  getPlayerScoreForGame,
  getPlayerScoreHistory,
  getResearchByGameId,
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
  updateGame,
  updateStreak,
  upsertFinalSelection,
  upsertGutSelection,
  upsertLeaderboardStat,
  upsertResearch,
  upsertValidationQuestion,
  writeAuditLog,
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
    const game = await getTodayGame(todayUTC());
    if (!game || game.status === "draft" || game.status === "cancelled") return null;
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
      if (game.status === "result_published" && research.researchSnapshot) {
        return { content: research.researchSnapshot, isSnapshot: true };
      }
      return { content: research.content, isSnapshot: false };
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
      return getCommunityStats(input.gameId);
    }),
});

// ─── Picks Router ─────────────────────────────────────────────────────────────

const picksRouter = router({
  getMyPick: protectedProcedure
    .input(z.object({ gameId: z.number() }))
    .query(async ({ ctx, input }) => {
      return getPlayerPick(ctx.user.id, input.gameId);
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
        validationAnswer: z.string().min(1),
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
      await upsertFinalSelection(
        ctx.user.id,
        input.gameId,
        input.selection,
        input.validationAnswer
      );
      return { success: true };
    }),
});

// ─── Scores Router ────────────────────────────────────────────────────────────

const scoresRouter = router({
  getMyScoreForGame: protectedProcedure
    .input(z.object({ gameId: z.number() }))
    .query(async ({ ctx, input }) => {
      return getPlayerScoreForGame(ctx.user.id, input.gameId);
    }),

  getMyHistory: protectedProcedure.query(async ({ ctx }) => {
    return getPlayerScoreHistory(ctx.user.id);
  }),

  getMyLeaderboardStat: protectedProcedure.query(async ({ ctx }) => {
    return getLeaderboardStatForUser(ctx.user.id);
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
    return getStreakForUser(ctx.user.id);
  }),
});

// ─── Admin Router ─────────────────────────────────────────────────────────────

const adminRouter = router({
  createGame: adminProcedure
    .input(
      z.object({
        gameDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
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

  listPlayers: adminProcedure.query(async () => {
    return getAllUsers();
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

// ─── App Router ───────────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  games: gamesRouter,
  picks: picksRouter,
  scores: scoresRouter,
  leaderboard: leaderboardRouter,
  streaks: streaksRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
