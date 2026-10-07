# Scoring v2 — build spec (2026-10-07)

**Decision:** Paul, 2026-10-07: "let's build it and push it and try it for a few days." Design and evidence: `references/scoring-homework-findings-2026-10-07.md`. Prototype: https://claude.ai/artifact/NkE3Uxiiw1GHcn9RY5dp38. Schema additions approved in writing the same day.

**Already done (do not redo):** `drizzle/schema.ts` columns; `shared/const.ts` `SCORE_WEIGHTS`, `CONFIDENCE_TABLE`, `CONFIDENCE_LABELS`, `PRICE_TREND_LABEL`, `HIGHLIGHTED_METRIC_COUNT`, `DAY_KIND_*`, types `ConfidenceLevel`, `DayKind`; `server/scoring.ts` v2 functions `calculateScoreV2`, `computeReasonScore`, `computeConfidenceScore`, `computeCheckScore`, `objectiveSideForMetric`, `classifyDay`. Legacy `calculateScore` stays for practice mode and old games.

## The day, as the player sees it

1. Gut pick (unchanged).
2. Research (unchanged content). The game's four `highlightedMetrics` get a highlighted row in the metrics table; if one is `"Price trend"` the chart card is highlighted instead. A one-line note above the table: "Mo has highlighted the four metrics where these two companies differ most today. You'll be asked which one is your reason."
3. **Your reason** (new step between research and final pick). Question 1: "Which highlighted metric is the main reason for your pick?" — four buttons, each showing the label and both companies' values (for Price trend: "the chart"). Question 2, shown once a metric is chosen: "Which company does {metric} favor?" — two buttons. Note under it: "The {reason} points are yours if your final pick agrees with the company you name here, and, where a metric has a plain direction, you read it the right way round. There is no answer key for which metric matters most."
4. **Final pick + confidence** (one screen). Pick A/B (unchanged), then "How sure are you?" with three buttons: Toss-up, Leaning, Confident, each showing "{if right} / {if wrong}" from `CONFIDENCE_TABLE × SCORE_WEIGHTS.conf`. Caption: "Points if right / if wrong. Toss-up never loses." Lock in requires both. One mutation: `picks.submitFinal({ gameId, selection, reasonMetric, reasonSide, confidence })`.
5. **Reading check** = the existing validation question modal, untimed: remove the countdown/elapsed display and every "faster = more points" line; still send `answerTimeMs` (harmless, kept for analytics). Correct = `SCORE_WEIGHTS.check` points, wrong = 0.
6. Submitted state: show "Banked before the open" (reason + check points, computed client-side from the same rules, or returned by the server) and "The call + confidence settle at the close." Weights shown as text ("How today is scored: 40 / 25 / 20 / 15"), never editable in the app.

Result page (after settlement): four-line breakdown (The call, Your reason, Confidence, Reading check) plus total; a day-kind pill from `game.dayKind` ("Coin toss · 0.17 pts apart" / "Clear" / "Decisive") directly above the Hindsight Spotlight. Share text drops the ⏱ emoji and reads e.g. "72/100 · called it · Leaning".

## Transition rule (important)

A game is scored under v2 **only if `daily_games.highlightedMetrics` is non-null**. Games staged before this deploy have none and settle under the legacy 80/20 path unchanged; the client shows the legacy flow for them (no reason step, no confidence, old copy). This makes the switch happen on the first game Mo stages with the new prompt, with no mixed day. Old score rows keep their numbers (Discussion 8).

Practice mode stays on legacy 80/20 for this trial (its games have no highlights). Note it in the handover.

## Server

- `picks.submitFinal` input: add `reasonMetric: z.string().max(64)`, `reasonSide: z.enum(["A","B"])`, `confidence: z.enum(["tossup","leaning","confident"])`, all **optional** (legacy games and guest replay). Validate: when the game has `highlightedMetrics`, all three are required and `reasonMetric` must be one of them. Persist via `db.upsertFinalSelection` (extend it).
- `games.checkGuestAnswer` unchanged. Guest play: `client/src/lib/guestPick.ts` `GuestPick` gains the three fields; `planReplay`/sign-up replay passes them to `submitFinal`.
- `closeAndScoreGame` (`routers.ts`): after settlement compute `dayKind = classifyDay(perfA, perfB)` and store on the game. For each pick: if the game has highlights → `calculateScoreV2` with `objectiveSide = objectiveSideForMetric(reasonMetric, valueA, valueB)` where the values come from the game's research metrics (strip the ticker prefix to match labels; Price trend → null); else legacy `calculateScore`. `db.insertDailyScore` gains `reasonScore` and `confidenceScore` (default 0) and sums all four into `totalScore`. Auto-submitted finals (gut copied at lockout) have no reason/confidence: both score 0 (that is the auto-submit penalty now; no other penalty).
- Bots (`testerAgent.ts`): `submitFinal` with `confidence: "tossup"` for Coin Flip (all bots), `reasonMetric` = a random highlighted metric, `reasonSide` = the bot's final pick. Fix the existing bug: answer yes_no/true_false questions too (random "Yes"/"No", "True"/"False").
- Dashboard `getStats`: unchanged (`predictionScore > 0` still means "called it").

## Mo's prompt (`server/_core/curationAgent.ts` `SYSTEM_PROMPT` only; keep the anchor strings used by `requireIndex` intact)

- New output field on `tomorrow`: `"highlightedMetrics": ["<label>", "<label>", "<label>", "<label>"]` — exactly four, from the eight panel labels (without ticker prefix) plus `"Price trend"`. Rule text: choose the four where the two companies differ most meaningfully today; Price trend qualifies only when the 20-session moves differ by more than 10 percentage points or one chart shows an event the other lacks; never choose a metric where both values are the same or "No confirmed date".
- Validation question rules: replace the current rules with: one **comparative** question whose answer needs both columns of the metrics panel or both charts (e.g. "Which company's shares are closer to their 52-week high?"), never a fact lifted from the brief, never about the highlighted metric chosen as Price trend. Keep the type rotation and answer-distribution rules. Remove any mention of timing or "20%".
- Hindsight Spotlight rule: it must open with one sentence that classifies the day using the same thresholds as the server (margin < 0.25 pts = "a coin toss", < 1 = "clear", else "decisive"), and on a coin-toss day must say the result is too close to carry a lesson about the companies before explaining how each traded.
- Parse `highlightedMetrics` in `scheduledCuration.ts` (both staging `upsertProposalContent` path and legacy path) and in `routers.ts` `nextGameFields`/`admin.endOfDay` zod (`nextHighlightedMetrics: z.array(z.string()).length(4).optional()`), storing on `daily_games.highlightedMetrics`. Validate labels against the metric labels present (after stripping prefixes) plus Price trend; on failure log a warning and store null (the game then runs legacy for that day, which is safe).
- Update `references/daily-curation-agent-prompt.md` to match.

## Copy (US English, "Mo")

Replace every 80/20 and timed-quiz mention: `Home.tsx` FAQ + JSON-LD + how-it-works + "The Score" block; `Demo.tsx` (minimum: no speed/80/20 claims); `Practice.tsx` "timed question"; `EvolutionOfMunymo.tsx` add a short closing paragraph to "Why 80/20?" saying it was replaced on 2026-10-08 and why (one sentence: the call turned out to be a coin flip for everyone, so the score now pays for the decision, not the dice); `shared/milestones.ts:51` perfect-game copy; `email.ts` result email four lines with `SCORE_WEIGHTS` maxima, welcome/finish-your-pick emails drop "timed"; `Leaderboard.tsx:148` Coin Flip line ("picks at random, always says Toss-up"); `AdminEditGame.tsx:324`.

The Score block wording: "**The call — 40.** Did your final pick win? **Your reason — 25.** Name the highlighted metric behind your pick and which company it favors; the points are yours when your pick agrees with your reason. **Confidence — 20.** Toss-up, Leaning or Confident, scored on a published table where honesty pays. **Reading check — 15.** One question that needs both columns of the panel. No timer."

## Tests (`server/munymo.test.ts`)

Add: `calculateScoreV2` (right/wrong call × each confidence level; reason consistent/inconsistent; objective-direction miss; all-null legacy pick scores 0 on reason/conf; max 100; weights sum), `objectiveSideForMetric` (Revenue Growth parses "+36% YoY" vs "+34% YoY" → A; equal → null; P/E → null), `classifyDay` boundaries (0.249 coin_toss, 0.25 clear, 0.999 clear, 1.0 decisive). Keep legacy tests. `npx tsc --noEmit` and `pnpm test` must pass.

## Handover

Section 4 table: new row "Scoring v2 (call 40 / reason 25 / confidence 20 / check 15, untimed)" — Complete, 2026-10-07; amend the time-decay row to "superseded by v2 for games with highlighted metrics; legacy path kept for practice and old games"; practice row: "practice stays on 80/20 during the v2 trial". Section 9: replace with the v2 description and the transition rule. Section 26: Discussions 1–4 move to "decided 2026-10-07, trial running".

## Order of operations

1. Code + tests green locally. 2. Migration (`pnpm db:push`, lift-and-restore the deny rule, commit generated files). 3. One commit, push to `main`. 4. Watch Railway, then the next curation run's email for `highlightedMetrics`.
