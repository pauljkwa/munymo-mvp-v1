import { describe, expect, it } from "vitest";
import {
  aiCostByMonth,
  defaultCategoryForVendor,
  groupVendorCosts,
  summarizeTurns,
  type AiUsageRowLike,
} from "@shared/aiUsage";
import { vendorCostInputSchema } from "@shared/vendorCostSchema";
import { newRunId, nextTurnIndex, recordAiRun, recordAiTurn } from "./_core/aiUsage";

const NOW = new Date("2026-10-17T12:00:00Z");

function row(over: Partial<AiUsageRowLike>): AiUsageRowLike {
  return {
    rowKind: "turn",
    runId: "r1",
    runKind: "daily_combined",
    trigger: "cron-1615",
    gameDate: "2026-10-16",
    inputTokens: 0,
    cacheReadTokens: 0,
    cacheWrite5mTokens: 0,
    cacheWrite1hTokens: 0,
    webSearchRequests: 0,
    failedOver: false,
    estimatedCostUsd: "0.100000",
    outcome: null,
    errorMessage: null,
    submitAttempts: null,
    durationMs: 1000,
    createdAt: new Date("2026-10-16T20:20:00Z"),
    ...over,
  };
}

describe("summarizeTurns", () => {
  const rows: AiUsageRowLike[] = [
    // 10-16: two turns (one on the failover model), one failed run
    row({ runId: "a", inputTokens: 1_000, cacheReadTokens: 9_000, estimatedCostUsd: "0.250000", webSearchRequests: 3 }),
    row({ runId: "a", failedOver: true, inputTokens: 1_000, cacheReadTokens: 0, cacheWrite1hTokens: 8_000, estimatedCostUsd: "0.750000", webSearchRequests: 2 }),
    row({ rowKind: "run", runId: "a", outcome: "failed", errorMessage: "boom", estimatedCostUsd: "1.000000", createdAt: new Date("2026-10-16T21:00:00Z") }),
    // 10-15: one turn with an unpriced model, one successful run
    row({ runId: "b", gameDate: "2026-10-15", estimatedCostUsd: null, inputTokens: 500, createdAt: new Date("2026-10-15T20:20:00Z") }),
    row({ rowKind: "run", runId: "b", gameDate: "2026-10-15", outcome: "success", estimatedCostUsd: null, createdAt: new Date("2026-10-15T20:40:00Z") }),
    // September turn: inside the last 30 days, outside month-to-date
    row({ runId: "c", gameDate: "2026-09-25", estimatedCostUsd: "2.000000", createdAt: new Date("2026-09-25T20:20:00Z") }),
    // One-off call with no game date: counts toward spend, not toward any game day
    row({ runId: "d", runKind: "metric_explanation", gameDate: null, estimatedCostUsd: "0.050000", createdAt: new Date("2026-10-14T10:00:00Z") }),
  ];

  const s = summarizeTurns(rows, { now: NOW, days: 30 });

  it("sums turn rows only (run rows are not double-counted)", () => {
    expect(s.monthToDateUsd).toBeCloseTo(0.25 + 0.75 + 0.05, 6);
    expect(s.last30DaysUsd).toBeCloseTo(0.25 + 0.75 + 0.05 + 2, 6);
  });

  it("counts turns with no price as unpriced", () => {
    expect(s.unpricedTurns).toBe(1);
  });

  it("groups by game date, newest first, with failure and failover counts", () => {
    expect(s.byGameDate.map((d) => d.gameDate)).toEqual(["2026-10-16", "2026-10-15", "2026-09-25"]);
    expect(s.byGameDate[0]).toEqual({
      gameDate: "2026-10-16",
      costUsd: 1,
      turns: 2,
      runs: 1,
      failedRuns: 1,
      failoverTurns: 1,
      webSearches: 5,
    });
    expect(s.byGameDate[1]).toMatchObject({ turns: 1, costUsd: 0, runs: 1, failedRuns: 0 });
  });

  it("lists runs newest first with cost and error", () => {
    expect(s.runs[0]).toMatchObject({ runId: "a", outcome: "failed", errorMessage: "boom", costUsd: 1 });
    expect(s.runs[1]).toMatchObject({ runId: "b", outcome: "success", costUsd: null });
  });

  it("computes cache hit rate over input-side tokens", () => {
    // 9,000 cache-read tokens out of 10,000 + 9,000 + 500 input-side tokens across the window's turns
    expect(s.cacheHitRate).toBeCloseTo(9_000 / (10_000 + 9_000 + 500), 6);
  });

  it("returns a null hit rate when there are no turns", () => {
    expect(summarizeTurns([], { now: NOW }).cacheHitRate).toBeNull();
  });

  it("narrows the per-day table to the requested window", () => {
    const narrow = summarizeTurns(rows, { now: NOW, days: 3 });
    expect(narrow.byGameDate.map((d) => d.gameDate)).toEqual(["2026-10-16", "2026-10-15"]);
    expect(narrow.last30DaysUsd).toBeCloseTo(s.last30DaysUsd, 6);
  });
});

describe("groupVendorCosts", () => {
  const entries = [
    { id: 1, month: "2026-10", vendor: "Railway", category: "run", amount: "20.00", currency: "USD", note: null },
    { id: 2, month: "2026-10", vendor: "Anthropic API", category: "run", amount: "31.40", currency: "USD", note: null },
    { id: 3, month: "2026-10", vendor: "Claude Max plan", category: "build", amount: "100.00", currency: "USD", note: null },
    { id: 4, month: "2026-10", vendor: "Domain", category: "run", amount: "25.50", currency: "AUD", note: "annual" },
    { id: 5, month: "2026-09", vendor: "Railway", category: "run", amount: "18.00", currency: "USD", note: null },
  ];

  it("totals each category per currency, newest month first", () => {
    const months = groupVendorCosts(entries);
    expect(months.map((m) => m.month)).toEqual(["2026-10", "2026-09"]);
    expect(months[0].totals.run).toEqual({ USD: 51.4, AUD: 25.5 });
    expect(months[0].totals.build).toEqual({ USD: 100 });
    expect(months[1].totals.build).toEqual({});
  });

  it("puts the computed Anthropic figure beside the entered one", () => {
    const months = groupVendorCosts(entries, { "2026-10": 29.87, "2026-08": 4 });
    expect(months.map((m) => m.month)).toEqual(["2026-10", "2026-09", "2026-08"]);
    expect(months[0]).toMatchObject({ computedAnthropicUsd: 29.87, enteredAnthropicUsd: 31.4 });
    expect(months[1]).toMatchObject({ computedAnthropicUsd: null, enteredAnthropicUsd: null });
    expect(months[2].entries).toEqual([]);
  });
});

describe("aiCostByMonth", () => {
  it("sums priced turn rows per UTC month", () => {
    const out = aiCostByMonth([
      { rowKind: "turn", estimatedCostUsd: "1.5", createdAt: new Date("2026-10-01T00:00:00Z") },
      { rowKind: "turn", estimatedCostUsd: null, createdAt: new Date("2026-10-02T00:00:00Z") },
      { rowKind: "run", estimatedCostUsd: "1.5", createdAt: new Date("2026-10-02T00:00:00Z") },
      { rowKind: "turn", estimatedCostUsd: "2", createdAt: new Date("2026-09-30T23:59:00Z") },
    ]);
    expect(out).toEqual({ "2026-10": 1.5, "2026-09": 2 });
  });
});

describe("vendor ledger helpers", () => {
  const ok = { month: "2026-10", vendor: "Railway", category: "run", amount: 20, currency: "USD" };

  it("accepts a valid entry", () => {
    expect(vendorCostInputSchema.safeParse(ok).success).toBe(true);
    expect(vendorCostInputSchema.safeParse({ ...ok, note: "annual renewal" }).success).toBe(true);
  });

  it("rejects a bad month string", () => {
    for (const month of ["2026-1", "10-2026", "2026-13", "2026-00", "2026/10", "October"]) {
      expect(vendorCostInputSchema.safeParse({ ...ok, month }).success, month).toBe(false);
    }
  });

  it("rejects a negative amount and a malformed currency", () => {
    expect(vendorCostInputSchema.safeParse({ ...ok, amount: -1 }).success).toBe(false);
    expect(vendorCostInputSchema.safeParse({ ...ok, currency: "usd" }).success).toBe(false);
    expect(vendorCostInputSchema.safeParse({ ...ok, currency: "US" }).success).toBe(false);
  });

  it("defaults Claude Max plan to a build cost and everything else to run", () => {
    expect(defaultCategoryForVendor("Claude Max plan")).toBe("build");
    expect(defaultCategoryForVendor("Railway")).toBe("run");
    expect(defaultCategoryForVendor("Something new")).toBe("run");
  });
});

describe("newRunId", () => {
  it("fits the runId column and follows the documented format", () => {
    for (const kind of ["daily_combined", "daily_results_only", "staging", "backfill_highlights", "metric_explanation"] as const) {
      const id = newRunId(kind);
      expect(id.length).toBeLessThanOrEqual(40);
      expect(id).toMatch(new RegExp(`^${kind}-\\d{13}-[0-9a-f]{4}$`));
    }
  });
});

describe("logging module without a database", () => {
  it("never throws and writes nothing (no connection in the suite)", async () => {
    const ctx = { runId: newRunId("staging"), runKind: "staging" as const, trigger: "cron-1445", gameDate: "2026-10-16" };
    await expect(
      recordAiTurn(ctx, {
        model: "claude-sonnet-5",
        turnIndex: nextTurnIndex(ctx),
        usage: { input_tokens: 1, output_tokens: 1 } as never,
        stopReason: "end_turn",
        retries: 0,
        failedOver: false,
        durationMs: 5,
      })
    ).resolves.toBeUndefined();
    await expect(recordAiRun(ctx, { outcome: "success", durationMs: 5 })).resolves.toBeUndefined();
    expect(nextTurnIndex(ctx)).toBe(2);
  });
});
