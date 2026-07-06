# Audit Remediation Plan — Handover (2026-07-06)

**For the implementing agent.** A full read-only audit of this codebase was completed on
2026-07-06 (by Claude Fable 5). This file is the execution plan for the Critical/High
findings. Nothing below has been implemented yet. Work through the phases in order; each
phase is one or two small commits that must be independently shippable (every push to
`main` auto-deploys via Railway).

## Non-negotiable rules (from CLAUDE.md — read it first)

- `npx tsc --noEmit` and `pnpm test` must pass before every commit/push.
- **Never** run `pnpm db:push` — Phase 2.3 requires Paul's written approval first.
- Never force-push `main`. Pull-merge, then push.
- Any commit that changes a feature's status must update `references/munymo-handover-v2.md`
  §4 table in the same commit.
- Read each source file before editing it — do not trust this document's line numbers blindly;
  verify against the actual code.
- **Stop at every decision gate (D1–D3 below) and ask Paul. Do not improvise past them.**

---

## Phase 0 — Restore visibility & stop silent damage (no schema changes)

**0.1 Add tRPC `onError`** — `server/_core/index.ts` ~line 55.
The `createExpressMiddleware({ router, createContext })` call has no `onError`. Add one that
logs `path`, error code, message, and stack (at minimum for INTERNAL_SERVER_ERROR). This is
the top-priority fix: currently every thrown exception in every procedure is swallowed into
a generic 500 with nothing logged.

**0.2 Rewrite `notifyOwner` off Manus** — `server/_core/notification.ts`.
It currently POSTs to the Manus Forge service (`BUILT_IN_FORGE_API_URL`) and **throws** if
that env is unset. Rewrite it to send an email via the existing `sendEmail()` in
`server/email.ts` (Resend) to a new `OWNER_ALERT_EMAIL` env var. Requirements:
- Must **never throw** — missing config → `console.error` + `return false`.
- Keep the signature `(payload: {title, content}) => Promise<boolean>` (9 call sites:
  systemRouter, testerAgent, curationAgent, scheduledCuration).
- Why it matters: un-wrapped `await notifyOwner(...)` at `scheduledCuration.ts:158` and
  `:258` currently converts a freshness-422 or even a *successful* curation run into a 500.
- Paul must add `OWNER_ALERT_EMAIL` in Railway before/with this deploy.

**0.3 Make crons DST-safe** — `server/_core/index.ts`.
The curation cron runs at `15 20 * * 1-5` UTC, which is 45 min **before** NASDAQ close during
US winter time. `node-cron` accepts IANA timezones — reschedule:
- Curation: `cron.schedule("15 16 * * 1-5", ..., { timezone: "America/New_York" })` (4:15 PM ET).
- Streak-at-risk: `"30 8 * * 1-5"` America/New_York (always 60 min before 9:30 ET lockout).
- Tester agent: pick an ET time after curation, e.g. `"0 18 * * 1-5"` ET.
Update the comments to match.

**0.4 Wire time-decay into scoring** — `server/routers.ts` ~line 436 (`closeAndScoreGame`).
`calculateScore(...)` is called WITHOUT `pick.validationAnswerTimeMs`, so the 12–20pt
time-decay system in `server/scoring.ts` is dead in production (everyone correct gets 20).
Pass it as the 5th argument. Add tests (there are currently NONE for `computeValidationScore`):
boundaries at 15_000ms / 60_000ms, null-timing → 20, and a `calculateScore` case with
`answerTimeMs` ~40_000 scoring strictly between 12 and 20.
Client copy: soften "The 20% validation bonus has been added" in
`client/src/pages/DailyGame.tsx` (~line 118) to "your validation bonus has been added".

**0.5 Tighten `endOfDay` zod** — `server/routers.ts` ~line 721.
`winner` is optional with no link to `closeGameId`; `input.winner!` can close a game with a
null winner and score all predictions 0. Add
`.refine(d => !d.closeGameId || d.winner !== undefined, ...)` and remove the `!` assertions.

Handover §4 rows to update with this phase: time-decay scoring, curation cron.

---

## Phase 1 — Lockout job (fixes "locked" status + auto-submit together)

Background: game status `"locked"` is checked in ~10 places (server + client + admin UI) but
**never written anywhere**; and the lockout auto-submit endpoint
(`server/autoSubmitHandler.ts`) authenticates via the retired Manus cron session
(`sdk.authenticateRequest` + `isCron`), so nothing can call it — Decision 1's
auto-submit-at-lockout never runs.

**1.1** Add an internal cron `"35 9 * * 1-5"` America/New_York (5 min after lockout) running a
new `runLockoutSweep()`:
1. Find games `status = "active"` AND `lockoutAt <= now` (NO 15-minute window — missed runs
   must self-heal on the next sweep).
2. Copy `gutSelection → finalSelection` where final is null (reuse the idempotent update
   logic already in `autoSubmitHandler.ts` lines ~53–84).
3. Set `status = "locked"`.

**1.2** Repoint `POST /api/scheduled/auto-submit-locked-picks` at `runLockoutSweep()` with
`x-curation-secret` auth (same pattern as `scheduledCuration.ts`'s `isAuthorisedCron`).
Delete the `sdk` dependency from this handler.

**1.3** Keep `closeAndScoreGame`'s own gut→final copy as a safety net (it's idempotent).
Fix the now-wrong dedup comment at `scheduledCuration.ts:332`. Confirm `picks.submitValidation`
still accepts answers on `locked` games (it should — it only blocks
result_published/cancelled; that is Decision 1's requirement).

**1.4** Clean up `computeNewStreak` in `server/scoring.ts`: the returned `updated` field is
`true` in every code path. Remove it from the return type, delete the dead
`if (!updated) return;` and its false comment in `routers.ts` (~992–993), update the ~8 test
assertions in `server/munymo.test.ts`. Do NOT change away-player behavior (streak preserved,
date advanced — the T2 tests assert this and it is intended).

Handover §4 rows: "Auto-submission at lockout" and "Validation question staying open after
lockout" → Complete.

---

## Phase 2 — Retry-safety & duplicate-game protection

**2.1 (code-only, ship first)** In `closeAndScoreGame`'s scoring loop: fetch
`getPlayerScoreForGame(pick.userId, gameId)`; if a score row already exists, still upsert the
score but **skip `updateStreakForPlayer`**. This makes retries after mid-loop failure safe
for streaks (they currently double-increment). Do not attempt the full db.transaction
refactor — deferred deliberately.

**2.2 (code-only)** In `endOfDay`, before `createGame`: query for an existing non-cancelled
game on `nextGameDate`; throw `CONFLICT` if found. Closes the duplicate-game/pileup vector.

**2.3 (SCHEMA — requires Paul's written approval before `pnpm db:push`)**
- `daily_scores`: add `uniqueIndex("daily_scores_user_game_unique").on(userId, gameId)`.
  `insertDailyScore` already uses `onDuplicateKeyUpdate` — it silently never fires today.
  **Pre-flight:** run a read-only duplicate check against prod
  (`SELECT userId, gameId, COUNT(*) ... GROUP BY userId, gameId HAVING COUNT(*) > 1`) and
  show Paul the results; duplicates must be cleaned (keep latest `calculatedAt`) before the
  index can apply.
- `daily_games.gameDate` unique: **only if Paul approves D1** (see gates).
Present exact migration SQL to Paul and WAIT for approval.

---

## Phase 3 — Referral attribution (decision-gated, D2)

`POST /api/referral/attribute` (`server/referral.ts` ~142) requires a Manus cron session
nothing can present; signup attribution is dead. If Paul approves: replace with a
`referral.attributeSignup` **protected tRPC mutation** taking the `munymo_ref` cookie value,
reusing the existing dedup/validation logic verbatim; client calls it once after first
sign-in when the cookie is present, then clears it. Delete the dead Express route.

---

## Decision gates — ASK PAUL, do not proceed past these

- **D1:** Unique DB index on `daily_games.gameDate`? (Strict uniqueness blocks re-running a
  date unless a cancelled row is deleted/re-dated.) Default: app-guard 2.2 only.
- **D2:** Build referral attribution (Phase 3) now, or defer until merch ships?
- **D3:** Confirm `OWNER_ALERT_EMAIL` value and whether to also send web-push alerts.
- **Schema approval** required before any `pnpm db:push` (Phase 2.3).

## Out of scope (known, documented in the audit chat of 2026-07-06)

Medium/Low findings not covered here include: Manus dead code (~1,800 lines in
`server/_core/` + client pages), `context.ts` silent auth-catch, winner-rule wording drift
vs Decision 6, deactivated users still receiving emails/push, handover-doc §5/§9/§10
staleness, `isKnownMetricLabel` full-table scan. Do not fix these opportunistically inside
the phases above; keep diffs scoped.
