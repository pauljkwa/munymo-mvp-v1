# Afternoon Curation Split — Build Spec

Status: **approved-pending Paul's sign-off of this document. Do not build until approved.**
Author: Fable 5, 2026-08-01 (per the analyst/spec/implementer workflow).
Audience: the implementing model. Read `CLAUDE.md` first; tsc + vitest must pass; no schema changes are needed or permitted here.

## 1. Goal and invariant

Split the single post-close curation run into two phases so the failure-prone
research work happens in the US afternoon (hours of retry runway) and the
post-close run is small and fast (results reach US players minutes after close).

**Paul's canonical cadence invariant (must not change, player-visible):**
> "Every time the NASDAQ closes, that day's game ends and the results are
> collected and published. At the same time, a new game is curated and
> published which will remain in play until such time as the NASDAQ reopens."

The split preserves this: results and the next game still go live together
right after close. Only the *research timing* moves earlier — the next game is
staged as a hidden `draft` in the afternoon ("in the trolley") and activated at
the deploy moment.

**Golden safety property:** if staging fails or produces nothing, the post-close
run falls back to today's proven combined behavior. Worst case = current system.

## 2. Current architecture (read these files before editing)

- `server/_core/curationAgent.ts` — Claude agent (claude-sonnet-5, streaming,
  per-turn retry ladder, Opus 5 failover, `runDailyCuration()`,
  `runCurationIfOutstanding()` watchdog entry, in-flight guard).
- `server/_core/scheduledCuration.ts` — `dailyCurationHandler`
  (POST /api/scheduled/daily-curation): idempotency guard → concluded-game
  check → no-op guard → freshness → `admin.endOfDay`. Also
  `expectedLockoutIso()` (server-computed lockout — keep using it).
- `server/routers.ts` — `admin.endOfDay` (close/score + create-or-keep next
  game, cadence guard, detached notification fan-out), `admin.runCuration`.
- `server/_core/index.ts` — crons: main 16:15 ET, watchdogs 17:15/18:15/19:15
  ET, boot sweep. All `America/New_York`, Mon–Fri.
- Game statuses: `draft | active | locked | result_published | cancelled`.
  `getActiveOrUpcomingGame()` (server/db.ts) only returns active/locked, so
  players never see drafts. `daily_games.gameDate` is UNIQUE.

## 3. Phase A — afternoon staging run (new)

**Cron: 14:45 America/New_York, Mon–Fri** (afternoon news cycle is published;
~75 min of retry runway before close). **Staging watchdog: 15:30 ET** re-runs
Phase A only if no staged draft exists (mirror `runCurationIfOutstanding`).

New exported function in `curationAgent.ts`: `runStagingCuration()`.
- Same client setup, retry ladder, model failover, and in-flight guard family
  as `runDailyCuration` (share the guard: a staging run and a full run must
  never overlap — reuse the existing `runInFlight` flag).
- Agent conversation: a STAGING system prompt derived from the existing one,
  with the "Determine today's winner" section REMOVED and the output reduced
  to the `tomorrow` block only (`marketClosed`/`today` omitted). Everything
  else (freshness pre-qualification via check_freshness, banned lists, content
  rules, US-English, dates section incl. the market-calendar rule) stays
  verbatim — do not rewrite working prompt sections.
- `gameDate` for the staged game: the next trading day strictly after "today"
  (ET). At 14:45 ET the market is open, so today's game is still in play and
  the staged game is for TOMORROW (or Monday on Friday). Never today.
- Submission: POST to a new endpoint `POST /api/scheduled/stage-game`
  (same shared-secret auth) rather than overloading daily-curation.

**New handler `stageGameHandler` in `scheduledCuration.ts`:**
1. Auth + reuse the module `applyInFlight` mutex (409 if busy).
2. Idempotency: a draft OR active/locked game already at `tomorrow.gameDate`
   with the same tickers → re-upsert research/question, return
   `{ok, alreadyApplied}` (mirror the existing C1 guard).
3. If ANY queued (draft/active) game already exists after today (ET) → no-op
   `{ok, skipped}` (cadence: never two queued games).
4. Freshness check (existing `checkFreshness` + `fetchGamesWithinMatchupWindow`).
5. Create the game with **status: "draft"**, `lockoutAt: expectedLockoutIso(gameDate)`
   (server-computed — ignore agent's value), research + validation question
   via the existing upserts. Use `createGame`; handle a cancelled row at that
   date by reviving it (mirror endOfDay's C3 logic — extract a shared helper
   rather than duplicating).
6. Email on final staging failure: calm ⚠️ only ("staging failed — the
   post-close run will fall back to combined curation; no action needed").
   Never the ❌ manual-action email from Phase A.

## 4. Phase B — post-close results run (slimmed)

Cron stays 16:15 ET; watchdogs 17:15/18:15/19:15 and boot sweep unchanged.

`runDailyCuration()` gains a pre-check: does a staged **draft** exist for the
next trading day (query via a new small db helper)?
- **Draft exists → results-only conversation:** system prompt section for
  matchup selection/research/freshness is skipped; the agent only determines
  today's winner from real closing prices and writes
  `resultSummary`/`hindsightSpotlight` (keep those content rules). Output: a
  payload with `today` block + `stagedGameId` and NO `tomorrow` block. This
  conversation is small (~2-4 turns) — markedly cheaper and faster.
- **No draft → legacy path:** exactly the current combined behavior. Do not
  remove any of it.

**`dailyCurationHandler` changes:**
- Accept the results-only payload shape: when `body.stagedGameId` is present
  and matches a draft, skip freshness entirely (nothing new is being created),
  run the existing concluded-game/winner validation, call `endOfDay` with
  `closeGameId` + a new flag instead of the `next*` fields.
- **`admin.endOfDay`**: accept `activateStagedGameId?: number` as an
  alternative to the `next*` creation fields. When present: close/score as
  now, then flip the staged draft to `active` (single `updateGame`), and run
  the existing "new game is live" push with the STAGED game's tickers. The
  cadence guard, audit log, and detached notification fan-out stay as they
  are. Validation: the referenced game must exist, be `draft`, and be dated
  after the closed game — else CONFLICT (loud).
- Deploy remains one moment: results publish and the staged game activates in
  the same invocation (cadence invariant holds).

## 5. Watchdog / self-healing integration

- `curationWorkOutstanding()` (Phase B trigger) is unchanged.
- New `stagingOutstanding()`: true when now(ET) is 14:45–16:00 on a weekday
  AND no draft/active/locked game exists dated after today(ET). Used by the
  15:30 staging watchdog. Do NOT wire staging into the boot sweep or evening
  watchdogs — after close, the legacy fallback owns it.
- Never deploy to main between 14:40 and ~16:45 ET (extends the existing
  "never deploy mid-run" rule to the staging window).

## 6. Explicitly out of scope (v1)

- Late-breaking-news override (swapping a staged matchup after a 4:05 PM ET
  earnings bombshell). Accepted gap; revisit only if it bites.
- Any schema change (statuses already suffice). M4 (resultEmailsSentAt) is a
  separate pending item — do not fold it in.
- Changing model choice, spend limits, or email recipients.

## 7. Tests (add to server/munymo.test.ts)

- `stagingOutstanding` time gate: pure-function tests across the window edges
  (14:30 no, 15:00 yes-if-no-draft, 16:30 no) and DST (use the
  Intl-based pattern from `isGameSessionConcluded` tests).
- endOfDay `activateStagedGameId`: activates a draft; CONFLICTs on missing /
  non-draft / mis-dated game. (Follow the existing createCaller test pattern.)
- Payload routing: results-only payload skips freshness; legacy payload
  unaffected (mock-light — test the exported pure pieces, as existing tests do).

## 8. Rollout & verification

1. Ship behind the natural fallback (no flag needed — absence of a draft IS
   the fallback).
2. After deploy, verify next US trading day: ⚠️/✅ staging email at ~14:50 ET
   (04:50/05:50 Perth... compute at implementation time), draft visible in
   admin games list, then the usual ✅ close email showing "activated staged
   game #N". Update `references/munymo-handover-v2.md` Section 4 in the same
   commit, and the curation-failure runbook memory after verification.
