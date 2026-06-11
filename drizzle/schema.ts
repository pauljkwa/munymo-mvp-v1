import {
  bigint,
  boolean,
  decimal,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

// ─── Users ────────────────────────────────────────────────────────────────────

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Daily Games ──────────────────────────────────────────────────────────────

/**
 * Status lifecycle:
 *   draft → active → locked → result_published | cancelled
 *
 * draft:             Admin has created the game; not yet visible to players.
 * active:            Game is live; players can submit Gut and Final Selections.
 * locked:            Lockout deadline has passed; no more picks accepted.
 * result_published:  Admin has published the outcome; scores calculated.
 * cancelled:         Game was cancelled; neutral for all players.
 */
export const dailyGames = mysqlTable("daily_games", {
  id: int("id").autoincrement().primaryKey(),
  gameDate: varchar("gameDate", { length: 10 }).notNull(), // YYYY-MM-DD
  companyAName: varchar("companyAName", { length: 128 }).notNull(),
  companyATicker: varchar("companyATicker", { length: 16 }).notNull(),
  companyBName: varchar("companyBName", { length: 128 }).notNull(),
  companyBTicker: varchar("companyBTicker", { length: 16 }).notNull(),
  sector: varchar("sector", { length: 128 }),
  pairingRationale: text("pairingRationale"),
  status: mysqlEnum("status", [
    "draft",
    "active",
    "locked",
    "result_published",
    "cancelled",
  ])
    .default("draft")
    .notNull(),
  winner: mysqlEnum("winner", ["A", "B"]), // null until result_published
  resultCommentary: text("resultCommentary"),
  lockoutAt: timestamp("lockoutAt"), // server-enforced deadline
  publishedAt: timestamp("publishedAt"),
  cancelledAt: timestamp("cancelledAt"),
  createdBy: int("createdBy").notNull(), // admin user id
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DailyGame = typeof dailyGames.$inferSelect;
export type InsertDailyGame = typeof dailyGames.$inferInsert;

// ─── Game Research ─────────────────────────────────────────────────────────────

/**
 * Active-game research is displayed on the game page while the game is live.
 * On result_published, a snapshot is taken and stored in researchSnapshot
 * for the Research Hub archive. The snapshot is immutable after that point.
 */
export const gameResearch = mysqlTable("game_research", {
  id: int("id").autoincrement().primaryKey(),
  gameId: int("gameId").notNull().unique(),
  content: text("content").notNull(), // Markdown/rich text
  researchSnapshot: text("researchSnapshot"), // immutable copy taken at publish
  snapshotTakenAt: timestamp("snapshotTakenAt"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type GameResearch = typeof gameResearch.$inferSelect;
export type InsertGameResearch = typeof gameResearch.$inferInsert;

// ─── Validation Questions ─────────────────────────────────────────────────────

export const validationQuestions = mysqlTable("validation_questions", {
  id: int("id").autoincrement().primaryKey(),
  gameId: int("gameId").notNull().unique(), // one question per game
  questionType: mysqlEnum("questionType", [
    "multiple_choice",
    "yes_no",
    "true_false",
  ]).notNull(),
  questionText: text("questionText").notNull(),
  /**
   * For multiple_choice: JSON array of option strings e.g. ["A","B","C","D"]
   * For yes_no / true_false: null (options are implicit)
   */
  options: json("options").$type<string[]>(),
  correctAnswer: varchar("correctAnswer", { length: 256 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ValidationQuestion = typeof validationQuestions.$inferSelect;
export type InsertValidationQuestion =
  typeof validationQuestions.$inferInsert;

// ─── Player Picks ─────────────────────────────────────────────────────────────

export const playerPicks = mysqlTable("player_picks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  gameId: int("gameId").notNull(),
  gutSelection: mysqlEnum("gutSelection", ["A", "B"]), // null until submitted
  gutSubmittedAt: timestamp("gutSubmittedAt"),
  finalSelection: mysqlEnum("finalSelection", ["A", "B"]), // null until submitted
  finalSubmittedAt: timestamp("finalSubmittedAt"),
  validationAnswer: varchar("validationAnswer", { length: 256 }),
  validationSubmittedAt: timestamp("validationSubmittedAt"),
  isLocked: boolean("isLocked").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PlayerPick = typeof playerPicks.$inferSelect;
export type InsertPlayerPick = typeof playerPicks.$inferInsert;

// ─── Daily Scores ─────────────────────────────────────────────────────────────

/**
 * Calculated server-side only, never accepted from client.
 * predictionScore: 0 or 80 (correct/incorrect Final Selection)
 * validationScore: 0 or 20 (correct/incorrect validation answer)
 * totalScore: predictionScore + validationScore (0–100)
 */
export const dailyScores = mysqlTable("daily_scores", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  gameId: int("gameId").notNull(),
  predictionScore: int("predictionScore").notNull().default(0), // 0 or 80
  validationScore: int("validationScore").notNull().default(0), // 0 or 20
  totalScore: int("totalScore").notNull().default(0), // 0–100
  calculatedAt: timestamp("calculatedAt").defaultNow().notNull(),
});

export type DailyScore = typeof dailyScores.$inferSelect;
export type InsertDailyScore = typeof dailyScores.$inferInsert;

// ─── Leaderboard Stats ────────────────────────────────────────────────────────

/**
 * Materialised per-player leaderboard data, recalculated on each result publish.
 * qualificationStatus: 'qualified' when gamesPlayed >= 20, else 'pending'
 */
export const leaderboardStats = mysqlTable("leaderboard_stats", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  gamesPlayed: int("gamesPlayed").notNull().default(0),
  totalScore: bigint("totalScore", { mode: "number" }).notNull().default(0),
  averageDailyScore: decimal("averageDailyScore", {
    precision: 6,
    scale: 2,
  })
    .notNull()
    .default("0.00"),
  qualificationStatus: mysqlEnum("qualificationStatus", [
    "pending",
    "qualified",
  ])
    .notNull()
    .default("pending"),
  lastUpdatedAt: timestamp("lastUpdatedAt").defaultNow().notNull(),
});

export type LeaderboardStat = typeof leaderboardStats.$inferSelect;
export type InsertLeaderboardStat = typeof leaderboardStats.$inferInsert;

// ─── Streak Records ───────────────────────────────────────────────────────────

/**
 * awayStatus:
 *   null / 'active'  — normal participation
 *   'away'           — streak preserved, game not counted as missed
 *   'missing'        — streak broken
 */
export const streakRecords = mysqlTable("streak_records", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  currentStreak: int("currentStreak").notNull().default(0),
  longestStreak: int("longestStreak").notNull().default(0),
  lastParticipationDate: varchar("lastParticipationDate", { length: 10 }), // YYYY-MM-DD
  awayStatus: mysqlEnum("awayStatus", ["active", "away", "missing"])
    .notNull()
    .default("active"),
  awayStatusSetAt: timestamp("awayStatusSetAt"),
  awayStatusSetBy: int("awayStatusSetBy"), // admin user id
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type StreakRecord = typeof streakRecords.$inferSelect;
export type InsertStreakRecord = typeof streakRecords.$inferInsert;

// ─── Community Stats ──────────────────────────────────────────────────────────

/**
 * Computed after result_published. Shows what percentage of players picked
 * each company in both Gut and Final Selections.
 */
export const gameCommunityStats = mysqlTable("game_community_stats", {
  id: int("id").autoincrement().primaryKey(),
  gameId: int("gameId").notNull().unique(),
  totalParticipants: int("totalParticipants").notNull().default(0),
  gutPctA: decimal("gutPctA", { precision: 5, scale: 2 }).notNull().default("0.00"),
  gutPctB: decimal("gutPctB", { precision: 5, scale: 2 }).notNull().default("0.00"),
  finalPctA: decimal("finalPctA", { precision: 5, scale: 2 }).notNull().default("0.00"),
  finalPctB: decimal("finalPctB", { precision: 5, scale: 2 }).notNull().default("0.00"),
  validationCorrectPct: decimal("validationCorrectPct", {
    precision: 5,
    scale: 2,
  })
    .notNull()
    .default("0.00"),
  computedAt: timestamp("computedAt").defaultNow().notNull(),
});

export type GameCommunityStats = typeof gameCommunityStats.$inferSelect;
export type InsertGameCommunityStats = typeof gameCommunityStats.$inferInsert;

// ─── Admin Audit Log ──────────────────────────────────────────────────────────

export const adminAuditLog = mysqlTable("admin_audit_log", {
  id: int("id").autoincrement().primaryKey(),
  adminId: int("adminId").notNull(),
  action: varchar("action", { length: 64 }).notNull(),
  targetType: varchar("targetType", { length: 64 }), // e.g. 'game', 'player'
  targetId: int("targetId"),
  detail: text("detail"), // JSON or human-readable description
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AdminAuditLog = typeof adminAuditLog.$inferSelect;
export type InsertAdminAuditLog = typeof adminAuditLog.$inferInsert;
