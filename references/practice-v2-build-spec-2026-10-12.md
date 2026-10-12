# Practice mode on Scoring v2 — build spec (2026-10-12)

**Decision:** Paul, 2026-10-12, after four days on live v2 ("flows well and I like it"): bring archived-game practice onto the same format. Schema additions approved in writing the same day. Live v2 reference: `references/scoring-v2-build-spec-2026-10-07.md`; the live implementation in `server/routers.ts` (`picks.submitFinal`, `closeAndScoreGame`) and `client/src/pages/DailyGame.tsx` is the pattern to mirror.

**Already done:** `drizzle/schema.ts` `practice_picks` gains `reasonMetric`, `reasonSide`, `confidence`, `reasonScore`, `confidenceScore`. Migration is run by Paul (one-click script) before the push.

## Rules

- A practice play is v2 **iff the game's `daily_games.highlightedMetrics` is non-null**, exactly like live. Games without highlights keep today's legacy practice flow (timed question, 80/20) until the backfill fills them.
- Practice still never touches `daily_scores`, leaderboards or streaks (integrity rule in the schema comment stays).
- Practice settles instantly, so scoring happens in `practice.submitValidation`, using `calculateScoreV2` with `objectiveSideForMetric` from the game's metrics (`metricsSnapshot ?? researchMetrics`, `valuesForMetric` in `server/highlightedMetrics.ts`), the stored `winner`, and the stored pick's reason/side/confidence. Store all five score columns; `totalScore` is the sum.
- `dayKind` for a game with null `dayKind` is computed on read with `classifyDay(perfA, perfB)` (no write needed), so the practice result can show the day-kind pill for every game.

## Server (`server/routers.ts` practiceRouter ~:441-610, `server/db.ts` practice helpers)

- `practice.getGame`: add `highlightedMetrics` and `dayKind` (computed if null) to the explicit projection; keep hiding anything that leaks the result before completion (`winner`, perfs, prices, result text stay hidden until `completedAt`, as today).
- `practice.submitFinal`: accept optional `reasonMetric`, `reasonSide`, `confidence`; when the game has highlights, require all three and validate `reasonMetric` against the list (copy the live `submitFinal` validation). Persist on `practice_picks`.
- `practice.submitValidation`: v2 branch per the rule above; legacy branch unchanged. Return the breakdown (`predictionScore`, `reasonScore`, `confidenceScore`, `validationScore`, `totalScore`, `dayKind`, margin) so the client renders the result without a second query.
- `getPracticeStats` / practice history: include the two new columns where score rows are returned.
- **Backfill as an admin button**, not a script: `admin.backfillHighlights` mutation + a button on `/admin` next to "Run Curation Now" ("Backfill highlights for the archive"). For every `result_published` game with null `highlightedMetrics`, ask Mo (the same model/client as curation, no web search, cached system prompt) to choose four from the stored panel using the exact "highlightedMetrics rules" text from `curationAgent.ts`, passing both companies' metric values; validate with `validateHighlightedMetrics`; store; also store `dayKind` for every published game where null. Idempotent, processes in batches of 10 with an in-flight guard like `runCuration`, logs per game, returns `{processed, filled, skipped, failed}`. Games whose panel has fewer than four distinct usable metrics are skipped (left legacy).
- Tests: v2 practice scoring on a fixture (right call + consistent reason + confident + check right = 100; inconsistent reason = call + conf + check only; legacy game unchanged) in `server/munymo.test.ts`.

## Client

- `client/src/pages/PracticeGame.tsx` (own copy of the step machine): for v2 games add the "Your Reason" step between research and final (same two questions and copy as `DailyGame.tsx`: four highlighted metrics with both values, then "Which company does X favor?"), highlight the four rows in the metrics table (amber + chip, Price trend highlights the chart), confidence buttons on the final step with `{ifRight} / {ifWrong}` from `CONFIDENCE_TABLE × SCORE_WEIGHTS.conf`, `ValidationModal untimed`, and a v2 result card: day-kind pill with margin, four-line breakdown with `SCORE_WEIGHTS` maxima, total, then the existing Hindsight Spotlight. Legacy games keep the current flow. Reuse `displayCompanyName`. Never hardcode weights.
- `client/src/pages/Practice.tsx`: copy no longer says practice differs in scoring; one line: "Scored the same way as the live game, instantly."
- `client/src/pages/MyDashboard.tsx` practice block: show the practice average as today; the "projected rank" caveat stays.
- Admin page: the backfill button with its result toast.

## Docs

- Handover Section 4: practice row → "Practice on Scoring v2 (2026-10-12)"; remove "practice stays on 80/20 during the trial" wording in the v2 row and Section 9; note the backfill button in Section 20/26 as appropriate.
- `references/scoring-and-learning-discussions-2026-10-05.md` decisions log: one line.

## Order

1. Code + tests green. 2. Paul runs the migration script. 3. Push. 4. Paul clicks "Backfill highlights for the archive" on `/admin` and reports the counts; until then archived games without highlights play legacy, which is safe.
