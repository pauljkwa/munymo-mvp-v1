# Learning Hub — Research Summary (Phase 1)

**Date:** 2026-07-18
**Status:** For Paul's review. No code changes. Companion document: `learning-hub-curriculum-outline.md`.

This document covers two things, per Paul's direction:

1. **A review of the current six research metrics** shown to players each game — are they best practice for a *single-day* stock prediction, before we commit to them long-term?
2. **Best practices for teaching stock-analysis metrics** — individually and as a combined picture — drawn from education research and established platforms.

---

## Part A — Review of the current metric set

### What we show today

The curation agent (`references/daily-curation-agent-prompt.md`, Step 4) collects six metrics per company:

| Metric | Horizon it actually informs |
|---|---|
| Market Cap | Context / sizing — not predictive of direction |
| P/E Ratio (TTM) | Long-term valuation (years) |
| Revenue Growth (YoY %) | Long-term fundamentals (quarters–years) |
| EPS (TTM) | Long-term fundamentals |
| 52-Week High / Low | Weak momentum/context signal |
| Analyst Consensus + price target | Medium-term (months) |

### The mismatch

The game asks players to predict **which of two stocks outperforms in one trading session**. The research literature is fairly unambiguous that the current metrics answer a different question:

- **Valuation ratios (P/E etc.) have essentially no predictive power for daily moves.** They predict *long-run* returns; on a one-day horizon P/E is at best a weak signal ([Morningstar](https://www.morningstar.com/markets/price-primarily-predicts-future-returns-not-future-earnings-growth), [LSEG/FTSE Russell](https://www.lseg.com/en/insights/ftse-russell/do-valuations-predict-long-term-returns-examining-us-equities-through-various-size-and-style-indices)).
- **Single-day moves are catalyst-driven.** The dominant drivers are scheduled and unscheduled events: earnings releases, analyst upgrades/downgrades, M&A, regulatory decisions, executive changes, macro data, and sector narratives — and the move depends on *surprise vs. expectations*, not on the level of any fundamental ratio ([TradeStation on the 7 catalyst types](https://www.tradestation.com/insights/2025/09/21/7-catalysts-stock-movement-2/), [Stock catalyst — Wikipedia](https://en.wikipedia.org/wiki/Stock_catalyst)).
- **The short-horizon signals with actual documented predictive power** are: earnings surprise / post-earnings-announcement drift ([Quantpedia](https://quantpedia.com/strategies/post-earnings-announcement-effect), [ScienceDirect PEAD review](https://www.sciencedirect.com/science/article/pii/S2214635020303750)), analyst forecast *revisions* (the change, not the standing consensus), and short interest ([Diether et al., "Can Short-sellers Predict Returns? Daily Evidence"](https://www.cis.upenn.edu/~mkearns/finread/short_sellers_predict_returns.pdf)). Practitioner pre-open checklists focus on gaps, relative volume, and pending events rather than fundamentals ([Schwab on fundamentals vs. technicals](https://www.schwab.com/learn/story/how-to-pick-stocks-using-fundamental-and-technical-analysis)).
- **Volatility context matters for a head-to-head.** A high-beta stock will usually out-move a low-beta one in *either* direction on a given day; players comparing two companies benefit from knowing which one is the "mover." Beta on its own doesn't predict direction, but it frames the matchup ([CXO Advisory on beta](https://www.cxoadvisory.com/volatility-effects/the-long-and-short-of-beta/)).

**Conclusion: the current set was chosen as a generic "stock research" panel, not for this game's question.** Manus's six metrics are all defensible for teaching long-term investing, but none of them helps a player reason about *tomorrow specifically* — the pairing rationale and research paragraphs currently carry all of that weight on their own.

### What a fit-for-purpose panel looks like

A single-day matchup panel should answer three questions a player actually faces:

1. **What's the live catalyst?** (why these two, why now)
2. **Which stock moves more when it moves?** (volatility context)
3. **Which way is the pressure pointing?** (expectations, positioning, momentum)

Candidate replacement/additional metrics, all obtainable from Yahoo Finance (no new data source needed):

| Candidate metric | What it teaches | Single-day relevance |
|---|---|---|
| **Next earnings date** (and "reports before open / after close / not this week") | Event risk | High — earnings day is the single biggest scheduled mover |
| **Beta (5Y)** | Volatility / how much a stock moves with the market | High — frames which stock is the bigger mover |
| **Prior-day % move + relative volume** | Momentum and attention | High — gap-and-go vs. fade is core day-horizon intuition |
| **Short interest (% of float)** | Positioning / squeeze risk | Medium-high — documented short-term signal |
| **% vs. 52-week high** (replaces raw 52-Week Range) | Momentum framing | Medium — same data, more interpretable |
| **Analyst consensus + recent revisions** (keep, reframe) | Expectations | Medium — revisions matter more than the standing rating |

### Recommended posture (Paul to decide)

Three options, in rising order of change:

- **Option A — keep as-is.** Defensible only if Munymo's teaching mission is "long-term investing literacy, with the daily game as the engagement hook." Weakness: the metrics panel never helps players play the actual game, which players will eventually notice.
- **Option B — hybrid (recommended; ADOPTED and implemented 2026-07-18).** Final panel, 8 metrics per company in two labelled groups: **"The Long Game"** (Market Cap, P/E Ratio, Revenue Growth, Analyst Consensus) and **"Game-Day Setup"** (Next Earnings, Beta, Last Session Move, vs 52-Week High). EPS (TTM) was dropped (P/E already embeds it and raw EPS is the least comparable cross-company number); 52-Week Range became "vs 52-Week High". The two-group split is itself a teaching device: it makes the horizon distinction explicit every single day and maps 1:1 onto the curriculum in the companion outline. ("Game-Day Setup" was chosen over "Today's Setup" so archive pages never show stale relative time.)
- **Option C — full short-horizon panel.** Maximum game relevance, but discards the fundamentals teaching surface and narrows Munymo to a trading game — runs against the education mission and the Learning Hub itself.

Option B touches: the curation prompt (Step 4 + `researchMetrics` JSON), the game-page metrics rendering, and nothing in the schema (`researchMetrics` is a free-form JSON map of label → value). The existing `MetricExplanationSheet` already handles arbitrary labels, so new metrics get "What does this mean?" explanations for free.

---

## Part B — Best practices for teaching stock-analysis metrics

### 1. Microlearning is the proven format

Morningstar's Investing Classroom — the most-copied investing curriculum — uses **100+ courses of ~10 minutes each, every one ending in a quiz**, organised into difficulty levels 100 → 500 ([Morningstar Investing Classroom](https://www.morningstar.com/start-investing/classroom), [structure review](https://investingtothrive.com/review-morningstar-stock-investing-education/)). One concept per lesson; a quiz to close the loop; a visible level ladder. This maps perfectly onto Munymo's daily cadence: **one short lesson per game day**.

### 2. Experiential beats lecture — and Munymo already has the experience

Financial-literacy research consistently finds simulation/application-based programs outperform lecture formats; learners who apply concepts to live decisions retain more and change behaviour ([Frontiers in Education review](https://www.frontiersin.org/journals/education/articles/10.3389/feduc.2024.1397060/full)). Gamified financial education studies report large knowledge gains (~31% score improvement) and strong engagement effects ([IEEE study on gamified financial learning](https://ieeexplore.ieee.org/document/11158633/), [EPALE on gamification for adult financial literacy](https://epale.ec.europa.eu/en/blog/gamification-and-other-strategies-develop-financial-literacy-adult-learners)).

Munymo's structural advantage: most platforms teach a concept, then contrive an exercise. Munymo has a **real decision every day** (the pick), a **real outcome 24 hours later** (the result), and a **built-in debrief** (Hindsight Spotlight). The Learning Hub shouldn't be a separate library bolted on the side — each lesson should attach to today's matchup ("today's lesson: Beta — notice which of NEE/DUK is the bigger mover and why that matters for your pick").

### 3. Spaced repetition and the daily streak

Duolingo's core mechanics — spacing review just before forgetting, streaks for habit, one bite-sized unit per day, adaptive review of weak areas — are the state of the art for retention in daily-cadence apps ([Duolingo: how we learn how you learn](https://blog.duolingo.com/how-we-learn-how-you-learn/), [instructional-design analysis](https://www.transform-elearning.com/duolingo-instructional-design-strategies/)). Munymo already has the streak (and MunyIQ will make it critical). Practical translation: lessons recur — a metric taught in week 1 resurfaces as a quiz question in week 3, ideally on a game day where that metric is the interesting one.

### 4. Teaching the combined picture: named frameworks, not metric soup

The pedagogy of "many metrics → one judgment" is well developed in investing education:

- **Checklist/scorecard approach** — the Piotroski F-Score is the canonical example: nine simple binary checks that sum to a score. Its teaching power is that each check is trivially understandable, yet the *combination* is what works ([Piotroski F-Score explainer](https://pictureperfectportfolios.com/the-piotroski-f-score-a-value-investors-essential-tool/), [Alpha Architect](https://alphaarchitect.com/value-investing-factor-research-how-to-improve-the-piotroski-f-score-measure/)).
- **Factor lenses** — Value / Quality / Momentum (+ Size, Volatility) is the standard professional vocabulary for grouping metrics; research shows combined factors beat any single factor, with Quality + Momentum the standout pairing ([MSCI factor models at 50](https://www.msci.com/research-and-insights/blog-post/factor-models-at-50-innovation-that-changed-investing), [multi-factor overview](https://factorlab.medium.com/multi-factor-investing-strategies-combinations-and-performance-analysis-e650cf6e6875)).
- **Decomposition** — DuPont analysis teaches that a headline number (ROE) is a *product of parts* (margin × turnover × leverage), which is the cleanest way to teach "one number never tells the story."
- **Expectations framing** — for the daily game specifically, the unifying idea is *price moves on surprise vs. expectations*, which is why the same "good" earnings can drop a stock. This is the single most valuable combined-picture insight for Munymo players and is what the Hindsight Spotlight already demonstrates daily.

The curriculum outline turns these into a capstone: a **Munymo Matchup Scorecard** — a simple player-facing checklist (catalyst? / bigger mover? / expectations already priced in? / fundamentals tiebreak?) that players learn piece-by-piece and can eventually run in their heads before every pick.

### 5. Structural principles adopted for the outline

- **Levels, not a wall of articles** — 100→500 ladder (Morningstar), visible progress.
- **One concept per lesson, ~3 minutes**, quiz to close (Morningstar/Duolingo; shorter than Morningstar's 10 min because Munymo's session is a companion to the daily pick, not a study block).
- **Every lesson anchors to the live game** where possible (experiential principle).
- **Frameworks before formulas at the top of the ladder** — players graduate from "what is P/E" to "which lens does P/E belong to, and when does it not matter."
- **Spaced quiz resurfacing** tied to the streak.
- **Plain-English first** — consistent with the existing `researchSummary` beginner tier and `MetricExplanationSheet` voice; jargon is introduced deliberately, one term at a time, never assumed.

---

## Existing assets the Hub builds on (inventory)

| Asset | Where | Role in Learning Hub |
|---|---|---|
| Daily research content + beginner summary | `researchContent` / `researchSummary` per game | Daily "reading" the lesson attaches to |
| Metrics panel + `MetricExplanationSheet` | game page | Per-metric plain-English explainers (LLM-generated, cached) — the seed of the metric glossary |
| Validation question | per game | Existing daily quiz mechanic — can be steered to reinforce the current lesson |
| Hindsight Spotlight | per game result | The debrief — already teaches expectations-vs-outcome daily |
| Streak (+ future MunyIQ) | player state | Spacing/retention engine and paid-tier hook |

## Decisions — RESOLVED 2026-07-18

Paul reviewed and deferred the education/metric calls to Claude ("I don't know what I don't know"), with one explicit lock of his own:

1. **Metric set: Option B (hybrid) adopted and implemented directly 2026-07-18** (Paul approved Fable building inline rather than the usual spec-for-implementer flow, given available usage headroom). See the "Research metrics panel v2" row in the handover Section 4 table for what changed.
2. **Curriculum:** outline adopted as drafted; v1 ships Levels 100–200 first (see decisions section in `learning-hub-curriculum-outline.md`).
3. **Tier gating: all education material is Free, permanently (Paul, explicit, locked "for good").** Only interactive tools (pick-page Scorecard, review-cards→MunyIQ) may be tiered.
