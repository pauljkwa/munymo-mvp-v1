# Munymo — Remediation Plan (Fable 5 Review → Manus Build Handover)

**Prepared by:** Claude Code (Opus 4.8) — verified against source, 2026-07-02
**For:** Manus AI (implementation + deployment + DB writes)
**Source:** Fable 5 full code review, June 2026
**Companion doc:** `references/munymo-handover-v2.md` (read Rules 1–8 first)

---

## 0. How to use this document

This is a **to-do list for Manus to execute**, not a spec to reinterpret. Every claim in it was verified against the actual source by reading the files — file:line references are current as of commit `ed9e64c`.

**Why Claude Code is not making these changes:** per handover S6/S7, only the deployed Manus runtime has DB credentials and can run `pnpm db:push`. The live DB holds real player data. Manus owns the writes; this plan owns the reasoning.

### Rules for Manus on every task below (non-negotiable)

1. **Read the file before editing it** (Handover Rule 1). The line numbers here are a map, not a substitute for reading.
2. **One task at a time. Verify, then move on** (Rule 5). Do not batch P0 tasks into one commit.
3. **Every task lists its own tests + acceptance criteria. Do not mark done until they pass.**
4. **Extract shared logic — do not write a second copy.** Two tasks below (T1 away-status, T5 close-game) exist *because* two builders each wrote "the" logic in their own lane. The fix for both is one shared function. Do not re-create the divergence.
5. **When a task changes a feature's status, update the handover table in `munymo-handover-v2.md` Section 4 in the SAME commit.** The handover currently claims three shipped features don't exist — that drift is how a future session "re-fixes" working code.
6. **Schema changes (marked ⚠️ SCHEMA) require Paul's written approval before `pnpm db:push`** (S7). Show him the exact column diff. Only ever *add* columns; never drop/rename. Each schema task below includes a **code-only fallback** if approval is withheld.
7. **Commit message = what changed + why + which task ID.** End with the co-author trailer.
8. **After EACH task, write a Deploy Prompt (Section 0.1) and hand it to the Deploy Task before starting the next task.** One change → deploy → verify live → then the next change. Do not let uncommitted/undeployed tasks stack up — that re-creates the merge-divergence problem the review flagged.
9. **After EACH task, also write a Completion Report MD file (Section 0.2)** stating exactly what was done, so Claude Code can verify it against the diff and keep the handover accurate. The report is the confirmation-of-work + review gate. Do not consider a task closed until the report is written.

### Priority tiers

- **P0 — Trust & correctness** (this week): T1, T2, T3, T4
- **P1 — Security** (this week): T6, T7, T8
- **P2 — Integrity & divergence**: T5, T9
- **P3 — Retention & funnel**: T10, T11, T12, T13
- **P4 — Process & hygiene**: T14, T15, T16, T17
- **P5 — Deferred (design/scale, not now)**: listed at end

---

## 0.1 Deployment discipline — write a Deploy Prompt after every task

Because this plan runs **one change at a time**, each task must be deployed and verified live before the next begins. After completing a task, Manus must **generate a Deploy Prompt and paste it into the Deploy Task** (the Manus agent/task that owns deployment). Do not self-deploy inline — routing through the Deploy Task keeps deployment steps explicit and auditable.

**Deployment facts (from handover Section 5, S3, S6, S8 — do not deviate):**
- `github` remote = **backup only**. `origin` = **Manus internal remote** = the actual deploy trigger (Manus Autoscale). Pushing to `github` does NOT deploy.
- Live server: `https://munymogame-utnkpetr.manus.space`; `munymo.com` is a Cloudflare DNS alias of it. Verify against either.
- **Never `--force`-push GitHub** (T16). Pull-merge first, then push.
- **Schema tasks** (⚠️ SCHEMA): `pnpm db:push` runs **only in the deployed runtime** (S6) and **only after Paul's written approval** (S7). The Deploy Prompt must call this out explicitly and STOP for approval — it must never silently push schema.

### Deploy Prompt template (fill in the blanks, paste into the Deploy Task)

```
DEPLOY TASK — Munymo remediation, Task <T#>: <one-line summary>

1. WHAT CHANGED
   - Files: <list every changed file:path>
   - Summary: <what this task fixed, 1–2 lines>
   - Schema change required: <NO  |  YES — see step 3>

2. PRE-DEPLOY VERIFICATION (must pass before pushing)
   - [ ] pnpm tsc --noEmit  → 0 errors
   - [ ] pnpm vitest run     → all pass (incl. new tests for this task: <name them>)
   - [ ] Manual QA if client-facing: <exact steps + expected result from the task's Acceptance criteria>

3. SCHEMA (only if step 1 says YES — otherwise skip)
   - Proposed column change: <exact drizzle/schema.ts diff>
   - ⚠️ STOP: do not run pnpm db:push until Paul has approved this diff in writing.
   - After approval, in the DEPLOYED runtime only: pnpm db:push
   - Confirm the column exists before deploying code that reads it.

4. DEPLOY
   - Commit: "<T#>: <what> — <why>" (+ Co-Authored-By trailer)
   - Backup: git pull --no-rebase github main  →  resolve any conflict  →  git push github main   (NEVER --force)
   - Publish: push/deploy to the Manus internal `origin` remote to trigger Autoscale (the actual deploy)

5. POST-DEPLOY VERIFICATION (on munymo.com or munymogame-utnkpetr.manus.space)
   - [ ] <the task's Acceptance criterion, checked on the LIVE site>
   - [ ] No new errors in server logs / browser console
   - [ ] Rollback plan if broken: revert commit <hash>, redeploy previous

6. HANDOVER HYGIENE
   - [ ] Updated munymo-handover-v2.md Section 4 status table (if this task changed a feature's status)
   - [ ] Checked off <T#> in the remediation plan tracking checklist
```

### Worked example — Deploy Prompt for T1

```
DEPLOY TASK — Munymo remediation, Task T1: weekend streak reset fix

1. WHAT CHANGED
   - Files: server/scoring.ts, server/db.ts, server/routers.ts, server/munymo.test.ts
   - Summary: playing streak now counts consecutive TRADING days; a weekend (or any
     gap containing no published game day) no longer resets the streak.
   - Schema change required: NO

2. PRE-DEPLOY VERIFICATION
   - [ ] pnpm tsc --noEmit → 0 errors
   - [ ] pnpm vitest run → all pass, incl. new tests: Fri→Mon increments, Mon→Wed
         with a skipped Tue game resets, Mon→Tue increments, first-participation = 1
   - [ ] Manual QA: n/a (pure logic, covered by unit tests)

3. SCHEMA: skip (none)

4. DEPLOY
   - Commit: "T1: streak counts trading days not calendar days — fixes weekend reset"
   - Backup: git pull --no-rebase github main → push github main (no --force)
   - Publish: push/deploy via Manus internal origin remote

5. POST-DEPLOY VERIFICATION (live)
   - [ ] A test player who played Fri then Mon shows currentStreak incremented, not reset to 1
   - [ ] dashboard.getStats returns the expected currentStreak
   - [ ] No new server-log errors
   - [ ] Rollback: revert the T1 commit, redeploy

6. HANDOVER HYGIENE
   - [ ] Section 4 / Decision 2 note updated (weekend reset fixed)
   - [ ] T1 checked off in tracking checklist
```

**Every task below assumes this Deploy Prompt step happens after it.** Client-only tasks (T4, T11, T12, T13, T15) still get a Deploy Prompt — their step 5 is live-site QA, not unit tests.

---

## 0.2 Completion Report — confirmation of work + review gate

After each task deploys and verifies, Manus writes a **Completion Report** so Claude Code (or the next reviewer) can confirm the work matches the task and keep the handover truthful. This is the mechanism that prevents handover drift (the review's top process risk).

**File location:** `references/task-reports/T<#>-<slug>.md` (e.g. `references/task-reports/T1-weekend-streak.md`). Create the `references/task-reports/` folder if it doesn't exist. One file per task; never overwrite a prior report.

**The review loop:**
1. Manus completes task → writes Deploy Prompt (0.1) → deploys → writes Completion Report (this section).
2. Claude Code reads the report **and the actual git diff for the task's commit**, confirms they match, and confirms the task's Acceptance criteria are genuinely met (not just claimed).
3. Claude Code updates `munymo-handover-v2.md` Section 4 and the tracking checklist to reflect reality. **Claude Code owns the handover's accuracy; Manus owns the report's honesty.**
4. Only then does the next task start.

Manus must report faithfully: if a test was skipped, if something was deferred, if the fix was partial, or if it deviated from the approach in this plan — **say so in the report.** A report that hides a gap defeats the entire purpose. "Deviated from plan because X" is a good report; a silently different implementation is the failure mode we're guarding against.

### Completion Report template

```
# Task T<#> — <summary> — Completion Report

**Date:** <YYYY-MM-DD>   **Author:** Manus   **Commit:** <hash>   **Deployed:** <yes/no + URL verified>

## What the task asked
<1–2 lines paraphrasing the task's goal + Acceptance criteria, from this plan>

## What I actually changed
- <file:path> — <precise description of the change, and WHY it was done this way>
- <file:path> — <…>
(Include the shared-function name if T1/T2/T5 — confirm no second copy of the logic was created.)

## How it differs from the plan's suggested approach (if at all)
<"No deviation" OR the exact difference + why. Be honest.>

## Schema
<"None" OR: column added, exact diff, Paul's approval reference, db:push run in deployed env on <date>.>

## Verification I ran
- tsc --noEmit: <pass/fail>
- vitest run: <pass/fail; name the new tests + what they assert>
- Manual/live QA: <exact steps + observed result vs expected>
- Anything NOT verified and why: <be explicit — "did not test holiday gaps, only weekends">

## Handover impact (for Claude Code to apply)
- Section 4 table row(s) to change: <which, from what → to what>
- Any founder-decision note to update: <e.g. Decision 2 weekend-reset fixed>
- New follow-ups discovered: <anything found mid-task worth a new task ID>

## Rollback
<commit to revert if this needs backing out>
```

**Claude Code's verification checklist per report** (so the review is consistent):
- [ ] The changed files in the report match `git show <commit>` — nothing undisclosed, nothing claimed-but-absent.
- [ ] For T1/T2/T5: exactly ONE implementation of the logic exists (grep for the old path to confirm it's gone, not duplicated).
- [ ] The Acceptance criteria are actually met on the live site, not just asserted.
- [ ] Tests named in the report exist and pass.
- [ ] Handover Section 4 + tracking checklist updated to match. Report filed under `references/task-reports/`.

---

## P0 — Trust & correctness

### T1 — Fix the weekend streak reset 🔴 (habit-killer)

**Where:** `server/scoring.ts:87-123` (`computeNewStreak`), tests in `server/munymo.test.ts`.

**The bug (verified):** Line 107 computes `diffDays` as raw calendar days between `lastParticipationDate` and `gameDate`, then line 110 only increments when `diffDays === 1`. Friday → Monday is a 3-day calendar gap, so line 113 (`diffDays > 1`) resets the streak to 1. **No playing streak can ever survive a weekend.** Decision 2 defines the playing streak as consecutive *trading* days — Fri→Mon is consecutive trading days and must increment.

**Why it's #1:** streaks are the core habit mechanic. This bug punishes your most consistent player every Monday. Nothing else on this list matters if the reward loop is broken.

**Approach:** Treat a gap that spans only non-trading days (weekends, and ideally holidays) as "no trading day missed." Two options — pick (b):

- (a) *Cheap:* if the only calendar days between `last` and `current` are Saturdays/Sundays, treat as consecutive. Handles weekends, not holidays.
- (b) *Correct (recommended):* the caller already knows the trading calendar — it only calls `updateStreakForPlayer` on days a game was actually published. So the right signal is **"was there a published game between `last` and `current` that this player missed?"** Pass that into `computeNewStreak` instead of inferring from calendar math. Concretely: change the streak decision from "diffDays === 1" to "no *published game day* exists strictly between last and current." Add a helper in `server/db.ts` like `countPublishedGameDaysBetween(lastDate, currentDate)` (exclusive of both ends) and pass the count in; `0` missed → increment, `>0` missed → reset.

Keep `computeNewStreak` pure and testable — pass the "missed trading days" count as a parameter; do the DB lookup in `updateStreakForPlayer` (`routers.ts:968`).

**⚠️ Note:** this interacts with T2 (away status). Do T2's `lastParticipationDate` fix in the same mental model — both are about "what counts as a gap."

**Tests (add to `munymo.test.ts`):**
- Fri (2026-06-26) → Mon (2026-06-29) with 0 missed trading days → streak increments.
- Mon → Wed with Tue a published game the player skipped → streak resets to 1.
- Mon → Tue consecutive → increments (regression).
- First participation (`lastParticipationDate === null`) → streak = 1 (regression).

**Acceptance:** a player who plays every trading day for two weeks shows `currentStreak === 10`, not `5`. Update handover Section 4 / Decision 2 note.

---

### T2 — Away Status protects nothing; unify the two systems 🔴

**Where:** dashboard toggle `server/routers.ts:1018-1026` (writes `users.awayStatus`); streak engine `server/routers.ts:979-989` + `server/scoring.ts:95-97` (reads `streak_records.awayStatus`).

**The bug (verified, two parts):**
1. **Disconnected systems.** The player-facing dashboard toggle writes the boolean `users.awayStatus`. The streak engine only ever reads the enum `streak_records.awayStatus`, which is set exclusively by the admin procedure `setPlayerAwayStatus`. A player toggling "Away" (which the UI tells them protects their streak) changes nothing the streak logic looks at.
2. **Even the admin path is broken.** While `awayStatus === "away"`, `computeNewStreak` returns `updated: false` (`scoring.ts:95-97`), so `updateStreakForPlayer` skips the DB write (`routers.ts:988`) and **`lastParticipationDate` never advances.** The first game back computes a large gap and resets the streak to 1 anyway. Protection is illusory in both paths.

**Approach (two fixes, one commit):**
- **Unify the source of truth.** Decide on ONE field. Recommended: keep `streak_records.awayStatus` (the enum the engine already reads) as canonical, and make the dashboard `setAwayStatus` procedure write to it (active ↔ away) instead of / in addition to `users.awayStatus`. Do NOT leave two writable fields — that's the twin-implementation trap. If you keep `users.awayStatus` for display, have exactly one of them be the write target and derive the other, or drop the unused one (⚠️ SCHEMA drop — needs approval; code-only fallback: stop writing the unused field and read only the canonical one).
- **Make protection actually protect.** When a player is away, the streak value should be preserved AND `lastParticipationDate` must advance so the gap isn't counted on return. Simplest correct behaviour: on an away day, treat it as neutral — advance `lastParticipationDate` to the current game date without changing `currentStreak`. This means `computeNewStreak` must return `updated: true` with an advanced date but unchanged streak while away. Adjust `scoring.ts:95-97` accordingly and confirm `updateStreakForPlayer` writes the date.

**Decision 5 reminder:** away is unlimited in MVP — no cap logic.

**Tests:**
- Player away for Wed, plays Thu → Thu continues the streak (does not reset), `lastParticipationDate` moved through Wed.
- Dashboard `setAwayStatus({active:true})` → the value the streak engine reads reflects "away". (Integration-level; assert the canonical field.)

**Acceptance:** a player who marks away, misses days, and returns keeps their streak. The dashboard toggle demonstrably drives streak protection. Update handover Section 4 + Decision 5 note.

---

### T3 — Validate winner & performance in the curation pipeline 🔴 (the only safety net on an unsupervised nightly AI)

**Where:** `server/_core/scheduledCuration.ts:156-163`.

**The bug (verified):** Line 161 sets `winner = tickerA matches ? "A" : "B"`. If the agent's `winnerTicker` matches **neither** company (typo, stale game, wrong exchange suffix), it silently becomes `"B"` and every player is scored against the wrong winner — emails go out, streaks update, leaderboard shifts. Separately, the server never cross-checks `winner` against `companyAPerf`/`companyBPerf`, even though Decision 6 says the higher % move wins. An AI agent generates this payload nightly with **no human in the loop**, so this is not optional hardening — it's the only thing standing between one hallucination and a corrupted scoring day.

**Approach:** In `dailyCurationHandler`, before building `endOfDayInput`, add two guards (only when `!marketClosed && today?.winnerTicker`):
1. **Ticker must match one side.** Resolve `winner` explicitly: if `winnerTicker` matches company A → `"A"`, matches B → `"B"`, matches neither → **reject**: `notifyOwner` + `return res.status(422)` with a clear message. Do not fall through to `"B"`.
2. **Winner must agree with the perf numbers.** If both `companyAPerf` and `companyBPerf` are present, compute the expected winner as the higher percentage (`companyAPerf >= companyBPerf ? "A" : "B"`, per Decision 6 — higher move wins regardless of sign). If the ticker-derived winner contradicts the perf-derived winner → **reject** with a message naming both values. (If perf numbers are absent, skip this check but still require the ticker guard.)

Mirror the same two guards in the manual `admin.endOfDay` path if feasible, or factor them into the shared close function from T5 so both the cron and the admin form are protected.

**Tests:** unit-test a `resolveWinner(game, payload)` helper: matching A, matching B, matching neither (throws/rejects), ticker says A but perf says B (throws/rejects), perf absent (allows on ticker alone).

**Acceptance:** a payload with a nonsense `winnerTicker` or a winner/perf contradiction is rejected with an owner notification and no game is scored. Nothing is published on a bad payload.

---

### T4 — Validation-question re-entry + fix the `wasAutoSubmitted` misfire 🟠 (protects 20% of every score)

**Where:** `client/src/pages/DailyGame.tsx:419-426` (heuristic), `:866-910` (the two "submitted" cards).

**Two bugs (verified):**
1. **`wasAutoSubmitted` misfires on a common path.** Lines 422-426 infer auto-submission from `gut === final && no validationAnswer`. A player who *rationally* picks the same company for gut and final, then closes the validation modal, comes back to a card saying **"Time Ran Out — the submission window closed while you were away"** while the game is still live. It's false and insulting.
2. **A player can permanently lose 20% of their score.** If gut ≠ final and the player closes the tab after submitting final but before answering, the normal "Picks Submitted" card (`:866`) offers no way back to the validation question — only the (misfiring) auto-submit card does. The server would happily accept the answer (Decision 1 keeps it open post-lockout), but the UI never offers it.

**Approach:**
- **Fix the heuristic.** Stop inferring from gut===final. Compare timing instead: auto-submitted iff `finalSubmittedAt >= lockoutAt`. This data is already on the pick + game (`game.lockoutAt` at `:420`). *Better long-term (⚠️ SCHEMA, optional): add `player_picks.wasAutoSubmitted boolean default false`, set it server-side in the `endOfDay` auto-submit UPDATE (`routers.ts:719-730`), and read the real flag. Code-only fallback: the `finalSubmittedAt >= lockoutAt` comparison above — do this first regardless.*
- **Always offer re-entry.** In the normal "Picks Submitted" card (`:866`), show an "Answer the validation question" button whenever `validationAnswer` is null — not just in the auto-submit branch. The server already accepts it post-lockout per Decision 1.

**Tests / manual QA:** (client — verify in the running app)
- Pick same company gut+final, submit before lockout, close modal → card must NOT say "Time Ran Out"; must offer the validation question.
- Pick different gut/final, submit final, reload before answering → "Picks Submitted" card shows the validation-question button; answering it scores.
- Genuine auto-submit (never submitted final; cron copied gut) → "Time Ran Out" card still appears correctly.

**Acceptance:** no live-game "Time Ran Out" false positives; validation question reachable from every submitted state where `validationAnswer` is null. Update handover (Decision 1 is implemented — note the UI fix).

---

## P1 — Security

### T6 — Authenticate `POST /api/referral/attribute` 🔴

**Where:** `server/referral.ts:141-190`.

**The bug (verified):** The endpoint reads `newUserId` straight from the request body with no auth (`referral.ts:142`) and no per-user dedup. Anyone can hit `GET /r/CODE` to learn a valid cookie value, then POST arbitrary `newUserId`s repeatedly to fabricate signup events and inflate `totalSignups`. The moment merch referrals carry any reward, this is directly gameable. **Note:** there is currently no client-side caller in `client/src` — first find how it's actually invoked (Clerk webhook? server-side user-creation hook? unused?) so the fix matches reality.

**Approach:**
- Derive `newUserId` **server-side** from the authenticated session (Clerk) rather than trusting the body. If it's called from a Clerk webhook, verify the webhook signature and take the user id from the verified payload.
- Add **dedup**: a given `referredUserId` may only ever produce one `signup` attribution event (unique constraint or an existence check before insert). ⚠️ SCHEMA if you add a unique index on `referral_events(referredUserId, eventType)` — approval needed; code-only fallback: `SELECT` for an existing signup event for that user before inserting.

**Acceptance:** attribution cannot be triggered for a user id you are not authenticated as; a second attribution for the same user is a no-op.

---

### T7 — Cap / constrain `metrics.getExplanation` 🟠 (public uncapped LLM = cost-burn)

**Where:** `server/routers.ts:1121-1150+`.

**The bug (verified):** `getExplanation` is a `publicProcedure`. Any unauthenticated visitor can submit arbitrary 256-char strings; each unique string misses the cache, triggers an LLM call, and inserts a `metric_explanations` row. That's a cost-burn vector, a junk-data vector, and a mild content vector (a hostile label's generated "explanation" gets cached and could be shown to others).

**Approach (pick the tightest that fits):**
- **Best:** only generate for metric labels that actually exist in some `game_research.researchMetrics`. Before the LLM call, verify the normalized label is a known metric; if unknown, return a generic "no explanation available" without generating/caching.
- **Or:** require auth (`protectedProcedure`) so it's at least tied to a real account, plus a simple per-user rate limit.

**Acceptance:** an arbitrary never-seen label does not create an LLM call or a cache row.

---

### T8 — Make `answerTimeMs` trustworthy 🟠 (leaderboard integrity)

**Where:** `server/routers.ts:228-259` (`submitValidation`).

**Two issues (verified):**
1. **Client supplies its own timing** (`:233` `answerTimeMs: z.number()`). A player can send `answerTimeMs: 0` and always collect the full 20 validation points.
2. **The correct answer is revealed pre-publish** (`:258-259` returns `correctAnswer`). A two-account player can learn the answer on account 1 and answer instantly on account 2.

**Approach:**
- **Server-side timing:** the server has no record of when the question was *shown*, so it can't currently compute elapsed time. Establish a server-side start signal — e.g. record a `validationShownAt` timestamp when the player first fetches the question for that game (⚠️ SCHEMA: `player_picks.validationShownAt timestamp`, approval needed), then compute `answerTimeMs = now - validationShownAt` server-side and ignore the client value. **Code-only fallback if no schema:** at minimum, clamp/sanity-check the client value (reject implausible `< ~300ms` as `0`-credit-worthy, or floor the effective time) and document that full server-side timing is deferred.
- **Stop leaking the answer pre-publish:** do not return `correctAnswer` from `submitValidation` before the game is `result_published`. Return `isCorrect` only. Reveal the correct answer later via the results flow.

**Acceptance:** a forged `answerTimeMs: 0` does not guarantee 20 points; `submitValidation` never returns `correctAnswer` while the game is open. Keep Decision 1 intact — validation still accepted post-lockout.

---

## P2 — Integrity & divergence

### T5 — Extract ONE shared close-game/scoring function 🟠 (kills the divergence)

**Where:** `server/routers.ts:494-610` (`publishResult`) and `:669-799` (`endOfDay`).

**The bug (verified):** Only `endOfDay` performs the Decision-1 gut→final auto-submit (`:719-730`). `publishResult` (`:536`) just skips picks with no `finalSelection`. So closing a game via `/admin/games/:id/result` silently gives gut-only players no score and breaks their streak — violating Decision 1. The two procedures have diverged.

**Approach:** Extract a single `closeAndScoreGame(gameId, { winner, perfA, perfB, resultSummary, hindsightSpotlight })` that does: lock picks → **auto-submit gut→final** → snapshot research → score all participants → upsert leaderboard → update streaks → compute community stats → mark `result_published`. Have BOTH `publishResult` and `endOfDay` call it. Fold T3's winner/perf guards in here so every close path is protected.

This is a **process fix as much as a code fix** — it removes the surface where two builders can re-diverge.

**Tests:** a game with a gut-only player closed via `publishResult` scores that player (gut copied to final) exactly as `endOfDay` would.

**Acceptance:** identical scoring/side-effects regardless of which procedure closes the game. Working-code caution (Rule 2): keep behaviour identical to today's `endOfDay` for the paths that already work.

---

### T9 — Make `endOfDay` atomic & stop identifying the new game by guesswork 🟠

**Where:** `server/routers.ts:669-799`, esp. `:762-778` (create then `listGames(1,0)[0]`).

**The bug (verified):** No DB transaction wraps the ~6 sequential writes + per-user email loop. After `createGame`, it re-fetches `listGames(1,0)[0]` (sorted by `gameDate` desc) to attach research + validation question — if any stray game with a later `gameDate` exists, research and the answer key attach to the **wrong game**. And a mid-flight failure leaves a half-published game that can't be retried ("Result already published" + freshness rules block a second attempt), forcing manual DB surgery (see the `scripts/cleanup-premature-run.mjs` graveyard).

**Approach:**
- **Return the new id directly.** Change `createGame` to return the inserted row id (or use `insertId`) and use that to attach research/question, instead of `listGames(1,0)[0]`.
- **Wrap in a transaction.** Put the close-and-score half (T5) and the create-next half in a DB transaction so a mid-flight failure rolls back and the run is retryable. Keep the email/push loop OUTSIDE the transaction (external side-effects shouldn't hold a DB tx open — see T17 scaling note), triggered only after commit.

**Acceptance:** the newly created game is identified by its real id; a simulated failure between writes leaves the DB in a retryable state, not a half-published one.

---

## P3 — Retention & funnel

### T10 — Wire the streak-at-risk email trigger 🟠 (highest-leverage retention lever, template already done)

**Where:** template `server/email.ts` (`buildStreakAtRiskEmail`); trigger does not exist yet.

**Approach:** Fire 1–2 hours before `lockoutAt` to players who have an active streak (per T1/T2's corrected logic) and have not yet submitted a final pick for today's active game, respecting `emailOptIn`. Ride the existing heartbeat/cron mechanism (see handover S5 — Agent crons vs heartbeat crons; use whichever already runs sub-daily, or add a lightweight scheduled hit to a new `/api/scheduled/streak-at-risk` endpoint guarded like the curation endpoint). Dedup so a player gets at most one such email per game.

**Acceptance:** a player with an active streak and no final pick gets exactly one at-risk email in the window before lockout; opted-out players get none. Update handover Section 4 (streak-at-risk = wired).

---

### T11 — Open the game page before sign-in 🟡 (top-of-funnel)

**Where:** `client/src/pages/DailyGame.tsx:359` (sign-in wall).

**The issue (verified):** the handover describes `/game` as "public (picks require auth)," but there's a sign-in wall before the matchup is even visible. Show today's matchup + research to everyone; move the sign-in prompt to the *pick* step. This makes the page work far harder for conversion.

**Acceptance:** a logged-out visitor sees the matchup and research; attempting to submit a pick prompts sign-in.

---

### T12 — Leaderboard provisional display 🟡

**Where:** `server/routers.ts:285` (`leaderboardRouter`), `client/src/pages/Leaderboard.tsx`.

**The issue:** with a 20-game qualification threshold and one active player, `/leaderboard` shows "No qualified players yet" for weeks. Show pending players with a "provisional" tag, or rank by games played until someone qualifies. Do not change the qualification threshold constant (handover: never change without a documented decision) — this is display-only.

**Acceptance:** a new player sees a populated (provisional) leaderboard, not an empty room.

---

### T13 — Fix the footer "My Dashboard" link 🟡 (known bug, trivial)

**Where:** `client/src/components/PublicLayout.tsx:254` — hardcodes `/profile`; should be `/dashboard`. One-line fix. Remove from handover "known nav bug" note when done.

---

## P4 — Process & hygiene

### T14 — Add CI: `tsc --noEmit` + `vitest run` on GitHub 🟠 (zero cost, first independent safety net)

**Why:** DB credentials only exist in the deployed runtime (S6); there's no CI, so GitHub never runs the tests that exist (`munymo.test.ts` covers exactly the right thing — the scoring functions). A GitHub Action gives the GitHub side of the collaboration its first independent check. This is what would have caught T1 if the streak test covered weekends.

**Approach:** `.github/workflows/ci.yml` running `pnpm install`, `pnpm tsc --noEmit` (or the project's typecheck script), `pnpm vitest run` on push/PR. No secrets required — the scoring tests are pure. Ensure the expanded T1/T2/T3 tests run here.

---

### T15 — Define `--color-error` (or migrate to `--color-danger`) 🟡

**Where:** `client/src/index.css` defines `--color-danger` (lines 50/104) but **not** `--color-error`, which is used in 7 files (DailyGame, MyDashboard, PlayerProfile, Demo, AdminDashboard, AdminEditGame, AdminPlayers). Wrong-prediction markers, "Confirm Deactivation" button, danger-zone borders all silently fall back to inherit/transparent. `GameResult` uses `--color-danger` correctly.

**Approach:** either add `--color-error: var(--color-danger);` (+ any `-muted` variant) in both light and dark blocks, or find-and-replace the 7 files to `--color-danger`. Prefer the alias for the smallest, safest diff. Verify against the oklch values already defined (do NOT introduce these vars into any `lightweight-charts` color prop — Rule 7).

---

### T16 — Collaboration-model hardening 🟠 (process, for Paul + Manus)

From the review — address the two-sources-of-truth fragility:
- **Never force-push GitHub.** History already shows merge repairs and a TS error *caused by a merge* (`fe63910`). The sanctioned `git push --force-with-lease github main` can still drop GitHub-side work on a bad race. Adopt: pull-merge before push, never `--force`.
- **Document the Manus internal remote URL** (the S3 gap in handover S3 is still open) so a fresh sandbox can actually deploy.
- **Handover-drift rule:** any commit that changes a feature's status updates the handover Section 4 table in the same commit (this is Rule 5 above, restated as policy).

*These are decisions for Paul, not code — listed so they're not lost.*

### T17 — Minor correctness cleanups 🟡 (batch when convenient, each tiny)

- `resetPlayerPick` writes no audit log, unlike every other sensitive admin op — add one (`routers.ts`, admin router).
- `dashboard.getHistory` (paginated, `routers.ts:1051`) is dead code — MyDashboard uses `getMyHistory().slice(0,20)`. Remove or adopt it.
- `GameResult` shows Company B as the player's pick when `finalSelection` is null — guard the null case.
- With 0 participants, community bars render a fabricated 50/50 — show "no participants" instead.

---

## P5 — Deferred (do NOT build now)

Per the review, these are correctly deferrable at current scale:
- **`AdminSettings` page + `app_settings` table + `getSetting()` helper** — hardcoded scoring constants (`scoring.ts:15-18`, `:127`) are fine at this scale. Handover Rule: do not wire scoring to the DB until the table + helpers exist and are tested.
- **`/demo/autoplay`** animated walkthrough — the static `/demo` already exists and is good.
- **Three-streak-type / losing-streak-of-5 intervention UX** — the data model exists (`currentWinStreak`/`currentLoseStreak` are tracked, `routers.ts:993-996`); the *intervention UX* is founder-design work. Flag before building (Decision 2).
- **Scaling debt (not urgent, keep watching):** `endOfDay` does ~2 Clerk calls + 1 Resend call *per user, sequentially* — a guaranteed timeout eventually; batch/parallelize before ~100 users. The missed-game email goes to every non-player daily — add frequency capping before it becomes a churn engine. (T9's transaction work should leave these external loops outside the tx.)

---

## Tracking checklist

Copy into the working session; check off as each passes its acceptance criteria.

- [ ] T1 — Weekend streak reset fixed + tests
- [ ] T2 — Away-status unified + protection actually works
- [ ] T3 — Curation winner/perf validation
- [ ] T4 — Validation re-entry + `wasAutoSubmitted` fix
- [ ] T6 — Referral attribute authenticated + dedup
- [ ] T7 — `metrics.getExplanation` constrained
- [ ] T8 — `answerTimeMs` trustworthy + answer not leaked pre-publish
- [ ] T5 — Shared close-game function (publishResult == endOfDay)
- [ ] T9 — `endOfDay` atomic + real new-game id
- [ ] T10 — Streak-at-risk email wired
- [ ] T11 — Game page public pre-auth
- [ ] T12 — Leaderboard provisional display
- [ ] T13 — Footer link → `/dashboard`
- [ ] T14 — CI: tsc + vitest
- [ ] T15 — `--color-error` defined
- [ ] T16 — Collaboration hardening (Paul + Manus)
- [ ] T17 — Minor cleanups batch

**Schema-touching tasks needing Paul's approval before `pnpm db:push`:** T2 (optional field cleanup), T4 (optional `wasAutoSubmitted`), T6 (optional unique index), T8 (optional `validationShownAt`). Each has a code-only fallback — none is blocked on schema.

---

*End of remediation plan. The code is the truth — read the source file before editing (Rule 1).*
