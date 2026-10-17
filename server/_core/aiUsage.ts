/**
 * Running-costs ledger: writes one ai_usage_log row per Anthropic API call
 * ("turn") and one summary row per run (references/running-costs-ledger-spec.md §4).
 *
 * Every function here swallows its own errors with console.error and never
 * throws: a logging failure must never cost a game day. When the database is
 * unreachable (tests, local dev, or before the migration has been applied in
 * production) the functions return without writing.
 */
import { randomBytes } from "node:crypto";
import { eq, and, sql } from "drizzle-orm";
import type Anthropic from "@anthropic-ai/sdk";
import { aiUsageLog } from "../../drizzle/schema";
import { AI_PRICING, estimateCostUsd, normalizeUsage } from "@shared/aiPricing";
import { getDb } from "../db";

export type AiRunKind =
  | "daily_combined"
  | "daily_results_only"
  | "staging"
  | "backfill_highlights"
  | "metric_explanation";

export type AiRunContext = {
  runId: string;
  runKind: AiRunKind;
  trigger: string;
  /** US-Eastern trading date the run was told; undefined for one-off calls. */
  gameDate?: string;
  /** Running count of turns logged for this run (used by nextTurnIndex). */
  turnCount?: number;
};

/** `<runKind>-<epoch ms>-<4 random hex>`; at most 40 characters for the runId column. */
export function newRunId(runKind: AiRunKind): string {
  return `${runKind}-${Date.now()}-${randomBytes(2).toString("hex")}`;
}

/** 1-based position of the next turn within the run. */
export function nextTurnIndex(ctx: AiRunContext): number {
  ctx.turnCount = (ctx.turnCount ?? 0) + 1;
  return ctx.turnCount;
}

export async function recordAiTurn(
  ctx: AiRunContext,
  turn: {
    model: string;
    turnIndex: number;
    usage: Anthropic.Usage;
    stopReason: string | null;
    retries: number;
    failedOver: boolean;
    durationMs: number;
  }
): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    const u = normalizeUsage(turn.usage);
    const cost = estimateCostUsd(turn.model, turn.usage);
    await db.insert(aiUsageLog).values({
      rowKind: "turn",
      runId: ctx.runId,
      runKind: ctx.runKind,
      trigger: ctx.trigger.slice(0, 32),
      gameDate: ctx.gameDate ?? null,
      model: turn.model.slice(0, 40),
      turnIndex: turn.turnIndex,
      inputTokens: u.inputTokens,
      cacheReadTokens: u.cacheReadTokens,
      cacheWrite5mTokens: u.cacheWrite5mTokens,
      cacheWrite1hTokens: u.cacheWrite1hTokens,
      outputTokens: u.outputTokens,
      webSearchRequests: u.webSearchRequests,
      stopReason: turn.stopReason ? turn.stopReason.slice(0, 24) : null,
      retries: turn.retries,
      failedOver: turn.failedOver,
      estimatedCostUsd: cost === null ? null : cost.toFixed(6),
      pricingVersion: AI_PRICING.effectiveDate,
      durationMs: Math.round(turn.durationMs),
    });
  } catch (err) {
    console.error("[ai-usage] Failed to record turn (ignored):", err);
  }
}

export async function recordAiRun(
  ctx: AiRunContext,
  run: {
    outcome: "success" | "failed" | "skipped";
    errorMessage?: string;
    submitAttempts?: number;
    durationMs: number;
  }
): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    // Sum the run's own turn rows. If any turn was unpriced the total would be
    // misleadingly low, so the run is left unpriced too.
    const [agg] = await db
      .select({
        cost: sql<string | null>`sum(${aiUsageLog.estimatedCostUsd})`,
        turns: sql<number>`count(*)`,
        unpriced: sql<number>`sum(case when ${aiUsageLog.estimatedCostUsd} is null then 1 else 0 end)`,
      })
      .from(aiUsageLog)
      .where(and(eq(aiUsageLog.runId, ctx.runId), eq(aiUsageLog.rowKind, "turn")));
    const turns = Number(agg?.turns ?? 0);
    const unpriced = Number(agg?.unpriced ?? 0);
    const totalCost = turns === 0 ? 0 : unpriced > 0 ? null : Number(agg?.cost ?? 0);

    await db.insert(aiUsageLog).values({
      rowKind: "run",
      runId: ctx.runId,
      runKind: ctx.runKind,
      trigger: ctx.trigger.slice(0, 32),
      gameDate: ctx.gameDate ?? null,
      estimatedCostUsd: totalCost === null ? null : totalCost.toFixed(6),
      pricingVersion: AI_PRICING.effectiveDate,
      outcome: run.outcome,
      errorMessage: run.errorMessage ? run.errorMessage.slice(0, 2000) : null,
      submitAttempts: run.submitAttempts ?? null,
      durationMs: Math.round(run.durationMs),
    });
  } catch (err) {
    console.error("[ai-usage] Failed to record run (ignored):", err);
  }
}
