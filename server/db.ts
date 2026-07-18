import { and, asc, desc, eq, gt, lt, lte, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  adminAuditLog,
  dailyGames,
  dailyScores,
  gameCommunityStats,
  gameResearch,
  leaderboardStats,
  lessonProgress,
  metricExplanations,
  outboundClicks,
  playerPicks,
  pushSubscriptions,
  streakRecords,
  users,
  validationQuestions,
  type InsertOutboundClick,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db) {
    const url = ENV.databaseUrl; // prefers MUNYMO_DATABASE_URL over platform DATABASE_URL
    if (url) {
      try {
        _db = drizzle(url);
      } catch (error) {
        console.warn("[Database] Failed to connect:", error);
        _db = null;
      }
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    const value = user[field];
    if (value === undefined) continue;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  }

  values.lastSignedIn = user.lastSignedIn ?? new Date();
  updateSet.lastSignedIn = values.lastSignedIn;

  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  if (Object.keys(updateSet).length === 0) {
    updateSet.lastSignedIn = new Date();
  }

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getUserByClerkId(clerkId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  return result[0];
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

export async function upsertUserByClerkId(user: {
  clerkId: string;
  name?: string | null;
  email?: string | null;
  loginMethod?: string | null;
  lastSignedIn?: Date;
  role?: "user" | "admin";
}): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { clerkId: user.clerkId };
  const updateSet: Record<string, unknown> = {};

  if (user.name !== undefined) { values.name = user.name; updateSet.name = user.name; }
  if (user.email !== undefined) { values.email = user.email; updateSet.email = user.email; }
  if (user.loginMethod !== undefined) { values.loginMethod = user.loginMethod; updateSet.loginMethod = user.loginMethod; }

  values.lastSignedIn = user.lastSignedIn ?? new Date();
  updateSet.lastSignedIn = values.lastSignedIn;

  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  }

  if (Object.keys(updateSet).length === 0) {
    updateSet.lastSignedIn = new Date();
  }

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function updateUserProfile(userId: number, data: {
  displayName?: string | null;
  awayStatus?: boolean;
  awayStatusUntil?: Date | null;
  deactivated?: boolean;
  tier?: "free" | "premium";
  emailOptIn?: boolean;
  pushOptIn?: boolean;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set(data).where(eq(users.id, userId));
}

/**
 * Every personal-data column on `users`, and the value erasure resets it to.
 *
 * Named rather than inlined so the test suite can assert it covers every
 * personal column on the table — add a personal field to `users` and forget it
 * here, and that test fails rather than the field silently surviving erasure.
 *
 * Columns absent from this list carry no identity once these are cleared:
 * `id` is an opaque integer, and role/tier/streak timestamps say nothing about
 * who the person was.
 */
export const ERASED_USER_FIELDS = {
  clerkId: null,
  openId: null,
  name: null,
  displayName: null,
  email: null,
  loginMethod: null,
  // Nothing left to send to, and no lawful basis to keep the opt-in.
  emailOptIn: false,
  pushOptIn: false,
  // Blocks sign-in via the legacy openId path even if a row is somehow matched.
  deactivated: true,
} as const;

/**
 * Irreversibly strip personal data from a user row and drop their push
 * subscriptions (an endpoint URL identifies a device, so it is personal data).
 *
 * The row itself is deliberately kept. Picks, scores, streaks and leaderboard
 * stats reference the user only by integer id, so leaving the scrubbed row in
 * place keeps game history intact but anonymous — which is what the privacy
 * policy reserves the right to retain — without cascading deletes across half
 * the schema.
 *
 * Idempotent: running it again on an already-erased row is a no-op.
 *
 * Throws if the database is unreachable. Callers must not report success when
 * nothing was erased, so this deliberately does not follow the `if (!db) return`
 * convention used by the read helpers above.
 */
export async function eraseUserPersonalData(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable — erasure aborted");
  await db.update(users).set(ERASED_USER_FIELDS).where(eq(users.id, userId));
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(users.name);
}

// ─── Daily Games ──────────────────────────────────────────────────────────────

export async function getTodayGame(gameDate: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(dailyGames)
    .where(eq(dailyGames.gameDate, gameDate))
    .limit(1);
  return result[0];
}

/**
 * Earliest queued game strictly after `afterDate` (YYYY-MM-DD) — a draft or
 * active game waiting to be played. Locked games are excluded: locked means
 * in-play past lockout, not queued. Used by the endOfDay cadence guard.
 */
export async function getQueuedGameAfter(afterDate: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(dailyGames)
    .where(
      and(
        or(eq(dailyGames.status, "draft"), eq(dailyGames.status, "active")),
        gt(dailyGames.gameDate, afterDate)
      )
    )
    .orderBy(asc(dailyGames.gameDate))
    .limit(1);
  return result[0];
}

/**
 * Returns the current playable game:
 * - Any active/locked game whose gameDate is today OR in the future (up to next trading day)
 * - This allows a game to become visible the afternoon before its trading date
 * - Returns the soonest upcoming game so players can start picking early
 */
export async function getActiveOrUpcomingGame() {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(dailyGames)
    .where(
      and(
        or(
          eq(dailyGames.status, "active"),
          eq(dailyGames.status, "locked")
        )
      )
    )
    .orderBy(asc(dailyGames.gameDate))
    .limit(1);
  return result[0];
}

export async function getGameById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(dailyGames).where(eq(dailyGames.id, id)).limit(1);
  return result[0];
}

export async function listGames(limit = 20, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(dailyGames)
    .orderBy(desc(dailyGames.gameDate))
    .limit(limit)
    .offset(offset);
}

export async function listPublishedGames(limit = 20, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(dailyGames)
    .where(eq(dailyGames.status, "result_published"))
    .orderBy(desc(dailyGames.gameDate))
    .limit(limit)
    .offset(offset);
}

export async function createGame(data: Omit<typeof dailyGames.$inferInsert, "id" | "createdAt" | "updatedAt">): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(dailyGames).values(data);
  return (result as unknown as { insertId: number }).insertId;
}

export async function updateGame(id: number, data: Partial<typeof dailyGames.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(dailyGames).set(data).where(eq(dailyGames.id, id));
}

// ─── Game Research ─────────────────────────────────────────────────────────────

export async function getResearchByGameId(gameId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(gameResearch).where(eq(gameResearch.gameId, gameId)).limit(1);
  return result[0];
}

export async function upsertResearch(gameId: number, content: string, researchSummary?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // researchSummary only when provided — existing content-only callers must not null out the summary
  const summaryPatch = researchSummary !== undefined ? { researchSummary } : {};
  await db
    .insert(gameResearch)
    .values({ gameId, content, ...summaryPatch })
    .onDuplicateKeyUpdate({ set: { content, ...summaryPatch } });
}

export async function upsertResearchWithMetrics(
  gameId: number,
  content: string,
  researchMetrics: Array<{ label: string; value: string }>,
  researchSummary?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .insert(gameResearch)
    .values({ gameId, content, researchMetrics, researchSummary })
    .onDuplicateKeyUpdate({ set: { content, researchMetrics, researchSummary } });
}

export async function snapshotResearch(gameId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const research = await getResearchByGameId(gameId);
  if (!research) return;
  await db
    .update(gameResearch)
    .set({
      researchSnapshot: research.content,
      metricsSnapshot: research.researchMetrics ?? null,
      snapshotTakenAt: new Date(),
    })
    .where(eq(gameResearch.gameId, gameId));
}

// ─── Validation Questions ─────────────────────────────────────────────────────

export async function getValidationQuestion(gameId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(validationQuestions)
    .where(eq(validationQuestions.gameId, gameId))
    .limit(1);
  return result[0];
}

export async function upsertValidationQuestion(
  gameId: number,
  data: Omit<typeof validationQuestions.$inferInsert, "id" | "gameId" | "createdAt" | "updatedAt">
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .insert(validationQuestions)
    .values({ gameId, ...data })
    .onDuplicateKeyUpdate({ set: data });
}

// ─── Player Picks ─────────────────────────────────────────────────────────────

export async function getPlayerPick(userId: number, gameId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(playerPicks)
    .where(and(eq(playerPicks.userId, userId), eq(playerPicks.gameId, gameId)))
    .limit(1);
  return result[0];
}

export async function upsertGutSelection(userId: number, gameId: number, selection: "A" | "B") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .insert(playerPicks)
    .values({ userId, gameId, gutSelection: selection, gutSubmittedAt: new Date() })
    .onDuplicateKeyUpdate({ set: { gutSelection: selection, gutSubmittedAt: new Date() } });
}

export async function upsertFinalSelection(
  userId: number,
  gameId: number,
  selection: "A" | "B"
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const now = new Date();
  await db
    .insert(playerPicks)
    .values({
      userId,
      gameId,
      finalSelection: selection,
      finalSubmittedAt: now,
    })
    .onDuplicateKeyUpdate({
      set: {
        finalSelection: selection,
        finalSubmittedAt: now,
      },
    });
}

/** Submit validation answer separately (post-final-pick flow) with timing data */
export async function submitValidationAnswer(
  userId: number,
  gameId: number,
  validationAnswer: string,
  validationAnswerTimeMs: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const now = new Date();
  await db
    .update(playerPicks)
    .set({ validationAnswer, validationAnswerTimeMs, validationSubmittedAt: now })
    .where(and(eq(playerPicks.userId, userId), eq(playerPicks.gameId, gameId)));
}

export async function lockPicksForGame(gameId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(playerPicks).set({ isLocked: true }).where(eq(playerPicks.gameId, gameId));
}

export async function getPicksForGame(gameId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(playerPicks).where(eq(playerPicks.gameId, gameId));
}

// ─── Daily Scores ─────────────────────────────────────────────────────────────

export async function getPlayerScoreForGame(userId: number, gameId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(dailyScores)
    .where(and(eq(dailyScores.userId, userId), eq(dailyScores.gameId, gameId)))
    .limit(1);
  return result[0];
}

export async function insertDailyScore(
  userId: number,
  gameId: number,
  predictionScore: number,
  validationScore: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const totalScore = predictionScore + validationScore;
  await db
    .insert(dailyScores)
    .values({ userId, gameId, predictionScore, validationScore, totalScore })
    .onDuplicateKeyUpdate({ set: { predictionScore, validationScore, totalScore, calculatedAt: new Date() } });
}

export async function getPlayerScoreHistory(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: dailyScores.id,
      userId: dailyScores.userId,
      gameId: dailyScores.gameId,
      predictionScore: dailyScores.predictionScore,
      validationScore: dailyScores.validationScore,
      totalScore: dailyScores.totalScore,
      calculatedAt: dailyScores.calculatedAt,
      gameDate: dailyGames.gameDate,
    })
    .from(dailyScores)
    .leftJoin(dailyGames, eq(dailyScores.gameId, dailyGames.id))
    .where(eq(dailyScores.userId, userId))
    .orderBy(desc(dailyScores.calculatedAt));
}

// ─── Leaderboard Stats ────────────────────────────────────────────────────────

export async function getLeaderboard() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      userId: leaderboardStats.userId,
      userName: users.name,
      gamesPlayed: leaderboardStats.gamesPlayed,
      averageDailyScore: leaderboardStats.averageDailyScore,
      qualificationStatus: leaderboardStats.qualificationStatus,
    })
    .from(leaderboardStats)
    .innerJoin(users, eq(leaderboardStats.userId, users.id))
    .where(eq(leaderboardStats.qualificationStatus, "qualified"))
    .orderBy(desc(leaderboardStats.averageDailyScore));
}

export async function getProvisionalLeaderboard() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      userId: leaderboardStats.userId,
      userName: users.name,
      gamesPlayed: leaderboardStats.gamesPlayed,
      averageDailyScore: leaderboardStats.averageDailyScore,
    })
    .from(leaderboardStats)
    .innerJoin(users, eq(leaderboardStats.userId, users.id))
    .where(eq(leaderboardStats.qualificationStatus, "pending"))
    .orderBy(desc(leaderboardStats.averageDailyScore))
    .limit(20);
}

export async function getLeaderboardStatForUser(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(leaderboardStats)
    .where(eq(leaderboardStats.userId, userId))
    .limit(1);
  return result[0];
}

export async function upsertLeaderboardStat(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Recalculate from daily_scores
  const scores = await getPlayerScoreHistory(userId);
  const gamesPlayed = scores.length;
  const totalScore = scores.reduce((sum, s) => sum + s.totalScore, 0);
  const averageDailyScore = gamesPlayed > 0 ? (totalScore / gamesPlayed).toFixed(2) : "0.00";
  const qualificationStatus = gamesPlayed >= 20 ? "qualified" : "pending";

  await db
    .insert(leaderboardStats)
    .values({
      userId,
      gamesPlayed,
      totalScore,
      averageDailyScore,
      qualificationStatus,
      lastUpdatedAt: new Date(),
    })
    .onDuplicateKeyUpdate({
      set: {
        gamesPlayed,
        totalScore,
        averageDailyScore,
        qualificationStatus,
        lastUpdatedAt: new Date(),
      },
    });
}

// ─── Streak Records ───────────────────────────────────────────────────────────

export async function getStreakForUser(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(streakRecords)
    .where(eq(streakRecords.userId, userId))
    .limit(1);
  return result[0];
}

export async function initStreakForUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .insert(streakRecords)
    .values({ userId })
    .onDuplicateKeyUpdate({ set: { userId } }); // no-op if exists
}

export async function updateStreak(
  userId: number,
  currentStreak: number,
  longestStreak: number,
  lastParticipationDate: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(streakRecords)
    .set({ currentStreak, longestStreak, lastParticipationDate })
    .where(eq(streakRecords.userId, userId));
}

export async function updateWinLoseStreak(
  userId: number,
  currentWinStreak: number,
  longestWinStreak: number,
  currentLoseStreak: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(streakRecords)
    .set({ currentWinStreak, longestWinStreak, currentLoseStreak })
    .where(eq(streakRecords.userId, userId));
}

export async function setAwayStatus(
  userId: number,
  status: "active" | "away" | "missing",
  adminId: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(streakRecords)
    .set({ awayStatus: status, awayStatusSetAt: new Date(), awayStatusSetBy: adminId })
    .where(eq(streakRecords.userId, userId));
}

/**
 * Count the number of result_published game days strictly between two dates
 * (exclusive of both ends). Used by the streak engine to determine whether a
 * player missed any trading days — a gap containing 0 published game days
 * (e.g. Friday → Monday) should NOT reset the streak.
 *
 * @param lastDate - YYYY-MM-DD of the player's last participation
 * @param currentDate - YYYY-MM-DD of the current game being scored
 * @returns count of published game days strictly between the two dates
 */
export async function countPublishedGameDaysBetween(
  lastDate: string,
  currentDate: string
): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(dailyGames)
    .where(
      and(
        eq(dailyGames.status, "result_published"),
        gt(dailyGames.gameDate, lastDate),
        lt(dailyGames.gameDate, currentDate)
      )
    );
  return Number(result[0]?.count ?? 0);
}

// ─── Outbound Article Clicks ────────────────────────────────────────────────────

/**
 * Records one outbound source-article click. Fire-and-forget: if the DB is
 * unavailable we silently skip rather than break the user's click-through.
 */
export async function recordOutboundClick(
  data: Omit<InsertOutboundClick, "id" | "createdAt">
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(outboundClicks).values(data);
}

/**
 * Aggregate outbound-click stats for the admin dashboard: overall total plus a
 * per-publisher breakdown (highest first) — the numbers you'd take to a
 * publisher to show how much traffic Munymo has sent them.
 */
export async function getOutboundClickStats(): Promise<{
  total: number;
  byPublisher: Array<{ publisher: string; clicks: number }>;
}> {
  const db = await getDb();
  if (!db) return { total: 0, byPublisher: [] };

  const totalRes = await db
    .select({ count: sql<number>`count(*)` })
    .from(outboundClicks);
  const total = Number(totalRes[0]?.count ?? 0);

  const rows = await db
    .select({
      publisher: outboundClicks.publisher,
      clicks: sql<number>`count(*)`,
    })
    .from(outboundClicks)
    .groupBy(outboundClicks.publisher)
    .orderBy(desc(sql`count(*)`));

  const byPublisher = rows.map((r) => ({
    publisher: r.publisher ?? "Unknown",
    clicks: Number(r.clicks),
  }));

  return { total, byPublisher };
}

// ─── Community Stats ──────────────────────────────────────────────────────────

export async function computeAndStoreCommunityStats(gameId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const picks = await getPicksForGame(gameId);
  const question = await getValidationQuestion(gameId);
  const game = await getGameById(gameId);
  if (!game) throw new Error("Game not found");

  const total = picks.length;
  if (total === 0) {
    await db
      .insert(gameCommunityStats)
      .values({ gameId, totalParticipants: 0 })
      .onDuplicateKeyUpdate({ set: { totalParticipants: 0, computedAt: new Date() } });
    return;
  }

  const gutA = picks.filter((p) => p.gutSelection === "A").length;
  const gutB = picks.filter((p) => p.gutSelection === "B").length;
  const finalA = picks.filter((p) => p.finalSelection === "A").length;
  const finalB = picks.filter((p) => p.finalSelection === "B").length;
  const validCorrect = question
    ? picks.filter((p) => p.validationAnswer === question.correctAnswer).length
    : 0;

  const pct = (n: number) => ((n / total) * 100).toFixed(2);

  await db
    .insert(gameCommunityStats)
    .values({
      gameId,
      totalParticipants: total,
      gutPctA: pct(gutA),
      gutPctB: pct(gutB),
      finalPctA: pct(finalA),
      finalPctB: pct(finalB),
      validationCorrectPct: pct(validCorrect),
      computedAt: new Date(),
    })
    .onDuplicateKeyUpdate({
      set: {
        totalParticipants: total,
        gutPctA: pct(gutA),
        gutPctB: pct(gutB),
        finalPctA: pct(finalA),
        finalPctB: pct(finalB),
        validationCorrectPct: pct(validCorrect),
        computedAt: new Date(),
      },
    });
}

export async function getCommunityStats(gameId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(gameCommunityStats)
    .where(eq(gameCommunityStats.gameId, gameId))
    .limit(1);
  return result[0];
}

// ─── Admin Audit Log ──────────────────────────────────────────────────────────

export async function writeAuditLog(
  adminId: number,
  action: string,
  targetType?: string,
  targetId?: number,
  detail?: string
) {
  const db = await getDb();
  if (!db) return;
  await db.insert(adminAuditLog).values({ adminId, action, targetType, targetId, detail });
}

export async function getAuditLog(limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(adminAuditLog)
    .orderBy(desc(adminAuditLog.createdAt))
    .limit(limit)
    .offset(offset);
}

// ─── Metric Explanations ────────────────────────────────────────────────────────

/** Normalise a metric label into a stable cache key */
export function normaliseMetricKey(label: string): string {
  return label.toLowerCase().trim().replace(/\s+/g, " ");
}

/**
 * Returns true if the label matches a metric label used in any game_research row.
 * Used to gate LLM calls — unknown labels get a static fallback, no LLM invoked.
 */
export async function isKnownMetricLabel(metricLabel: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const key = normaliseMetricKey(metricLabel);
  const rows = await db.select({ metrics: gameResearch.researchMetrics }).from(gameResearch);
  for (const row of rows) {
    const metrics = row.metrics as Array<{ label: string }> | null;
    if (!metrics) continue;
    for (const m of metrics) {
      if (normaliseMetricKey(m.label) === key) return true;
    }
  }
  return false;
}

export async function getMetricExplanation(metricLabel: string) {
  const db = await getDb();
  if (!db) return undefined;
  const key = normaliseMetricKey(metricLabel);
  const result = await db
    .select()
    .from(metricExplanations)
    .where(eq(metricExplanations.metricKey, key))
    .limit(1);
  return result[0];
}

export async function upsertMetricExplanation(
  metricLabel: string,
  explanation: string,
  aiGenerated = true
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const key = normaliseMetricKey(metricLabel);
  await db
    .insert(metricExplanations)
    .values({ metricKey: key, metricLabel, explanation, aiGenerated })
    .onDuplicateKeyUpdate({ set: { explanation, aiGenerated, updatedAt: new Date() } });
}

// ─── Learning Hub — Lesson Progress ────────────────────────────────────────────

export async function getLessonProgressForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ lessonId: lessonProgress.lessonId, quizCorrect: lessonProgress.quizCorrect })
    .from(lessonProgress)
    .where(eq(lessonProgress.userId, userId));
}

/** Upsert a lesson completion. First write wins for quizCorrect — a later
 * retake never overwrites the original attempt's result. */
export async function markLessonComplete(
  userId: number,
  lessonId: string,
  quizCorrect: boolean
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // No-op update on duplicate: atomic first-write-wins without a
  // select-then-insert race against the (userId, lessonId) unique index.
  await db
    .insert(lessonProgress)
    .values({ userId, lessonId, quizCorrect })
    .onDuplicateKeyUpdate({ set: { lessonId: sql`lessonId` } });
}
