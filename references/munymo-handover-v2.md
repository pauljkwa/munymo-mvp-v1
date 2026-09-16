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
| Afternoon curation split (Phase A staging / Phase B results-only) | **Complete (2026-08-01)** — spec in `references/afternoon-curation-split-spec.md`. Splits the single post-close curation run into two: a new **Phase A** afternoon cron at 14:45 `America/New_York` (`runStagingCuration()`, `curationAgent.ts`) researches and stages the NEXT trading day's matchup as a hidden `draft` game ("in the trolley") — a smaller research-only Claude conversation with ~75 min of retry runway before close, instead of racing the 16:15 ET post-close deadline. New `POST /api/scheduled/stage-game` handler (`stageGameHandler`, `scheduledCuration.ts`) mirrors `dailyCurationHandler`'s guards: the SAME `applyInFlight` mutex, a C1-style idempotency check (`findMatchingProposal`, now shared by both handlers), the cadence "never two queued games" no-op, freshness validation, and a C3-style cancelled-row revival (extracted to `createOrReviveGame()` in `db.ts`, now shared by `stageGameHandler` and `admin.endOfDay`). A 15:30 ET watchdog (`stagingOutstanding()` + pure time-gate `isStagingWindowOpen()`, unit-tested) re-runs Phase A only if nothing got staged; NOT wired into the boot sweep or evening watchdogs (staging is afternoon-only). **Phase B** (`runDailyCuration()` at 16:15 ET, unchanged cron) gains a pre-check (`getStagedDraftGameAfter()`): if a staged draft exists, it runs a small (~2-4 turn) **results-only** conversation (`attemptResultsOnlyCuration`, its own derived system prompt `RESULTS_ONLY_SYSTEM_PROMPT`) that only scores today and POSTs a `stagedGameId` payload back to the SAME `/api/scheduled/daily-curation` endpoint — `dailyCurationHandler` routes on payload shape via new exported `classifyCurationPayload()` (results-only skips freshness/tomorrow entirely). `admin.endOfDay` gained `activateStagedGameId` as an alternative to the `next*` creation fields: validates the referenced game is a `draft` dated after the closed game (else loud `CONFLICT`, via new exported pure `validateStagedGameActivation()`), flips it to `active` with one `updateGame`, and the existing notification fan-out/audit log read from a unified `resolvedNextGame` regardless of which of the three paths (activate staged / create fresh / cadence-guard-kept) produced it. **Golden safety property, by construction, not a flag:** if Phase A never runs or fails outright, no draft exists, so Phase B's pre-check falls through to the original combined flow (`attemptDailyCuration`'s legacy path) unchanged — the worst case is exactly today's pre-split behavior. `STAGING_SYSTEM_PROMPT` and `RESULTS_ONLY_SYSTEM_PROMPT` are DERIVED from the single `SYSTEM_PROMPT` by slicing at its section headings (not hand-copied), so freshness rules/content rules/US-English/the Dates section can only ever say one thing across all three prompts. Staging failures always send the calm ⚠️ "no action needed, post-close will fall back to combined curation" email — never the ❌ manual-recovery alarm (that's exclusively a Phase B/legacy-path email). No schema change. Tests: `isStagingWindowOpen` window-edge + DST cases, `validateStagedGameActivation` (missing/non-draft/mis-dated/ok), `classifyCurationPayload` routing, plus a `createCaller` CONFLICT test for `admin.endOfDay`'s `activateStagedGameId` path — all in `server/munymo.test.ts`. Not yet verified live (ships pending the next US trading day's 14:45 ET run). |
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
| Resend DNS records (Cloudflare SPF/DKIM/DMARC) | **Done (2026-07-10)** — `munymo.com` shows **Verified** in Resend (us-east-1). DKIM + SPF + return-path MX (`send.`) all verified; outbound email fully authenticated. The earlier "Partially Failed" was only the **inbound-receiving** MX (`@ → inbound-smtp…amazonaws.com`), which Munymo doesn't use — fixed by turning **OFF** Resend's "Enable Receiving" toggle (send-only setup; root domain has no MX and receives no mail). Optional DMARC (`_dmarc` TXT `v=DMARC1; p=none;`) not yet added — nice-to-have for deliverability, not required. |
| `researchSummary` beginner research field | **Complete** — DB column added (migration 0010), wired through `server/db.ts`, `server/routers.ts`, shown by default on `/game` with toggle to full analysis (commit bf9d804) |
| Yesterday's result CTA on /game | **Complete** — full result card with % change, winner trophy, CTA (commit 31bb3ee) |
| Price movement panel on /game/:id/result | **Complete** — two-column card showing both companies' % day change (commit 31bb3ee); actual $ start→finish prices added 2026-07-07 (migration 0012, `companyA/BStartPrice`/`EndPrice` on `daily_games`) — shown when present, curation agent now captures them, historical games without this data just show % change |
| Daily curation agent freshness enforcement | **Complete (2026-07-09)** — freshness is now pre-qualified BEFORE research/writing, not checked after the fact. `scheduledCuration.ts` exposes `POST /api/scheduled/check-freshness` (deterministic, DB-backed) and `GET /api/scheduled/recent-games` now also returns pre-computed `bannedSectors`/`bannedTickers`/`bannedPairs`. The agent's system prompt instructs it to scan news, abandon any thread whose sector/companies are banned immediately (no further research on that lead), and call the new `check_freshness` tool to confirm a candidate sector+pair before writing any content. The old flow wrote the entire game first and only found out about a freshness violation at submission (422), burning a full research-and-write cycle per rejection, up to `MAX_SUBMIT_ATTEMPTS` (4) times — that retry-on-422 path is kept as a safety net but should now rarely trigger. `checkFreshness()`/`computeBannedLists()` are shared between the new endpoint and the final submit-time validation in `dailyCurationHandler`, so the two checks can't drift apart. |
| Source attribution for daily matchup | **Shipped (2026-07-09, migration 0013, commit f2250dc)** — nullable `sourceUrl`/`sourceTitle`/`sourcePublisher` columns on `dailyGames`, threaded through `admin.endOfDay`'s Zod input, `CurationPayload`, and the curation agent's system prompt/JSON output (captures the exact article that gave the "buzz" signal, credited on the game page with a link back). Wired into `AdminEndOfDay.tsx`'s manual JSON-import/form path too. Displayed on `/game/:id` and the archive page under Pairing Rationale. Outbound links use `rel="noopener"` (deliberately NOT `noreferrer`) + UTM tags so publishers see labelled munymo.com referrals (guerrilla-marketing strategy — do not re-add noreferrer, commit 0452cb3). |
| Outbound article click tracking | **Shipped (2026-07-09, migration 0014, commit e9cf163)** — `outbound_clicks` table (purely additive) records each click on a source-article link (gameId/userId/publisher/sourceUrl, all nullable). Public `games.recordOutboundClick` mutation fired fire-and-forget from `DailyGame.tsx`/`ArchiveGame.tsx` (attributes to `ctx.user` when signed in, counts anonymous). Admin `admin.outboundClickStats` query + dashboard card show total + per-publisher breakdown (card only renders once ≥1 click exists). |
| Curation pipeline audit fixes + model failover | **Complete (2026-07-30)** — from a full-pipeline reliability audit (all findings verified against code). (C1) `dailyCurationHandler` now has an idempotency guard BEFORE freshness: a retried POST of an already-applied payload returns `{ok, alreadyApplied}` and re-upserts research/question (heals half-created games) instead of 422ing as a false "freshness violation" — the first run's own created game used to poison the freshness window for every retry. (C2) a concluded-but-unscored game with no usable winner in the payload now rejects loudly (422 + owner email) instead of silently orphaning the game and wedging every later night. (C3) endOfDay revives a cancelled row at the proposed date via `updateGame` instead of dup-keying on the unique gameDate index forever. (M1) a published/locked game at the proposed date is a loud CONFLICT (misdated proposal), not silently "kept". (M2) `lockoutAt` is now always server-computed — 9:30 AM America/New_York, DST-safe `expectedLockoutIso()` (unit-tested), agent's value only logged on drift. (M3) module-level mutex on the handler: concurrent POSTs get 409 instead of racing double-scoring. (M5) endOfDay's per-user email/push fan-out is detached from the HTTP response (DB state commits, response returns, notifications run in background) — response latency no longer grows with user count, which was the main agent-timeout→retry amplifier. (M6) handler dates computed in America/New_York, not UTC (UTC rolled to "tomorrow" at 8 PM ET, mid recovery-window) — and (129e842) the AGENT's prompt date too: the 07-29 boot-sweep recovery ran at 20:05 ET, was told "today is 07-30" (UTC), and queued Friday's game skipping Thursday; the misdated game (870001 GD vs LMT) was re-dated 07-31→07-30 directly in prod (lockout corrected to 13:30Z) and the prompt now names the date as the market's trading date and pins gameDate as "next trading day strictly after the day just scored". Minor: `GET /api/scheduled/recent-games` now secret-gated (leaked the queued future matchup). Model failover: after 2 failed per-turn retries on `claude-sonnet-5`, remaining retries run on `claude-opus-5` (separate serving pool, same API surface), sticky 45 min. Deferred (needs schema change + Paul's approval): M4 sent-marker column so result emails survive a mid-fan-out crash; also deferred: admin republish-with-correction path, streak-at-risk loop hardening. |
| Curation self-healing watchdog (retry architecture v3) | **Complete (2026-07-30)** — after the 2026-07-30 failure (an Anthropic overload storm outlasted the [30s/60s/120s] per-turn budget and killed both run attempts), the single-shot 16:15 ET cron was identified as the real fragility: the run's true deadline is the next market open, hours away. Three layers now: (1) per-turn retry ladder deepened to [30s/1m/2m/5m/10m] (~18 min of patience per research turn, `curationAgent.ts`); (2) hourly watchdog crons at 17:15/18:15/19:15 ET (`index.ts`) call new `runCurationIfOutstanding()` — a no-op unless the earliest active/locked game's session has concluded (>= 16:10 ET on its own date, pure helper `isGameSessionConcluded`, DST-safe, unit-tested) but is still unscored, in which case the full agent re-runs; (3) a boot sweep 3 min after every server start self-heals deploy-killed runs (the in-flight guard is in-memory) and also auto-recovers on the next deploy after a fully failed night. Failure emails are tiered: non-final attempts send "⚠️ auto-retry scheduled — no action needed"; only the 19:15 slot (or boot sweep) escalates to the ❌ manual email, which now points at the admin Run Curation Now button. Mid-session triggering is impossible by construction (the time gate), so extra slots/holidays cost nothing. |
| Admin "Run Curation Now" button | **Complete (2026-07-25)** — new `admin.runCuration` protected tRPC mutation (`server/routers.ts`, adminProcedure + audit-logged as `run_curation_manual`) fires the same `runDailyCuration()` the nightly cron uses, surfaced as a confirm-guarded button on `/admin` (`AdminDashboard.tsx`, "Curation Agent" card). Removes the Railway-secret/Terminal step from failed-run recovery (the deferred idea from the 2026-07-07 incident, revived after the 2026-07-25 failure needed manual recovery again). A module-level in-flight guard in `curationAgent.ts` (`isCurationRunInFlight`) makes cron/endpoint/button triggers mutually exclusive — a duplicate trigger is skipped with `{started:false, alreadyRunning:true}` and the UI says so. Outcome still reported by the usual ✅/❌ curation email. |
| Curation close/create is a no-op when next game exists | **Complete (2026-07-10)** — `admin.endOfDay` previously threw `CONFLICT` if a non-cancelled game already existed for `nextGameDate`, which could error out a run that had legitimately just closed a concluded game (the close commits first — no transaction — so it wasn't lost, but the run reported failure). Now it closes the concluded game, then **skips creation and reuses the existing game** as the next game (teaser/push reflect the real existing matchup, not the discarded proposal; `endOfDay` returns `nextGameCreated`). Still no pileups (nothing new inserted). Also fixed the misleading owner-notification wording that hardcoded "(public holiday)" whenever `marketClosed` was set — `marketClosed` is overloaded (real holiday OR no completed game was due), so the email no longer asserts a holiday. Motivated by the 2026-07-10 state where a manual-recovery run left the schedule a day ahead (DAL/UAL Fri already existed, COST/WMT Mon curated early). Checked against the [[game-cadence-canonical-spec]]. |
| Railway pre-deploy migration pipeline | **Complete** — `npx drizzle-kit migrate` only; migration files committed to repo; idempotent SQL (commits a8fb449, a40450f) |
| Tester agent (synthetic players) | **Complete** — 6 accounts (IDs 870002–870012), `node-cron` inside server at 6:00 PM `America/New_York` Mon–Fri (DST-safe, after curation), endpoint at `/api/scheduled/tester-picks` (commit ed89d50) |
| Replace Manus curation with Claude agent | **Complete** — Claude-powered agent in `server/_core/curationAgent.ts` (`claude-sonnet-5` + `web_search`; downgraded from `claude-opus-4-8` 2026-07-18 for ~60% cost saving after hitting the $50/mo API spend limit), `node-cron` inside server at 4:15 PM `America/New_York` Mon–Fri (DST-safe IANA timezone, ~15 min after NASDAQ close year-round), manual trigger at `/api/scheduled/run-curation`. Hardened 2026-07-21 after a run died on a single Anthropic `overloaded_error` (529) and Monday's game went unscored: transient API errors (429/5xx/connection drop) now retry the same research turn up to 3 times with backoff, and any other failure gets one whole-run retry after 10 min before the failure email goes out. Hardened again 2026-07-25 after both attempts of the 2026-07-24 EOD run died on undici's `TypeError: terminated` (connection severed mid-stream — after headers, while the body streamed; the SDK only wraps request-time failures as APIConnectionError, so this bypassed the transient check): `isTransientApiError` (now exported + unit-tested) also walks the error `cause` chain and classifies stream-severance signatures (`terminated`, `Premature close`, `other side closed`, `socket hang up`, `fetch failed`, `aborted`, ECONNRESET/ETIMEDOUT/EPIPE) as transient, so the per-turn retry — which preserves the whole research conversation — handles them instead of the run dying. Endpoint auth switched from Manus session cookie to shared secret `CURATION_AGENT_SECRET`. Env vars set in Railway; both Manus scheduled tasks (curation + streak-at-risk) deactivated. Live smoke-tested (403 on unauthenticated probe). |
| Validation question type rotation | **Complete** — curation agent and reference prompt now instruct varying `questionType` (multiple_choice / true_false / yes_no) using the prior game's type (returned by `/api/scheduled/recent-games`), picking randomly among the other two so the same type never repeats two days running. Previously always defaulted to multiple_choice. |
| Research metrics panel v2 (two-group hybrid) | **Complete (2026-07-18)** — the Manus-era 6-metric panel (all long-horizon fundamentals) replaced with 8 metrics per company in two labelled groups: **"The Long Game"** (Market Cap, P/E Ratio, Revenue Growth, Analyst Consensus) and **"Game-Day Setup"** (Next Earnings, Beta, Last Session Move, vs 52-Week High) — dropped EPS (TTM), replaced 52-Week Range with "vs 52-Week High". Rationale: single-day moves are catalyst-driven; the old panel never informed the actual daily prediction (research in `references/learning-hub-research-summary.md`, part of the Learning Hub project). Curation prompt updated in `curationAgent.ts` + `daily-curation-agent-prompt.md`; grouping rendered via new `client/src/lib/metricGroups.ts` in `DailyGame.tsx` and `ArchiveGame.tsx` (word-boundary label matching; legacy games with single-group metrics render ungrouped exactly as before); 4 new static explanations in `metricExplanations.ts`. No schema change (`researchMetrics` is free-form JSON). |
| Streak double-increment on scoring retry | **Fixed 2026-07-06.** `closeAndScoreGame` (`server/routers.ts`) now checks `getPlayerScoreForGame` before scoring each pick; if a score row already exists (a prior run got partway through before failing), the score is still refreshed but `updateStreakForPlayer` is skipped, so a retry after a mid-loop failure no longer double-increments streaks. `daily_scores` also now has a DB-level unique index on (userId, gameId) (migration 0011), so `insertDailyScore`'s `onDuplicateKeyUpdate` actually fires instead of silently no-oping. |
| Duplicate-game/pileup protection | **Fixed 2026-07-06.** `endOfDay` (`server/routers.ts`) checks for an existing non-cancelled game on `nextGameDate` before calling `createGame`, throwing `CONFLICT` if one is found. `daily_games.gameDate` also now has a strict DB-level unique index (migration 0011, D1 approved by Paul) — a historical duplicate (two different games both published for 2026-06-18, ids 30001/60001) was found during the pre-flight check and resolved by re-dating id 60001 to 2026-06-19 before the index could be added. |
| Referral signup attribution | **Fixed 2026-07-06** — replaced the dead `POST /api/referral/attribute` Express route (required a Manus cron session nothing could present) with a `referral.attributeSignup` protected tRPC mutation, called once client-side after first sign-in when the `munymo_ref` cookie is present. See Section 22. |
| Account deletion / right to erasure | **Shipped (2026-07-16)** — the privacy policy (`PrivacyPolicy.tsx` §6) promised "if you delete your account, we will remove your personal data", but **no erasure mechanism existed**: the only path was `deactivateAccount`, which sets `deactivated=true` and keeps everything (correctly labelled as deactivation in the UI — nothing was lying to users, the capability was simply absent). New `dashboard.deleteAccount` protected mutation (`server/routers.ts`) + `eraseUserPersonalData()` / `ERASED_USER_FIELDS` (`server/db.ts`), surfaced as a separate "Delete Account Permanently" option in the `/profile` Danger Zone, below and visually distinct from Deactivate, with type-`DELETE`-to-confirm. **Deletes the Clerk user first, then scrubs our row** — Clerk holds the authoritative email/name/credentials, so scrubbing locally alone would leave the real personal data in Clerk and the user still able to sign in. Clerk-first also means a Clerk failure aborts with nothing changed and the user can retry; the reverse order would destroy the `clerkId` needed to find them again. Erasure nulls clerkId/openId/name/displayName/email/loginMethod, sets deactivated=true and both opt-ins false, and deletes `push_subscriptions` rows (an endpoint URL identifies a device). **No schema change and no `db:push`** — every target column was already nullable, and MySQL permits many NULLs in a unique index so erased rows don't collide on clerkId. The user row is deliberately kept: picks/scores/streaks/leaderboard reference it only by integer id, so history survives anonymously (which §6 already reserves the right to retain) with no cascading deletes. Leaderboard already falls back to "Anonymous" on a null name, so no client change was needed. Guarded by tests that fail if a new personal column is added to `users` and not covered by `ERASED_USER_FIELDS`, and that assert the mutation throws rather than reporting a success it didn't achieve. **Not verified end-to-end in a browser** — `/profile` is auth-gated and the local Clerk key is production-only; deletion was deliberately never exercised against real data. |
| Reader text-size control (accessibility) | **Shipped (2026-07-16)** — Small/Medium/Large segmented control in the `PublicLayout` header (`client/src/components/TextSizeToggle.tsx`), backed by `TextSizeProvider` (`client/src/contexts/TextSizeContext.tsx`). Sets the **root** font-size to 100% / 112.5% / 125%, persisted to `localStorage` under `munymo-text-size`; an inline script in `client/index.html` applies the saved size before first paint to avoid a flash. Scaling the root (rather than restyling text) makes every rem-based token — text, spacing, radii — grow proportionally, so layouts keep their proportions. Percent units mean a reader's own browser default font size is respected and scaled on top. **The default is now Medium (112.5%), so the whole site reads ~12.5% larger than before** — the previous look is still available as "Small". Measured on real pages at 320/360/375/390px: zero horizontal overflow at every step. Two supporting fixes shipped with it: 8 hardcoded `text-[10px]` labels (Home/GameResult/DailyGame) converted to `text-[0.625rem]` so they actually scale, and the header wordmark pinned to a fixed 28px height (it was `h-7`, i.e. rem, so it grew with the text and crowded the controls on narrow phones). Known gaps: auth-gated pages (research/final steps, dashboard) were not driven in a browser because the local Clerk key is production-only. The lucide-icons gap is now closed (2026-07-16): `--icon-scale` (1 / 1.125 / 1.25) is set on `<html>` by `TextSizeContext` and the pre-paint script, and `svg.lucide` in `index.css` applies it as `transform: scale(...)` — a visual-only transform, so px-sized icons keep pace with the text without any layout reflow. |
| Mobile pinch-to-zoom blocked | **Fixed (2026-07-16)** — `client/index.html`'s viewport meta carried `maximum-scale=1`, which disables pinch-to-zoom on Android Chrome and fails WCAG 1.4.4 (Resize Text); iOS Safari has ignored it since iOS 10. Removed, so readers can zoom. |
| Beta signup reinforcement + welcome email | **Shipped (2026-07-16)** — the landing page's beta CTAs previously opened Clerk's generic sign-IN dialog with no beta framing, and nothing ever confirmed to a new tester that they'd joined the founding beta. Three pieces: (1) all four landing CTAs (`Home.tsx`) now use `SignUpButton` so new visitors land directly on the sign-up view; (2) `ClerkProvider` in `main.tsx` carries a `localization` override so the sign-up dialog is titled "Join the Munymo founding beta" (sign-in gets "Welcome back to Munymo"); (3) a founding-beta welcome email (`buildWelcomeEmail` in `server/email.ts`, house template style) is sent fire-and-forget on first sign-in from the new-user branch in `server/_core/context.ts` — guarded by an in-process Set against concurrent-first-request double-sends, and a send failure never blocks authentication. PublicLayout's "Sign in" menu item deliberately stays `SignInButton` (returning users). |
| Beta feedback channel (form + reply-to) | **Shipped (2026-07-16)** — the welcome email invited feedback but no channel existed (and munymo.com is send-only in Resend, so replying mailed a dead address). Three pieces: (1) every outgoing email now sets `replyTo: feedback@munymo.com` (`sendEmail` in `server/email.ts`); Paul set up Cloudflare Email Routing to forward that address to his inbox; (2) new `/feedback` page (`client/src/pages/Feedback.tsx`, "Give Feedback" in nav) → `feedback.submit` protected tRPC mutation → `buildFeedbackEmail` (HTML-escaped message + player name/email/id) sent to feedback@munymo.com; 60s per-user in-memory cooldown; a failed send throws so the player is never told "sent" when it wasn't; (3) welcome email now says reply or use the form, linking `/feedback`. |
| Learning Hub — Phases A + B (all 5 levels, 32 lessons) | **Shipped (2026-07-18)** — new `/learn` (level ladder) and `/learn/:lessonId` (lesson + quiz) public routes, both free for every tier permanently. Static, hand-authored lesson content ships in the client bundle (`client/src/content/lessons/`) — all 32 lessons across Levels 100–500 now live; the "Coming soon" state on `/learn` clears automatically per level once it has lessons (no separate flag to flip). New additive `lesson_progress` table (`userId`, `lessonId`, `completedAt`, `quizCorrect`, unique on user+lesson) tracks completion via `learn.getProgress` / `learn.markComplete` (protected tRPC, validated against `shared/lessonIds.ts`, which a unit test keeps in sync with the content files and which now lists all 32 ids). Deterministic, zero-AI-call "lesson of the day" card on `/game` (`client/src/lib/lessonOfTheDay.ts`) matches the live matchup's Beta/Next-Earnings/52-Week-High/analyst-action signals to a relevant lesson (the Level 400 Analysts lesson is tagged `analyst` so rule 4 now has a real target), falling back to a rotation over `catalyst`/`fundamentals`/`valuation`/`sector-story`/`basics`-tagged lessons; dismissable per day via localStorage. Content follows the spec's voice guide including US English spelling (rule 8, added during Phase A review) throughout. Full spec in `references/learning-hub-build-spec.md`. Content review by Fable pending before this merges to `main`; the `lesson_progress` schema addition still awaits Paul's written approval and has not been pushed via `pnpm db:push`. Out of scope for v1 (per spec Section 8): spaced-repetition review cards, the interactive pick-page Scorecard tool, MunyIQ integration, tier gating, localization. |
| App-style bottom tab bar (mobile) | **Complete (2026-07-24)** — `client/src/components/BottomNav.tsx`, rendered by `PublicLayout` on every player page. Mobile-only (`md:hidden`), **signed-in players only** (signed-out visitors keep the clean marketing site). Five tabs: Today (`/game`), Research, Learn, Ranks (`/leaderboard`), Me (`/dashboard`, also active on `/profile`); active tab in brand green with `aria-current`. Height contract: 56px + `env(safe-area-inset-bottom)` (iPhone home indicator); an in-flow spacer keeps the footer visible; z-30 sits under the header menu backdrop (z-40) and ChartSheet (z-200). DailyGame's lockout countdown bar mobile offset updated from the fossil `bottom-[56px]` to the same safe-area calc so it docks on top of the bar. Historical note: a Manus-era bottom nav existed only in Manus's working copy and never landed in this repo — only the countdown's 56px offset survived; this is a fresh rebuild. |
| Landing page FAQ section | **Complete (2026-07-24)** — new SECTION 6 on `/` (`client/src/pages/Home.tsx`), between the beta-recruitment section and the final CTA. 10 questions about Munymo itself (what it is, the gut-then-research two-step, 80/20 scoring, not-trading/not-advice/not-gambling, streaks + Away Status, matchup curation, MunyIQ, free beta), answers distilled from the Evolution of Munymo document into US English; rendered with the shadcn accordion. The same `FAQ_ITEMS` array also emits `FAQPage` JSON-LD structured data for Google + AI search (GEO). |
| SEO on-page basics (titles, meta, h1, OG, structured data) | **Complete (2026-07-24)** — before this, every page's title tag was just "Munymo", with no meta description, no Open Graph/Twitter tags, and no `<h1>` on the landing page. Now: keyword-bearing default title + meta description + static OG/Twitter card + `Organization`/`WebSite`/`WebApplication` JSON-LD in `client/index.html`; per-route `document.title`/description/canonical via new `client/src/hooks/usePageMeta.ts`, called from every routed page — including dynamic per-game titles on `/research/:id` ("LLY vs NVO — Which Stock Performed Better?") and per-lesson titles on `/learn/:lessonId`. Landing hero's "Introducing Munymo" line is now the page `<h1>` with the primary phrase "daily stock market prediction game"; 3 search-phrased FAQ items added (simulator, Wordle-for-stocks, beginner learn-by-playing → 13 total, all feeding the FAQPage JSON-LD). Keyword research + full strategy (incl. deferred P3 content ideas) in `references/seo-keyword-strategy-2026-07-24.md`. **Server-side since 2026-08-05** — GSC showed every URL pending with identical homepage HTML (per-route titles only existed after JS ran, and every path returned 200, so Google saw 40+ duplicates plus soft-404s). `resolvePageMeta`/`injectPageMeta` in `server/_core/seo.ts` now rewrite `<title>`/description/og:/twitter:/canonical in the served `index.html` for every route (mirrors every `usePageMeta` call — keep the two in sync when adding pages), inject `noindex` on auth-gated shells, and return real HTTP 404s for unknown routes/games/lessons (SPA shell still renders NotFound). Wired into both catch-alls in `server/_core/vite.ts` (dev + prod), fail-open to the plain shell on any error; covered by `server/seoMeta.test.ts`. Follow-ups: a proper 1200×630 OG share image (current one reuses the wide logo PNG). |
| sitemap.xml + robots.txt | **Complete (2026-07-24)** — `GET /sitemap.xml` served dynamically by `server/_core/seo.ts` (registered before the static/Vite middleware in `index.ts`): 9 public static routes plus every `result_published` game as `/research/:id` with `<lastmod>`, so the archive is crawlable and the sitemap grows automatically each trading day (1h cache, capped at 5000 games). `client/public/robots.txt` allows all crawlers, disallows `/admin`, `/dashboard`, `/profile`, `/api/`, and points to the sitemap. Submit `https://munymo.com/sitemap.xml` once in Google Search Console. |
| Multiple simultaneous "active" games pileup | **Fixed 2026-07-06.** Root cause: the close-game query in `scheduledCuration.ts` (`dailyCurationHandler`) ordered candidates by `desc(gameDate)` — picking the LATEST (a future, not-yet-played) active/locked game to close instead of the earliest. The old curation-agent prompt had the same ambiguity ("find the most recent game with active/locked status" over a newest-first list). Once more than one active game existed, each night's run would close the wrong (future) game with fabricated data while the real one from that day sat forever unresolved, and a new game kept getting added — exactly the "cron timing issue" symptom seen across several days. By 2026-07-06 this had produced three unresolved rows: July 6 (AMZN/TSLA, manually cancelled by Paul), July 7 (NVDA/AVGO, `lockoutAt` wrongly `13:00 UTC` instead of `13:30 UTC` — a recurrence of the bug "fixed" once before in commit `633c3ae`), and July 8 (GOOGL/META, pre-curated ahead of time, which should never happen). **Manual cleanup performed:** July 8 (GOOGL/META) and the cancelled July 6 (AMZN/TSLA) rows deleted entirely (with their `game_research`/`validation_questions` children); NVDA/AVGO's `gameDate` moved to `2026-07-06` and `lockoutAt` corrected to `2026-07-06T13:30:00.000Z`, so it now correctly stands in as today's game. July 7 and July 8 are blank and will be freshly curated when those dates actually arrive. **Code fix:** the close-game query now orders by `asc(gameDate)`; both `curationAgent.ts`'s system prompt and `daily-curation-agent-prompt.md` now explicitly say to pick the EARLIEST-dated active/locked game, not the first one in the (newest-first) list. |
| Leaderboard showed real names instead of chosen display names | **Fixed (2026-08-25)** — `getLeaderboard()` and `getProvisionalLeaderboard()` (`server/db.ts`) selected `users.name`, which is the full legal-ish name Clerk supplies at sign-up, so the public rankings published every player's real name and the handle they set on `/profile` (`dashboard.updateDisplayName` → `users.displayName`) appeared nowhere. Every other surface already coalesced correctly (`PublicLayout.tsx`, `MyDashboard.tsx`, `PlayerProfile.tsx`, `dashboard.getStats`'s `playerName`) — the leaderboard was the only place that didn't. Both queries now select `displayName` + `name` and map through a new exported `publicPlayerName()` helper (`displayName ?? name`), still returning the same `userName` field, so `Leaderboard.tsx` is unchanged. Erased accounts have both columns nulled by `ERASED_USER_FIELDS`, so they still fall through to the client's existing "Anonymous" rendering. No schema change. Covered by 4 unit tests in `server/munymo.test.ts` including one asserting the real name can't leak once a display name exists. Note `referralRouter.ts`'s `ownerName` reads `displayName` alone, but that's an admin-only view, not a public ranking — deliberately left as is. **Extended same day:** the no-display-name fallback no longer publishes the full real name either — `abbreviatePlayerName()` reduces it to first name + surname initial ("Paul Kennedy" → "Paul K"). Middle names are skipped (the initial comes from the surname, not the middle name); generational and professional suffixes are dropped so "Paul Kennedy Jr" is "Paul K", not "Paul J"; single-token names are returned whole (many cultures use one, and Clerk accepts one) rather than reduced to nothing; only the leading character is capitalized, so "McDonald" survives intact instead of being title-cased to "Mcdonald"; whitespace-only names return null and render as "Anonymous". Abbreviation is for PUBLIC surfaces only — a player's own name shown back to them in the header, `/dashboard` and `/profile` is deliberately still shown in full. 14 further unit tests cover the edge cases. |
| PWA cold launch showed the signed-out CTA to signed-in players | **Fixed (2026-08-25)** — `useAuth()` derived `isAuthenticated` as `isLoaded && isSignedIn && Boolean(user)`, gating on two sequential waits: Clerk's script loading and refreshing the session token, and then the `auth.me` tRPC round-trip. Launching the installed PWA from the home-screen icon meant seconds of "signed out as far as the UI knows", during which the hero CTA rendered `Start Playing — It's Free` wrapped in `<SignUpButton mode="modal">` — so a quick tap threw an already-signed-in player into the sign-up modal, and the mobile `BottomNav` was absent and then popped in, shifting the page. Fix is two-layered: (1) a new `likelyAuthenticated` reads Clerk's verdict directly (`isLoaded ? isSignedIn === true : hint`), which settles one full round-trip earlier than `isAuthenticated` because it doesn't wait on `auth.me`; (2) a `munymo-auth-hint` localStorage flag records the last resolved verdict and covers the window before Clerk itself loads, kept in step by an effect on `isLoaded`/`isSignedIn` and cleared inside `logout()` **before** `signOut()` (its redirect to `/` can beat the effect). `Home.tsx`'s four CTA/section gates and `BottomNav.tsx` now use `likelyAuthenticated`; everything needing the DB record (admin gating, the header's name/avatar block) still uses `isAuthenticated`/`user`. **The hint is a rendering optimization, never authority** — it is client-side and user-writable; auth is still enforced by Clerk on the client and `protectedProcedure` on the server, and a stale hint self-corrects the moment Clerk loads (worst case: a signed-out visitor sees `Play Today's Game`, a plain `<Link href="/game">`, and gets the normal sign-in prompt on that auth-gated page). `localStorage` access is try/caught for Safari private mode. No layout or copy change to the landing page (§20 respected). |
| Crawlable internal links in the served html | **Complete (2026-09-12)** — Search Console showed every `/research/:id` archive page stuck at **"Discovered - currently not indexed"** with `last_crawl` never set: Google knew the URLs (from the sitemap) but had never fetched them. Diagnosis: the html actually served for `/research` contained **zero `<a>` tags** — 372KB of shell with every link rendered client-side by React — so the sitemap was the ONLY discovery path and there was no internal-link signal suggesting the pages mattered. (Google's second-wave JS render does find them eventually, but it is lower priority and unreliable at low authority.) The Aug 5 server-side work fixed `<title>`/description/canonical; the *link graph* was still JS-only. New `buildCrawlLinks()` + `injectCrawlLinks()` in `server/_core/seo.ts` render a real `<ul>` of links into the shell, wired into BOTH catch-alls in `vite.ts` (dev + prod) alongside `injectPageMeta`: `/research` gets all published games (capped 300), `/learn` all 32 lessons, `/` the four hubs plus the 12 newest games. Anchor text is the ticker pairing (`NEE vs CEG — 2026-09-11`) and the lesson title, not "read more" — that is the only anchor text Google gets for those pages. Placed inside `<div id="root">`; `main.tsx` uses `createRoot` (NOT `hydrateRoot`), so React replaces it wholesale on mount — verified no hydration warnings, no leftover nav in the DOM, no visual change. **Not cloaking:** the links are real, resolve to real pages, and match what the React app renders; the site is also now usable with JS disabled. The published-game list is shared with the sitemap behind a 15-min in-memory cache (`getPublishedGames`), so building the list on every shell request costs no extra query; DB failure serves the last good list, else no links — never a 500. **Also fixed in the same change:** the 32 `/learn/:lessonId` pages were missing from the sitemap entirely (only `/learn` was listed) — sitemap went 69 → 101 URLs. Covered by 9 tests in `server/seoMeta.test.ts`. Companion connector work (not in this repo): the local GSC MCP at `~/WorkSpace/tools/google-search-console-mcp` was re-authorized from `webmasters.readonly` to full `webmasters`, gaining real sitemap submission; its `submit_url_for_indexing` was a **stub returning hardcoded success without calling anything** and now refuses honestly, `check_indexing_status` read camelCase keys off a snake_case dict (every field but `verdict` reported UNKNOWN), and `get_index_coverage`/`get_mobile_usability_issues` queried an invalid `issue` dimension and always 400'd — both now say so instead. Sitemap resubmitted 2026-09-12: Google re-downloaded within minutes after 7 weeks stale (last fetch had been 2026-07-24, twelve days BEFORE the Aug 5 fix it needed to see). |
| Admin Player Management — status invisible + away-status drift | **Fixed (2026-09-16)** — found while investigating the first real signup (user 5370001), whose `streak_records.awayStatus` read `"away"` while `users.awayStatus` read `false`. **Root cause (real bug, not cosmetic):** `streak_records.awayStatus` is canonical — the streak engine and `streakAtRiskHandler` read it — and `users.awayStatus` is a display mirror that `/profile` reads (`PlayerProfile.tsx`). The PLAYER's own toggle wrote both (`routers.ts` ~1412-1416), but `admin.setPlayerAwayStatus` → `setAwayStatus()` wrote ONLY the canonical field, so an admin-set Away left the player's own profile page still showing "Active" while the streak engine treated them as away. `setAwayStatus()` now mirrors to `users.awayStatus` (`away` → true; `active`/`missing` → false), matching the player path. **UI, second cause:** `AdminPlayers.tsx` never displayed away status at all — the "Status" column showed `player.role` — and offered two same-looking buttons ("Away"/"Active") with no confirm, so a click produced a success toast with no visible change. On mobile the `<table>` squeezed its action column off-screen, leaving a single unlabelled icon as the only visible control; Paul changed a real user's status by accident this way. Replaced the table with a stacking card list (no horizontal overflow at any width), a coloured status badge (Active/Away/Missing), and ONE button naming the change it will make ("Set Away" / "Set Active") behind a confirm that spells out the consequence (streak protected, reminder emails suppressed). New `getPlayersForAdmin()` in `db.ts` backs `admin.listPlayers` (was `getAllUsers()`, users-table only): joins `streak_records` for canonical away status + current streak, and counts `push_subscriptions` per player in one pass (not N queries). **Rows now show `pushDevices`, not just `pushOptIn`** — `pushOptIn` defaults to `true` at signup (`schema.ts:38`) so it says nothing about reachability; only a registered subscription means a push can be delivered, and the first real user had `pushOptIn: true` with zero devices. No schema change. 3 tests in `server/munymo.test.ts` guard the mirror. **Not visually verified** — `/admin/*` is auth-gated and the local Clerk key is production-only, so the rendered page could not be checked locally; `tsc`, 185 tests and `pnpm build` all pass. |
| Unique server-rendered body content on leaf pages | **Complete (2026-09-16)** — follow-up to the 09-12 link-list fix, which worked: Search Console showed the archive pages moving from never-crawled to **crawled within hours** of the sitemap resubmit (`/research/1770001` crawled 09-12 09:44, `/research/870001` 10:04), and `/terms` went "URL is unknown to Google" → **Submitted and indexed**. But they still didn't index — status became **"Duplicate, Google chose different canonical than user"** with Google naming `/research/2` as the canonical for the WHOLE archive (that one page is indexed; the other ~60 are folded into it). **Cause, verified against the live site:** every `/research/:id` served a unique `<title>` AND a correct self-referential canonical, but `<div id="root">` was **empty — 0 bytes** — so all ~60 pages were byte-identical below the head. Google dedupes on body content and overrode our declared canonical. Unique metadata is not sufficient; the body needs unique words. `buildCrawlLinks`/`injectCrawlLinks` renamed to **`buildCrawlContent`/`injectCrawlContent`** (the job is no longer only links) and extended: hub routes still get link lists, and leaf routes now get their real content. `/research/:id` renders an `<article>` with the ticker-pair h1, both company names, sector, date, the result (winner + both % moves), `pairingRationale`, and the `researchSummary` prose — ~3KB of unique text per page, verified distinct by hash between two games. `/learn/:lessonId` renders the lesson title, `jargonTerm`, full `body` prose and `matchupHook` (~2.5KB). Both append hub + sibling links (never self-linking) so leaf pages carry an internal link graph rather than being crawl dead-ends. **Leak guard preserved:** only `result_published` games render, mirroring `resolveArchiveGameMeta`, so a queued future matchup can never appear in the html; a nonexistent id renders nothing (verified 0 bytes). Content is escaped via `htmlEscape`, paragraphs split on blank lines. React still replaces it on mount (`createRoot`) — verified no leftover markup, no hydration warnings, correct page renders. **The same trap was waiting for lessons**: `/learn/l100-1` had an identical empty body and sat at "Discovered - currently not indexed" (only entered the sitemap 09-12, not yet crawled) — fixed before Google reached it. Sitemap now re-read regularly (09-12, then 09-15) at 102 URLs, up from 34 stale since July. 5 new tests in `server/seoMeta.test.ts` (190 total). Search performance remains 5 impressions/28 days — noise at that volume, not a trend. |
| Manus runtime + jsxLoc plugin shipping to production | **Fixed (2026-09-16)** — found during a forward-looking audit of what else could block indexing. `vite.config.ts` line 153 ran `jsxLocPlugin()` and `vitePluginManusRuntime()` **unconditionally**, so both dev-only tools shipped in production builds. The Manus runtime injected a **366KB INLINE script into every page's html** (visible on the live site as the block beginning `window.__MANUS_HOST_DEV__ = false;`) — a leftover from the platform Munymo migrated off, doing nothing but bloating every response. Worse for SEO: it made every archive page **99.2% byte-identical boilerplate** (3,002 bytes of unique content in a 375,590-byte document), which is the opposite of what you want while Google is deciding whether those pages duplicate each other — it had already collapsed the whole archive onto `/research/2`. `jsxLocPlugin` put **2,219 `data-loc`** source-location attributes in the production bundle (dead weight plus needless disclosure of the source tree). Both are now gated behind `process.env.NODE_ENV === "production"` and kept in dev, using the SAME gate `vitePluginManusDebugCollector` already used — verified sound by the fact that the debug collector correctly emits nothing in production, which proves `vite build` sets NODE_ENV itself. **Results:** built `index.html` **375,590 → 5,640 bytes** (−98.5%); unique-content share per archive page **0.8% → 34.4%**; JS bundle 1,234,780 → 1,120,471 bytes (−114KB); `data-loc` 2,219 → 0. **Verified carefully rather than assumed:** ran the actual production build on a test port and browser-tested it — React mounts, `/`, `/learn`, `/research` and `/research/:id` all render correctly, server-rendered content still present, no leftover injected markup, `window.__MANUS_HOST_DEV__` now `undefined` with nothing depending on it, no new console errors; dev server separately confirmed unchanged (plugins still active, page still 200). Bonus finding, NOT fixed: the umami analytics tag ships with its placeholder unreplaced (`src="%VITE_ANALYTICS_ENDPOINT%/umami"`), so it 400s on every page load in production — analytics is silently dead and it is the source of the recurring console error. Needs `VITE_ANALYTICS_ENDPOINT`/`VITE_ANALYTICS_WEBSITE_ID` set in Railway, or the tag removed. **Fixed same day:** new `stripUnconfiguredAnalytics()` (`seo.ts`, wired into both `vite.ts` catch-alls) removes the tag while its placeholders are unresolved — so the failed request and console error are gone and nothing is silently pretending to collect data. Deliberately STRIPPED rather than deleted from `client/index.html`: set the two env vars and rebuild, the placeholders resolve, the function stops matching and the tag ships again. GA4 (`G-RLCKFXCSF3`) is a separate working install and is untouched — verified still present. 4 tests. |
| Retention: first-timer reminder, push prompt, threshold 20→10 | **Complete (2026-09-16)** — three changes from the retention analysis prompted by the first real signup churning after one session. **(1) First-timer reminder email.** `streakAtRiskHandler` skipped anyone with `currentStreak <= 0`, and a streak is only written at scoring time — HOURS after lockout — so by construction the reminder could never reach a player on their first game. That is exactly how user 5370001 was lost (gut pick 02:54Z, lockout 13:30Z, no push device, no streak, no contact). The handler now routes on whether a streak exists: streak > 0 keeps the existing `buildStreakAtRiskEmail`; no streak gets a new `buildFinishYourPickEmail` that reflects back the gut pick they made and points at the research, and **deliberately never mentions streaks** (leading with something unearned reads as noise). Guarded so it only emails players who actually STARTED — a gut pick with no final — because emailing everyone who hasn't played would be daily spam. Away players still skipped. 5 tests. **(2) Push prompt at the right moment.** New `ResultReminderPrompt` (`client/src/components/`) renders in `DailyGame`'s research step, i.e. immediately after the gut pick when the player has something riding on the outcome — not on `/profile`, which a new player may never open. `users.pushOptIn` defaults to `true` so every new player LOOKS reachable while having no `push_subscriptions` row at all; this is the only thing that creates one. Dismissal persists in localStorage (one "no" is remembered); hidden entirely for already-subscribed, blocked, or unsupported browsers; iOS pre-install shows the Add-to-Home-Screen instruction instead of a dead button. **(3) Threshold 20 → 10.** At one game per trading day, 20 games is four calendar weeks — surviving that long puts a player in roughly the top 5–10% of a typical cohort, so the threshold meant most signups would never reach the leaderboard. Ten games is two weeks and still a defensible sample. The constant moved to `shared/const.ts` as `LEADERBOARD_QUALIFICATION_GAMES`, imported by BOTH `server/scoring.ts` and the client — the client previously hardcoded the literal `20` in **five** places (`Leaderboard.tsx` ×4, `MyDashboard.tsx` ×1) which would have silently disagreed with the server. A test asserts server and shared constant match. Verified in-browser: "Qualification requires 10 completed games", "< 10 games". **Deliberately NOT built:** projected leaderboard placement — at a threshold of 10 the player qualifies at game 10, so there is nothing left to predict; countdown from game 1 then real rank on qualifying. **Outstanding:** `qualificationStatus` is STORED on `leaderboard_stats` and only recalculated when a player next plays, so dormant players who now qualify at 10 will not appear on the leaderboard until they play again — needs a one-off recompute across existing rows. |
| Magic links always "expired" + validation-answer bias + qualification rationale | **Fixed (2026-09-16)** — three unrelated issues Paul reported together. **(1) Magic links never worked**, including links opened seconds after arrival. Cause: the link carried Clerk's sign-in token *id*, and `/api/magic` pre-checked it with `GET /v1/sign_in_tokens/{id}` — **an endpoint Clerk does not provide** (their Backend API documents only CREATE and REVOKE for sign-in tokens). That request failed every time, so the handler always took its invalid-token branch and redirected to the expired page; age was irrelevant, which is why "just received" links failed too. Rewritten around new `server/_core/magicLink.ts`: Clerk returns the ready-to-use sign-in `url` **at creation** (the old code kept `id` and discarded `url`), so we carry that and let Clerk be the authority — it is single-use by design (status pending→accepted) and enforces its own expiry. TTL standardised at **86400s everywhere** (was 24h in `routers.ts` but **2h** in `scheduledCuration.ts`, so an evening result email could expire before morning). The friendly expired-page fallback is kept by stamping our own `exp` into the link, answered without any Clerk call; that stamp is a courtesy, not a security control — a tampered `exp` only skips our page and hands the user to Clerk. **Open-redirect guard added** (`isAllowedMagicTarget`): the target arrives via query param, so it is host-allowlisted (munymo.com / clerk.com / accounts.dev, https only, rejecting lookalikes like `munymo.com.evil.net`). Pre-rewrite links carrying `token=` degrade to the fallback. 12 tests in new `server/magicLink.test.ts`. **(2) Validation answers were predictable** — correct option almost always first, True/Yes almost always correct. Root cause is structural, not prompt carelessness: a model writing a question thinks of the answer then invents distractors, so it lands first. Fixed server-side by `shuffleOptionsForGame()` (`scoring.ts`), applied in `games.getValidationQuestion` — **safe because scoring compares answer TEXT, never index** (`calculateScore`), and **seeded by gameId so the order is stable**, since the question is timed and a reshuffle on reload would move options under the player's finger. true_false/yes_no have no position to shuffle, so both the agent system prompt and `references/daily-curation-agent-prompt.md` gained answer-distribution guidance (aim ~half FALSE/"No", false by one checkable detail, no tell-tale hedges/absolutes). 6 tests. **(3) Qualification rationale** — the leaderboard stated the threshold with no reasoning, reading as an arbitrary gamified gate. Now explains it as the sample-size rule it is ("an average over one or two games is mostly luck…"), using the shared constant so the number can't drift. Verified in-browser. |
| Leaderboard golf-style ranking (1-2-2-4) | **Complete (2026-09-16)** — the board numbered rows (`rank = i + 1`), so players on the SAME average got different positions purely from the order MySQL happened to return — and neither query had a secondary sort, so that order could change between page loads. Now standard competition ranking: equal averages share a position and the next distinct score resumes at however many are above it plus one (two tied for 2nd are both 2nd; next is 4th). Logic lives in new `shared/leaderboard.ts` (`assignCompetitionRanks`, `sortForLeaderboard`, `formatAverageScore`) imported by BOTH server and client so they cannot diverge. **Games played orders ties but never outranks** — Paul's rule: a longer record behind the same average is listed first as recognition of sustained play, but volume cannot buy a better position; `userId` is a final tiebreak so rows matching on both score and games played stop swapping between loads. Both `getLeaderboard()` and `getProvisionalLeaderboard()` gained `desc(averageDailyScore), desc(gamesPlayed), asc(userId)`. **Scores now render 2dp, not 1dp** (Paul's decision): ties are decided on the STORED 2dp value, so 88.75 and 88.84 rank 2nd and 3rd — at 1dp both displayed "88.8" and the ranking looked broken. Medals follow RANK not row, so two tied for 1st get two golds, no silver, and the next player takes bronze at 3rd. Applies to the provisional table too. The page now explains both the qualification threshold (a sample-size rule, not a gamified gate) and the tie behaviour — verified rendering. 10 tests. |
| Practice mode — archived games (server) | **Server complete (2026-09-16), migration 0016 applied.** New `practice_picks` table — deliberately a SEPARATE TABLE, not an `isPractice` flag on `player_picks`: that table feeds `getPlayerScoreHistory` → `upsertLeaderboardStat` → the ranked leaderboard, and every one of those queries would have needed a filter. One forgotten WHERE clause and practice silently pollutes the competitive board, which is the one thing this feature must never do; separation makes it impossible by construction rather than by vigilance. Scores are stored ON the practice row, never in `daily_scores`, so nothing reading that table can mistake practice for live play. Practice never touches the leaderboard, streaks, or qualification. **Blind play enforced SERVER-side** (`practice.getGame`), not in the client — hiding fields in the UI would be no protection since the payload would still carry the answer: `winner`, both `%` moves, the **gameDate** and the dated source article are withheld until that player completes the game. The date is withheld specifically because it makes the outcome searchable. **Known, accepted limitation:** the research prose itself names dated news events (verified: "a September 9, 2026 market wrap…"), so a determined player can still date a matchup and look up the result. Unavoidable without gutting the research, which IS the product, and tolerable only because practice cannot reach the leaderboard — the only person a cheat misleads is themselves. This must be stated in the UI. Guards: one play per game per player (DB unique index), `result_published` games only, gut → final → validate order enforced, completed games cannot be replayed for a better score. `computeProjectedRank()` (`scoring.ts`) reports where a practice average WOULD sit on the live board using competition ranking — a hypothetical, never stored, and the UI must carry the caveat that practice averages run high because the outcome already happened and the research can be re-read without time pressure. 6 tests. **Client shipped same day:** `/practice` (hub: available games, practice record, projected rank) and `/practice/:id` (the full loop — gut → research → final → timed question → reveal), registered in `App.tsx`, linked from the nav menu for signed-in players. Both routes are `noindex` and excluded from the sitemap (auth-gated, no unique public content) — verified. The hub carries the honest caveat in plain sight: practice doesn't affect leaderboard/streak/qualification, AND that the research still names news from that week so a determined player can find the answer and would only be fooling themselves. The list shows tickers, company names and sector but **never the game date** — the server withholds it. Play resumes where the player left off rather than restarting. Both pages gate on `likelyAuthenticated`, NOT `loading`: gating on `loading` left the page on a spinner forever whenever Clerk failed to resolve, with no escape (reproduced locally, since the local Clerk key is production-only). **Outstanding:** dormant-player qualification recompute. |

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
- `metrics.getExplanation` — public. Checks `server/_core/metricExplanations.ts` FIRST: a static, hand-written explanation for each of the ten standard research metrics (Market Cap, P/E Ratio, Revenue Growth, Analyst Consensus, Next Earnings, Beta, Last Session Move, vs 52-Week High, plus legacy EPS (TTM) and 52-Week Range for pre-2026-07-18 games), matched by suffix since labels are always ticker-prefixed (e.g. "NVDA Market Cap"). Instant, no DB, no LLM. Only a genuinely custom/admin-entered label (not one of the six) falls through to the DB cache, then to a live Claude call (`claude-opus-4-8` via `ANTHROPIC_API_KEY`) which caches its result for next time. **History (2026-07-06): originally called `server/_core/llm.ts` (Manus "Forge" proxy via `BUILT_IN_FORGE_API_KEY`), which was never set in Railway — every call 500'd instantly with no server-side log (tRPC has no `onError` handler, so uncaught errors are silent). First fixed by calling Anthropic directly per-request (worked, but ~5s latency per tap since every metric has a unique ticker-prefixed label and none of it was actually company-specific). Replaced same day with the static-lookup approach above, since the content never varied by ticker anyway.** `server/_core/llm.ts` is unused dead code, left in place. If other unexplained silent 500s show up, add an `onError` to `createExpressMiddleware` in `server/_core/index.ts` — there currently is none.

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

**Resolved (2026-07-10):** `munymo.com` is **Verified** in Resend — DKIM + SPF + return-path MX all in place, outbound email fully authenticated. The domain sat at "Partially Failed" only because Resend's **Enable Receiving** feature (inbound MX) was on with no MX record; Munymo is send-only, so receiving was turned **off** to clear it. Optional DMARC (`_dmarc` TXT `v=DMARC1; p=none;`) is the one remaining nice-to-have, not required.

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
