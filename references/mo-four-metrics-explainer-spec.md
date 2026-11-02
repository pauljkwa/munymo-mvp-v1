# Mo's Four Metrics explainer — build spec (2026-11-02)

**Decision:** Paul, 2026-11-02: the results page should explain *why Mo chose the four highlighted metrics before the open* and *how each one played out*, so a novice sees the pre-open analytics Mo used, not only the hindsight. **Revised the same day:** nothing new is shown before the open. Players should use their own nous and investigative skills; it is enough that the four metrics are marked as the ones Mo finds indicative. Mo instead weaves the four metrics subtly into the research text, and the explicit reasoning appears only on the results page. A studious player who reads the wrap-up daily learns the reasoning and applies it to the next game without hand-holding. Spec written by Fable for a cheaper model to build; Fable reviews the diff.

**Schema:** two new nullable JSON columns on `daily_games` (ADD only). **Paul must approve in writing before the migration runs**, and Paul runs `scripts/apply-migration.sh` himself (the agent harness blocks `db:push`). Apply the migration *before* pushing code that reads the columns.

**Not in scope:** any new pre-open UI (no "Mo:" lines on the game page, nothing under the Your-reason buttons, the fixed sentence above the metrics table stays as it is), backfilling old games (Mo was never asked for this; the card simply does not render without notes), any change to scoring, any change to which metrics Mo may choose, leagues, practice mode.

---

## What the player sees

### Before the open (game page) — no UI change

The game page stays exactly as it is: the four metrics carry their "Highlighted" chip and the one fixed sentence above the table. Mo's per-metric reasons are **recorded at staging but not displayed** until the result is published (the server withholds them, see "Reading it").

What changes before the open is the research text itself. Mo's prompt (below) asks that `researchContent` and `researchSummary` touch on each of the four highlighted metrics in passing, as part of the narrative, without labelling them, listing them, or saying "highlighted". A player who reads the brief closely will find the threads; one who skims will not be told. Example of the intended register, inside a paragraph about The Trade Desk:

> ...and it is growing revenue at a far slower clip than its larger rival, which matters more than usual on a day when neither company has news of its own.

That is the whole pre-open treatment. No new fields are sent to the client before settlement.

### After the close (results page `client/src/pages/GameResult.tsx` and the public archive page `client/src/pages/ArchiveGame.tsx`)

New card, **"Mo's Four Metrics"**, placed after "What Happened" and before the Hindsight Spotlight on both pages. Icon: `ListChecks` from lucide (or `BarChart3` if that name is unavailable in the installed version). Intro line under the heading: "Mo chose these four before the open because they separated the two companies most. Here is why, and how each one held up."

One block per metric, in the order stored in `highlightedMetrics`:

- **Header row:** the label, then both values with ticker chips (`GOOGL 14% YoY · TTD 3% YoY`). For `Price trend` show "the 20-session chart" instead of values.
- **Before the open:** Mo's pre-game sentence (from `highlightedMetricNotes`).
- **How it played out:** Mo's post-game sentence (from `highlightedMetricDebrief`).
- **Chips** (right of the header, wrap on phones):
  - "Your reason" when the signed-in player's `reasonMetric` matches this label (case-insensitive). Add the side they named: "Your reason · you said GOOGL". Color it success when `reasonSide === winner`, muted otherwise. Never shown on the archive page for signed-out visitors.
  - "Numbers favored {TICKER}" when `objectiveSideForMetric(label, valueA, valueB)` is non-null (today that is Revenue Growth only). This is the same function settlement uses, so the chip and the reason score can never disagree.
- Dividers between blocks, same card-glass styling as the Reading Check card, `MoByline` at the bottom.

Render rules: the card renders only when `highlightedMetrics` is non-null **and at least one of the two notes objects is non-null**. If only the pre-game notes exist (settlement run did not return a debrief), render the "Before the open" lines and omit "How it played out" for every metric rather than showing blanks. If a single metric's sentence is missing, omit that line only.

Phone layout: everything stacks; the two values go on their own line under the label; chips wrap. Reuse the colour tokens already used for the Reading Check and Spotlight cards; no new CSS.

---

## Data

### Schema (`drizzle/schema.ts`, `dailyGames`, next to `highlightedMetrics`)

```ts
// Mo's one-sentence reason for each highlighted metric, written when the game is staged.
// Keys are the exact labels stored in highlightedMetrics. Null for games staged before 2026-11.
highlightedMetricNotes: json("highlightedMetricNotes").$type<Record<string, string> | null>(),
// Mo's one-sentence "how it played out" per highlighted metric, written at settlement.
highlightedMetricDebrief: json("highlightedMetricDebrief").$type<Record<string, string> | null>(),
```

Both nullable, no defaults, no other column touched. Commit the generated `drizzle/` migration files with the feature.

### Payload (`server/_core/scheduledCuration.ts` types `CurationTomorrow` and `CurationPayload.today`)

- `tomorrow.highlightedMetricNotes?: Record<string, string>` — label → one sentence.
- `today.highlightedMetricDebrief?: Record<string, string>` — label → one sentence.

### Validation helper (`server/highlightedMetrics.ts`, pure, tested)

```ts
/** Keeps only the entries whose key matches one of the game's highlighted labels
 *  (case-insensitive, trimmed), re-keyed to the stored label spelling, values trimmed
 *  and capped at 400 chars. Returns null when the input is not an object or nothing
 *  matches. Never throws; a bad notes object must never block a curation run. */
export function resolveMetricNotes(raw: unknown, highlighted: string[] | null, context: string): Record<string, string> | null
```

Log one `console.warn` naming the dropped keys when some are dropped. Use it for both the notes and the debrief.

### Where it is stored

1. **Stage-game endpoint** (`stageGameHandler`, `nextGameFields` ~line 1000) and the **legacy combined path** (`nextGameFields`/`endOfDayInput` ~line 788, plus `upsertProposalContent` for the C1 re-apply): after `highlightedMetrics` is resolved, store `highlightedMetricNotes: resolveMetricNotes(tomorrow.highlightedMetricNotes, resolvedHighlights, "stage-game")`. Store null when `highlightedMetrics` itself resolved to null (no highlights means no notes).
2. **Settlement** (`closeAndScoreGame` in `server/routers.ts`, the `updateGame` call around line 1234): accept `highlightedMetricDebrief?: Record<string, string>` in `opts`, resolve it against `game.highlightedMetrics`, and write it with the result fields. Pass it through from `endOfDayInput` in both scheduled paths (`today?.highlightedMetricDebrief`) and from the admin mutations below.
3. **Admin mutations** (`publishResult` ~line 1777, `endOfDay` ~line 1914): zod `highlightedMetricDebrief: z.record(z.string()).optional()` on both; `nextHighlightedMetricNotes: z.record(z.string()).optional()` on `endOfDay`, stored alongside `nextHighlightedMetrics`. The sanitizer (`sanitizeAiStrings`) already runs on every one of these inputs and deep-cleans record values, so no extra stripping is needed.
4. **Admin forms** (`client/src/pages/admin/AdminEndOfDay.tsx`, `AdminCreateGame.tsx`): the paste-JSON importer (`td(...)`/`t(...)` helpers) should carry the two new objects through to the mutation inputs. No new form fields are required; a one-line read-only "Notes: 4 of 4 metrics" / "Notes: none" indicator next to the highlighted-metric picker is enough.

### Reading it

- `games.getToday` / `getById` (whatever `GameResult.tsx` and `ArchiveGame.tsx` already use for `highlightedMetrics`) return the two new fields **only when `status === "result_published"`**; before that both are returned as null, exactly as `dayKind` and the perfs are withheld until finished (see the practice `getGame` comment near `routers.ts:530`). The pre-open game page never receives them, so there is nothing for a player to find in the network tab.
- `getResearch` already returns `metrics` as a label → value record for both live and snapshot rows; the card uses `valuesForMetric`-style matching client-side (there is a `sameLabel` helper in `DailyGame.tsx`; lift it to `shared/` if the results page needs it too).
- The player's `reasonMetric` and `reasonSide` are already on the pick row the results page loads (`myPick`); confirm the `getMyPick`-style query selects them and add them if not.

---

## Mo's prompt (`server/_core/curationAgent.ts`, `SYSTEM_PROMPT` only)

Keep every `requireIndex` anchor string intact ("## highlightedMetrics rules", "## Output format — CRITICAL", `"today": {`, `"tomorrow": {`, and the rest). Both derived prompts are sliced from `SYSTEM_PROMPT`, so edit it once:

1. In **"## highlightedMetrics rules"**, append:

   > For each of the four, write ONE sentence in `highlightedMetricNotes` (key = the exact label) saying why this metric separates the two companies going into the game day. Quote the two values and say what the gap usually means for a single session. These notes are shown to players only AFTER the result is published, as the "before the open" half of a debrief, so write them as your pre-game reasoning: never say or hint which company will win, never use hindsight, and never use relative time words (anchor dates as in the Dates section). For "Price trend", describe the shape of the two 20-session charts (the gap, spike or breakdown that qualified it). Plain prose, 1–2 sentences, under 300 characters, no markup.
   >
   > Weave the four highlighted metrics into `researchContent` and `researchSummary` as part of the narrative: each of the four should be touched on somewhere in the prose, in context, the way an analyst would mention it. Do NOT label them, list them, number them, or use the words "highlighted", "key metric" or "Mo". A close reader should be able to find the threads; a skimmer should not be told. The brief must still read as a story about the two companies, not as a walkthrough of the metrics panel.

2. In **"## Determine today's winner"**, after the Hindsight Spotlight opening rule, append:

   > Also write `highlightedMetricDebrief`: for each of the four highlighted metrics listed in the user message (same keys), ONE sentence on how that metric held up today. Say plainly whether the company the numbers favored was the one that won the open-to-close move, and if not, what overrode it (news, earnings, the broader market). On a coin-toss day say the gap was too small for any metric to claim credit. Never pretend a metric predicted the result when it didn't; the lesson is the point. Under 300 characters each, plain prose, no markup.

3. **Output template:** add `"highlightedMetricDebrief": { "<label>": "<1 sentence>", ... }` to the `today` block after `hindsightSpotlight`, and `"highlightedMetricNotes": { "<label>": "<1 sentence>", ... }` to the `tomorrow` block directly after `highlightedMetrics`. Because the derived prompts lift these blocks with `extractBalancedBlock`, placing the fields inside the existing braces is all that is needed.

4. **User message for the settlement runs** (`attemptResultsOnlyCuration` and the combined run's opening message): append a block built by a new server helper `describeHighlightedMetricsForAgent(game, researchRows)`:

   ```
   HIGHLIGHTED METRICS for the concluded game (write highlightedMetricDebrief with exactly these keys):
   - Revenue Growth: GOOGL 14% YoY | TTD 3% YoY — Mo's pre-open note: "..."
   - P/E Ratio: ...
   - Price trend: (the 20-session chart) — Mo's pre-open note: "..."
   ```

   Build it from the concluded game's `highlightedMetrics`, `highlightedMetricNotes` and its research metrics (`valuesForMetric`). Omit the block entirely when the concluded game has no highlights. The results-only run already knows the concluded game via the session-prices lookup (`sessionPricesNote`); reuse that lookup so both blocks describe the same game. The combined (legacy) run finds the game the same way.

5. Mirror the rule text in `references/daily-curation-agent-prompt.md` (the human-readable copy) under its existing "Highlighted metrics" paragraph.

Prompt-cache note: this invalidates the cached system prefix once; expected, nothing to do.

---

## Emails (optional, small)

In the staging ✅ email (`server/_core/scheduledCuration.ts` success notification for stage-game) add a "Metric notes: 4/4" or "Metric notes: missing" line so Paul can see at a glance when Mo skipped them. Same for the debrief in the settlement ✅ email. No other email changes.

---

## Demo page

`client/src/pages/Demo.tsx` `DEMO_GAME`: add four sample notes and four sample debrief lines for its AAPL vs MSFT matchup so the demo's **results** screen shows the card. The demo's pre-open steps do not change. Keep them short and consistent with the existing demo copy.

---

## Tests (`server/munymo.test.ts` or a new `server/metricNotes.test.ts`)

- `resolveMetricNotes`: exact keys kept; case/whitespace variants re-keyed to the stored label; unknown keys dropped with a warning; non-object → null; empty after filtering → null; values trimmed and capped at 400 chars; `highlighted === null` → null.
- `describeHighlightedMetricsForAgent`: lists all four with both values and the note; Price trend line has no values; returns "" for a game without highlights.
- Prompt structure: the existing anchor-based tests still pass; add one asserting the `today` block in `RESULTS_ONLY_SYSTEM_PROMPT` contains `highlightedMetricDebrief` and the `tomorrow` block in `STAGING_SYSTEM_PROMPT` contains `highlightedMetricNotes` (export the derived prompts for tests if they are not already).
- Prompt text: `STAGING_SYSTEM_PROMPT` contains the weaving rule ("Do NOT label them, list them") and `SYSTEM_PROMPT` contains it once.
- `sanitizeAiStrings` already has coverage for record values.

`npx tsc --noEmit` and `pnpm test` must pass before pushing.

---

## Handover

Section 4 table: new row **"Mo's Four Metrics explainer (pre-open reasons + post-close debrief)"**, Complete with the ship date, naming the two columns, the two payload fields, the fallback rules and the fact that games before the ship date show no card. Section 26 to-do table: tick the item. Section 9 (scoring): one sentence noting the "Numbers favored" chip reuses `objectiveSideForMetric`.

## Order of operations

1. Paul approves the two columns in writing. 2. `drizzle/schema.ts` change → Paul runs `scripts/apply-migration.sh` → commit the generated files. 3. Code + tests green locally. 4. One commit, push to `main`. 5. Watch the next afternoon staging email for "Metric notes: 4/4", then open the game page on a phone and confirm nothing new appears before the open (and that the research reads as a story, with the four metrics present but unlabelled), then after the settlement email open the results page. First game with the card is the first one staged after the deploy.
