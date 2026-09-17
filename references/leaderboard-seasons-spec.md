# Leaderboard Seasons and the Competition Engine

**Date:** 2026-09-17. **Approved by Paul** in chat the same day ("Yes… it fits perfectly"). Implemented by Fable 5.1.

## Why

The all-time board ranked players by Average Daily Score after 10 games. On a one-day head-to-head that is close to a coin flip, ten games carries a luck band of roughly ±13 points, so the gaps between ranks were smaller than the noise. An all-time average never settles (a lucky ten-game newcomer jumps to the top; a 100-game veteran regresses to 50), never resets (no reason to look on a Tuesday, no way for a late joiner to catch the founder), and was populated almost entirely by five test bots with human names. See `references/product-review-2026-09-17.md` Section 4.

## The model

A **competition** is four things: a **scope** (everyone, a league, two people), a **window** (a month, a week, custom dates), a **metric** (total points, average, accuracy, streak) and an **eligibility rule** (minimum games). Every per-game score already exists in `daily_scores`, so any competition is a query over that table. The engine is `getSeasonStandings(from, to, memberIds?)` in `server/db.ts` plus the pure ranking helpers in `shared/leaderboard.ts`. The global season and the all-time board are the first two instances. Leagues, head-to-head and sponsor events are later instances of the same engine and will need a `competitions` table (definition + members) — **that is a schema change and will be proposed separately for approval.** Nothing in this phase touches the schema.

## Phase 1 (this change)

1. **Season board (default tab).** Calendar month by `gameDate` (the market date). Ranked by **total points**. Everyone with at least one scored game in the month is on it from game one; no qualification gate, because a total is not an average. Ties share a position (golf ranking, existing helper); among ties, the higher average is listed first, then lower user id. Resets on the 1st. Past months listed below with their winner.
2. **Percentiles.** The payload carries `percentile` (rank / players, rounded up to a whole percent). The UI shows "Top N%" beside the rank only when the board has at least 20 players; below that a percentile reads as a joke.
3. **Coin Flip benchmark.** One tester bot (id 870002) stays on every public board, renamed "Coin Flip", marked as a benchmark with a dice icon and a muted row. It picks at random, so it is the honest answer to "is this luck?". A signed-in player's card says how far ahead of or behind Coin Flip they are this month. The other four bots (870004–870010) and the erased one (870012) keep playing for pipeline testing but are hidden from every public surface. All six are excluded from community stats ("How the crowd voted"), which are recomputed for history by `scripts/apply-bot-policy.ts`.
4. **All-time tab.** The existing average-score board with its 10-game rule and the provisional list, labelled for what it is, with "played X of Y available" beside each average so a selective player's number reads honestly. Y counts published games since that player's first scored game.
5. **Dashboard.** The "Leaderboard" stat card becomes the season standing: points, games, rank.
6. **Copy.** Landing feature pill and the leaderboard page explanations rewritten. Practice's projected rank names the all-time board.

## Not in this phase

- `competitions` table, leagues, head-to-head, sponsor events (needs schema approval).
- Weekly seasons (the engine supports any window; the UI exposes months only).
- A confidence option on the final pick (calibration scoring) — parked for MunyIQ.
- Retiring the hidden bots entirely: Paul's decision is to switch them off once real players have qualified to replace them.
