# Learning Hub — Proposed Curriculum Outline (v1, for review)

**Date:** 2026-07-18
**Status:** Draft for Paul's review — no code yet. Rationale and sources in `learning-hub-research-summary.md`.

## Design rules (from the research)

- **One concept per lesson, ~3 minutes, ends with a 1–2 question quiz.**
- **Five levels (100–500)**, visible ladder, each level unlocks the next. Lessons within a level can be taken in any order except the level capstone, which requires the rest of the level.
- **Anchor to the live game whenever possible:** each lesson ends with a "See it in today's matchup" line generated from the current game's data.
- **Spaced resurfacing:** after a lesson is completed, its quiz question re-appears ~1 and ~3 weeks later (a "review card" on the game page). Ties into the streak.
- **Plain English first.** Each lesson introduces at most one new jargon term, defined on first use — same voice as the beginner `researchSummary`.
- Written on the assumption **Option B (hybrid metric panel)** from the research summary is adopted; if not, Level 200 changes shape.

## Tier stance — DECIDED (Paul, 2026-07-18, locked permanently)

**All education material — every level, every lesson — is Free tier, for good.** Education is the mission; it is never gated. Paid tiers get only the *tools* built on top of the education: the interactive Matchup Scorecard on the pick page, spaced review cards feeding MunyIQ, and similar. (Consistent with the standing membership-tiers position that all research is fully free.)

---

## Level 100 — How the market works (6 lessons)

Goal: a player who has never bought a stock can explain what today's game is measuring.

1. **What a share actually is** — ownership, why it has a price.
2. **Why prices move** — buyers vs. sellers, information, the idea that price = the market's current best guess.
3. **The trading day** — open, close, pre/after-market; why Munymo scores close-to-close.
4. **Percentage change, not price** — why a $2 stock can "beat" a $500 stock; how the game's winner is decided.
5. **Market cap** — company size; big ≠ better, small ≠ cheaper.
6. **Capstone: Read a matchup page** — guided tour of the research summary, metrics panel, and lockout; players make a pick as the exercise.

## Level 200 — Today's setup: what moves a stock in one day (7 lessons)

Goal: the player can articulate *why these two companies today* — the game-relevant level.

1. **Catalysts** — earnings, upgrades/downgrades, M&A, regulation, macro; scheduled vs. surprise.
2. **Earnings day** — why the calendar matters; reports before-open vs. after-close.
3. **Expectations vs. surprise** — why "good news" can drop a stock. *The single most important lesson in the Hub; the Hindsight Spotlight demonstrates it weekly.*
4. **Beta & volatility** — which stock is the bigger mover; movement ≠ direction.
5. **Momentum & volume** — gaps, relative volume, "in play" stocks; % vs. 52-week high.
6. **Short interest** — betting against a stock; squeeze mechanics in one paragraph.
7. **Capstone: The pairing rationale, decoded** — take today's `pairingRationale` and identify the catalyst, the expected mover, and the open question.

## Level 300 — The company underneath (7 lessons)

Goal: the fundamentals vocabulary — the "long game" half of the metrics panel.

1. **Revenue & growth** — the top line; YoY vs. QoQ.
2. **Earnings & EPS** — profit per share; TTM explained.
3. **P/E ratio** — price for a dollar of earnings; expensive vs. cheap is relative (sector, history, growth).
4. **Margins** — gross vs. net; what "quality of earnings" means.
5. **Debt & balance sheet basics** — leverage cuts both ways.
6. **Moats & competition** — why rivals in the same sector diverge (connects to the daily head-to-head format).
7. **Capstone: Two companies, same sector** — compare today's (or a past game's) pair on fundamentals only; then reveal what actually happened that day, teaching that fundamentals ≠ tomorrow.

## Level 400 — The street: who else is in this trade (6 lessons)

Goal: interpret the humans and institutions around a stock.

1. **Analysts** — who they are; Buy/Hold/Sell inflation; why revisions matter more than ratings.
2. **Price targets** — what an average target does and doesn't tell you.
3. **Institutions vs. retail** — who moves the price.
4. **Sentiment & narrative** — sector stories, fear/greed, why narratives overshoot.
5. **Reading financial news critically** — headline vs. substance; sourcing (mirrors the curation agent's own standards).
6. **Capstone: The Hindsight habit** — structured re-read of a past Hindsight Spotlight: what was knowable in advance vs. hindsight bias.

## Level 500 — The combined picture (6 lessons)

Goal: synthesis — from metrics to judgment. The level the whole Hub builds toward.

1. **No metric works alone** — DuPont-style decomposition as the demonstration: one headline number, three moving parts.
2. **Factor lenses** — Value, Quality, Momentum as the professional vocabulary for grouping every metric the player has learned.
3. **Checklists beat hunches** — the Piotroski idea: simple checks, powerful combination.
4. **Horizon discipline** — which metrics answer which question (the "long game" vs. "today's setup" split from the metrics panel, now made explicit as a principle).
5. **The Munymo Matchup Scorecard** — the capstone artifact: Catalyst? → Bigger mover? → Already priced in? → Fundamentals tiebreak? A four-question mental checklist for every daily pick. (Alpha tier: interactive version on the pick page.)
6. **Capstone: Run the scorecard live** — player fills the scorecard for today's game before picking; after results, the Hindsight Spotlight is framed against their scorecard answers.

---

## Integration mechanics (product, not curriculum)

- **Lesson of the day:** the Hub suggests the one lesson most relevant to today's matchup (e.g., an earnings-day matchup surfaces Level 200 #2). Simple tag match between lesson topics and game metadata — no new AI calls needed.
- **Review cards:** completed lessons resurface as single quiz questions on the game page (spaced ~1w/~3w). Correct answers could feed MunyIQ later.
- **Progress:** per-level completion ring; a "Curriculum" page listing levels 100–500 with locked/unlocked states.
- **Content pipeline:** lesson bodies are static authored content (written once, by us with AI drafting, reviewed by Paul) — *not* generated daily. Only the "See it in today's matchup" line is dynamic. This keeps cost ~zero and quality controlled.
- **Glossary:** the cached `MetricExplanationSheet` explanations become a browsable glossary inside the Hub for free.

## Decisions (locked 2026-07-18 — Paul deferred education/metric calls to Claude)

1. **Tiering:** all lessons Free, permanently (Paul, explicit). Paid tiers get tools only.
2. **Lesson completion is purely educational in v1** — no effect on MunyIQ, streaks, or leaderboards. When MunyIQ ships, spaced review cards may feed it (Pro), but the lessons themselves never gate anything.
3. **v1 scope: write and ship Levels 100–200 (13 lessons) first.** The ladder UI shows all five levels with 300–500 marked as coming, so the destination is visible from day one. Validates the format before committing to the full ~32 lessons.
4. **The Scorecard as a *lesson* (Level 500 #5) is free like everything else; the *interactive* Scorecard on the pick page is an Alpha tool.** Any player can run the checklist in their head for free — the paid version is the convenience, not the knowledge.
5. **Metric panel: Option B (hybrid) adopted** — implemented directly 2026-07-18; details in the handover Section 4 table ("Research metrics panel v2").
