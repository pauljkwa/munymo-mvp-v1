# Task T1 — Weekend streak reset fixed — Completion Report

**Date:** 2026-07-03   **Author:** Manus   **Commit:** (see below)   **Deployed:** No — pushed to GitHub backup only; awaiting Paul's review before publishing

## What the task asked

Fix `computeNewStreak` in `server/scoring.ts` which used raw calendar-day math (`diffDays === 1`), causing Friday→Monday (3 calendar days) to reset the streak to 1. The playing streak must count consecutive *trading* days, not calendar days. A gap spanning only non-trading days (weekends, holidays) must increment the streak, not reset it.

**Acceptance:** a player who plays every trading day for two weeks shows `currentStreak === 10`, not `5`.

## What I actually changed

- **`server/db.ts`** — Added `gt` and `lt` to the drizzle-orm import. Added new helper `countPublishedGameDaysBetween(lastDate, currentDate)` that counts `result_published` game rows with `gameDate` strictly between the two dates (exclusive of both ends). Returns 0 if DB unavailable. This is the single source of truth for "how many trading days did this player miss?" — no second copy of this logic exists anywhere.

- **`server/scoring.ts`** — Replaced the `diffDays` calendar-day calculation in `computeNewStreak` with a new `missedTradingDays: number = 0` parameter (default 0 for backward compatibility). Decision logic: `missedTradingDays === 0` → increment; `> 0` → reset. Also replaced the `diffDays === 0` same-day guard with a string comparison (`gameDate <= lastParticipationDate`) which is correct for YYYY-MM-DD format. The function remains pure and testable — no DB access inside it.

- **`server/routers.ts`** — Added `countPublishedGameDaysBetween` to the db import list. In `updateStreakForPlayer`, before calling `computeNewStreak`, added a DB lookup: `missedTradingDays = streak.lastParticipationDate ? await countPublishedGameDaysBetween(streak.lastParticipationDate, gameDate) : 0`. This value is then passed as the 6th argument to `computeNewStreak`.

- **`server/munymo.test.ts`** — Added 5 new T1 tests:
  - `T1: Fri→Mon with 0 missed trading days increments streak (weekend gap)` — the core bug fix
  - `T1: Mon→Wed with 1 missed trading day (Tue published game) resets streak` — correct reset behaviour
  - `T1: Mon→Tue consecutive (0 missed) increments streak (regression)` — regression guard
  - `T1: first participation always yields streak=1 regardless of missedTradingDays` — regression guard
  - `T1: same-day or earlier gameDate returns unchanged streak (guard)` — edge case

  Updated 3 pre-existing tests to pass `missedTradingDays` explicitly (they were written against the old calendar-day API and would have incorrectly incremented with the default of 0):
  - "resets streak to 1 when gap of 2+ days" — now passes `missedTradingDays=2`
  - "does not reduce longest streak when current resets" — now passes `missedTradingDays=7`
  - "Missing status player who participates after gap gets streak reset to 1" — now passes `missedTradingDays=3`

## How it differs from the plan's suggested approach (if at all)

No material deviation. The plan recommended approach (b): pass a "missed trading days" count from a DB helper into `computeNewStreak` rather than inferring from calendar math. That is exactly what was implemented. The helper is named `countPublishedGameDaysBetween` as suggested.

One minor addition: replaced the `diffDays === 0` same-day guard with a string comparison (`gameDate <= lastParticipationDate`) since the new logic no longer computes `diffDays` at all. The behaviour is identical.

## Schema

None. No schema changes. No `pnpm db:push` required.

## Verification I ran

- `pnpm tsc --noEmit`: **pass** — 0 errors
- `pnpm vitest run server/munymo.test.ts`: **37/37 pass** — all new T1 tests pass, all pre-existing streak tests pass
- `pnpm vitest run` (full suite): **57/61 pass** — the 4 failures are all in `server/email.test.ts` and are pre-existing (unrelated to T1; they were failing before this change)
- Manual/live QA: not applicable — pure server-side logic covered by unit tests

**Not verified:** holiday gaps (e.g. a US market holiday on a weekday). The fix correctly handles these because `countPublishedGameDaysBetween` queries `result_published` games — if no game was published on a holiday, it won't be counted as a missed day. This is the correct behaviour per the plan's "correct" approach (b). Not explicitly tested with a holiday scenario in unit tests, but the logic is sound.

## Handover impact (for Claude Code to apply)

- Section 4 table: "Three streak types (Decision 2)" row — note that the **playing streak weekend-reset bug is now fixed**. The three-streak-type tracking (win/lose streaks) is still outstanding per the P5 deferral.
- Decision 2 note: add "Playing streak now counts consecutive trading days — weekend gap no longer resets streak (T1, 2026-07-03)."
- New follow-ups discovered: The 4 pre-existing `email.test.ts` failures should be investigated as a separate task (not T1 scope). They appear to be testing for specific HTML content that no longer matches the email templates.

## Rollback

Revert the T1 commit (hash TBD after push) and redeploy. The `missedTradingDays` parameter has a default of `0`, so any callers that don't pass it will increment (not reset) — which is safer than the old bug but not neutral. A full rollback is the correct approach if needed.
