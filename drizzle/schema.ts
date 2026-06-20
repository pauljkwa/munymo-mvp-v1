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
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

// ─── Users ────────────────────────────────────────────────────────────────────

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  // Clerk user ID — primary identity key going forward
  clerkId: varchar("clerkId", { length: 64 }).unique(),
  // Legacy Manus openId — kept for backward compatibility, nullable
  openId: varchar("openId", { length: 64 }).unique(),
  name: text("name"),
  // Custom display name set by the user (overrides name from OAuth)
  displayName: varchar("displayName", { length: 64 }),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  // Membership tier
  tier: mysqlEnum("tier", ["free", "premium"]).default("free").notNull(),
  // Away Status — when true, streak is protected
  awayStatus: boolean("awayStatus").default(false).notNull(),
  awayStatusUntil: timestamp("awayStatusUntil"),
  // Soft delete — deactivated users cannot sign in
  deactivated: boolean("deactivated").default(false).notNull(),
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
  exchange: varchar("exchange", { length: 16 }).default("NASDAQ").notNull(), // e.g. NASDAQ, NYSE, ASX
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
  companyAPerf: decimal("companyAPerf", { precision: 7, scale: 3 }), // % change e.g. +2.450
  companyBPerf: decimal("companyBPerf", { precision: 7, scale: 3 }), // % change e.g. -1.230
  resultSummary: text("resultSummary"), // short paragraph summary of the matchup outcome
  hindsightSpotlight: text("hindsightSpotlight"), // educational debrief with 20/20 hindsight
  resultCommentary: text("resultCommentary"), // legacy field kept for compatibility
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
/**
 * ResearchMetric shape stored in the researchMetrics JSON column:
 * Array of { label: string, value: string } — admin-editable, up to 12 items.
 */
export type ResearchMetric = { label: string; value: string };

export const gameResearch = mysqlTable("game_research", {
  id: int("id").autoincrement().primaryKey(),
  gameId: int("gameId").notNull().unique(),
  content: text("content").notNull(), // Markdown/rich text narrative
  researchMetrics: json("researchMetrics").$type<ResearchMetric[]>(), // flexible key-value metrics
  researchSnapshot: text("researchSnapshot"), // immutable copy taken at publish
  metricsSnapshot: json("metricsSnapshot").$type<ResearchMetric[]>(), // immutable metrics copy
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

export const playerPicks = mysqlTable(
  "player_picks",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    gameId: int("gameId").notNull(),
    gutSelection: mysqlEnum("gutSelection", ["A", "B"]), // null until submitted
    gutSubmittedAt: timestamp("gutSubmittedAt"),
    finalSelection: mysqlEnum("finalSelection", ["A", "B"]), // null until submitted
    finalSubmittedAt: timestamp("finalSubmittedAt"),
    validationAnswer: varchar("validationAnswer", { length: 256 }),
    validationAnswerTimeMs: int("validationAnswerTimeMs"), // ms from question display to answer submit
    validationSubmittedAt: timestamp("validationSubmittedAt"),
    isLocked: boolean("isLocked").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    userGameUnique: uniqueIndex("player_picks_user_game_unique").on(table.userId, table.gameId),
  })
);

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

// ─── Metric Explanations ────────────────────────────────────────────────────────

/**
 * AI-generated plain-English explanations for research metrics.
 * Keyed by a normalised metric name (lowercase, trimmed).
 * Generated by LLM on first use and cached indefinitely.
 * Admin can override the explanation text at any time.
 */
export const metricExplanations = mysqlTable("metric_explanations", {
  id: int("id").autoincrement().primaryKey(),
  // Normalised key: lowercase, trimmed, e.g. "p/e ratio", "revenue growth"
  metricKey: varchar("metricKey", { length: 256 }).notNull().unique(),
  // The original label as first submitted (for display reference)
  metricLabel: varchar("metricLabel", { length: 256 }).notNull(),
  // Plain-English explanation generated by LLM (or overridden by admin)
  explanation: text("explanation").notNull(),
  // Whether this was AI-generated (true) or manually written/overridden (false)
  aiGenerated: boolean("aiGenerated").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MetricExplanation = typeof metricExplanations.$inferSelect;
export type InsertMetricExplanation = typeof metricExplanations.$inferInsert;

// ─── Push Subscriptions ─────────────────────────────────────────────────────

/**
 * Web Push API subscriptions stored per user per device.
 * Each device has a unique endpoint URL. A user may have multiple devices.
 * endpoint is the unique identifier — used to deduplicate and clean up expired subs.
 */
export const pushSubscriptions = mysqlTable(
  "push_subscriptions",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    // The push service endpoint URL (unique per device/browser)
    // Stored as text but we use endpointHash for deduplication
    endpoint: text("endpoint").notNull(),
    // SHA-256 hash of endpoint for unique index (text can't be indexed directly)
    endpointHash: varchar("endpointHash", { length: 64 }).notNull(),
    // Encryption keys from the browser's PushSubscription object
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    // User agent hint for display purposes
    userAgent: varchar("userAgent", { length: 512 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    userEndpointUnique: uniqueIndex("push_subscriptions_user_endpoint_unique").on(
      table.userId,
      table.endpointHash
    ),
  })
);

export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type InsertPushSubscription = typeof pushSubscriptions.$inferInsert;

// ─── Referral Codes ──────────────────────────────────────────────────────────

/**
 * One row per physical merch item.
 * Each item ships with a unique QR code pointing to munymo.com/r/[code].
 *
 * Lifecycle:
 *   unassigned  — code generated, item not yet shipped / claimed
 *   active      — owner has scanned and enrolled the code; referrals are live
 *   suspended   — admin has suspended this code (abuse, lost item, etc.)
 *
 * When status = 'active', every subsequent scan by a non-owner opens the
 * landing page with a referral cookie. If that visitor signs up within the
 * attribution window, a referral_event row is created and the owner is credited.
 */
export const referralCodes = mysqlTable("referral_codes", {
  id: int("id").autoincrement().primaryKey(),
  // 8-character alphanumeric code, e.g. "X7K2M9PQ" — embedded in the QR URL
  code: varchar("code", { length: 16 }).notNull().unique(),
  // Merch item type for display / analytics
  merchType: mysqlEnum("merchType", ["mug", "tshirt", "other"])
    .default("other")
    .notNull(),
  // Batch identifier — links a code to a production/fulfilment run
  batchId: varchar("batchId", { length: 64 }),
  // The Munymo user who owns this code (null until enrolled)
  ownerId: int("ownerId"),
  // Lifecycle status
  status: mysqlEnum("status", ["unassigned", "active", "suspended"])
    .default("unassigned")
    .notNull(),
  // Timestamp when the owner enrolled (claimed) this code
  enrolledAt: timestamp("enrolledAt"),
  // Running totals — denormalised for fast dashboard queries
  totalScans: int("totalScans").notNull().default(0),
  totalSignups: int("totalSignups").notNull().default(0),
  // Admin notes
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ReferralCode = typeof referralCodes.$inferSelect;
export type InsertReferralCode = typeof referralCodes.$inferInsert;

// ─── Referral Events ──────────────────────────────────────────────────────────

/**
 * One row per meaningful referral interaction.
 *
 * eventType:
 *   scan    — someone scanned the QR code (may or may not sign up)
 *   signup  — a scan led to a new user registration within the attribution window
 *
 * For 'signup' events, referredUserId is populated once the new user is created.
 * The attribution window is 30 days from the scan timestamp.
 */
export const referralEvents = mysqlTable("referral_events", {
  id: int("id").autoincrement().primaryKey(),
  referralCodeId: int("referralCodeId").notNull(),
  eventType: mysqlEnum("eventType", ["scan", "signup"]).notNull(),
  // The new user who signed up (null for scan events)
  referredUserId: int("referredUserId"),
  // The owner of the code at the time of this event (denormalised for history)
  ownerIdAtEvent: int("ownerIdAtEvent"),
  // Anonymous fingerprint for deduplicating repeat scans from the same device
  // SHA-256 of (IP + User-Agent) — never stored raw
  deviceFingerprint: varchar("deviceFingerprint", { length: 64 }),
  // UTM / referral cookie value set on the visitor's browser
  referralCookie: varchar("referralCookie", { length: 64 }),
  // Attribution: was this scan within the 30-day window of a prior scan?
  attributed: boolean("attributed").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ReferralEvent = typeof referralEvents.$inferSelect;
export type InsertReferralEvent = typeof referralEvents.$inferInsert;

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
