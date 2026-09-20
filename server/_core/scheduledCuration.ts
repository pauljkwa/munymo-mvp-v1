/**
 * Scheduled curation endpoints — called by the AGENT cron each trading day.
 *
 * GET  /api/scheduled/recent-games   → returns last 30 days of games for freshness checks
 * POST /api/scheduled/stage-game     → Phase A (afternoon): stages tomorrow's game as a hidden draft
 * POST /api/scheduled/daily-curation → Phase B (post-close): accepts the full curation JSON (legacy)
 *                                       OR a results-only payload (stagedGameId set), validates
 *                                       freshness rules where applicable, runs End of Day logic
 *                                       (close today + create/activate tomorrow)
 */
import type { Express, Request, Response } from "express";
import { notifyOwner } from "./notification";
import { ENV } from "./env";
import { settleFromPrices } from "../scoring";
import { buildUnsubscribeUrl } from "../unsubscribe";

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

type RecentGameRow = {
  gameDate: string;
  sector: string | null;
  companyATicker: string;
  companyBTicker: string;
};

/**
 * Fetches games within the widest freshness window (365 days) — the same
 * dataset both the pre-check and the final submit-time validation check
 * against, just filtered to different cutoffs per rule.
 */
async function fetchGamesWithinMatchupWindow(db: any): Promise<RecentGameRow[]> {
  const { dailyGames } = await import("../../drizzle/schema.js");
  const { desc, gte } = await import("drizzle-orm");

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - MATCHUP_REPEAT_DAYS);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  return db
    .select({
      gameDate: dailyGames.gameDate,
      sector: dailyGames.sector,
      companyATicker: dailyGames.companyATicker,
      companyBTicker: dailyGames.companyBTicker,
    })
    .from(dailyGames)
    .where(gte(dailyGames.gameDate, cutoffStr))
    .orderBy(desc(dailyGames.gameDate));
}

/** Checks one candidate sector + ticker pair against all three freshness rules. */
function checkFreshness(
  recentGames: RecentGameRow[],
  sector: string | undefined,
  companyATicker: string,
  companyBTicker: string
): string[] {
  const violations: string[] = [];
  const tickerA = companyATicker.toUpperCase();
  const tickerB = companyBTicker.toUpperCase();

  const now = new Date();
  const sectorCutoff = new Date(now); sectorCutoff.setDate(now.getDate() - SECTOR_REPEAT_DAYS);
  const companyCutoff = new Date(now); companyCutoff.setDate(now.getDate() - COMPANY_REPEAT_DAYS);
  const matchupCutoff = new Date(now); matchupCutoff.setDate(now.getDate() - MATCHUP_REPEAT_DAYS);
  const sectorCutoffStr = sectorCutoff.toISOString().slice(0, 10);
  const companyCutoffStr = companyCutoff.toISOString().slice(0, 10);
  const matchupCutoffStr = matchupCutoff.toISOString().slice(0, 10);

  for (const g of recentGames) {
    const gA = g.companyATicker.toUpperCase();
    const gB = g.companyBTicker.toUpperCase();
    const gDate = g.gameDate;

    if (g.sector && sector && g.sector.toLowerCase() === sector.toLowerCase() && gDate >= sectorCutoffStr) {
      violations.push(`Sector '${sector}' was used on ${gDate} (within ${SECTOR_REPEAT_DAYS} days)`);
    }
    if ((gA === tickerA || gB === tickerA) && gDate >= companyCutoffStr) {
      violations.push(`Company ${tickerA} was used on ${gDate} (within ${COMPANY_REPEAT_DAYS} days)`);
    }
    if ((gA === tickerB || gB === tickerB) && gDate >= companyCutoffStr) {
      violations.push(`Company ${tickerB} was used on ${gDate} (within ${COMPANY_REPEAT_DAYS} days)`);
    }
    const sameMatchup = (gA === tickerA && gB === tickerB) || (gA === tickerB && gB === tickerA);
    if (sameMatchup && gDate >= matchupCutoffStr) {
      violations.push(`Matchup ${tickerA} vs ${tickerB} was used on ${gDate} (within ${MATCHUP_REPEAT_DAYS} days)`);
    }
  }

  return violations;
}

/**
 * Pre-computes the exact exclusion lists for the curation agent, so it can
 * steer its news search away from ineligible sectors/companies up front
 * instead of inferring eligibility itself from raw game dates.
 */
function computeBannedLists(recentGames: RecentGameRow[]): {
  bannedSectors: string[];
  bannedTickers: string[];
  bannedPairs: string[][];
} {
  const now = new Date();
  const sectorCutoff = new Date(now); sectorCutoff.setDate(now.getDate() - SECTOR_REPEAT_DAYS);
  const companyCutoff = new Date(now); companyCutoff.setDate(now.getDate() - COMPANY_REPEAT_DAYS);
  const sectorCutoffStr = sectorCutoff.toISOString().slice(0, 10);
  const companyCutoffStr = companyCutoff.toISOString().slice(0, 10);

  const bannedSectors = new Set<string>();
  const bannedTickers = new Set<string>();
  const bannedPairs: string[][] = [];

  for (const g of recentGames) {
    // recentGames is already scoped to the 365-day matchup window, so every
    // row here is a banned pair by definition.
    bannedPairs.push([g.companyATicker.toUpperCase(), g.companyBTicker.toUpperCase()]);

    if (g.sector && g.gameDate >= sectorCutoffStr) {
      bannedSectors.add(g.sector);
    }
    if (g.gameDate >= companyCutoffStr) {
      bannedTickers.add(g.companyATicker.toUpperCase());
      bannedTickers.add(g.companyBTicker.toUpperCase());
    }
  }

  return {
    bannedSectors: Array.from(bannedSectors),
    bannedTickers: Array.from(bannedTickers),
    bannedPairs,
  };
}

// ─── GET /api/scheduled/recent-games ─────────────────────────────────────────
async function recentGamesHandler(req: Request, res: Response) {
  try {
    // Secret-gated like the other scheduled endpoints — this response includes
    // the QUEUED future matchup, which must not be publicly readable before
    // game day (audit minor finding, 2026-07-30).
    if (!isAuthorisedCron(req)) {
      return res.status(403).json({ error: "cron-only endpoint" });
    }
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

    const { bannedSectors, bannedTickers, bannedPairs } = computeBannedLists(games);

    return res.json({
      games,
      rules: {
        sectorRepeatDays: SECTOR_REPEAT_DAYS,
        companyRepeatDays: COMPANY_REPEAT_DAYS,
        matchupRepeatDays: MATCHUP_REPEAT_DAYS,
      },
      // Pre-computed exclusions — check candidates against these directly
      // instead of re-deriving eligibility from `games`' raw dates.
      bannedSectors,
      bannedTickers,
      bannedPairs,
    });
  } catch (err) {
    console.error("[recent-games] Error:", err);
    return res.status(500).json({ error: String(err) });
  }
}

// ─── POST /api/scheduled/check-freshness ─────────────────────────────────────
// Cheap, deterministic pre-qualification check for a candidate sector + ticker
// pair — called by the curation agent BEFORE it writes any research or content,
// so an ineligible pick costs one fast tool call instead of a whole rebuilt game.
async function checkFreshnessHandler(req: Request, res: Response) {
  try {
    if (!isAuthorisedCron(req)) {
      return res.status(403).json({ error: "cron-only endpoint" });
    }

    const { sector, companyATicker, companyBTicker } = req.body as {
      sector?: string;
      companyATicker?: string;
      companyBTicker?: string;
    };

    if (!sector || !companyATicker || !companyBTicker) {
      return res.status(400).json({ error: "sector, companyATicker, and companyBTicker are required" });
    }

    const { getDb } = await import("../db");
    const db = await getDb();
    if (!db) return res.status(500).json({ error: "Database unavailable" });

    const recentGames = await fetchGamesWithinMatchupWindow(db);
    const violations = checkFreshness(recentGames, sector, companyATicker, companyBTicker);

    return res.json({ fresh: violations.length === 0, violations });
  } catch (err) {
    console.error("[check-freshness] Error:", err);
    return res.status(500).json({ error: String(err) });
  }
}

// ─── POST /api/scheduled/daily-curation ──────────────────────────────────────
/** Today's date (YYYY-MM-DD) in the market's timezone. UTC was wrong here:
 *  it rolls to "tomorrow" at 8 PM ET — exactly the evening-recovery window —
 *  which let future-dated games slip past the close-candidate guard (audit
 *  finding M6, 2026-07-30). */
function todayInET(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(now);
}

/** The one true lockout instant for a game date: 9:30 AM America/New_York,
 *  DST-safe. The agent used to compute this itself, so a wrong DST guess
 *  around the Mar/Nov transitions could lock players out an hour early — or
 *  let them pick an hour into the live session (audit finding M2). The server
 *  now always computes it; the payload's value is ignored. Exported for tests. */
export function expectedLockoutIso(gameDate: string): string {
  const edtGuess = new Date(`${gameDate}T13:30:00Z`); // 9:30 ET if EDT (UTC-4)
  const etTime = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  }).format(edtGuess);
  return etTime === "09:30" ? edtGuess.toISOString() : new Date(`${gameDate}T14:30:00Z`).toISOString();
}

// Concurrent POSTs (an agent retry racing a slow first request) used to run
// two close-and-score passes at once — double streak increments, duplicate-key
// noise (audit finding M3). One application at a time; the loser gets a 409
// and the agent's retry layer treats the eventual success email as truth.
// Shared with stageGameHandler (Phase A) too — a staging run and a full
// daily-curation run must never apply concurrently.
let applyInFlight = false;

/**
 * C1 idempotency guard, shared by daily-curation and stage-game: if a game
 * already exists at the proposed date with the SAME tickers, this exact
 * submission (or a retried equivalent) was already applied — the caller
 * should re-upsert research/question (heals a half-created row) and return
 * early instead of treating the retry as a fresh proposal or a freshness
 * violation (audit finding C1, 2026-07-30).
 */
async function findMatchingProposal(
  db: any,
  gameDate: string,
  companyATicker: string,
  companyBTicker: string,
  statuses: Array<"draft" | "active" | "locked">
): Promise<{ id: number; companyATicker: string; companyBTicker: string; status: string } | undefined> {
  const { dailyGames } = await import("../../drizzle/schema.js");
  const { and, eq, inArray } = await import("drizzle-orm");
  const [row] = await db
    .select({ id: dailyGames.id, companyATicker: dailyGames.companyATicker, companyBTicker: dailyGames.companyBTicker, status: dailyGames.status })
    .from(dailyGames)
    .where(and(eq(dailyGames.gameDate, gameDate), inArray(dailyGames.status, statuses)))
    .limit(1);
  if (row && row.companyATicker === companyATicker && row.companyBTicker === companyBTicker) return row;
  return undefined;
}

function mapQuestionType(qt: string): "multiple_choice" | "yes_no" | "true_false" {
  return qt === "yn" || qt === "yes_no" ? "yes_no" : qt === "tf" || qt === "true_false" ? "true_false" : "multiple_choice";
}

/**
 * Routing decision for dailyCurationHandler: a results-only payload
 * (stagedGameId set, Phase B fast path) skips the tomorrow/freshness/C1
 * machinery entirely, since none of it applies to "nothing new is being
 * proposed"; a legacy payload (tomorrow set) gets the full combined
 * treatment unchanged; anything else is a malformed request. Pure and
 * exported for tests — the routing decision itself doesn't touch the DB.
 */
export function classifyCurationPayload(body: { stagedGameId?: number; tomorrow?: unknown }): "results-only" | "legacy" | "invalid" {
  if (body.stagedGameId) return "results-only";
  if (body.tomorrow) return "legacy";
  return "invalid";
}

/** Upserts a game's research + validation question from a `tomorrow` block.
 *  Idempotent — safe to call again on a retried submission (used by both the
 *  C1 guard's re-upsert and the initial creation path). */
async function upsertProposalContent(gameId: number, tomorrow: CurationTomorrow): Promise<void> {
  const { upsertResearchWithMetrics, upsertValidationQuestion } = await import("../db");
  if (tomorrow.researchContent) {
    const metricsArray = tomorrow.researchMetrics
      ? Object.entries(tomorrow.researchMetrics).map(([label, value]) => ({ label, value: String(value) }))
      : [];
    await upsertResearchWithMetrics(gameId, tomorrow.researchContent, metricsArray, tomorrow.researchSummary);
  }
  if (tomorrow.validationQuestion?.questionText && tomorrow.validationQuestion?.correctAnswer) {
    await upsertValidationQuestion(gameId, {
      questionType: mapQuestionType(tomorrow.validationQuestion.questionType),
      questionText: tomorrow.validationQuestion.questionText,
      options: tomorrow.validationQuestion.options ?? undefined,
      correctAnswer: tomorrow.validationQuestion.correctAnswer,
    });
  }
}

/**
 * Phase B results-only branch of dailyCurationHandler: `stagedGameId`
 * references a game Phase A already staged as a draft, so there is nothing
 * new to propose here — freshness and the C1/cadence "queued game" guards
 * exist to protect a NEW matchup proposal and don't apply. This mirrors the
 * legacy path's concluded-game lookup and T3 winner validation exactly (same
 * queries, same rejection messages) and then calls endOfDay with
 * `activateStagedGameId` instead of the `next*` creation fields.
 */
async function applyResultsOnlyCuration(
  body: CurationPayload,
  todayEt: string,
  req: Request,
  res: Response,
  startTime: number
): Promise<Response> {
  const { today, marketClosed, stagedGameId } = body;
  const { getDb, getGameById } = await import("../db");
  const { dailyGames } = await import("../../drizzle/schema.js");
  const { lte, or, eq, and, asc } = await import("drizzle-orm");
  const db = await getDb();
  if (!db) return res.status(500).json({ error: "Database unavailable" });

  const stagedGame = await getGameById(stagedGameId!);
  if (!stagedGame) {
    return res.status(400).json({ error: `stagedGameId ${stagedGameId} not found` });
  }
  // Idempotency: a retried submission after a prior (possibly
  // network-severed) attempt already flipped the staged draft live.
  if (stagedGame.status !== "draft") {
    const msg = `stagedGameId ${stagedGameId} is already '${stagedGame.status}' — already applied. No-op.`;
    console.log("[daily-curation]", msg);
    return res.json({ ok: true, alreadyApplied: true, nextGameId: stagedGame.id, summary: msg });
  }

  // ── Determine the concluded game to close — identical query/logic to the
  // legacy path's step 3 (see its comment for the "earliest, not latest" rationale). ──
  const [concludedGame] = await db
    .select({ id: dailyGames.id, gameDate: dailyGames.gameDate, companyATicker: dailyGames.companyATicker, companyBTicker: dailyGames.companyBTicker })
    .from(dailyGames)
    .where(and(or(eq(dailyGames.status, "active"), eq(dailyGames.status, "locked")), lte(dailyGames.gameDate, todayEt)))
    .orderBy(asc(dailyGames.gameDate))
    .limit(1);

  if (concludedGame && (marketClosed || !today?.winnerTicker)) {
    const msg =
      `Concluded game #${concludedGame.id} (${concludedGame.companyATicker} vs ${concludedGame.companyBTicker}, ` +
      `${concludedGame.gameDate}) is unscored, but the payload ${marketClosed ? "claims the market was closed" : "has no winnerTicker"}. ` +
      `Refusing to proceed — the game would be orphaned. If the market genuinely didn't trade that day, cancel or re-date the game in /admin.`;
    console.error("[daily-curation] Rejected:", msg);
    await notifyOwner({ title: "⚠️ Curation rejected — concluded game not scored", content: msg });
    return res.status(422).json({ error: "Concluded game not scored", detail: msg });
  }

  const closeGameId = !marketClosed && today?.winnerTicker ? concludedGame?.id : undefined;

  // Nothing to close (holiday, or nothing newly concluded) → leave the
  // staged draft untouched for a future run. Activation only ever happens
  // together with a close (the cadence invariant), so there's no partial
  // "activate without closing" here — exactly what the equivalent legacy
  // no-op guard (step 3b) would also do, since the staged draft IS the
  // "already queued" game that guard checks for.
  if (!closeGameId) {
    const msg = `Nothing to close (${marketClosed ? "market closed" : "no concluded game"}) — staged game #${stagedGame.id} left as draft for a future run.`;
    console.log("[daily-curation]", msg);
    return res.json({ ok: true, skipped: true, reason: msg });
  }

  // ── Determine winner — identical logic to the legacy path's step 4.
  // Open-to-close from the agent's prices is canonical; its own % and
  // winnerTicker only generate warnings (reported in the run summary). ──
  let winner: "A" | "B" | undefined;
  let settledPerfA = today?.companyAPerf;
  let settledPerfB = today?.companyBPerf;
  let settlementWarnings: string[] = [];
  const closingGameRows = await db.select().from(dailyGames).where(eq(dailyGames.id, closeGameId)).limit(1);
  if (closingGameRows[0]) {
    const settled = settleFromPrices({
      tickerA: closingGameRows[0].companyATicker,
      tickerB: closingGameRows[0].companyBTicker,
      winnerTicker: today!.winnerTicker!,
      companyAPerf: today!.companyAPerf,
      companyBPerf: today!.companyBPerf,
      companyAStartPrice: today!.companyAStartPrice,
      companyAEndPrice: today!.companyAEndPrice,
      companyBStartPrice: today!.companyBStartPrice,
      companyBEndPrice: today!.companyBEndPrice,
    });
    if ("error" in settled) {
      console.error("[daily-curation] settlement failed:", settled.error);
      await notifyOwner({ title: "⚠️ Curation rejected — settlement failed", content: settled.error });
      return res.status(422).json({ error: "Settlement failed", detail: settled.error });
    }
    winner = settled.winner;
    settledPerfA = settled.companyAPerf;
    settledPerfB = settled.companyBPerf;
    settlementWarnings = settled.warnings;
    for (const w of settlementWarnings) console.warn("[daily-curation] settlement:", w);
  }

  const endOfDayInput = {
    closeGameId,
    winner,
    companyAPerf: settledPerfA,
    companyBPerf: settledPerfB,
    companyAStartPrice: today?.companyAStartPrice,
    companyAEndPrice: today?.companyAEndPrice,
    companyBStartPrice: today?.companyBStartPrice,
    companyBEndPrice: today?.companyBEndPrice,
    resultSummary: today?.resultSummary,
    hindsightSpotlight: today?.hindsightSpotlight,
    activateStagedGameId: stagedGame.id,
  };

  const { appRouter } = await import("../routers");
  // Build a minimal admin context for the cron caller — identical convention
  // to the legacy path below.
  const caller = appRouter.createCaller({
    user: { id: 1, role: "admin" as const, clerkId: null, openId: null, email: null, name: "Cron", loginMethod: null, createdAt: new Date(), updatedAt: new Date(), displayName: null, awayStatus: false, awayStatusUntil: null, deactivated: false, tier: "free" as const, lastSignedIn: new Date(), emailOptIn: true, pushOptIn: true },
    req: req as any,
    res: res as any,
  });

  const result = await caller.admin.endOfDay(endOfDayInput);

  const elapsed = Date.now() - startTime;
  const warningNote = settlementWarnings.length
    ? ` Settlement warnings: ${settlementWarnings.join("; ")}.`
    : "";
  const summary = `Results-only curation completed in ${elapsed}ms. Closed game #${closeGameId} (winner: ${winner}, open-to-close ${settledPerfA}% vs ${settledPerfB}%).${warningNote} Activated staged game #${result.nextGameId} (${result.nextGameTickers}).`;
  console.log("[daily-curation]", summary);
  await notifyOwner({
    title: `✅ Daily curation complete — activated staged game (${result.nextGameTickers})`,
    content: summary,
  });
  return res.json({ ok: true, nextGameId: result.nextGameId, summary });
}

async function dailyCurationHandler(req: Request, res: Response) {
  const startTime = Date.now();
  if (applyInFlight) {
    return res.status(409).json({ error: "A curation payload is already being applied", alreadyRunning: true });
  }
  applyInFlight = true;
  try {
    // ── 1. Authenticate — shared-secret cron call ──
    if (!isAuthorisedCron(req)) {
      return res.status(403).json({ error: "cron-only endpoint" });
    }

    const body = req.body as CurationPayload;
    const { today, tomorrow, marketClosed } = body;

    // ── Payload routing (results-only vs legacy) ──
    // A results-only payload (stagedGameId set) skips the tomorrow/freshness/
    // C1-idempotency machinery below entirely — none of it applies, since
    // those guards exist to protect a NEW matchup proposal and this payload
    // isn't proposing one.
    const payloadKind = classifyCurationPayload(body);
    if (payloadKind === "results-only") {
      return await applyResultsOnlyCuration(body, todayInET(), req, res, startTime);
    }
    if (payloadKind === "invalid" || !tomorrow) {
      // The `!tomorrow` half is unreachable given classifyCurationPayload
      // above (payloadKind is only "legacy" when tomorrow is set) — it's
      // here purely so TypeScript narrows `tomorrow` to defined for the rest
      // of this function, since it can't see across the two variables.
      return res.status(400).json({ error: "Missing 'tomorrow' block in payload" });
    }

    // ── Market-closed day handling ──
    // If the agent signals the market was closed today (public holiday),
    // we skip all scoring/closing logic and only create tomorrow's game.
    if (marketClosed) {
      console.log("[daily-curation] Market closed today — skipping result scoring, creating next game only.");
    }

    const { getDb, getQueuedGameAfter } = await import("../db");
    const { dailyGames } = await import("../../drizzle/schema.js");
    const { lte, or, eq, and, asc } = await import("drizzle-orm");
    const db = await getDb();
    if (!db) return res.status(500).json({ error: "Database unavailable" });

    const todayEt = todayInET();

    // ── 2. Idempotency guard — was this exact payload already applied? ──
    // MUST run before freshness: once a run has created tomorrow's game, that
    // game's own row sits inside every freshness window, so a retried POST of
    // the SAME payload used to 422 as a "freshness violation" — the agent's
    // retry layer then reported failure for work that had actually succeeded,
    // and a half-created game (row inserted, research/question lost to a
    // mid-run crash) could never be repaired (audit finding C1, 2026-07-30).
    // endOfDay closes before it creates, so a matching next-game row proves
    // the close also already happened; the research/question upserts below
    // are idempotent and heal any half-created game.
    const sameProposal = await findMatchingProposal(db, tomorrow.gameDate, tomorrow.companyATicker, tomorrow.companyBTicker, ["draft", "active"]);
    if (sameProposal) {
      await upsertProposalContent(sameProposal.id, tomorrow);
      const msg = `Payload already applied — game ${sameProposal.id} (${tomorrow.companyATicker} vs ${tomorrow.companyBTicker}, ${tomorrow.gameDate}) exists; research/question re-upserted. No-op.`;
      console.log("[daily-curation]", msg);
      return res.json({ ok: true, alreadyApplied: true, nextGameId: sameProposal.id, summary: msg });
    }

    // ── 3. Determine the concluded game to close ──
    // The EARLIEST-dated active/locked game, i.e. the game whose trading day
    // has just concluded. Using desc() here would pick the latest (a future,
    // not-yet-played) game instead if more than one active/locked game ever
    // exists at once — which is exactly how games piled up unresolved in the
    // past (see references/munymo-handover-v2.md). The lte(gameDate, todayEt)
    // guard excludes future-dated games whose session hasn't happened yet.
    // Found INDEPENDENT of the payload's winner data: a concluded-but-unscored
    // game with no usable winner must fail loudly below, not silently skip the
    // close and orphan the game forever (audit finding C2).
    const [concludedGame] = await db
      .select({ id: dailyGames.id, gameDate: dailyGames.gameDate, companyATicker: dailyGames.companyATicker, companyBTicker: dailyGames.companyBTicker })
      .from(dailyGames)
      .where(
        and(
          or(eq(dailyGames.status, "active"), eq(dailyGames.status, "locked")),
          lte(dailyGames.gameDate, todayEt)
        )
      )
      .orderBy(asc(dailyGames.gameDate))
      .limit(1);

    if (concludedGame && (marketClosed || !today?.winnerTicker)) {
      // Previously this silently skipped the close, created the next game, and
      // sent a "✅ complete" email — leaving the concluded game locked forever
      // and wedging every subsequent night on a ticker-validation mismatch.
      const msg =
        `Concluded game #${concludedGame.id} (${concludedGame.companyATicker} vs ${concludedGame.companyBTicker}, ` +
        `${concludedGame.gameDate}) is unscored, but the payload ${marketClosed ? "claims the market was closed" : "has no winnerTicker"}. ` +
        `Refusing to proceed — the game would be orphaned. If the market genuinely didn't trade that day, cancel or re-date the game in /admin.`;
      console.error("[daily-curation] Rejected:", msg);
      await notifyOwner({ title: "⚠️ Curation rejected — concluded game not scored", content: msg });
      return res.status(422).json({ error: "Concluded game not scored", detail: msg });
    }

    const closeGameId = !marketClosed && today?.winnerTicker ? concludedGame?.id : undefined;

    // ── 3b. No-op guard ──
    // Nothing to close AND a next game already queued → this run has no work
    // (e.g. the nightly cron fired while the only active game's trading day is
    // still in the future). Succeed quietly instead of failing with a CONFLICT
    // from endOfDay's duplicate-game guard and emailing a false alarm.
    // Queued means draft/active only — a published or locked game at the
    // proposed date is NOT tomorrow's game (audit finding M1).
    const queuedAhead = await getQueuedGameAfter(todayEt);
    if (!closeGameId && queuedAhead) {
      const msg = `Nothing to close and a game is already queued (id ${queuedAhead.id}, ${queuedAhead.gameDate}, ${queuedAhead.status}) — no-op.`;
      console.log("[daily-curation]", msg);
      return res.json({ ok: true, skipped: true, reason: msg });
    }

    // ── 4. Freshness validation — only when the proposal will actually be used ──
    // A queued game ahead means endOfDay's cadence guard will keep it and
    // discard this proposal, so rejecting the whole run (close included!) over
    // the discarded proposal's staleness held today's scoring hostage to
    // tomorrow's content (audit: freshness-hostage coupling). This is a final
    // safety net — the agent pre-confirms via /api/scheduled/check-freshness.
    if (!queuedAhead) {
      const recentGamesForFreshness = await fetchGamesWithinMatchupWindow(db);
      const violations = checkFreshness(recentGamesForFreshness, tomorrow.sector, tomorrow.companyATicker, tomorrow.companyBTicker);
      if (violations.length > 0) {
        const msg = `Freshness rule violations:\n${violations.join("\n")}`;
        console.warn("[daily-curation] Rejected:", msg);
        await notifyOwner({ title: "⚠️ Curation rejected — freshness violations", content: msg });
        return res.status(422).json({ error: "Freshness rule violations", violations });
      }
    }

    // ── 4. Determine winner (open-to-close from prices is canonical) ──
    let winner: "A" | "B" | undefined;
    let settledPerfA = today?.companyAPerf;
    let settledPerfB = today?.companyBPerf;
    let settlementWarnings: string[] = [];
    if (!marketClosed && today && today.winnerTicker && closeGameId) {
      const game = await db.select().from(dailyGames).where(eq(dailyGames.id, closeGameId)).limit(1);
      if (game[0]) {
        const settled = settleFromPrices({
          tickerA: game[0].companyATicker,
          tickerB: game[0].companyBTicker,
          winnerTicker: today.winnerTicker,
          companyAPerf: today.companyAPerf,
          companyBPerf: today.companyBPerf,
          companyAStartPrice: today.companyAStartPrice,
          companyAEndPrice: today.companyAEndPrice,
          companyBStartPrice: today.companyBStartPrice,
          companyBEndPrice: today.companyBEndPrice,
        });
        if ("error" in settled) {
          console.error("[daily-curation] settlement failed:", settled.error);
          await notifyOwner({ title: "⚠️ Curation rejected — settlement failed", content: settled.error });
          return res.status(422).json({ error: "Settlement failed", detail: settled.error });
        }
        winner = settled.winner;
        settledPerfA = settled.companyAPerf;
        settledPerfB = settled.companyBPerf;
        settlementWarnings = settled.warnings;
        for (const w of settlementWarnings) console.warn("[daily-curation] settlement:", w);
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
    // Lockout is ALWAYS server-computed (9:30 AM America/New_York, DST-safe) —
    // the agent's own value is checked only to log drift (audit finding M2:
    // a wrong LLM DST guess could lock players out early, or leave picks open
    // into the live session; a missing value disabled lockout entirely).
    const lockoutAt = expectedLockoutIso(tomorrow.gameDate);
    const agentLockout = tomorrow.lockoutTime ?? tomorrow.lockoutAt;
    if (agentLockout) {
      try {
        const agentIso = new Date(agentLockout).toISOString();
        if (agentIso !== lockoutAt) {
          console.warn(`[daily-curation] Agent lockout ${agentIso} != server-computed ${lockoutAt} — using server value`);
        }
      } catch {
        console.warn(`[daily-curation] Agent lockout unparseable (${agentLockout}) — using server value ${lockoutAt}`);
      }
    }
    const endOfDayInput = {
      closeGameId,
      winner,
      companyAPerf: settledPerfA,
      companyBPerf: settledPerfB,
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
      nextSourceUrl: tomorrow.sourceUrl,
      nextSourceTitle: tomorrow.sourceTitle,
      nextSourcePublisher: tomorrow.sourcePublisher,
      nextLockoutAt: lockoutAt,
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
    // `marketClosed` covers TWO cases: a genuine market holiday, OR simply no
    // completed game was due to be scored (e.g. the only pending game's session
    // hasn't happened yet). Don't assert "public holiday" — it isn't always true.
    const closedNote = marketClosed
      ? "No game was scored today — no completed game was due (market holiday, or the pending game's session hasn't concluded yet)."
      : closeGameId
        ? `Closed game #${closeGameId} (winner: ${winner}, open-to-close ${settledPerfA}% vs ${settledPerfB}%).` +
          (settlementWarnings.length ? ` Settlement warnings: ${settlementWarnings.join("; ")}.` : "")
        : "No game closed (first game).";
    // Reflect whether we actually created the next game or the cadence guard
    // kept an already-queued one (in which case the agent's proposal was discarded).
    const nextNote = result.nextGameCreated
      ? `Next game: ${tomorrow.companyATicker} vs ${tomorrow.companyBTicker} on ${tomorrow.gameDate}.`
      : `Next game already queued — kept ${result.nextGameTickers} on ${result.nextGameDate} (cadence guard; proposed ${tomorrow.companyATicker} vs ${tomorrow.companyBTicker} for ${tomorrow.gameDate} discarded).`;
    const summary = `Daily curation completed in ${elapsed}ms. ${nextNote} ${closedNote}`;
    console.log("[daily-curation]", summary);

    await notifyOwner({
      title: result.nextGameCreated
        ? `✅ Daily curation complete — ${tomorrow.companyATicker} vs ${tomorrow.companyBTicker}`
        : `✅ Daily curation complete — game closed, next already existed`,
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
  } finally {
    applyInFlight = false;
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────
/** Shape of the `tomorrow` block — shared by the full daily-curation payload
 *  and the Phase A stage-game payload, since staging proposes exactly the
 *  same "next game" content, just delivered earlier and to a different
 *  endpoint. */
interface CurationTomorrow {
  exchange?: string;
  gameDate: string;
  sector?: string;
  companyAName: string;
  companyATicker: string;
  companyBName: string;
  companyBTicker: string;
  pairingRationale?: string;
  /** The news article that supplied the "buzz" signal for this matchup. */
  sourceUrl?: string;
  sourceTitle?: string;
  sourcePublisher?: string;
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
}

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
  /** Phase B results-only payload: references the game Phase A already
   *  staged as a draft instead of proposing a new `tomorrow`. */
  stagedGameId?: number;
  /** Required for the legacy combined payload; absent for a results-only
   *  payload (stagedGameId is set instead — nothing new is being proposed). */
  tomorrow?: CurationTomorrow;
}

/** Phase A payload — stages tomorrow's game as a hidden draft ahead of close. */
interface StageGamePayload {
  tomorrow: CurationTomorrow;
}

// ─── POST /api/scheduled/stage-game ──────────────────────────────────────────
/**
 * Phase A (afternoon staging): creates tomorrow's game as a hidden `draft`
 * ("in the trolley") hours before close, so the failure-prone research work
 * gets the afternoon's retry runway instead of racing the post-close
 * deadline. Mirrors dailyCurationHandler's guards (C1 idempotency via
 * findMatchingProposal, the SAME applyInFlight mutex, the cadence "queued
 * game" no-op, freshness) but never closes/scores anything — that stays
 * exclusively daily-curation's job. See
 * references/afternoon-curation-split-spec.md.
 *
 * Golden safety property: if this handler never runs, or fails outright, no
 * draft gets created and runDailyCuration's Phase B pre-check falls back to
 * today's proven combined behavior automatically — nothing here is on the
 * critical path for a game going live.
 */
async function stageGameHandler(req: Request, res: Response) {
  const startTime = Date.now();
  // ── 1. Auth + in-flight mutex — the SAME lock as daily-curation, so a
  // staging run and a full post-close run can never apply concurrently. ──
  if (applyInFlight) {
    return res.status(409).json({ error: "A curation payload is already being applied", alreadyRunning: true });
  }
  applyInFlight = true;
  try {
    if (!isAuthorisedCron(req)) {
      return res.status(403).json({ error: "cron-only endpoint" });
    }

    const body = req.body as StageGamePayload;
    const { tomorrow } = body;
    if (!tomorrow) {
      return res.status(400).json({ error: "Missing 'tomorrow' block in payload" });
    }

    const { getDb, getQueuedGameAfter, getTodayGame, createOrReviveGame } = await import("../db");
    const db = await getDb();
    if (!db) return res.status(500).json({ error: "Database unavailable" });

    const todayEt = todayInET();

    // ── 2. Idempotency (C1 mirror) — a draft/active/locked game already at
    // tomorrow.gameDate with the SAME tickers means this exact staging
    // proposal (or a retried equivalent) was already applied. ──
    const sameProposal = await findMatchingProposal(db, tomorrow.gameDate, tomorrow.companyATicker, tomorrow.companyBTicker, ["draft", "active", "locked"]);
    if (sameProposal) {
      await upsertProposalContent(sameProposal.id, tomorrow);
      const msg = `Staging payload already applied — game ${sameProposal.id} (${tomorrow.companyATicker} vs ${tomorrow.companyBTicker}, ${tomorrow.gameDate}) exists; research/question re-upserted. No-op.`;
      console.log("[stage-game]", msg);
      return res.json({ ok: true, alreadyApplied: true, stagedGameId: sameProposal.id, summary: msg });
    }

    // ── 3. Cadence — never two queued games. If ANY draft/active game
    // already exists after today, this proposal is discarded quietly; the
    // pre-existing one wins, same call the daily-curation cadence guard makes. ──
    const queuedAhead = await getQueuedGameAfter(todayEt);
    if (queuedAhead) {
      const msg = `A game is already queued (id ${queuedAhead.id}, ${queuedAhead.gameDate}, ${queuedAhead.status}) — no-op, proposed ${tomorrow.companyATicker} vs ${tomorrow.companyBTicker} for ${tomorrow.gameDate} discarded.`;
      console.log("[stage-game]", msg);
      return res.json({ ok: true, skipped: true, reason: msg });
    }

    // ── 4. Freshness validation ──
    const recentGamesForFreshness = await fetchGamesWithinMatchupWindow(db);
    const violations = checkFreshness(recentGamesForFreshness, tomorrow.sector, tomorrow.companyATicker, tomorrow.companyBTicker);
    if (violations.length > 0) {
      const msg = `Freshness rule violations:\n${violations.join("\n")}`;
      console.warn("[stage-game] Rejected:", msg);
      return res.status(422).json({ error: "Freshness rule violations", violations });
    }

    // ── 5. Create as a hidden draft ("in the trolley") — lockoutAt is ALWAYS
    // server-computed, same as daily-curation (audit finding M2). A cancelled
    // row at this date is revived in place (C3 mirror) rather than dup-keying. ──
    const lockoutAt = expectedLockoutIso(tomorrow.gameDate);
    const existingAtDate = await getTodayGame(tomorrow.gameDate);
    const cancelledAtDate = existingAtDate?.status === "cancelled" ? existingAtDate : undefined;
    const nextGameFields = {
      gameDate: tomorrow.gameDate,
      exchange: tomorrow.exchange ?? "NASDAQ",
      companyAName: tomorrow.companyAName,
      companyATicker: tomorrow.companyATicker,
      companyBName: tomorrow.companyBName,
      companyBTicker: tomorrow.companyBTicker,
      sector: tomorrow.sector,
      pairingRationale: tomorrow.pairingRationale,
      sourceUrl: tomorrow.sourceUrl,
      sourceTitle: tomorrow.sourceTitle,
      sourcePublisher: tomorrow.sourcePublisher,
      lockoutAt: new Date(lockoutAt),
      // Cron-triggered — no admin session; id 1 ("Cron") is the same
      // convention dailyCurationHandler uses for its admin.endOfDay caller context.
      createdBy: 1,
      status: "draft" as const,
    };
    if (cancelledAtDate) {
      console.warn(`[stage-game] Reviving cancelled game #${cancelledAtDate.id} at ${tomorrow.gameDate} as a staged draft (gameDate is unique — inserting would dup-key).`);
    }
    const stagedGameId = await createOrReviveGame(nextGameFields, cancelledAtDate);
    await upsertProposalContent(stagedGameId, tomorrow);

    const elapsed = Date.now() - startTime;
    const summary = `Staged ${tomorrow.companyATicker} vs ${tomorrow.companyBTicker} for ${tomorrow.gameDate} as draft #${stagedGameId} in ${elapsed}ms.`;
    console.log("[stage-game]", summary);
    await notifyOwner({
      title: `✅ Afternoon staging complete — ${tomorrow.companyATicker} vs ${tomorrow.companyBTicker}`,
      content: summary,
    });
    return res.json({ ok: true, stagedGameId, summary });

  } catch (err: any) {
    const elapsed = Date.now() - startTime;
    const errMsg = err?.message ?? String(err);
    console.error("[stage-game] Error:", errMsg);
    // No email here — this is one HTTP call inside the agent's whole-run
    // retry loop, and the ONLY staging email is the calm ⚠️ final-failure
    // note runStagingCuration sends after every retry is exhausted (spec:
    // never the ❌ manual-action email for Phase A). Emailing per-attempt
    // here would just be noise on top of that.
    return res.status(500).json({
      error: errMsg,
      timestamp: new Date().toISOString(),
    });
  } finally {
    applyInFlight = false;
  }
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
    const { buildStreakAtRiskEmail, buildFinishYourPickEmail, sendEmail } = await import("../email");
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
    const { sendPushToUsers } = await import("../push");
    let sent = 0;
    let pushed = 0;
    let skipped = 0;

    for (const u of allUsers) {
      if (u.deactivated) { skipped++; continue; }
      const canPush = u.pushOptIn !== false;
      const canEmail = Boolean(u.email) && u.emailOptIn !== false;
      if (!canPush && !canEmail) { skipped++; continue; }

      const streak = await getStreakForUser(u.id);
      if (streak?.awayStatus === "away") { skipped++; continue; }

      const pick = await getPlayerPick(u.id, game.id);
      if (pick?.finalSelection) { skipped++; continue; } // already submitted

      const hasStreak = (streak?.currentStreak ?? 0) > 0;

      // A player with no streak yet used to be skipped outright, which meant
      // the reminder could never reach anyone on their FIRST game — a streak
      // is only written at scoring time, hours after lockout. That is how the
      // first real signup was lost. Now they get a different email, but only
      // if they actually started: someone who made a gut pick has shown
      // intent and left the game half-finished. Emailing users who haven't
      // engaged at all would just be daily spam, so they're still skipped.
      if (!hasStreak && !pick?.gutSelection) { skipped++; continue; }

      // Push first. These two reminders used to be email-only, so a player
      // who relies on push never got the nudge that does the most retention
      // work. A tap opens the app on today's game, signed in. Only if push
      // reaches none of their devices do we fall back to email.
      if (canPush) {
        const minutes = Math.max(1, Math.round(msUntilLockout / 60000));
        const pushResult = await sendPushToUsers([u.id], hasStreak
          ? {
              title: `Your ${streak?.currentStreak ?? 1}-day streak is at risk`,
              body: `${game.companyATicker} vs ${game.companyBTicker} locks in about ${minutes} minutes. One pick keeps the chain going.`,
              url: "/game",
              tag: `munymo-streak-${game.id}`,
            }
          : {
              title: `Finish your pick: ${game.companyATicker} vs ${game.companyBTicker}`,
              body: `Your gut pick is in. Read the research and lock your final call — about ${minutes} minutes left.`,
              url: "/game",
              tag: `munymo-finish-${game.id}`,
            });
        if (pushResult.reachedUserIds.includes(u.id)) { pushed++; continue; }
      }
      if (!canEmail || !u.email) { skipped++; continue; }

      // Shared helper: good until used or until the next game's link replaces
      // it (see magicLink.ts) — not a flat TTL.
      const { createMagicLink } = await import("./magicLink");
      const magicLink = await createMagicLink(u.clerkId, "/game", ENV.clerkSecretKey, {
        purpose: "play",
        date: game.gameDate,
      });

      const { subject, html } = hasStreak
        ? buildStreakAtRiskEmail({
            playerName: u.name,
            currentStreak: streak?.currentStreak ?? 1,
            companyAName: game.companyAName,
            companyATicker: game.companyATicker,
            companyBName: game.companyBName,
            companyBTicker: game.companyBTicker,
            lockoutAt,
            magicLink,
          })
        : buildFinishYourPickEmail({
            playerName: u.name,
            // Guarded above: no streak means we only get here with a gut pick.
            gutSelection: pick!.gutSelection as "A" | "B",
            companyAName: game.companyAName,
            companyATicker: game.companyATicker,
            companyBName: game.companyBName,
            companyBTicker: game.companyBTicker,
            lockoutAt,
            magicLink,
          });

      const result = await sendEmail({ to: u.email, subject, html, unsubscribeUrl: buildUnsubscribeUrl(u.id) });
      if (result.success) sent++; else skipped++;
    }

    console.log(`[streak-at-risk] Pushed: ${pushed}, emailed: ${sent}, skipped: ${skipped}`);
    return res.json({ ok: true, pushed, sent, skipped });

  } catch (err) {
    console.error("[streak-at-risk] Error:", err);
    return res.status(500).json({ error: String(err) });
  }
}

// ─── Registration ─────────────────────────────────────────────────────────────
export function registerScheduledCuration(app: Express) {
  app.get("/api/scheduled/recent-games", recentGamesHandler);
  app.post("/api/scheduled/check-freshness", checkFreshnessHandler);
  app.post("/api/scheduled/daily-curation", dailyCurationHandler);
  app.post("/api/scheduled/stage-game", stageGameHandler);
  app.post("/api/scheduled/streak-at-risk", streakAtRiskHandler);
}
