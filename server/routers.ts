import { TRPCError } from "@trpc/server";
import type Anthropic from "@anthropic-ai/sdk";
import { calculateScore, checkLockout, computeNewStreak, isQualified } from "./scoring";
import { hashEndpoint } from "./push";
import {
  broadcastEmail,
  buildFeedbackEmail,
  buildGameAvailableEmail,
  buildMissedGameEmail,
  buildResultPublishedEmail,
  FEEDBACK_ADDRESS,
  sendEmail,
} from "./email";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { ENV } from "./_core/env";
import { getSessionCookieOptions } from "./_core/cookies";
import { getClerkClient } from "./_core/context";
import { systemRouter } from "./_core/systemRouter";
import { referralRouter } from "./referralRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  computeAndStoreCommunityStats,
  createGame,
  eraseUserPersonalData,
  getAllUsers,
  getAuditLog,
  getCommunityStats,
  getGameById,
  getLeaderboard,
  getLeaderboardStatForUser,
  getProvisionalLeaderboard,
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
  updateWinLoseStreak,
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
  isKnownMetricLabel,
  countPublishedGameDaysBetween,
  recordOutboundClick,
  getOutboundClickStats,
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
          researchSummary: research.researchSummary ?? null,
          isSnapshot: true,
          metrics,
          hindsightSpotlight: game.hindsightSpotlight ?? null,
          winner: game.winner ?? null,
          winnerName: game.winner === "A" ? game.companyAName : game.winner === "B" ? game.companyBName : null,
        };
      }
      return { content: research.content, researchSummary: research.researchSummary ?? null, isSnapshot: false, metrics, hindsightSpotlight: null, winner: null, winnerName: null };
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

  // Fire-and-forget analytics: records a click on a daily-matchup source-article
  // link so we can report how much traffic Munymo sends publishers. Public so
  // logged-out visitors count too; attributes to ctx.user when signed in.
  recordOutboundClick: publicProcedure
    .input(
      z.object({
        gameId: z.number().optional(),
        publisher: z.string().max(128).optional(),
        sourceUrl: z.string().max(2048).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await recordOutboundClick({
        gameId: input.gameId ?? null,
        userId: ctx.user?.id ?? null,
        publisher: input.publisher ?? null,
        sourceUrl: input.sourceUrl ?? null,
      });
      return { ok: true };
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
      const game = await getGameById(input.gameId);
      if (!game) throw new TRPCError({ code: "NOT_FOUND", message: "Game not found" });
      if (game.status === "result_published" || game.status === "cancelled") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Game is already closed" });
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
      // Clamp implausible timing — no human answers in under 300ms (code-only guard)
      const sanitisedTimeMs = input.answerTimeMs < 300 ? 0 : input.answerTimeMs;
      await submitValidationAnswer(ctx.user.id, input.gameId, input.answer, sanitisedTimeMs);
      // Return isCorrect only — correctAnswer is not revealed until result_published
      const question = await getValidationQuestion(input.gameId);
      const isCorrect = question?.correctAnswer === input.answer;
      return { success: true, isCorrect };
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
  getProvisional: publicProcedure.query(async () => {
    return getProvisionalLeaderboard();
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
// Fetches OHLCV candlestick data server-side to avoid CORS. Yahoo Finance is
// tried first on both its query hosts with a real browser identity, but Yahoo
// hard-blocks datacenter egress IPs like Railway's, so Twelve Data (keyed via
// TWELVE_DATA_SECRET_KEY) is the fallback that actually serves production.
// (Stooq was evaluated as a keyless fallback and rejected: its CSV endpoint
// sits behind a JavaScript proof-of-work challenge, so server-side fetches get
// HTML, never data.)
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

async function fetchYahooOHLCV(
  ticker: string,
  range: string, // "1d" | "5d" | "1mo" | "3mo" | "6mo" | "1y"
  interval: string // "5m" | "1h" | "1d" | "1wk"
) {
  const hosts = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"];
  let res: Response | null = null;
  let lastErr: unknown = null;
  for (const host of hosts) {
    const url = `https://${host}/v8/finance/chart/${encodeURIComponent(ticker)}?range=${range}&interval=${interval}&includePrePost=false`;
    try {
      res = await fetch(url, {
        headers: { "User-Agent": BROWSER_UA, Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) break;
      lastErr = new Error(`Yahoo Finance (${host}) returned ${res.status}`);
      res = null;
    } catch (err) {
      lastErr = err;
      res = null;
    }
  }
  if (!res) {
    try {
      return await fetchTwelveDataOHLCV(ticker, range, interval);
    } catch (tdErr) {
      const yahooMsg = lastErr instanceof Error ? lastErr.message : String(lastErr);
      const tdMsg = tdErr instanceof Error ? tdErr.message : String(tdErr);
      throw new Error(`Yahoo: ${yahooMsg}; Twelve Data: ${tdMsg}`);
    }
  }
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

// Twelve Data fallback — keyed API, friendly to datacenter IPs. Free tier is
// 800 credits/day (1 per call); the client caches responses for 5 minutes.
async function fetchTwelveDataOHLCV(
  ticker: string,
  range: string, // "1d" | "5d" | "1mo" | "3mo" | "6mo" | "1y"
  interval: string // "5m" | "1h" | "1d" | "1wk"
) {
  if (!ENV.twelveDataApiKey) {
    throw new Error("TWELVE_DATA_SECRET_KEY not configured");
  }
  const intervalMap: Record<string, string> = { "5m": "5min", "1h": "1h", "1d": "1day", "1wk": "1week" };
  // Bars to request per range at its resolution (one session ≈ 78 five-minute
  // bars; 5d ≈ 35 hourly; the rest are daily/weekly counts + 1 for headroom)
  const sizeMap: Record<string, number> = { "1d": 78, "5d": 35, "1mo": 23, "3mo": 66, "6mo": 27, "1y": 53 };
  const tdInterval = intervalMap[interval] ?? "1day";
  const outputsize = sizeMap[range] ?? 66;
  const url =
    `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(ticker)}` +
    `&interval=${tdInterval}&outputsize=${outputsize}&timezone=UTC&order=ASC` +
    `&apikey=${encodeURIComponent(ENV.twelveDataApiKey)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Twelve Data returned ${res.status}`);
  const json = (await res.json()) as {
    status?: string;
    message?: string;
    meta?: { currency?: string };
    values?: Array<{ datetime: string; open: string; high: string; low: string; close: string; volume?: string }>;
  };
  if (json.status === "error" || !Array.isArray(json.values) || json.values.length === 0) {
    throw new Error(json.message ?? `no data for ${ticker}`);
  }
  const candles = json.values
    .map((v) => ({
      // Intraday datetimes are "YYYY-MM-DD HH:mm:ss" (UTC, per &timezone=UTC);
      // daily/weekly are bare "YYYY-MM-DD"
      time: Math.floor(
        Date.parse(v.datetime.includes(" ") ? `${v.datetime.replace(" ", "T")}Z` : `${v.datetime}T00:00:00Z`) / 1000
      ),
      open: parseFloat(v.open),
      high: parseFloat(v.high),
      low: parseFloat(v.low),
      close: parseFloat(v.close),
      volume: v.volume != null ? parseFloat(v.volume) : null,
    }))
    .filter((c) => Number.isFinite(c.time) && Number.isFinite(c.open) && Number.isFinite(c.close))
    .sort((a, b) => a.time - b.time); // lightweight-charts requires ascending time
  if (candles.length === 0) throw new Error(`no usable rows for ${ticker}`);
  const lastClose = candles[candles.length - 1].close;
  return { candles, meta: { currency: json.meta?.currency ?? "USD", regularMarketPrice: lastClose } };
}

// ─── Shared close-game logic (T5) ─────────────────────────────────────────────
/**
 * Single source of truth for closing and scoring a game.
 * Called by both publishResult (admin manual) and endOfDay (cron automated).
 * Returns the scored picks so callers can send notifications.
 */
async function closeAndScoreGame(
  gameId: number,
  opts: {
    winner: "A" | "B";
    companyAPerf?: number;
    companyBPerf?: number;
    companyAStartPrice?: number;
    companyAEndPrice?: number;
    companyBStartPrice?: number;
    companyBEndPrice?: number;
    resultSummary?: string;
    hindsightSpotlight?: string;
    resultCommentary?: string;
  }
): Promise<Array<{ userId: number; predictionScore: number; validationScore: number; totalScore: number }>> {
  const game = await getGameById(gameId);
  if (!game) throw new TRPCError({ code: "NOT_FOUND", message: "Game not found" });
  if (game.status === "result_published") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Result already published" });
  }
  if (game.status === "cancelled") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot publish result for cancelled game" });
  }

  // 1. Auto-submit: players who made a Gut Selection but no Final Selection
  //    have their gut copied to final at lockout — per founder Decision 1.
  const db = await import("./db").then((m) => m.getDb());
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  const { playerPicks: playerPicksTable } = await import("../drizzle/schema.js");
  const { sql: drizzleSql, and: drizzleAnd, eq: drizzleEq, isNull, isNotNull } = await import("drizzle-orm");
  await db.update(playerPicksTable)
    .set({ finalSelection: drizzleSql`${playerPicksTable.gutSelection}`, finalSubmittedAt: new Date() })
    .where(
      drizzleAnd(
        drizzleEq(playerPicksTable.gameId, gameId),
        isNotNull(playerPicksTable.gutSelection),
        isNull(playerPicksTable.finalSelection)
      )
    );

  // 2. Lock all picks
  await lockPicksForGame(gameId);

  // 3. Snapshot research
  await snapshotResearch(gameId);

  // 4. Score all participants
  const question = await getValidationQuestion(gameId);
  const picks = await getPicksForGame(gameId);
  const scoredPicks: Array<{ userId: number; predictionScore: number; validationScore: number; totalScore: number }> = [];

  for (const pick of picks) {
    if (!pick.finalSelection) continue;
    // Retry-safety: if this player already has a score row for this game (a
    // prior run got partway through before failing), still refresh the score
    // but skip the streak update — it already ran once and would otherwise
    // double-increment on retry.
    const alreadyScored = await getPlayerScoreForGame(pick.userId, gameId);
    const { predictionScore, validationScore } = calculateScore(
      pick.finalSelection,
      opts.winner,
      pick.validationAnswer,
      question?.correctAnswer ?? "",
      pick.validationAnswerTimeMs
    );
    await insertDailyScore(pick.userId, gameId, predictionScore, validationScore);
    scoredPicks.push({ userId: pick.userId, predictionScore, validationScore, totalScore: predictionScore + validationScore });

    // 5. Update leaderboard and streaks
    await upsertLeaderboardStat(pick.userId);
    if (!alreadyScored) {
      await updateStreakForPlayer(pick.userId, game.gameDate, pick.finalSelection === opts.winner);
    }
  }

  // 6. Compute community stats
  await computeAndStoreCommunityStats(gameId);

  // 7. Mark game as result_published
  await updateGame(gameId, {
    status: "result_published",
    winner: opts.winner,
    companyAPerf: opts.companyAPerf !== undefined ? String(opts.companyAPerf) : undefined,
    companyBPerf: opts.companyBPerf !== undefined ? String(opts.companyBPerf) : undefined,
    companyAStartPrice: opts.companyAStartPrice !== undefined ? String(opts.companyAStartPrice) : undefined,
    companyAEndPrice: opts.companyAEndPrice !== undefined ? String(opts.companyAEndPrice) : undefined,
    companyBStartPrice: opts.companyBStartPrice !== undefined ? String(opts.companyBStartPrice) : undefined,
    companyBEndPrice: opts.companyBEndPrice !== undefined ? String(opts.companyBEndPrice) : undefined,
    resultSummary: opts.resultSummary,
    hindsightSpotlight: opts.hindsightSpotlight,
    resultCommentary: opts.resultCommentary,
    publishedAt: new Date(),
  });

  return scoredPicks;
}

// ─── Admin Router ─────────────────────────────────────────────────────────────

const adminRouter = router({
  // Outbound-referral reporting: total clicks sent to publishers + per-publisher
  // breakdown. Ammunition for "we sent you N thousand readers" partnership pitches.
  outboundClickStats: adminProcedure.query(async () => {
    return getOutboundClickStats();
  }),

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
        const players = allUsers.filter((u) => u.role !== "admin" && u.emailOptIn !== false);
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
        sourceUrl: z.string().optional(),
        sourceTitle: z.string().max(256).optional(),
        sourcePublisher: z.string().max(128).optional(),
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
    .input(z.object({ gameId: z.number(), content: z.string().min(1), summary: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const game = await getGameById(input.gameId);
      if (!game) throw new TRPCError({ code: "NOT_FOUND" });
      if (game.status === "result_published" || game.status === "cancelled") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot edit research for a closed game" });
      }
      await upsertResearch(input.gameId, input.content, input.summary);
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
        companyAStartPrice: z.number().optional(),
        companyAEndPrice: z.number().optional(),
        companyBStartPrice: z.number().optional(),
        companyBEndPrice: z.number().optional(),
        resultSummary: z.string().optional(),
        hindsightSpotlight: z.string().optional(),
        resultCommentary: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const game = await getGameById(input.gameId);
      if (!game) throw new TRPCError({ code: "NOT_FOUND" });

      const scoredPicks = await closeAndScoreGame(input.gameId, {
        winner: input.winner,
        companyAPerf: input.companyAPerf,
        companyBPerf: input.companyBPerf,
        companyAStartPrice: input.companyAStartPrice,
        companyAEndPrice: input.companyAEndPrice,
        companyBStartPrice: input.companyBStartPrice,
        companyBEndPrice: input.companyBEndPrice,
        resultSummary: input.resultSummary,
        hindsightSpotlight: input.hindsightSpotlight,
        resultCommentary: input.resultCommentary,
      });

      await writeAuditLog(
        ctx.user.id,
        "publish_result",
        "game",
        input.gameId,
        JSON.stringify({ winner: input.winner })
      );

      // Send personalised result emails to each participant
      try {
        const allUsers = await getAllUsers();
        const userMap = new Map(allUsers.map((u) => [u.id, u]));
        let emailsSent = 0;
        let emailsFailed = 0;
        for (const scored of scoredPicks) {
          const user = userMap.get(scored.userId);
          if (!user?.email) { emailsFailed++; continue; }
          if (user.emailOptIn === false) { continue; }
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
        companyAStartPrice: z.number().optional(),
        companyAEndPrice: z.number().optional(),
        companyBStartPrice: z.number().optional(),
        companyBEndPrice: z.number().optional(),
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
        // The article that supplied the "buzz" signal for this matchup.
        nextSourceUrl: z.string().optional(),
        nextSourceTitle: z.string().optional(),
        nextSourcePublisher: z.string().optional(),
        nextLockoutAt: z.string().datetime().optional(),
        // ── Tomorrow's research ──
        nextResearchContent: z.string().optional(),
        nextResearchSummary: z.string().optional(),
        nextResearchMetrics: z.record(z.string(), z.string()).optional(),
        // ── Tomorrow's validation question ──
        nextQuestionType: z.enum(["multiple_choice", "yes_no", "true_false"]).optional(),
        nextQuestionText: z.string().optional(),
        nextQuestionOptions: z.array(z.string()).optional(),
        nextCorrectAnswer: z.string().optional(),
      })
      .refine((d) => !d.closeGameId || d.winner !== undefined, {
        message: "winner is required when closeGameId is set",
        path: ["winner"],
      })
    )
    .mutation(async ({ ctx, input }) => {
      // ── 1. Close today's game (skipped if no closeGameId — Game 1 / first game) ──
      let game: Awaited<ReturnType<typeof getGameById>> | null = null;
      let winner: "A" | "B" | undefined;
      const scoredPicks: Array<{ userId: number; predictionScore: number; validationScore: number; totalScore: number }> = [];

      if (input.closeGameId) {
        if (input.winner === undefined) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "winner is required when closeGameId is set" });
        }
        winner = input.winner;
        game = await getGameById(input.closeGameId);
        if (!game) throw new TRPCError({ code: "NOT_FOUND", message: "Game not found" });

        const closed = await closeAndScoreGame(input.closeGameId, {
          winner,
          companyAPerf: input.companyAPerf,
          companyBPerf: input.companyBPerf,
          companyAStartPrice: input.companyAStartPrice,
          companyAEndPrice: input.companyAEndPrice,
          companyBStartPrice: input.companyBStartPrice,
          companyBEndPrice: input.companyBEndPrice,
          resultSummary: input.resultSummary,
          hindsightSpotlight: input.hindsightSpotlight,
        });
        scoredPicks.push(...closed);
      }

      // ── 2. Create tomorrow's game — unless a game for that date already exists ──
      // A non-cancelled game for this date can already exist when an earlier run
      // curated ahead (e.g. a manual recovery run left the schedule a day ahead of
      // itself). Do NOT create a duplicate and do NOT error: the concluded game has
      // already been closed above, which is the important work. No-op the creation
      // and reuse the existing game as "tomorrow's game" for teasers/notifications,
      // so a valid close is never lost to a CONFLICT. Still prevents pileups —
      // nothing new is inserted.
      const existingNextGame = await getTodayGame(input.nextGameDate);
      const nextGameAlreadyExists = !!existingNextGame && existingNextGame.status !== "cancelled";
      const nextGameCreated = !nextGameAlreadyExists;

      let nextGameId: number;
      if (nextGameAlreadyExists) {
        console.warn(
          `[endOfDay] A game already exists for ${input.nextGameDate} (id ${existingNextGame!.id}, ${existingNextGame!.status}) — skipping creation; the close was still applied.`
        );
        nextGameId = existingNextGame!.id;
      } else {
        nextGameId = await createGame({
          gameDate: input.nextGameDate,
          exchange: input.nextExchange,
          companyAName: input.nextCompanyAName,
          companyATicker: input.nextCompanyATicker,
          companyBName: input.nextCompanyBName,
          companyBTicker: input.nextCompanyBTicker,
          sector: input.nextSector,
          pairingRationale: input.nextPairingRationale,
          sourceUrl: input.nextSourceUrl,
          sourceTitle: input.nextSourceTitle,
          sourcePublisher: input.nextSourcePublisher,
          lockoutAt: input.nextLockoutAt ? new Date(input.nextLockoutAt) : undefined,
          createdBy: ctx.user.id,
          status: "active",
        });

        if (input.nextResearchContent) {
          const metricsArray = input.nextResearchMetrics
            ? Object.entries(input.nextResearchMetrics).map(([label, value]) => ({ label, value: String(value) }))
            : [];
          await upsertResearchWithMetrics(nextGameId, input.nextResearchContent, metricsArray, input.nextResearchSummary);
        }
        if (input.nextQuestionType && input.nextQuestionText && input.nextCorrectAnswer) {
          await upsertValidationQuestion(nextGameId, {
            questionType: input.nextQuestionType,
            questionText: input.nextQuestionText,
            options: input.nextQuestionOptions,
            correctAnswer: input.nextCorrectAnswer,
          });
        }
      }

      await writeAuditLog(ctx.user.id, "end_of_day", "game", input.closeGameId ?? 0, JSON.stringify({ winner: input.winner, nextGameDate: input.nextGameDate }));

      // ── 3. Send result emails to ALL registered users (only if a game was closed) ──
      // Players who participated get a score summary; non-players get a re-engagement email.
      if (game) {
        // `game` and `winner` are always set together above, so this is safe.
        const closedWinner = winner as "A" | "B";
        const allUsers = await getAllUsers();
        try {
          const scoredMap = new Map(scoredPicks.map((s) => [s.userId, s]));
          // Build next-game teaser data — must reflect the ACTUAL next game, i.e.
          // the pre-existing one if we skipped creation (not the discarded proposal).
          const nextTicker = nextGameCreated
            ? { a: input.nextCompanyATicker, b: input.nextCompanyBTicker, aName: input.nextCompanyAName, bName: input.nextCompanyBName }
            : { a: existingNextGame!.companyATicker, b: existingNextGame!.companyBTicker, aName: existingNextGame!.companyAName, bName: existingNextGame!.companyBName };
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
            if (user.emailOptIn === false) continue;
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
                winner: closedWinner,
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
                winner: closedWinner,
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

        // ── 4. Send push notifications to all subscribed users (respecting pushOptIn) ──
        try {
          const { sendPushToUsers } = await import("./push");
          const optedInUserIds = allUsers.filter((u) => u.pushOptIn !== false).map((u) => u.id);
          const winnerTicker = input.winner === "A" ? game.companyATicker : game.companyBTicker;
          const loserTicker = input.winner === "A" ? game.companyBTicker : game.companyATicker;
          const pushResult = await sendPushToUsers(optedInUserIds, {
            title: `Results are in: ${winnerTicker} beats ${loserTicker}`,
            body: input.resultSummary
              ? input.resultSummary.slice(0, 120) + (input.resultSummary.length > 120 ? "…" : "")
              : `See how the community voted and check your score.`,
            url: `/game/${game.id}/result`,
            tag: `munymo-result-${game.id}`,
          });
          console.log(`[Push] Result notifications: ${pushResult.sent} sent, ${pushResult.expired} expired, ${pushResult.errors} errors`);
        } catch (err) {
          console.warn("[Push] End-of-day push notifications failed:", err);
        }
      }

      // ── 5. Send push notification for new game availability (respecting pushOptIn) ──
      // Only when we actually created a new game — if we reused a pre-existing one
      // it was already announced when it was first created; re-announcing it (and
      // with the discarded proposal's tickers) would be wrong.
      if (nextGameCreated) {
        try {
          const { sendPushToUsers } = await import("./push");
          const optedInIds = (await getAllUsers()).filter((u) => u.pushOptIn !== false).map((u) => u.id);
          await sendPushToUsers(optedInIds, {
            title: `Today's game is live: ${input.nextCompanyATicker} vs ${input.nextCompanyBTicker}`,
            body: input.nextSector
              ? `${input.nextCompanyAName} vs ${input.nextCompanyBName} — ${input.nextSector}. Make your pick before lockout!`
              : `${input.nextCompanyAName} vs ${input.nextCompanyBName}. Make your pick before lockout!`,
            url: `/game`,
            tag: `munymo-game-${nextGameId}`,
          });
        } catch (err) {
          console.warn("[Push] New game push notification failed:", err);
        }
      }

      return { success: true, nextGameId, nextGameCreated };
    }),

  listPlayers: adminProcedure.query(async () => {
    return getAllUsers();
  }),

  resetPlayerPick: adminProcedure
    .input(z.object({ userId: z.number(), gameId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await import("./db").then((m) => m.getDb());
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { playerPicks } = await import("../drizzle/schema.js");
      const { and, eq } = await import("drizzle-orm");
      await db.delete(playerPicks).where(
        and(eq(playerPicks.userId, input.userId), eq(playerPicks.gameId, input.gameId))
      );
      await writeAuditLog(ctx.user.id, "reset_player_pick", "game", input.gameId, JSON.stringify({ targetUserId: input.userId }));
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

  // Send a test push notification to the calling admin's own devices.
  // Used to verify VAPID keys and subscriptions end-to-end without waiting
  // for a real end-of-day run.
  sendTestPush: adminProcedure.mutation(async ({ ctx }) => {
    const { sendPushToUsers } = await import("./push");
    const result = await sendPushToUsers([ctx.user.id], {
      title: "Munymo test notification",
      body: "If you can see this, push notifications are working. 🎉",
      url: "/",
      tag: "munymo-test-push",
    });
    return result;
  }),
});

// ─── Streak Helper ────────────────────────────────────────────────────────────

async function updateStreakForPlayer(userId: number, gameDate: string, isCorrect: boolean) {
  const streak = await getStreakForUser(userId);
  if (!streak) {
    await initStreakForUser(userId);
    await updateStreak(userId, 1, 1, gameDate);
    // New user: set win/lose streaks from first result
    const newWinStreak = isCorrect ? 1 : 0;
    const newLoseStreak = isCorrect ? 0 : 1;
    await updateWinLoseStreak(userId, newWinStreak, newWinStreak, newLoseStreak);
    return;
  }
  const awayStatus = streak.awayStatus as "active" | "away" | "missing";
  // Count published game days strictly between last participation and today.
  // A gap of 0 means only non-trading days (weekends/holidays) were skipped
  // and the streak should increment, not reset (T1 fix).
  const missedTradingDays = streak.lastParticipationDate
    ? await countPublishedGameDaysBetween(streak.lastParticipationDate, gameDate)
    : 0;
  const { newCurrent, newLongest } = computeNewStreak(
    awayStatus,
    streak.lastParticipationDate,
    streak.currentStreak,
    streak.longestStreak,
    gameDate,
    missedTradingDays
  );
  await updateStreak(userId, newCurrent, newLongest, gameDate);
  // Update win/lose streaks
  const freshStreak = await getStreakForUser(userId);
  if (freshStreak) {
    const newWinStreak = isCorrect ? (freshStreak.currentWinStreak ?? 0) + 1 : 0;
    const newLoseStreak = isCorrect ? 0 : (freshStreak.currentLoseStreak ?? 0) + 1;
    const newLongestWin = Math.max(newWinStreak, freshStreak.longestWinStreak ?? 0);
    await updateWinLoseStreak(userId, newWinStreak, newLongestWin, newLoseStreak);
  }
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
      // Write to streak_records.awayStatus — the canonical field the streak engine reads
      const streakStatus = input.active ? "away" : "active";
      await setAwayStatus(ctx.user.id, streakStatus, ctx.user.id);
      // Keep users.awayStatus in sync for display purposes
      await updateUserProfile(ctx.user.id, { awayStatus: input.active });
      return { success: true };
    }),

  /** Update email/push notification opt-in preferences */
  setNotificationPrefs: protectedProcedure
    .input(z.object({
      emailOptIn: z.boolean().optional(),
      pushOptIn: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const data: { emailOptIn?: boolean; pushOptIn?: boolean } = {};
      if (input.emailOptIn !== undefined) data.emailOptIn = input.emailOptIn;
      if (input.pushOptIn !== undefined) data.pushOptIn = input.pushOptIn;
      await updateUserProfile(ctx.user.id, data);
      return { success: true };
    }),

  /** Soft-delete the account — sets deactivated=true and signs the user out */
  deactivateAccount: protectedProcedure
    .input(z.object({ confirm: z.literal(true) }))
    .mutation(async ({ ctx }) => {
      await updateUserProfile(ctx.user.id, { deactivated: true });
      return { success: true };
    }),

  /**
   * Permanently erase the account — the right-to-erasure path promised by the
   * privacy policy ("if you delete your account, we will remove your personal
   * data"). Distinct from deactivateAccount, which is reversible and keeps
   * everything.
   *
   * Clerk is deleted FIRST and our row scrubbed second, because Clerk holds the
   * authoritative copy of the email, name and credentials. If Clerk deletion
   * fails we abort having changed nothing, so the user can simply retry. The
   * reverse order would risk scrubbing our row — including the clerkId needed to
   * find them again — while their identity lived on in Clerk, unreachable.
   *
   * Game history is intentionally retained: it references the user only by
   * integer id, so it survives as anonymous data.
   */
  deleteAccount: protectedProcedure
    .input(z.object({ confirm: z.literal(true) }))
    .mutation(async ({ ctx }) => {
      const userId = ctx.user.id;
      const { clerkId } = ctx.user;

      if (clerkId) {
        const clerk = getClerkClient();
        if (!clerk) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message:
              "Account deletion is unavailable right now. Nothing has been changed — please contact us.",
          });
        }
        try {
          await clerk.users.deleteUser(clerkId);
        } catch (err) {
          console.error("[deleteAccount] Clerk deletion failed; aborting before local erasure. userId:", userId, err);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message:
              "We couldn't delete your account just now. Nothing has been changed — please try again.",
          });
        }
      }

      try {
        await eraseUserPersonalData(userId);
      } catch (err) {
        // Clerk identity is already gone, so the account is inaccessible, but
        // personal data is still in our database. This needs manual completion —
        // log loudly rather than reporting a success we didn't achieve.
        console.error(
          "[deleteAccount] ERASURE INCOMPLETE — Clerk user deleted but database scrub failed. Personal data remains for userId:",
          userId,
          err
        );
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "Your sign-in was removed, but we hit an error clearing your data. Please contact us so we can finish it.",
        });
      }

      return { success: true };
    }),

  /** Get a summary of the user's stats for the dashboard */
  getStats: protectedProcedure.query(async ({ ctx }) => {
    console.log("[dashboard.getStats] userId:", ctx.user.id);

    // Fetch history and leaderboard stat together; fetch streak separately so a
    // schema-migration lag (missing win/lose columns) cannot kill the whole query.
    const [stat, history] = await Promise.all([
      getLeaderboardStatForUser(ctx.user.id),
      getPlayerScoreHistory(ctx.user.id),
    ]);

    console.log("[dashboard.getStats] history.length:", history.length);

    // Streak is fetched in isolation — if the DB columns don't exist yet (e.g.
    // pnpm db:push hasn't been run after a schema change) this won't crash stats.
    let streak: Awaited<ReturnType<typeof getStreakForUser>> | null = null;
    try {
      streak = (await getStreakForUser(ctx.user.id)) ?? null;
    } catch (err) {
      console.warn("[dashboard.getStats] streak fetch failed (schema migration pending?):", err);
    }

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
      currentWinStreak: streak?.currentWinStreak ?? 0,
      longestWinStreak: streak?.longestWinStreak ?? 0,
      currentLoseStreak: streak?.currentLoseStreak ?? 0,
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
      // 1. Static, hand-written explanation for the standard metrics — instant,
      // no DB round trip, no LLM call. Covers every metric the curation agent
      // produces (labels are ticker-prefixed, matched by suffix).
      const { getStaticMetricExplanation } = await import("./_core/metricExplanations");
      const staticExplanation = getStaticMetricExplanation(input.metricLabel);
      if (staticExplanation) return { explanation: staticExplanation, aiGenerated: false };

      // 2. Check cache (for any previously-generated one-off/custom labels)
      const cached = await getMetricExplanation(input.metricLabel);
      if (cached) return { explanation: cached.explanation, aiGenerated: cached.aiGenerated };

      // 3. Reject unknown labels — only generate for metrics that exist in game research
      const known = await isKnownMetricLabel(input.metricLabel);
      if (!known) return { explanation: "No explanation available.", aiGenerated: false };

      // 4. Generate via Claude (rare — only reached for custom/admin-entered labels)
      if (!ENV.anthropicApiKey) {
        console.error("[metrics.getExplanation] ANTHROPIC_API_KEY is not configured");
        return { explanation: "No explanation available.", aiGenerated: false };
      }

      let explanation: string;
      try {
        const { default: AnthropicClient } = await import("@anthropic-ai/sdk");
        const client = new AnthropicClient({ apiKey: ENV.anthropicApiKey });
        const response = await client.messages.create({
          model: "claude-opus-4-8",
          max_tokens: 400,
          system:
            "You are a financial educator writing for beginner investors. " +
            "Explain financial metrics clearly, concisely, and without jargon. " +
            "Always include: what the metric measures, what a high vs low value typically signals, " +
            "and why it might matter when comparing two companies. " +
            "Write in a friendly, conversational tone. Keep it under 120 words.",
          messages: [
            { role: "user", content: `Please explain the financial metric: "${input.metricLabel}"` },
          ],
        });
        const textBlock = response.content.find(
          (b): b is Anthropic.TextBlock => b.type === "text"
        );
        explanation = textBlock?.text?.trim() || "No explanation available.";
      } catch (err) {
        console.error("[metrics.getExplanation] Claude call failed:", err);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not generate explanation" });
      }

      // 5. Cache for future use
      await upsertMetricExplanation(input.metricLabel, explanation, true);

      return { explanation, aiGenerated: true };
    }),
});

// ─── Push Notifications Router ──────────────────────────────────────────────

const pushRouter = router({
  /** Subscribe this device to push notifications */
  subscribe: protectedProcedure
    .input(
      z.object({
        endpoint: z.string().url(),
        p256dh: z.string(),
        auth: z.string(),
        userAgent: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await import("./db").then((m) => m.getDb());
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { pushSubscriptions } = await import("../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");
      const endpointHash = hashEndpoint(input.endpoint);
      // Upsert: update if same device re-subscribes (keys may rotate)
      const existing = await db
        .select({ id: pushSubscriptions.id })
        .from(pushSubscriptions)
        .where(
          and(
            eq(pushSubscriptions.userId, ctx.user.id),
            eq(pushSubscriptions.endpointHash, endpointHash)
          )
        )
        .limit(1);
      if (existing.length > 0) {
        await db
          .update(pushSubscriptions)
          .set({ p256dh: input.p256dh, auth: input.auth, userAgent: input.userAgent })
          .where(eq(pushSubscriptions.id, existing[0].id));
      } else {
        await db.insert(pushSubscriptions).values({
          userId: ctx.user.id,
          endpoint: input.endpoint,
          endpointHash,
          p256dh: input.p256dh,
          auth: input.auth,
          userAgent: input.userAgent,
        });
      }
      // Registering a device is an explicit opt-in — clear any stale
      // pushOptIn=false so end-of-day broadcasts actually reach this user.
      const { users } = await import("../drizzle/schema");
      await db.update(users).set({ pushOptIn: true }).where(eq(users.id, ctx.user.id));
      return { ok: true };
    }),

  /** Unsubscribe this device */
  unsubscribe: protectedProcedure
    .input(z.object({ endpoint: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await import("./db").then((m) => m.getDb());
      if (!db) return { ok: true };
      const { pushSubscriptions } = await import("../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");
      const endpointHash = hashEndpoint(input.endpoint);
      await db
        .delete(pushSubscriptions)
        .where(
          and(
            eq(pushSubscriptions.userId, ctx.user.id),
            eq(pushSubscriptions.endpointHash, endpointHash)
          )
        );
      return { ok: true };
    }),

  /** Check if this user has any active push subscriptions */
  status: protectedProcedure.query(async ({ ctx }) => {
    const db = await import("./db").then((m) => m.getDb());
    if (!db) return { subscribed: false, count: 0 };
    const { pushSubscriptions } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const subs = await db
      .select({ id: pushSubscriptions.id })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, ctx.user.id));
    return { subscribed: subs.length > 0, count: subs.length };
  }),

  /** VAPID public key — needed by the browser to subscribe */
  vapidPublicKey: publicProcedure.query(() => {
    return { key: process.env.VAPID_PUBLIC_KEY ?? "" };
  }),
});

// ─── Feedback Router ──────────────────────────────────────────────────────────

// Per-user cooldown so a stuck retry loop (or mischief) can't flood the
// feedback inbox. In-memory is fine: single Railway instance, and losing the
// cooldown on restart is harmless.
const FEEDBACK_COOLDOWN_MS = 60_000;
const lastFeedbackAt = new Map<number, number>();

const feedbackRouter = router({
  submit: protectedProcedure
    .input(z.object({ message: z.string().trim().min(3).max(5000) }))
    .mutation(async ({ ctx, input }) => {
      const prev = lastFeedbackAt.get(ctx.user.id);
      if (prev && Date.now() - prev < FEEDBACK_COOLDOWN_MS) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Please wait a minute before sending more feedback.",
        });
      }

      const { subject, html } = buildFeedbackEmail({
        playerName: ctx.user.displayName ?? ctx.user.name,
        email: ctx.user.email,
        userId: ctx.user.id,
        message: input.message,
      });
      const result = await sendEmail({ to: FEEDBACK_ADDRESS, subject, html });
      if (!result.success) {
        // Be honest with the player rather than swallowing a lost message.
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Your feedback couldn't be sent right now — please try again shortly.",
        });
      }
      lastFeedbackAt.set(ctx.user.id, Date.now());
      return { ok: true } as const;
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
  push: pushRouter,
  referral: referralRouter,
  feedback: feedbackRouter,
});
export type AppRouter = typeof appRouter;
