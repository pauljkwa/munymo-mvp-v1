# Munymo MVP — Complete Project Handover (v2)

**Date:** June 2026  
**Prepared by:** Claude Code (architect review) — corrected and extended from original Manus handover  
**Project:** Munymo MVP — daily stock-picking game  
**Active Manus project:** Munymo-Game (`SLgzupJDuKY6wiWMJF6c7P`)  
**GitHub repo:** `pauljkwa/munymo-mvp-v1`  
**Live site:** `munymo.com`

> **ACTIVE WORK (July 2026):** Remediation of Fable 5's code review is tracked in
> `references/munymo-fable5-remediation-plan.md` — 17 prioritized tasks (T1–T17), one change at a time.
> After each task, Manus writes a Deploy Prompt (into the Deploy Task) and a Completion Report under
> `references/task-reports/`. Claude Code verifies each report against the diff and keeps **this doc's
> Section 4 table accurate**. If you change a feature's status, update Section 4 in the same commit.

---

## CRITICAL RULES — READ BEFORE TOUCHING ANYTHING

These rules apply to every task without exception.

| Rule | Detail |
|------|--------|
| **Rule 1** | Read every file before modifying it — no exceptions, no assumptions |
| **Rule 2** | Working code is sacred — never touch confirmed-working features |
| **Rule 3** | GitHub is push-only — never clone `pauljkwa/munymo-mvp-v1` and rewrite |
| **Rule 4** | No speculative rewrites — diagnose first via logs/console, then make the smallest fix |
| **Rule 5** | One change at a time — verify it works before making the next change |
| **Rule 6** | Read this handover fully before taking any action |
| **Rule 7** | `lightweight-charts` only accepts hex/rgb/hsl colours — never oklch or CSS variables |
| **Rule 8** | The 7 founder decisions in Section 3 are binding product requirements — never contradict them |

The active project lives at `/home/ubuntu/munymo-mvp-fresh`. All work happens there. Push to GitHub after each confirmed-working checkpoint.

---

## 1. What Munymo Is

Munymo is a daily financial decision-making game designed to help players become better thinkers about markets. Each trading day, two NASDAQ-listed companies are paired head-to-head (e.g. AAPL vs MSFT).

**The core daily loop:**

1. Player makes a **Gut Selection** — instinct only, no research yet
2. Player reviews **active-game research** on the game page (metrics, charts, pairing rationale)
3. Player makes a **Final Selection** — their official prediction
4. Player answers one timed **Validation Question** — a financial literacy question answerable from the research
5. After market close, admin publishes the result — winner is the company with the higher percentage move from opening to closing price
6. Player receives a **Daily Score** and sees community statistics

**Positioning:** Munymo is a learning and decision-making product. It must never be presented as a gambling platform, stock-tipping service, or investment-advice engine.

**MVP thesis:** Validate whether players will return daily because the loop is simple, fair, educational, and satisfying enough to become a habit.

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Tailwind CSS 4, shadcn/ui |
| Backend | Node.js, Express 4, tRPC 11 |
| Database | MySQL (TiDB) via Drizzle ORM |
| Auth | Clerk (migrated from Manus OAuth in Phase 19) |
| Charts | `lightweight-charts` (TradingView) — **hex colours only, never oklch** |
| Email | Resend SDK — sender: `notifications@munymo.com` |
| Push | Web Push API with VAPID keys |
| Routing | Wouter |
| Testing | Vitest |
| Hosting | Manus Autoscale (serverless) |
| GitHub | `pauljkwa/munymo-mvp-v1` |

---

## 3. The 7 Founder Decisions (June 2026) — BINDING REQUIREMENTS

These decisions were made by the founder after the PRD was drafted. They override any earlier notes or PRD assumptions that conflict with them. Every future build task must be checked against this list.

**Decision 1 — Auto-submission at lockout**
If a player made a Gut Selection but never submitted a Final Selection, the system must automatically copy the Gut Selection as the Final Selection at lockout time. This auto-submission is the only way that game counts toward scoring. The validation question must remain available to the player after lockout, with timed scoring still active.

**Decision 2 — Three streak types and losing streak intervention**
Three streak types are tracked per player:
- **Playing streak** — consecutive trading days on which the player participated (made at least a Gut Selection)
- **Correct-prediction streak** — consecutive games where the Final Selection was correct
- **Losing streak** — consecutive games where the Final Selection was wrong

A losing streak of 5 triggers a remedial learning intervention (exact UX to be designed — flag before building).

**Decision 3 — No-show rules**
Auto-submission only triggers if a Gut Selection was made. If no Gut Selection was made, the game is unplayed. An unplayed game breaks the playing streak. There is no auto-submission from nothing.

**Decision 4 — NASDAQ only in MVP**
Only NASDAQ-listed companies are used for matchups. The `exchange` field in `daily_games` defaults to `"NASDAQ"`. Do not add other exchanges without a new founder decision.

**Decision 5 — Away Status is unlimited in MVP**
Players may hold Away Status for any number of days in MVP. No cap is enforced. This will be revisited after observing real behaviour.

**Decision 6 — Result calculation**
The winner is determined by relative percentage movement from the company's opening price to its closing price on the game date. The company with the higher percentage movement wins, regardless of direction (i.e. a company down 1% beats a company down 3%). The admin manually enters these percentages in the End of Day form. The rule is not yet automated.

**Decision 7 — Community stats format**
Community statistics must always display the raw player count alongside the percentage. Format: `"67% picked Microsoft (3 players)."` The current Results page shows percentages only — this is an outstanding bug to fix.

---

## 4. What Is and Is NOT Complete

The handover from the previous session said "all phases 1–24 are functionally complete." This is not accurate. The following are outstanding:

| Item | Status |
|------|--------|
| Auto-submission at lockout (Decision 1) | **Complete (2026-07-06)** — new `runLockoutSweep()` in `server/autoSubmitHandler.ts` runs via an internal `node-cron` at 9:35 AM `America/New_York` (5 min after the 9:30 ET lockout, DST-safe). Finds every `active` game whose `lockoutAt` has passed (no time window — a missed run self-heals on the next sweep), copies `gutSelection → finalSelection` for picks missing a final, and flips the game to `locked`. `POST /api/scheduled/auto-submit-locked-picks` now calls the same function, authenticated via shared secret (`x-curation-secret`) instead of the retired Manus cron session — the `sdk` dependency is gone. `closeAndScoreGame`'s own gut→final copy remains as an idempotent safety net. |
| Validation question staying open after lockout (Decision 1) | **Complete** — confirmed `picks.submitValidation` (`server/routers.ts`) only blocks `result_published`/`cancelled`, so it already accepts answers on `locked` games; no code change needed. Now that games actually reach `locked` status (see row above), this behavior is live for the first time. |
| Three streak types (Decision 2) | Playing + win + lose streaks tracked. Playing-streak weekend-reset bug fixed (T1, 2026-07-03, commit 34112de). Losing-streak-of-5 intervention UX still outstanding (deferred, P5). |
| Losing streak intervention at 5 (Decision 2) | **Not implemented** |
| Community stats showing raw counts (Decision 7) | **Not implemented** — percentages only |
| `AdminSettings` page at `/admin/settings` | **Does not exist** — no file, no route |
| `app_settings` database table | **Does not exist** — not in schema.ts, no migration |
| `getSetting()` / `getAllSettings()` helpers in `server/db.ts` | **Do not exist** — scoring.ts still uses hardcoded constants |
| Streak-at-risk email trigger | **Complete** — `/api/scheduled/streak-at-risk` endpoint in `scheduledCuration.ts`; auth switched from Manus session cookie to shared secret `CURATION_AGENT_SECRET`; triggered by internal `node-cron` at 8:30 AM `America/New_York` Mon–Fri (DST-safe IANA timezone, always 60 min before the 9:30 ET lockout). Manus cron retired. |
| Time-decay validation scoring (12–20pts based on answer speed) | **Complete (2026-07-06)** — `calculateScore()` in `closeAndScoreGame` (`server/routers.ts`) now passes `pick.validationAnswerTimeMs` as the 5th argument, so `computeValidationScore()` in `server/scoring.ts` actually applies the decay in production instead of always awarding the full 20. Added boundary tests (15s/60s thresholds, null-timing, mid-range). |
| `/demo/autoplay` animated walkthrough | **Does not exist** — no file, no route |
| Resend DNS records (Cloudflare SPF/DKIM/DMARC) | **Pending** — action required from Paul |
| `researchSummary` beginner research field | **Complete** — DB column added (migration 0010), wired through `server/db.ts`, `server/routers.ts`, shown by default on `/game` with toggle to full analysis (commit bf9d804) |
| Yesterday's result CTA on /game | **Complete** — full result card with % change, winner trophy, CTA (commit 31bb3ee) |
| Price movement panel on /game/:id/result | **Complete** — two-column card showing both companies' % day change (commit 31bb3ee); actual $ start→finish prices added 2026-07-07 (migration 0012, `companyA/BStartPrice`/`EndPrice` on `daily_games`) — shown when present, curation agent now captures them, historical games without this data just show % change |
| Daily curation agent freshness enforcement | **Complete (2026-07-09)** — freshness is now pre-qualified BEFORE research/writing, not checked after the fact. `scheduledCuration.ts` exposes `POST /api/scheduled/check-freshness` (deterministic, DB-backed) and `GET /api/scheduled/recent-games` now also returns pre-computed `bannedSectors`/`bannedTickers`/`bannedPairs`. The agent's system prompt instructs it to scan news, abandon any thread whose sector/companies are banned immediately (no further research on that lead), and call the new `check_freshness` tool to confirm a candidate sector+pair before writing any content. The old flow wrote the entire game first and only found out about a freshness violation at submission (422), burning a full research-and-write cycle per rejection, up to `MAX_SUBMIT_ATTEMPTS` (4) times — that retry-on-422 path is kept as a safety net but should now rarely trigger. `checkFreshness()`/`computeBannedLists()` are shared between the new endpoint and the final submit-time validation in `dailyCurationHandler`, so the two checks can't drift apart. |
| Source attribution for daily matchup | **Shipped (2026-07-09, migration 0013, commit f2250dc)** — nullable `sourceUrl`/`sourceTitle`/`sourcePublisher` columns on `dailyGames`, threaded through `admin.endOfDay`'s Zod input, `CurationPayload`, and the curation agent's system prompt/JSON output (captures the exact article that gave the "buzz" signal, credited on the game page with a link back). Wired into `AdminEndOfDay.tsx`'s manual JSON-import/form path too. Displayed on `/game/:id` and the archive page under Pairing Rationale. Outbound links use `rel="noopener"` (deliberately NOT `noreferrer`) + UTM tags so publishers see labelled munymo.com referrals (guerrilla-marketing strategy — do not re-add noreferrer, commit 0452cb3). |
| Outbound article click tracking | **Shipped (2026-07-09, migration 0014, commit e9cf163)** — `outbound_clicks` table (purely additive) records each click on a source-article link (gameId/userId/publisher/sourceUrl, all nullable). Public `games.recordOutboundClick` mutation fired fire-and-forget from `DailyGame.tsx`/`ArchiveGame.tsx` (attributes to `ctx.user` when signed in, counts anonymous). Admin `admin.outboundClickStats` query + dashboard card show total + per-publisher breakdown (card only renders once ≥1 click exists). |
| Curation close/create is a no-op when next game exists | **Complete (2026-07-10)** — `admin.endOfDay` previously threw `CONFLICT` if a non-cancelled game already existed for `nextGameDate`, which could error out a run that had legitimately just closed a concluded game (the close commits first — no transaction — so it wasn't lost, but the run reported failure). Now it closes the concluded game, then **skips creation and reuses the existing game** as the next game (teaser/push reflect the real existing matchup, not the discarded proposal; `endOfDay` returns `nextGameCreated`). Still no pileups (nothing new inserted). Also fixed the misleading owner-notification wording that hardcoded "(public holiday)" whenever `marketClosed` was set — `marketClosed` is overloaded (real holiday OR no completed game was due), so the email no longer asserts a holiday. Motivated by the 2026-07-10 state where a manual-recovery run left the schedule a day ahead (DAL/UAL Fri already existed, COST/WMT Mon curated early). Checked against the [[game-cadence-canonical-spec]]. |
| Railway pre-deploy migration pipeline | **Complete** — `npx drizzle-kit migrate` only; migration files committed to repo; idempotent SQL (commits a8fb449, a40450f) |
| Tester agent (synthetic players) | **Complete** — 6 accounts (IDs 870002–870012), `node-cron` inside server at 6:00 PM `America/New_York` Mon–Fri (DST-safe, after curation), endpoint at `/api/scheduled/tester-picks` (commit ed89d50) |
| Replace Manus curation with Claude agent | **Complete** — Claude-powered agent in `server/_core/curationAgent.ts` (`claude-opus-4-8` + `web_search`), `node-cron` inside server at 4:15 PM `America/New_York` Mon–Fri (DST-safe IANA timezone, ~15 min after NASDAQ close year-round), manual trigger at `/api/scheduled/run-curation`. Endpoint auth switched from Manus session cookie to shared secret `CURATION_AGENT_SECRET`. Env vars set in Railway; both Manus scheduled tasks (curation + streak-at-risk) deactivated. Live smoke-tested (403 on unauthenticated probe). |
| Validation question type rotation | **Complete** — curation agent and reference prompt now instruct varying `questionType` (multiple_choice / true_false / yes_no) using the prior game's type (returned by `/api/scheduled/recent-games`), picking randomly among the other two so the same type never repeats two days running. Previously always defaulted to multiple_choice. |
| Streak double-increment on scoring retry | **Fixed 2026-07-06.** `closeAndScoreGame` (`server/routers.ts`) now checks `getPlayerScoreForGame` before scoring each pick; if a score row already exists (a prior run got partway through before failing), the score is still refreshed but `updateStreakForPlayer` is skipped, so a retry after a mid-loop failure no longer double-increments streaks. `daily_scores` also now has a DB-level unique index on (userId, gameId) (migration 0011), so `insertDailyScore`'s `onDuplicateKeyUpdate` actually fires instead of silently no-oping. |
| Duplicate-game/pileup protection | **Fixed 2026-07-06.** `endOfDay` (`server/routers.ts`) checks for an existing non-cancelled game on `nextGameDate` before calling `createGame`, throwing `CONFLICT` if one is found. `daily_games.gameDate` also now has a strict DB-level unique index (migration 0011, D1 approved by Paul) — a historical duplicate (two different games both published for 2026-06-18, ids 30001/60001) was found during the pre-flight check and resolved by re-dating id 60001 to 2026-06-19 before the index could be added. |
| Referral signup attribution | **Fixed 2026-07-06** — replaced the dead `POST /api/referral/attribute` Express route (required a Manus cron session nothing could present) with a `referral.attributeSignup` protected tRPC mutation, called once client-side after first sign-in when the `munymo_ref` cookie is present. See Section 22. |
| Multiple simultaneous "active" games pileup | **Fixed 2026-07-06.** Root cause: the close-game query in `scheduledCuration.ts` (`dailyCurationHandler`) ordered candidates by `desc(gameDate)` — picking the LATEST (a future, not-yet-played) active/locked game to close instead of the earliest. The old curation-agent prompt had the same ambiguity ("find the most recent game with active/locked status" over a newest-first list). Once more than one active game existed, each night's run would close the wrong (future) game with fabricated data while the real one from that day sat forever unresolved, and a new game kept getting added — exactly the "cron timing issue" symptom seen across several days. By 2026-07-06 this had produced three unresolved rows: July 6 (AMZN/TSLA, manually cancelled by Paul), July 7 (NVDA/AVGO, `lockoutAt` wrongly `13:00 UTC` instead of `13:30 UTC` — a recurrence of the bug "fixed" once before in commit `633c3ae`), and July 8 (GOOGL/META, pre-curated ahead of time, which should never happen). **Manual cleanup performed:** July 8 (GOOGL/META) and the cancelled July 6 (AMZN/TSLA) rows deleted entirely (with their `game_research`/`validation_questions` children); NVDA/AVGO's `gameDate` moved to `2026-07-06` and `lockoutAt` corrected to `2026-07-06T13:30:00.000Z`, so it now correctly stands in as today's game. July 7 and July 8 are blank and will be freshly curated when those dates actually arrive. **Code fix:** the close-game query now orders by `asc(gameDate)`; both `curationAgent.ts`'s system prompt and `daily-curation-agent-prompt.md` now explicitly say to pick the EARLIEST-dated active/locked game, not the first one in the (newest-first) list. |

---

## 5. Repository and Deployment

**Active working directory:** `/home/ubuntu/munymo-mvp-fresh`

**GitHub remote:** `pauljkwa/munymo-mvp-v1`

The GitHub connector must be enabled in the Manus config before pushing:

```bash
manus-config config load --search github
# If enabled: false, edit /home/ubuntu/.manus/config/config.json and set "enabled": true
manus-config config save
```

To push after a checkpoint:

```bash
cd /home/ubuntu/munymo-mvp-fresh
git push --force-with-lease github main
```

The remote is named `github`. The Manus internal remote is `origin`. Never push to `origin` for GitHub — it goes to Manus's internal S3 store.

**Latest commit:** `b1508f84` on branch `main`.

**Deployment:** The live site at `munymo.com` is served by Manus Autoscale. Deployment is automatic on push to the Manus internal remote (not GitHub). GitHub is the backup/handover copy, not the deployment trigger.

---

## 6. Full Database Schema

Schema lives in `drizzle/schema.ts`. Migrations are in `drizzle/`. Thirteen migrations have been applied (0000–0012). Run `pnpm db:push` to apply schema changes.

### `users`
Players and admins.

| Column | Type | Notes |
|--------|------|-------|
| `id` | int PK | Auto-increment |
| `clerkId` | varchar(64) unique | Clerk user ID — primary identity |
| `openId` | varchar(64) unique | Legacy Manus OAuth ID — kept for backward compat |
| `name` | text | Name from OAuth provider |
| `displayName` | varchar(64) | Custom display name set by player |
| `email` | varchar(320) | |
| `loginMethod` | varchar(64) | |
| `role` | enum('user','admin') | Default: 'user'. Promote via direct DB update |
| `tier` | enum('free','premium') | Default: 'free' |
| `awayStatus` | boolean | When true, streak is protected |
| `awayStatusUntil` | timestamp | Optional expiry for away status |
| `deactivated` | boolean | Soft delete — blocks sign-in |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | Auto-updated |
| `lastSignedIn` | timestamp | |

### `daily_games`
One row per game day. Status lifecycle: `draft → active → locked → result_published | cancelled`.
Unique index on `gameDate` (migration 0011, 2026-07-06).

| Column | Type | Notes |
|--------|------|-------|
| `id` | int PK | |
| `gameDate` | varchar(10) | YYYY-MM-DD format |
| `exchange` | varchar(16) | Default: 'NASDAQ' |
| `companyAName` | varchar(128) | |
| `companyATicker` | varchar(16) | |
| `companyBName` | varchar(128) | |
| `companyBTicker` | varchar(16) | |
| `sector` | varchar(128) | |
| `pairingRationale` | text | Why these two companies are matched |
| `status` | enum | draft / active / locked / result_published / cancelled |
| `winner` | enum('A','B') | Null until result_published |
| `companyAPerf` | decimal(7,3) | % movement e.g. +2.450 |
| `companyBPerf` | decimal(7,3) | % movement e.g. -1.230 |
| `resultSummary` | text | Short paragraph on what happened |
| `hindsightSpotlight` | text | Educational debrief with hindsight analysis |
| `resultCommentary` | text | Legacy field — kept for compatibility |
| `lockoutAt` | timestamp | Server-enforced deadline |
| `publishedAt` | timestamp | When result was published |
| `cancelledAt` | timestamp | |
| `createdBy` | int | Admin user ID |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

### `game_research`
Research content attached to each game. One row per game.

| Column | Type | Notes |
|--------|------|-------|
| `id` | int PK | |
| `gameId` | int unique | FK to daily_games |
| `content` | text | Markdown narrative research |
| `researchMetrics` | json | Array of `{ label: string, value: string }` — see Section 14 |
| `researchSnapshot` | text | Immutable copy taken at result_published |
| `metricsSnapshot` | json | Immutable metrics copy taken at result_published |
| `snapshotTakenAt` | timestamp | |
| `updatedAt` | timestamp | |

### `validation_questions`
One question per game.

| Column | Type | Notes |
|--------|------|-------|
| `id` | int PK | |
| `gameId` | int unique | FK to daily_games |
| `questionType` | enum | multiple_choice / yes_no / true_false |
| `questionText` | text | |
| `options` | json | Array of strings for multiple_choice; null for yes_no/true_false |
| `correctAnswer` | varchar(256) | Hidden from players until result_published |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

### `player_picks`
One row per user per game. Unique index on (userId, gameId).

| Column | Type | Notes |
|--------|------|-------|
| `id` | int PK | |
| `userId` | int | FK to users |
| `gameId` | int | FK to daily_games |
| `gutSelection` | enum('A','B') | Null until submitted |
| `gutSubmittedAt` | timestamp | |
| `finalSelection` | enum('A','B') | Null until submitted |
| `finalSubmittedAt` | timestamp | |
| `validationAnswer` | varchar(256) | |
| `validationAnswerTimeMs` | int | Ms from question display to answer — used for time-decay scoring |
| `validationSubmittedAt` | timestamp | |
| `isLocked` | boolean | Set to true at lockout |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

### `daily_scores`
Server-side only. Never accepted from client. Unique index on (userId, gameId)
(migration 0011, 2026-07-06) — `insertDailyScore`'s `onDuplicateKeyUpdate` now
actually fires on a repeat write instead of silently no-oping.

| Column | Type | Notes |
|--------|------|-------|
| `id` | int PK | |
| `userId` | int | |
| `gameId` | int | |
| `predictionScore` | int | 0 or 80 |
| `validationScore` | int | 0–20 (time-decayed) |
| `totalScore` | int | 0–100 |
| `calculatedAt` | timestamp | |

### `leaderboard_stats`
Materialised per-player. Recalculated on each result publish.

| Column | Type | Notes |
|--------|------|-------|
| `id` | int PK | |
| `userId` | int unique | |
| `gamesPlayed` | int | |
| `totalScore` | bigint | Running total |
| `averageDailyScore` | decimal(6,2) | totalScore / gamesPlayed |
| `qualificationStatus` | enum | pending / qualified (qualified when gamesPlayed >= 20) |
| `lastUpdatedAt` | timestamp | |

### `streak_records`
Per-player streak tracking. Currently only tracks playing streak (current + longest). Three-streak-type tracking is an outstanding build item.

| Column | Type | Notes |
|--------|------|-------|
| `id` | int PK | |
| `userId` | int unique | |
| `currentStreak` | int | Consecutive days participated |
| `longestStreak` | int | All-time best |
| `lastParticipationDate` | varchar(10) | YYYY-MM-DD |
| `awayStatus` | enum | active / away / missing |
| `awayStatusSetAt` | timestamp | |
| `awayStatusSetBy` | int | Admin user ID |
| `updatedAt` | timestamp | |

### `game_community_stats`
Computed after result_published. Hidden from players while game is open.

| Column | Type | Notes |
|--------|------|-------|
| `id` | int PK | |
| `gameId` | int unique | |
| `totalParticipants` | int | Raw count — must be shown to players per Decision 7 |
| `gutPctA` | decimal(5,2) | % who picked Company A as gut |
| `gutPctB` | decimal(5,2) | |
| `finalPctA` | decimal(5,2) | % who picked Company A as final |
| `finalPctB` | decimal(5,2) | |
| `validationCorrectPct` | decimal(5,2) | |
| `computedAt` | timestamp | |

### `metric_explanations`
LLM-generated plain-English explanations for research metric labels. Cached indefinitely.

| Column | Type | Notes |
|--------|------|-------|
| `id` | int PK | |
| `metricKey` | varchar(256) unique | Normalised (lowercase, trimmed) |
| `metricLabel` | varchar(256) | Original label as submitted |
| `explanation` | text | Plain English explanation |
| `aiGenerated` | boolean | True if LLM-generated; false if manually overridden |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

### `push_subscriptions`
Web Push subscriptions. One row per user per device/browser.

| Column | Type | Notes |
|--------|------|-------|
| `id` | int PK | |
| `userId` | int | |
| `endpoint` | text | Push service URL (unique per device) |
| `endpointHash` | varchar(64) | SHA-256 of endpoint — used for unique index |
| `p256dh` | text | Encryption key from browser PushSubscription |
| `auth` | text | Auth key from browser PushSubscription |
| `userAgent` | varchar(512) | Hint for display purposes |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

Unique index on (userId, endpointHash). Expired subscriptions (410 response from push service) are automatically cleaned up.

### `referral_codes`
One row per physical merch item (mug, t-shirt, etc.). QR code points to `munymo.com/r/[code]`.

| Column | Type | Notes |
|--------|------|-------|
| `id` | int PK | |
| `code` | varchar(16) unique | 8-char alphanumeric |
| `merchType` | enum | mug / tshirt / other |
| `batchId` | varchar(64) | Production/fulfilment run ID |
| `ownerId` | int | FK to users — null until enrolled |
| `status` | enum | unassigned / active / suspended |
| `enrolledAt` | timestamp | When owner claimed this code |
| `totalScans` | int | Denormalised running total |
| `totalSignups` | int | Denormalised running total |
| `notes` | text | Admin notes |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

### `referral_events`
One row per scan or signup event.

| Column | Type | Notes |
|--------|------|-------|
| `id` | int PK | |
| `referralCodeId` | int | FK to referral_codes |
| `eventType` | enum | scan / signup |
| `referredUserId` | int | FK to users — null for scan events |
| `ownerIdAtEvent` | int | Denormalised owner at time of event |
| `deviceFingerprint` | varchar(64) | SHA-256 of IP+UA — never stored raw |
| `referralCookie` | varchar(64) | Attribution cookie value |
| `attributed` | boolean | Whether within 30-day attribution window |
| `createdAt` | timestamp | |

### `admin_audit_log`
Sensitive admin actions.

| Column | Type | Notes |
|--------|------|-------|
| `id` | int PK | |
| `adminId` | int | |
| `action` | varchar(64) | e.g. 'publishResult', 'cancelGame' |
| `targetType` | varchar(64) | e.g. 'game', 'player' |
| `targetId` | int | |
| `detail` | text | JSON or human-readable description |
| `createdAt` | timestamp | |

---

## 7. All Frontend Routes

| Path | Component | Access |
|------|-----------|--------|
| `/` | `Home.tsx` | Public |
| `/game` | `DailyGame.tsx` | Public (picks require auth) |
| `/game/:id/result` | `GameResult.tsx` | Public |
| `/leaderboard` | `Leaderboard.tsx` | Public |
| `/research` | `ResearchHub.tsx` | Public |
| `/research/:id` | `ArchiveGame.tsx` | Public |
| `/profile` | `PlayerProfile.tsx` | Public |
| `/dashboard` | `MyDashboard.tsx` | Protected (Clerk) |
| `/evolution` | `EvolutionOfMunymo.tsx` | Public |
| `/demo` | `Demo.tsx` | Public |
| `/email-landing` | `EmailLanding.tsx` | Public |
| `/terms` | `TermsOfUse.tsx` | Public |
| `/privacy` | `PrivacyPolicy.tsx` | Public |
| `/disclaimer` | `Disclaimer.tsx` | Public |
| `/responsible-gaming` | `ResponsibleGaming.tsx` | Public |
| `/r/:code` | Server-side redirect | Public — records scan event, sets attribution cookie, redirects to `/` |
| `/admin` | `AdminDashboard.tsx` | Admin only |
| `/admin/games/new` | `AdminCreateGame.tsx` | Admin only |
| `/admin/games/:id/edit` | `AdminEditGame.tsx` | Admin only |
| `/admin/games/:id/result` | `AdminPublishResult.tsx` | Admin only |
| `/admin/players` | `AdminPlayers.tsx` | Admin only |
| `/admin/audit` | `AdminAuditLog.tsx` | Admin only |
| `/admin/end-of-day` | `AdminEndOfDay.tsx` | Admin only |

**Known nav bug:** `PublicLayout.tsx` footer hardcodes `/profile` for the "My Dashboard" link. The actual dashboard route is `/dashboard`. Fix when convenient.

**Not yet built:** `/demo/autoplay` (animated walkthrough with ghost cursor) — no file, no route exists yet.

---

## 8. All tRPC Procedures

All procedures are defined in `server/routers.ts`. The `appRouter` composes these sub-routers.

### `auth`
- `auth.me` — public query; returns current user from Clerk session or null
- `auth.logout` — public mutation; no-op (Clerk handles logout client-side)

### `games`
- `games.getToday` — public; returns nearest active or locked game regardless of date
- `games.getById` — public; returns single game by ID
- `games.getResearch` — public; returns live research for active games; returns the immutable snapshot for published games
- `games.getValidationQuestion` — public; hides `correctAnswer` until status is `result_published`
- `games.list` — public; paginated list of all games
- `games.listArchive` — public; paginated list of `result_published` games only
- `games.getCommunityStats` — public; only returns data for `result_published` games

### `picks`
- `picks.getMyPick` — protected; returns current user's pick for a game
- `picks.submitGut` — protected; stores Gut Selection; cannot change after Final submitted
- `picks.submitFinal` — protected; stores Final Selection; requires Gut first; blocked after lockout
- `picks.submitValidation` — protected; stores validation answer + time; returns `isCorrect` immediately. **Per Decision 1, this must remain available after lockout — it must NOT be blocked by the lockout middleware. This is currently an outstanding bug.**

### `scores`
- `scores.getMyScoreForGame` — protected
- `scores.getMyHistory` — protected; all-time score history
- `scores.getMyLeaderboardStat` — protected

### `leaderboard`
- `leaderboard.get` — public; returns qualified players (gamesPlayed >= 20) sorted by averageDailyScore

### `streaks`
- `streaks.getMyStreak` — protected; returns streak record for current user
- `streaks.getStockChart` — public; proxies Yahoo Finance OHLCV data for a given ticker and range (1d / 5d / 1mo / 3mo / 6mo / 1y)

### `admin` (all require `role === "admin"`)
- `admin.createGame` — create a new game (status: draft)
- `admin.activateGame` — set status to active; sends game-available email to all users
- `admin.updateGame` — update game fields
- `admin.cancelGame` — cancel with reason; neutral for all players; logs to audit
- `admin.updateResearch` — set or update active-game research content and metrics
- `admin.setValidationQuestion` — attach validation question to game
- `admin.publishResult` — publish outcome; scores all picks; updates leaderboard; computes community stats; takes research snapshot; sends emails and push notifications
- `admin.endOfDay` — atomic operation: close today's game + create tomorrow's game in one call; sends all emails and push notifications
- `admin.setPlayerAwayStatus` — set a player's away/missing/active status
- `admin.listPlayers` — list all players
- `admin.resetPlayerPick` — delete a player's pick row for the active game (for testing)
- `admin.listAllGames`, `admin.getGameDetail`, `admin.getAuditLog`

### `dashboard` (all protected)
- `dashboard.getProfile` — returns user profile data
- `dashboard.updateDisplayName` — update custom display name
- `dashboard.setAwayStatus` — toggle away status
- `dashboard.deactivateAccount` — soft delete; sets `deactivated=true`; signs out
- `dashboard.getHistory` — paginated game history
- `dashboard.getStats` — comprehensive stats: accuracy, streak, leaderboard rank, validation accuracy, gut-vs-final agreement rate

### `metrics`
- `metrics.getExplanation` — public. Checks `server/_core/metricExplanations.ts` FIRST: a static, hand-written explanation for each of the six standard research metrics (Market Cap, P/E Ratio, Revenue Growth, EPS (TTM), 52-Week Range, Analyst Consensus), matched by suffix since labels are always ticker-prefixed (e.g. "NVDA Market Cap"). Instant, no DB, no LLM. Only a genuinely custom/admin-entered label (not one of the six) falls through to the DB cache, then to a live Claude call (`claude-opus-4-8` via `ANTHROPIC_API_KEY`) which caches its result for next time. **History (2026-07-06): originally called `server/_core/llm.ts` (Manus "Forge" proxy via `BUILT_IN_FORGE_API_KEY`), which was never set in Railway — every call 500'd instantly with no server-side log (tRPC has no `onError` handler, so uncaught errors are silent). First fixed by calling Anthropic directly per-request (worked, but ~5s latency per tap since every metric has a unique ticker-prefixed label and none of it was actually company-specific). Replaced same day with the static-lookup approach above, since the content never varied by ticker anyway.** `server/_core/llm.ts` is unused dead code, left in place. If other unexplained silent 500s show up, add an `onError` to `createExpressMiddleware` in `server/_core/index.ts` — there currently is none.

### `push`
- `push.subscribe` — store a push subscription for the current user
- `push.unsubscribe` — remove a push subscription
- `push.status` — check whether the current user has push enabled on this device
- `push.vapidPublicKey` — return the VAPID public key for client-side subscription setup

### `referral`
- `referral.claim` — protected; enrol a merch QR code to the current user's account
- `referral.myStats` — protected; aggregate stats for codes owned by current user
- `referral.generate`, `referral.listAll`, `referral.suspend`, `referral.unsuspend` — admin only

---

## 9. Scoring System

Scoring is implemented in `server/scoring.ts`. All scoring is **server-side only** — values are never accepted from the client.

**Prediction score:** 80 points for correct Final Selection, 0 for incorrect. (80% of total.)

**Validation score:** Time-decayed, 0–20 points. (20% of total.)
- Correct answer in under 15,000ms → 20 points
- Correct answer between 15,000ms and 60,000ms → linear decay from 20 down to 12
- Correct answer over 60,000ms → 12 points (minimum — answering correctly always earns something)
- Wrong answer → 0 points regardless of time

**Total:** 0–100 per game.

**Hardcoded constants (currently not read from DB):**
```typescript
VALIDATION_FAST_THRESHOLD_MS = 15_000
VALIDATION_SLOW_THRESHOLD_MS = 60_000
VALIDATION_MAX_SCORE = 20
VALIDATION_MIN_SCORE = 12
LEADERBOARD_QUALIFICATION_THRESHOLD = 20
```

**Outstanding:** An `AdminSettings` page was intended to let the admin configure these weights via an `app_settings` DB table. That table, the page, and the `getSetting()` DB helper do not exist yet. Until they are built, `scoring.ts` uses the hardcoded constants above. Do not wire scoring to the DB until the table and helpers are built and tested.

---

## 10. Game Lifecycle

```
draft → active → locked → result_published
                        ↘ cancelled
```

1. **draft** — admin created the game; not visible to players
2. **active** — game is live; players can submit; game-available email sent to all users
3. **locked** — lockout deadline has passed; pick mutations blocked by `assertNotLocked()`; **validation answers must remain accepted per Decision 1**
4. **result_published** — outcome published; scores calculated; research snapshot taken (immutable); community stats computed; emails and push sent
5. **cancelled** — neutral for all players; no streak penalty; logged to audit

---

## 11. Admin End-of-Day Flow

The primary daily operation is the **End of Day** page at `/admin/end-of-day`.

**Step by step:**
1. Admin pastes the curation JSON into the Import JSON textarea
2. Clicks **Populate Fields** — parses JSON and fills all form fields
3. A green "Ready to publish" summary card appears showing today's closing game and tomorrow's matchup
4. Admin clicks **Publish & Create Next Game** — calls `admin.endOfDay` tRPC mutation
5. A full-screen loading overlay with animated progress steps appears
6. On success, overlay shows completion state

**What `admin.endOfDay` does atomically:**
- Closes today's game (marks result_published, records winner + performance %)
- Scores all picks server-side
- Updates leaderboard stats
- Computes community stats
- Takes immutable research snapshot
- Sends personalised result emails (participants get score; non-participants get re-engagement email with next-game teaser)
- Sends push notifications: result notification + new game notification
- Creates tomorrow's game (with research, metrics, validation question)

**Magic links in emails:** The procedure generates Clerk sign-in tokens per user, wrapped in `https://munymo.com/api/magic?token=...&to=...` URLs. The `/api/magic` endpoint validates the token server-side before forwarding — expired tokens show a custom fallback page instead of Clerk's error screen.

---

## 12. Curation JSON Payload Format

This is the format posted to `POST /api/scheduled/daily-curation` and pasted into the End of Day form. Defined as `CurationPayload` in `server/_core/scheduledCuration.ts`.

```json
{
  "today": {
    "winnerTicker": "AAPL",
    "companyAPerf": 2.45,
    "companyBPerf": -1.23,
    "resultSummary": "Short paragraph describing what happened in the market today.",
    "hindsightSpotlight": "Educational debrief with analyst consensus and 20/20 hindsight."
  },
  "tomorrow": {
    "gameDate": "2026-06-25",
    "companyAName": "Apple Inc.",
    "companyATicker": "AAPL",
    "companyBName": "Microsoft Corporation",
    "companyBTicker": "MSFT",
    "sector": "Technology",
    "lockoutAt": "2026-06-25T13:00:00.000Z",
    "researchContent": "Markdown narrative research for the game page.",
    "researchMetrics": {
      "AAPL Market Cap": "$3.1T",
      "AAPL P/E Ratio": "32.4x (TTM)",
      "AAPL Revenue Growth": "+5.1% (YoY, FY2025)",
      "AAPL EPS (TTM)": "$6.42",
      "AAPL 52-Week Range": "$164.08 – $260.10",
      "MSFT Market Cap": "$3.3T",
      "MSFT P/E Ratio": "35.2x (TTM)",
      "MSFT Revenue Growth": "+17.6% (YoY, FY2025)",
      "MSFT EPS (TTM)": "$12.85",
      "MSFT 52-Week Range": "$344.79 – $505.48"
    },
    "validationQuestion": {
      "questionType": "multiple_choice",
      "questionText": "What does P/E ratio measure?",
      "options": ["A) Price per employee", "B) Price relative to earnings", "C) Profit efficiency", "D) Price per exchange"],
      "correctAnswer": "B) Price relative to earnings"
    },
    "pairingRationale": "Why this specific matchup matters today."
  }
}
```

**Critical — two formats for `researchMetrics`:**
- **In the curation JSON payload** (above): flat object with ticker-prefixed keys (`"AAPL Market Cap": "$3.1T"`)
- **In the database** (`game_research.researchMetrics`): array of objects (`[{ label: "AAPL Market Cap", value: "$3.1T" }]`)

The conversion from flat object to array happens in `server/_core/scheduledCuration.ts`. Do not change one format without updating the other and the conversion step.

**Ticker prefix convention:** Each metric key must be prefixed with the company ticker followed by a space. The game page uses this prefix to split metrics into the two-column layout. If keys are not prefixed, a fallback splits the list in half — the layout will still render but company attribution will be wrong.

---

## 13. Automated Daily Curation (CRON Agent)

The daily curation is a **Manus Agent scheduled task** — not a server-side cron. A separate AI agent runs on a schedule and calls the server's HTTP endpoints. The server listens; it does not schedule itself.

**Cron task details:**
- Task UID: `VKTf81x4Muj5Sx9c3JcCvi`
- Schedule: Monday–Friday, 4:15 AM Perth time (AWST = UTC+8) = 20:15 UTC
- Project UID: `SLgzupJDuKY6wiWMJF6c7P`

**To check cron status:**
```bash
manus-config schedule status
```

**To re-enable if paused:**
```bash
manus-config schedule update --uid VKTf81x4Muj5Sx9c3JcCvi --status active
```

**What the agent does when it fires:**
1. GETs `https://munymo.com/api/scheduled/recent-games` — public; returns last 365 days of games + freshness rule constants
2. Checks freshness rules: no same sector within 7 days, no same company within 30 days, no same pair within 365 days
3. Looks up closing prices on Yahoo Finance for today's active game
4. Selects tomorrow's matchup, researches both companies, writes research content, metrics, validation question, and Hindsight Spotlight
5. POSTs the complete `CurationPayload` JSON to `POST https://munymo.com/api/scheduled/daily-curation`
6. Server closes today's game, scores all picks, sends all emails and push notifications, creates tomorrow's game

If the market was closed (public holiday), the agent sets `marketClosed: true` — the server skips scoring and only creates tomorrow's game.

If the cron fails, the owner receives a push notification: "❌ Daily curation FAILED — Please run End of Day manually before 9:00 PM Perth time."

**Agent prompt location:** `references/daily-curation-agent-prompt.md` — do not modify unless specifically asked.

**Manual fallback if cron misses a run:**
1. Open `references/daily-curation-agent-prompt.md`
2. Start a new Manus chat, paste the prompt, replace `{RECENT_GAMES_JSON}` with the output of `GET https://munymo.com/api/scheduled/recent-games`
3. Agent generates the JSON payload
4. Go to `/admin/end-of-day` → Import JSON → Populate Fields → Publish & Create Next Game

---

## 14. Research Metrics Layout

The two-column side-by-side comparison table is in `client/src/pages/DailyGame.tsx` around lines 640–784. The same layout is in `client/src/pages/ArchiveGame.tsx`.

**Structure:**
- Single rounded card with `border` and `background: var(--color-surface)`
- **Header row:** `grid grid-cols-2` — Company A (green `#009050`) left, Company B (blue `#1d4ed8`) right
- **Metric rows:** `grid grid-cols-2` — alternating shading; label in small uppercase, value in bold; "What does this mean?" link below each value triggers `MetricExplanationSheet`
- **Chart CTAs row:** `grid grid-cols-2` at the bottom — "View Chart" button per company, opens `ChartSheet`

**Do not rewrite this layout.** It was rebuilt multiple times before settling on this approach.

---

## 15. ChartSheet Component

`client/src/components/ChartSheet.tsx` is a custom full-screen bottom sheet for displaying candlestick charts.

**Behaviour:**
- Animates in from the bottom with a slide-up transition
- Locks page scroll by adding the `sheet-open` class to `document.documentElement` — this is handled via CSS (`.sheet-open { overflow: hidden; }` in `index.css`), NOT via inline styles. This was a critical iOS Safari bug fix — do not change it to inline styles.
- Supports swipe-down dismissal (100px threshold)
- Restores scroll position on close

---

## 16. Candlestick Charts

Charts use **TradingView `lightweight-charts`** v4. Component: `client/src/components/CandlestickChart.tsx`.

**Critical constraint:** `lightweight-charts` has its own colour parser that only accepts hex, rgb, rgba, hsl, hsla, and named CSS colours. **Never pass oklch() values or CSS variable references** (e.g. `var(--color-brand)`) as chart colours — the library throws a silent error and renders a blank canvas with no console warning. This caused a multi-session debugging disaster.

**Correct colours:**
- Company A: `#009050` (brand green)
- Company B: `#1d4ed8` (blue)

The chart creates itself with explicit `clientWidth` (not `autoSize`) and uses a `ResizeObserver` for future resizes. On mobile, `ResizeObserver` does not reliably fire when a parent transitions from `display:none` to `display:block` (known Safari/Chrome mobile behaviour). The current implementation uses a 50ms polling loop (up to 1 second / 20 attempts) checking `clientWidth` directly — this is immune to `ResizeObserver` firing issues. Do not replace this with a single `ResizeObserver` approach.

---

## 17. Email System

Email sent via **Resend** (`RESEND_API_KEY` env var). Sender: `Munymo <notifications@munymo.com>`.

| Template | Subject | Trigger |
|----------|---------|---------|
| `buildGameAvailableEmail` | "Today's Munymo matchup is live — {A} vs {B}" | `admin.activateGame` — sent to all registered users |
| `buildResultPublishedEmail` | "Munymo result: {winner} wins — your score is {score}" | `admin.endOfDay` — sent to players who participated |
| `buildMissedGameEmail` | "You missed it — {winner} beat {loser} on {date}" | `admin.endOfDay` — sent to registered users who did NOT participate |
| `buildStreakAtRiskEmail` | "Your {N}-day streak is at risk — play before lockout" | **Not yet wired** — template exists, no automated trigger |

All result/game emails include Clerk magic links for one-tap sign-in.

**Outstanding:** Resend DNS records (SPF/DKIM/DMARC) have not been added to Cloudflare. Paul needs to do this from the Resend dashboard.

---

## 18. Push Notifications

Web Push via `web-push` npm package. VAPID keys in env vars.

**Service worker:** `client/public/sw.js`

**Key components:**
- `usePushNotifications` hook — manages SW registration, permission, subscribe/unsubscribe
- `NotificationSettings` component — handles iOS limitations, denied permissions, unsupported browsers; shown on player profile page

**Automatic push events (sent by `admin.endOfDay`):**
1. Result notification: "Results are in: [WINNER] beats [LOSER]"
2. New game notification: "Today's game is live: [TICKER_A] vs [TICKER_B]"

---

## 19. Authentication

Auth is **Clerk** — not Manus OAuth. Manus OAuth references anywhere are stale.

Both `clerkId` and `openId` (legacy) are stored on `users` for backward compatibility.

**Client:** `VITE_CLERK_PUBLISHABLE_KEY` env var. `ClerkProvider` wraps the app. `useAuth()` hook wraps Clerk's `useUser()`.

**Server:** `CLERK_SECRET_KEY` env var. Clerk Express middleware extracts the user from the session on every request. `server/_core/context.ts` builds the tRPC context.

- `publicProcedure` — no auth required
- `protectedProcedure` — requires valid Clerk session
- `adminProcedure` — additionally checks `ctx.user.role === "admin"`

To promote a user to admin, update the `role` field directly in the database.

Deactivated users (`deactivated: true`) are blocked from signing in at the middleware level.

---

## 20. Landing Page (Home.tsx) — Do Not Revert

The landing page was rebuilt in Phase 12 and is working exactly as intended. Do not revert it. Sections in order:

1. **Beta announcement bar** — dismissible (sessionStorage), shown to all users including admins
2. **Hero section** — asymmetric layout with live game teaser card or interactive mock card if no active game; CTAs to `/game` and `/demo`
3. **How It Works** — four-step process
4. **80/20 Scoring explainer** — with streak, leaderboard, and integrity sub-cards
5. **MunyIQ teaser carousel** — four tier cards (Sapphire, Emerald, Ruby, Diamond) with hosted gemstone images; "Coming Soon" positioning
6. **Road Ahead teaser cards** — Certificates of Achievement, Head-to-Head Challenges, Native Mobile Apps
7. **Founding Beta recruitment section** — personal invitation tone
8. **Final CTA** — unauthenticated users see sign-up prompt

---

## 21. Demo Page

`/demo` — `client/src/pages/Demo.tsx` — a fully interactive demo of the game flow using hardcoded AAPL vs MSFT data. No auth required, no DB writes. Shows the full experience: Gut Selection → Research (with real candlestick charts) → Validation Question → Result.

**`/demo/autoplay`** — does not exist yet. Intended to be an animated walkthrough with a ghost cursor and tap-to-advance beats. No file, no route.

---

## 22. Referral / Merch QR System

Physical merch items ship with unique QR codes pointing to `munymo.com/r/[code]`.

1. **Scan:** `GET /r/:code` server-side route — records a `scan` event, sets a 30-day attribution cookie (`munymo_ref`), redirects to landing page
2. **Attribution:** `referral.attributeSignup` protected tRPC mutation (fixed 2026-07-06) — client-side `ReferralAttribution` component (`client/src/components/ReferralAttribution.tsx`, mounted once in `App.tsx`) calls it once after first sign-in when the `munymo_ref` cookie is present, then clears the cookie. Looks for a matching scan within 30 days; creates a `signup` event; increments `totalSignups`. Replaces the old `POST /api/referral/attribute` Express route, which required a Manus cron session nothing could present — signup attribution was dead until this fix.
3. **Owner stats:** `referral.myStats` tRPC procedure
4. **Admin:** `referral.generate`, `referral.listAll`, `referral.suspend`, `referral.unsuspend`

---

## 23. Design System

**Theme:** Light-first. `ThemeProvider defaultTheme="light"` with dark mode toggle in nav. CSS variables in `client/src/index.css`.

**Colours:**
- `#002000` — dark green (wordmark, nav active, headings)
- `#009050` — brand accent green (Company A, CTAs, logo icon mark)
- `#1d4ed8` — blue (Company B, secondary accents)

**Typography:**
- Headings: Syne (Google Fonts)
- Body: Plus Jakarta Sans (Google Fonts)
- Monospace: JetBrains Mono

**Logo:** `MunymoLogo` React component in `client/src/components/MunymoLogo.tsx`. Adapts to dark mode via CSS filter.

**Layout shells:**
- `PublicLayout.tsx` — hamburger header (all screen sizes), overlay nav panel, footer with all internal links
- `AdminLayout.tsx` — sidebar on desktop, hamburger drawer on mobile

---

## 24. Environment Variables

All secrets managed via `webdev_request_secrets`.

| Variable | Purpose | Side |
|----------|---------|------|
| `DATABASE_URL` / `MUNYMO_DATABASE_URL` | MySQL/TiDB connection string | Server |
| `JWT_SECRET` | Session signing (legacy — kept for compatibility) | Server |
| `CLERK_SECRET_KEY` | Clerk server-side auth | Server |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk frontend key | Client |
| `RESEND_API_KEY` | Transactional email via Resend | Server |
| `VAPID_PUBLIC_KEY` | Web Push VAPID public key (server-side send) | Server |
| `VAPID_PRIVATE_KEY` | Web Push VAPID private key | Server |
| `VITE_VAPID_PUBLIC_KEY` | Web Push VAPID public key (client-side subscription setup) | Client |
| `BUILT_IN_FORGE_API_KEY` | Manus built-in LLM and storage APIs | Server |
| `BUILT_IN_FORGE_API_URL` | Manus built-in LLM and storage APIs | Server |
| `VITE_FRONTEND_FORGE_API_KEY` | Manus built-in APIs (frontend) | Client |
| `VITE_FRONTEND_FORGE_API_URL` | Manus built-in APIs (frontend) | Client |
| `VITE_APP_ID` | Manus OAuth app ID (legacy — kept for compatibility) | Client |
| `OWNER_OPEN_ID` | Owner identity for cron failure notifications | Server |
| `OWNER_NAME` | Owner display name for notifications | Server |

If a new Manus chat has zero connections, the first priority before any code work must be re-establishing every secret above via `webdev_request_secrets`. Do not attempt to run or build the project until all secrets are in place.

---

## 25. Key File Index

### Client — pages
| File | Purpose |
|------|---------|
| `client/src/pages/Home.tsx` | Landing page — do not revert |
| `client/src/pages/DailyGame.tsx` | Main game page — research metrics layout lines ~640–784 |
| `client/src/pages/GameResult.tsx` | Results page — shows scores, community stats, Hindsight Spotlight |
| `client/src/pages/ArchiveGame.tsx` | Single archived game — same metrics layout as DailyGame |
| `client/src/pages/ResearchHub.tsx` | Archive browser |
| `client/src/pages/Leaderboard.tsx` | Ranked leaderboard |
| `client/src/pages/MyDashboard.tsx` | Player dashboard at `/dashboard` |
| `client/src/pages/PlayerProfile.tsx` | Player profile + push notification settings |
| `client/src/pages/Demo.tsx` | Static demo at `/demo` — no auth, no DB |
| `client/src/pages/EmailLanding.tsx` | Magic link landing page |
| `client/src/pages/EvolutionOfMunymo.tsx` | Brand story page |
| `client/src/pages/admin/AdminDashboard.tsx` | Admin overview |
| `client/src/pages/admin/AdminEndOfDay.tsx` | Daily publish form |
| `client/src/pages/admin/AdminCreateGame.tsx` | New game form |
| `client/src/pages/admin/AdminEditGame.tsx` | Edit game + research |
| `client/src/pages/admin/AdminPublishResult.tsx` | Publish result form |
| `client/src/pages/admin/AdminPlayers.tsx` | Player management + away status |
| `client/src/pages/admin/AdminAuditLog.tsx` | Paginated audit log |
| `client/src/pages/legal/` | Terms, Privacy, Disclaimer, Responsible Gaming |

### Client — components
| File | Purpose |
|------|---------|
| `client/src/components/ChartSheet.tsx` | Full-screen bottom sheet for charts — iOS scroll-lock safe |
| `client/src/components/CandlestickChart.tsx` | TradingView Lightweight Charts wrapper — hex colours only |
| `client/src/components/MunymoLogo.tsx` | Logo component with dark mode adaptation |
| `client/src/components/NotificationSettings.tsx` | Push notification opt-in UI |

### Server
| File | Purpose |
|------|---------|
| `server/routers.ts` | All tRPC procedures |
| `server/db.ts` | All DB query helpers |
| `server/scoring.ts` | Score calculation — hardcoded constants, server-side only |
| `server/email.ts` | Email templates and send helpers |
| `server/push.ts` | Web Push helpers — sendPushToUsers, sendPushToAll |
| `server/referral.ts` | Referral attribution helpers |
| `server/referralRouter.ts` | Referral tRPC router |
| `server/_core/scheduledCuration.ts` | /api/scheduled/* endpoints + CurationPayload interface |
| `server/_core/context.ts` | tRPC context — Clerk session extraction |
| `server/_core/env.ts` | Environment variable validation |
| `server/_core/llm.ts` | LLM helper for metric explanations |

### Shared
| File | Purpose |
|------|---------|
| `shared/types.ts` | Shared TypeScript types |
| `shared/const.ts` | Shared constants |

### Drizzle
| File | Purpose |
|------|---------|
| `drizzle/schema.ts` | Full database schema — single source of truth |
| `drizzle/0000–0007_*.sql` | Applied migrations |

### References
| File | Purpose |
|------|---------|
| `references/daily-curation-agent-prompt.md` | Cron agent prompt — do not modify unless asked |
| `references/periodic-updates.md` | How scheduled jobs work |
| `references/munymo-new-chat-briefing.md` | Prior session handover notes |

### Scripts (one-shot operational tools — do not delete)
| File | Purpose |
|------|---------|
| `scripts/insert-monday-game.mjs` | Manually insert a game for a specific Monday |
| `scripts/close-xom-cvx-game.mjs` | Manually close the XOM vs CVX game |
| `scripts/cleanup-premature-run.mjs` | Clean up a game that ran prematurely |

---

## 26. What to Build Next (Priority Order)

1. **Auto-submission at lockout + validation stays open post-lockout** (Decisions 1 and 3) — most important missing game mechanic
2. **Community stats with raw player count** (Decision 7) — small change; `totalParticipants` already in DB
3. **Three streak types + losing streak of 5 intervention** (Decision 2) — discuss UX with Paul before building
4. **`AdminSettings` page + `app_settings` table + `getSetting()` helper** — then wire into `scoring.ts`
5. **`/demo/autoplay`** animated walkthrough
6. **Streak-at-risk email trigger** — template ready, just needs wiring

---

## 27. What NOT to Do

| Do not | Why |
|--------|-----|
| Pass oklch() or CSS variable values to `lightweight-charts` | Library silently fails and renders a blank canvas. Always use hex: `#009050` for Company A, `#1d4ed8` for Company B. |
| Use `display:none` and expect `ResizeObserver` to fire reliably on mobile | Safari and Chrome mobile do not reliably fire `ResizeObserver` when a parent transitions from `display:none` to `display:block`. The current polling approach is intentional — do not replace it. |
| Replace `html.sheet-open` CSS class with inline `overflow:hidden` style | The CSS class approach was a deliberate iOS Safari fix. Inline styles on `document.documentElement` interact badly with iOS Safari scroll behaviour. |
| Rewrite the research metrics layout | It was rebuilt multiple times. The current two-column `grid grid-cols-2` layout is correct and stable. |
| Push to the `origin` remote for GitHub | `origin` is Manus's internal S3 remote. Use `github` remote: `git push --force-with-lease github main`. |
| Clone `pauljkwa/munymo-mvp-v1` and start fresh | The working directory is `/home/ubuntu/munymo-mvp-fresh`. Cloning creates a second copy and causes sync confusion. |
| Accept scoring values from the client | All scoring is server-side only in `server/scoring.ts`. |
| Show community stats before a game is closed | Stats must only be visible for `result_published` games. |
| Block `picks.submitValidation` after lockout | Per Decision 1, validation must remain available after lockout with timed scoring. |

---

*End of handover document. If anything is unclear, the code is the truth — read the source file directly.*

## Session Updates — June 25 2026

The following corrections and discoveries were made during the June 25 2026 session. All items below supersede or extend earlier sections where relevant.

---

### S1 — Cron timing corrected

The daily curation Agent cron (Task UID: `VKTf81x4Muj5Sx9c3JcCvi`) was confirmed active. The next execution is 2026-06-26 at 04:15 AM Perth (AWST), which is `20:15 UTC` — 15 minutes after NASDAQ closes at 20:00 UTC during US Eastern Daylight Time (EDT, current period).

**Summer schedule (current — valid until first Sunday of November 2026):** cron fires at `20:15 UTC` = 04:15 AM Perth next day.

**Winter schedule (from first Sunday of November 2026):** cron must be updated to `21:15 UTC` = 05:15 AM Perth next day. See S9 for the DST reminder.

---

### S2 — Lockout time corrected in agent prompt

`references/daily-curation-agent-prompt.md` was updated (commit `633c3ae`). The lockout time was wrong — it specified 9:00 AM ET (market pre-open) instead of 9:30 AM ET (NASDAQ market open).

**Corrected values:**
- Summer/EDT (current): `{YYYY-MM-DD}T13:30:00.000Z` (9:30 AM New York time)
- Winter/EST: `{YYYY-MM-DD}T14:30:00.000Z` (9:30 AM New York time)

All games created by the curation agent from tonight onwards will use the correct lockout time. The June 25 2026 game (id: 150002) was created before this fix and has `lockoutAt: 2026-06-25T13:00:00.000Z` — accepted as a one-night anomaly since only one player was active.

---

### S3 — Deployment mechanism gap

The Manus internal `origin` remote (the deployment trigger for `munymo.com`) is **not present** in a fresh clone from GitHub. After cloning `pauljkwa/munymo-mvp-v1`, only the `github` remote exists.

**The Manus autoscale deployment URL is:** `munymogame-utnkpetr.manus.space` (see S8).

The Manus internal remote URL needs to be documented and added to any fresh sandbox before deployment pushes can work. Until this is resolved, code changes pushed to `github` will update the GitHub backup but will **not** deploy to `munymo.com`.

**Action required:** Document the Manus internal remote URL and add it to the sandbox setup steps in Section 5.

---

### S4 — Admin console cannot edit game mechanics

The admin edit form at `/admin/games/:id/edit` does not expose `lockoutAt` or any other game timing fields. Any correction to a game's lockout time requires either:
- A one-shot Node.js script run from the deployed environment (where DB credentials are injected), or
- Direct database access

**To-do (added to priority list):** Add lockout time editing to the admin edit form. This is a gap in the admin console that will matter more as player count grows.

---

### S5 — Agent crons and `manus-heartbeat` are different systems

`manus-heartbeat` is the CLI for **Heartbeat crons** — a different cron type from **Agent crons**. They cannot manage each other.

The daily curation task (`VKTf81x4Muj5Sx9c3JcCvi`) is an **Agent cron**. It is managed exclusively through the **Manus UI** (the scheduled tasks panel in the Munymo-Game project). Do not attempt to use `manus-heartbeat` to update it — the command will fail with an environment variable error.

`manus-config schedule update` only manages the schedule attached to the **current task session** — it cannot target other tasks by UID unless used in Coordinator mode.

---

### S6 — DB credentials not available in a fresh sandbox

`MUNYMO_DATABASE_URL` and `DATABASE_URL` are **not injected** in a plain cloned sandbox. They are only available in the deployed Manus webdev runtime (the live `munymo.com` server process).

Any script that requires database access (e.g. the scripts in `scripts/`) must be run from the deployed environment, not from a local sandbox clone. This includes `pnpm db:push` for schema migrations.

---

### S7 — Database safety rule

Before making any change to `drizzle/schema.ts`:

1. Show Paul the exact proposed change and wait for explicit written approval
2. Never run `pnpm db:push` without that approval
3. Only use `pnpm db:push` to **add** new columns or tables — never to drop or rename existing ones without a documented migration plan
4. Never change `DATABASE_URL` or `MUNYMO_DATABASE_URL`

The live database contains real player data. Thirteen migrations (0000–0012) have been applied. Any destructive schema change is irreversible without a backup restore.

---

### S8 — Underlying deployment URL

The Manus Autoscale deployment URL is:

```
https://munymogame-utnkpetr.manus.space
```

`munymo.com` points to this via DNS (Cloudflare). This URL is the actual server — `munymo.com` is a DNS alias. Useful to know if DNS propagation is delayed or if you need to test the server directly.

---

### S9 — DST reminder: November 2026 and March 2027

**First Sunday of November 2026 (US clocks fall back — EDT → EST):**

1. Open the Manus UI → Munymo-Game project → Scheduled Tasks
2. Find the daily curation Agent cron (Task UID: `VKTf81x4Muj5Sx9c3JcCvi`)
3. Update the schedule from 04:15 Perth to **05:15 Perth** (i.e. `21:15 UTC`)
4. Update `references/daily-curation-agent-prompt.md` Step 6 to use `14:30:00 UTC` for `lockoutAt`

**Second Sunday of March 2027 (US clocks spring forward — EST → EDT):**

1. Reverse the above: update cron back to `20:15 UTC` (04:15 Perth)
2. Update agent prompt Step 6 back to `13:30:00 UTC` for `lockoutAt`

Add a calendar reminder for both dates. Missing this change means the curation agent fires 1 hour late and games are created with the wrong lockout time.

---

## Session Update — July 10 2026

### S10 — Web Push restored after Manus migration

Push notifications had been dead since the move from Manus to Railway. Root cause was **not** a missing vendor — push is self-hosted Web Push (VAPID) via the `web-push` library (`server/push.ts`), no third party. Two problems:

1. **Stale VAPID keys.** `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` were copy-pasted from the Manus secrets file into Railway and were stale/mismatched. A fresh VAPID pair was generated (`npx web-push generate-vapid-keys`) and both variables updated in the Railway dashboard on 2026-07-10. There is no `VITE_VAPID_PUBLIC_KEY` in Railway and none is needed — the client fetches the public key from the server via the `push.vapidPublicKey` tRPC query (`server/routers.ts`), which reads `process.env.VAPID_PUBLIC_KEY`.
2. **Dead icon URL.** `client/public/sw.js` fallback icon pointed at `https://munymo.com/manus-storage/munymo-logo-cropped_75fe3c86.png`. The `/manus-storage/*` path is a proxy to Manus's Forge storage API (`server/_core/storageProxy.ts`), which 500s now that the Forge env vars are gone. Changed to the self-hosted `https://munymo.com/munymo-logo-cropped_e625fcf7.png` (exists in `client/public/`). `server/push.ts`'s icon/badge URLs already used the valid self-hosted asset — no change needed there.

**Consequence:** rotating the VAPID pair invalidates every existing `push_subscriptions` row (they are cryptographically bound to the old key pair). All users must re-enable notifications once; the stale rows are auto-pruned on the next send (push gateways return 410, handled by `sendToSubscription`).

**Verification tool added:** new `admin.sendTestPush` tRPC mutation (`server/routers.ts`) sends a push to the calling admin's own devices; wired to a "Send Test Push To Me" button in a Notifications card on the Admin Dashboard (`client/src/pages/admin/AdminDashboard.tsx`). Previously push only fired inside `admin.endOfDay`, so there was no way to test it without a full run. The button reports sent/expired/none via toast.

**Fixed the two-toggle trap.** `/dashboard` (`MyDashboard.tsx`) previously had a "Push notifications" toggle that only flipped the `pushOptIn` preference flag — it never called `pushManager.subscribe()` or wrote a `push_subscriptions` row, so users who toggled it saw no notifications and "No devices subscribed" on the test. The real subscription control (`NotificationSettings` via `usePushNotifications`) lived only on `/profile`, which **is not reachable from the nav menu** (no menu/footer link; unusable in an installed PWA with no address bar). Fix: the fake dashboard toggle was replaced with the real `<NotificationSettings />` component, so the reachable dashboard now performs the actual browser subscription (with proper iOS "add to Home Screen" / permission-denied messaging). `push.subscribe` (`server/routers.ts`) now also sets `users.pushOptIn = true` on subscribe, so registering a device is treated as the explicit opt-in and can't be silently suppressed by a stale `pushOptIn=false`. The separate `pushOptIn`-only UI toggle is gone; subscription presence + that flag now move together. (The unrelated footer "My Dashboard → /profile" mislink noted in Section 7 still stands.)

**Still Manus-coupled (dead code, cleanup candidates):** `server/_core/storageProxy.ts` and `server/storage.ts` (`/manus-storage/*` upload/download) depend on the retired Forge API and no longer function. Not removed yet.

---

## Session Update — July 10 2026 (cont.)

### S11 — Dashboard vs Profile responsibility split

`/dashboard` (`MyDashboard.tsx`) and `/profile` (`PlayerProfile.tsx`) had become muddled: the dashboard carried gameplay **and** nearly all account admin (Away Status, Notifications, Account Settings, Membership Tier, Danger Zone), while the profile duplicated gameplay (a stats row + a recent-games table already shown on the dashboard) and only held Notifications. Split cleanly, one purpose each:

- **`/dashboard` = gameplay only:** My Stats, Game History, MunyIQ score. (MunyIQ stays here — it's a gameplay-derived score. Header links to `/profile` via "Manage account".)
- **`/profile` = personal / account admin:** Away Status, Notifications (email + push), Account Settings (display name, password, email, sign out), Membership Tier / Upgrade, Danger Zone (deactivate). Header links to `/dashboard` via "View stats".

Away Status moved to Profile (decision: it's a personal control, confirmed by Paul 2026-07-10). The duplicated stats row + recent-games table were removed from Profile. All mutations moved with their sections (`setAwayStatus`, `setNotificationPrefs`, `updateDisplayName`, `deactivateAccount` now live in `PlayerProfile.tsx`; `MyDashboard.tsx` is now query-only). This lines up with `/profile`'s intended future as the member's self-serve billing/membership hub. "My Profile" is now linked in the nav menu (`PublicLayout.tsx`).

---

### S12 — Native in-app password management (Clerk made invisible)

The Account Settings → Password row on `/profile` used to link out to `https://accounts.clerk.com` — a generic Clerk domain that 404s (not the instance's actual Account Portal), and off-brand regardless (exposes the user to "Clerk"). Replaced with a native, brand-styled Change/Set Password form in `PlayerProfile.tsx` that calls Clerk's SDK **under the hood** via `useUser()` → `clerkUser.updatePassword({ newPassword, currentPassword?, signOutOfOtherSessions:false })`. The user never sees the word "Clerk".

Two states, driven by `clerkUser.passwordEnabled`:
- **Has a password:** shows masked `••••••••` + a "Change" button → reveals current / new / confirm fields → "Update Password".
- **Social sign-up, no password** (e.g. Google; detected via `passwordEnabled === false`, provider name derived from `externalAccounts[0].provider`): shows a greyed explanation that they signed up with `{Provider}` and have no password yet, plus a "Set a Password" button → reveals new / confirm fields (no current-password field) with copy explaining this enables email+password sign-in while their social login keeps working. Calls `updatePassword({ newPassword })` (no currentPassword).

Client-side guards: min 8 chars, new/confirm match, current-password required when changing. Clerk API errors surfaced to the user via toast (`err.errors[0].longMessage`). No server/schema change — password lives entirely in Clerk. (The old Clerk portal link is gone; nothing else references `accounts.clerk.com`.)

---

### S13 — Production DB migrated to Paul's own cluster (2026-07-10)

The live database was moved off the Manus-era TiDB cluster (`gateway02...`, which Paul had no console access to) onto his own **`munymo-prod`** cluster (`gateway01.us-east-1.prod.aws.tidbcloud.com`, us-east-1). Same database name (`eKLqbcXcmD3p6GhwsMA3tE`) and same `ssl={"rejectUnauthorized":true}` connection query preserved — the cutover changed **only** Railway's `MUNYMO_DATABASE_URL` (host/user/password). All 17 tables / 183 rows copied and verified row-by-row identical; the `__drizzle_migrations` journal came across too, so the predeploy `drizzle-kit migrate` remained a no-op. Confirmed live by a write landing on the new cluster while the old stayed frozen.

**Tooling note for any future prod dump:** Oracle `mysqldump` does **not** work against TiDB Serverless — it tries to read `column_masking_policy` (permission denied, no flag to disable). Use a driver-level dump instead (a `pymysql` script doing `SHOW CREATE TABLE` + `SELECT *` with proper escaping worked cleanly). `mysql-client` and `pymysql` were installed on Paul's Mac for this.

**Rollback window open:** old cluster untouched; revert by pointing `MUNYMO_DATABASE_URL` back to the old string (saved in `~/munymo-migration.env`). Full backup at `~/munymo-backups/munymo_old_backup_20260710_174327.sql`. Old cluster + local secret files to be deleted later once confidence is high.

---

### S14 — Google Analytics (GA4) added

GA4 tag `G-RLCKFXCSF3` (gtag.js) installed **once** in `client/index.html` `<head>`. Munymo is a Vite SPA, so this single install covers every route — current and future. **Do NOT add gtag to individual page components** (it would double-count). New pages/routes are tracked automatically; GA4's default enhanced measurement fires `page_view` on History API navigations, which Wouter uses. Runs alongside the existing Umami tag (both kept). Measurement ID is a public client-side value, hardcoded (not a secret). Consideration for later: EEA consent mode + a mention of Google Analytics in the privacy policy if EEA users are in scope.

---

*End of session updates.*
