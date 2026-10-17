# Running-Costs Ledger: AI usage log + vendor bills

**Date:** 2026-10-17. **Status: approved by Paul in chat 2026-10-17 (both tables, Max plan as a build cost). Build in progress.** Builder: a cheaper model (Sonnet) implements from this spec; Fable reviews the diff. Decided in chat 2026-10-17: the dashboard itself comes later; this spec is only the data capture that cannot be reconstructed after the fact, plus the smallest admin surface needed to see and enter it.

## 1. Why now

The curation agent (`server/_core/curationAgent.ts`) already reads the token counts on every Anthropic call and prints them with `console.log` at the end of each turn (search for `cache_read=` in that file). Railway rotates those logs away, so nothing survives. Every other number a future dashboard might want (players, games, picks, streaks, survey votes, referral events) already sits in the database and can be summarised any time. The Anthropic spend is the one stream that is lost daily, and the vendor invoices are the one stream nobody records at all. Both start on the day this ships; there is no backfill (Railway's log retention is too short to make a log parser worth writing).

## 2. What we are making

1. **`ai_usage_log`**: one row per Anthropic API call made by the app, plus one summary row per curation run, with tokens, model, trigger and an estimated US-dollar cost computed at write time.
2. **`vendor_costs`**: a monthly ledger Paul fills in by hand from each invoice (Railway, TiDB, Clerk, Resend, Cloudflare, domain, Anthropic Console, Claude Max plan).
3. A small **/admin/costs** page: month-to-date AI spend, cost per game day, run outcomes, and the vendor ledger with an inline entry form. No charts in this phase.

Everything else from the 2026-10-17 chat (player retention tiles, Search Console pulls, unit economics) is deliberately out of scope and waits for guest play and real players.

## 3. Schema (two new tables, nothing else touched)

Both tables are additive. No existing column changes. Builder generates the migration with the usual Drizzle flow (see section 9); Paul applies it by hand the way migrations 0018 and 0020 were applied.

### 3.1 `ai_usage_log`

Add to `drizzle/schema.ts` after `marketVotes`, in the house style (camelCase column names, `int` autoincrement id, `createdAt` default now, comments explaining non-obvious columns).

| Column | Type | Notes |
|---|---|---|
| `id` | int autoincrement PK | |
| `rowKind` | varchar(8) not null | `turn` (one API call) or `run` (one summary row written when a curation run ends). Aggregations filter on this. |
| `runId` | varchar(40) not null | Groups the turns of one run with its summary row. Format `<runKind>-<epoch ms>-<4 random hex>`, generated once at run start. One-off calls (backfill, metric explanation) get their own runId per invocation. |
| `runKind` | varchar(32) not null | One of: `daily_combined`, `daily_results_only`, `staging`, `backfill_highlights`, `metric_explanation`. |
| `trigger` | varchar(32) not null | What started it: `cron-1445`, `cron-1530-watchdog`, `cron-1615`, `watchdog-1715ET` / `1815ET` / `1915ET` (the existing strings from `index.ts`), `boot-sweep`, `admin-button`, `api-endpoint`, `admin-backfill`, `player-request`. |
| `gameDate` | varchar(10) | The US-Eastern trading date the run was told (`todayEt`). Null for one-off calls. This is the key for "cost per game day". |
| `model` | varchar(40) | The model that actually served the call, after any failover. Null on `run` rows. |
| `turnIndex` | int | 1-based position within the run (the `i + 1` already printed). Null on `run` rows. |
| `inputTokens` | int | `usage.input_tokens` |
| `cacheReadTokens` | int | `usage.cache_read_input_tokens ?? 0` |
| `cacheWrite5mTokens` | int | `usage.cache_creation?.ephemeral_5m_input_tokens ?? 0` |
| `cacheWrite1hTokens` | int | `usage.cache_creation?.ephemeral_1h_input_tokens`. If the breakdown object is absent, put the whole `cache_creation_input_tokens` here, because every cached call in this codebase uses the 1h TTL. |
| `outputTokens` | int | `usage.output_tokens` |
| `webSearchRequests` | int | `usage.server_tool_use?.web_search_requests ?? 0` |
| `stopReason` | varchar(24) | `end_turn`, `pause_turn`, `tool_use`, `max_tokens`, `refusal` |
| `retries` | int | How many transient-error retries preceded this successful turn (0 normally). |
| `failedOver` | boolean not null default false | True when the turn ran on `MODEL_FALLBACK`. |
| `estimatedCostUsd` | decimal(10,6) | Computed at write time from the rate table (section 5). Null when the model is not in the rate table. On `run` rows: the sum of the run's turns. |
| `pricingVersion` | varchar(10) | The `effectiveDate` of the rate table used, so rows can be re-priced later if a rate was wrong. |
| `outcome` | varchar(16) | `run` rows only: `success`, `failed`, `skipped`. |
| `errorMessage` | text | `run` rows only: the final error's message when `failed`. |
| `submitAttempts` | int | `run` rows only: how many payload submissions it took (freshness retries). |
| `durationMs` | int | Turn rows: wall time of the API call. Run rows: whole run. |
| `createdAt` | timestamp default now not null | |

Indexes: `(createdAt)`, `(runId)`, `(gameDate)`. No user id anywhere in this table, on purpose: a metric-explanation call is triggered by a player but we record only that the call happened.

### 3.2 `vendor_costs`

| Column | Type | Notes |
|---|---|---|
| `id` | int autoincrement PK | |
| `month` | varchar(7) not null | `YYYY-MM`, the billing month on the invoice. |
| `vendor` | varchar(40) not null | Free text but the form offers a fixed list (section 7). |
| `category` | varchar(8) not null | `run` (what Munymo costs to operate: Railway, TiDB, Clerk, Resend, Cloudflare, domain, Anthropic API) or `build` (what Paul pays to build it: the Claude Max plan, any one-off tooling). The page shows the two totals separately. |
| `amount` | decimal(10,2) not null | As printed on the invoice. |
| `currency` | varchar(3) not null default `USD` | Totals are shown per currency; no conversion is attempted. |
| `note` | varchar(200) | Optional, e.g. "annual renewal, 12 months". |
| `enteredBy` | int not null | `users.id` of the admin, same as `admin_audit_log.adminId`. |
| `createdAt`, `updatedAt` | timestamp | `updatedAt` with `onUpdateNow()` like `market_votes`. |

Unique index on `(month, vendor)`: entering the same vendor for the same month again replaces the figure (upsert), so a corrected invoice is one action, not two.

## 4. Where the logging hooks in

All logging goes through one new module, `server/_core/aiUsage.ts`, so the call sites stay a single line each. Every function in it swallows its own errors with a `console.error` and never throws: a logging failure must never cost a game day. Use the same `getDb()` pattern as other `db.ts` helpers; when the database is unreachable (tests, local dev without a connection) the functions return without writing.

```ts
export type AiRunContext = { runId: string; runKind: AiRunKind; trigger: string; gameDate?: string };
export function newRunId(runKind: AiRunKind): string;
export async function recordAiTurn(ctx: AiRunContext, turn: {
  model: string; turnIndex: number; usage: Anthropic.Usage; stopReason: string | null;
  retries: number; failedOver: boolean; durationMs: number;
}): Promise<void>;
export async function recordAiRun(ctx: AiRunContext, run: {
  outcome: "success" | "failed" | "skipped"; errorMessage?: string;
  submitAttempts?: number; durationMs: number;
}): Promise<void>;   // sums the run's turn rows for estimatedCostUsd
```

### 4.1 Curation agent (`curationAgent.ts`)

- `CurationRunOptions` gains `trigger?: string`. `runDailyCuration` and `runStagingCuration` build an `AiRunContext` at the top of their `Inner` function (after the env checks, since a skipped run costs nothing; write a `skipped` run row there anyway so the admin page can show "did not start" days).
- `runCurationIfOutstanding(trigger, opts)` already receives a trigger string; forward it as `opts.trigger`. The crons in `index.ts` pass `cron-1445`, `cron-1530-watchdog`, `cron-1615`; `admin.runCuration` in `routers.ts` passes `admin-button`; `runCurationHandler` passes `api-endpoint`.
- `research()` and `runTurnWithRetry()` take the context as a new last parameter. `runTurnWithRetry` currently returns `Anthropic.Message`; change it to return `{ message, model, retries, durationMs }` so `research()` can log the model that actually served the turn and how many retries it took. The existing `console.log` of the token counts stays (it is still the cheapest live check); add the `recordAiTurn` call right after it.
- `runKind` is `daily_combined` on `attemptDailyCuration`'s legacy path, `daily_results_only` on `attemptResultsOnlyCuration`, `staging` on `attemptStagingCuration`. The context is created once per run (not per `FULL_RUN_ATTEMPTS` attempt): a second full attempt keeps the same `runId`, so its turns count toward the same run cost, which is what Paul wants to see.
- `gameDate` is `todayEt` for daily runs; for staging, the trading date the staging prompt is given (the date it is staging **for** is in the payload, but the date the run was told is the stable key).
- The `run` row is written in `runDailyCurationInner` / `runStagingCurationInner` on both the success return and the exhausted-retries path, with `submitAttempts` taken from the `attempt` value the success path already logs.
- Cache verification bonus: `recordAiTurn` keeps the console line as-is, so the "all-zero cache fields = silent invalidator" check in the comments still works from logs.

### 4.2 Backfill highlights (`backfillHighlights.ts`)

Each `client.messages.create` call is one turn. One `runId` per admin button press (`runKind: backfill_highlights`, `trigger: admin-backfill`), `turnIndex` counting up across the batch, `gameDate` set to the game being backfilled so the cost lands on that game's day. Write a `run` row when the batch finishes.

### 4.3 Metric explanation (`routers.ts`, `metrics.getExplanation`)

One turn per call, `runKind: metric_explanation`, `trigger: player-request`, its own `runId`, no `gameDate`. This path uses `claude-opus-4-8` with no caching; log it as-is, do not change the model in this work.

## 5. Cost estimate (`shared/aiPricing.ts`)

A rate table in code, not in the database, because it is small and changes rarely. Rates in US dollars per million tokens, as published on Anthropic's pricing page. **The builder must check platform.claude.com's pricing page on build day, correct any figure below, and set `effectiveDate` to that day.** The figures here are from the API reference available on 2026-10-17:

| Model | Input | Output | Cache read | Cache write 5m (1.25x input) | Cache write 1h (2x input) |
|---|---|---|---|---|---|
| `claude-sonnet-5` | 2.00 | 10.00 | 0.20 | 2.50 | 4.00 |
| `claude-opus-5` | 5.00 | 25.00 | 0.50 | 6.25 | 10.00 |
| `claude-opus-4-8` | 5.00 | 25.00 | 0.50 | 6.25 | 10.00 |

Web search: 10.00 per 1,000 requests, charged on top of tokens (verify this figure too).

```ts
export const AI_PRICING = { effectiveDate: "2026-10-17", webSearchPer1000: 10, models: { ... } };
export function estimateCostUsd(model: string, usage: UsageLike): number | null;
```

`estimateCostUsd` returns `null` (not 0) for a model missing from the table and logs one `console.warn` per process per unknown model, so a model id change shows up on the admin page as "unpriced" rather than as a free run. Unit tests for it live in `server/aiPricing.test.ts` (no database): Sonnet turn with cache reads, Opus failover turn, web search surcharge, unknown model returns null, missing `cache_creation` breakdown is treated as 1h.

## 6. Admin API (`routers.ts`, `admin` router)

All `adminProcedure`.

- `costs.aiSummary` (query, input `{ days?: number }` default 30): returns
  - `monthToDateUsd`, `last30DaysUsd`, `unpricedTurns` (count with null cost),
  - `byGameDate[]`: `{ gameDate, costUsd, turns, runs, failedRuns, failoverTurns, webSearches }`, newest first,
  - `runs[]`: the last 40 `run` rows with their cost, outcome, trigger, kind, duration,
  - `cacheHitRate`: `cacheReadTokens / (cacheReadTokens + inputTokens + cacheWrite*)` over the window, as a 0..1 number. This is the one health number worth watching: it falling means a prompt invalidator crept in.
- `costs.vendorList` (query, input `{ months?: number }` default 12): rows plus per-month totals split by `category` and `currency`, and, for each month, the computed Anthropic figure from `ai_usage_log` beside whatever Paul entered for the "Anthropic API" vendor so the two can be reconciled by eye.
- `costs.vendorUpsert` (mutation, input `{ month, vendor, category, amount, currency, note? }`, zod-validated: month matches `^\d{4}-\d{2}$`, amount ≥ 0, currency 3 upper-case letters): upserts on `(month, vendor)`, sets `enteredBy` to `ctx.user.id`, writes an `admin_audit_log` row with action `vendor_cost_upsert`.
- `costs.vendorDelete` (mutation, `{ id }`): deletes one row, audit-logged.

The aggregation maths lives in pure functions in `shared/aiUsage.ts` (`summarizeTurns(rows)`, `groupVendorCosts(rows)`) with unit tests in `server/aiUsage.test.ts`, so the router procedures are thin and the numbers are testable without a database.

## 7. Admin page (`client/src/pages/admin/AdminCosts.tsx`, route `/admin/costs`)

Register the route the same way `/admin/audit-log` is registered, and add a link card on `AdminDashboard.tsx` next to the existing Audit Log link reading "Running costs". Phone-first layout like the rest of /admin (Paul reads it on his iPhone).

Top to bottom:

1. **AI spend card**: month to date, last 30 days, cache hit rate, number of unpriced turns (hidden when zero). Plain numbers, section heading in the existing `text-xs uppercase tracking-wider` style.
2. **Per game day table**: date, cost, turns, runs, failed, failover turns, searches. Newest first, 30 rows. A failed day shows its row in the existing warning amber.
3. **Recent runs table**: when, kind, trigger, outcome, duration, cost. The error message appears on tap (details/summary element) for failed runs.
4. **Vendor ledger**: a month-by-vendor table for the last 12 months, run and build totals per month, computed Anthropic figure beside the entered one. Below it an entry form: month (defaults to the current month), vendor (select from Railway, TiDB Cloud, Clerk, Resend, Cloudflare, Domain, Anthropic API, Claude Max plan, Other with free text), category (defaults from the vendor: Claude Max plan is `build`, everything else `run`), amount, currency (defaults USD), note. Save shows a toast. Each row has a delete control with a confirm.

No charts, no sparklines, no colour-coded tiles in this phase. The point is to prove the data is flowing for a month before anything is drawn.

## 8. Tests (vitest, no database, per the 2026-10-02 isolation rule)

- `server/aiPricing.test.ts`: the five cases in section 5.
- `server/aiUsage.test.ts`: `summarizeTurns` with a mixed window (two game days, one failover turn, one null-cost turn), `groupVendorCosts` with two currencies and both categories, upsert input validation rejects a bad month string.
- Existing suite stays green; `npx tsc --noEmit` and `pnpm test` before the commit, as always.

## 9. Migration and rollout

1. Builder adds both tables to `drizzle/schema.ts`, runs `pnpm drizzle-kit generate` (next number after 0020), commits the generated SQL and meta files with the code.
2. Paul applies the migration by hand with `scripts/apply-migration.sh`, the way 0018 and 0020 were applied. Not before the code is on `main`, and not during a curation window (avoid 14:30–20:00 New York time on a weekday; see the curation failure runbook).
3. Until the tables exist in production, every `recordAi*` call fails quietly with a `console.error` and curation is unaffected. That is the designed behaviour, not a bug.
4. First check after deploy: the next day's ✅ curation email arrives as usual, and `/admin/costs` shows the staging run and the post-close run with non-zero cache reads. If cache reads are zero, something in the prefix changed and that is worth a look regardless of this feature.

## 10. Handover

Same commit: Section 4 table row (feature status), Section 6 (both tables), Section 8 (the four `admin.costs.*` procedures), Section 25 key-file index (`aiUsage.ts`, `aiPricing.ts`, `AdminCosts.tsx`).

## 11. Not in this spec

- Any player, retention, Search Console or referral tile. Those wait for guest play and real players.
- A cost line in the curation emails. Nice later, but the email is sent by the HTTP handler, which does not see the agent's usage; wiring that through is a separate small job.
- Automatic vendor pulls (Railway has a usage API; the others mostly do not). Manual monthly entry is the honest version for now.
- Alerts when a month's spend approaches the Console limit. Easy to add on top of `aiSummary` once a month of data exists.
- Re-pricing old rows when a rate changes. `pricingVersion` makes it possible; nobody needs it yet.
