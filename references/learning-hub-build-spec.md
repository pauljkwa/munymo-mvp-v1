# Learning Hub — Build Specification (v1)

**Date:** 2026-07-18
**Author:** Claude Fable 5 (spec) — for implementation by **Claude Sonnet 5**
**Reviewed by:** Fable reviews the implementer's diff before merge (analyst/spec/implementer workflow).
**Companion docs:** `learning-hub-research-summary.md` (research + rationale), `learning-hub-curriculum-outline.md` (curriculum decisions).

---

## 0. How to run this build (for Paul)

Start a fresh Claude Code session with model **Sonnet 5** in this repository and paste:

> Read `references/learning-hub-build-spec.md` and implement it exactly. Work in phases as the spec defines them, and stop at each STOP-POINT for review. Follow every rule in `CLAUDE.md`. Do not push schema changes — the spec flags the one schema addition that needs Paul's explicit written approval first.

Fable reviews the diff at each stop-point before it merges.

---

## 1. Context the implementer needs

Munymo is a daily stock-picking game (React 19 + Tailwind 4 + shadcn/ui + Wouter on the client; Express 4 + tRPC 11 + Drizzle/MySQL on the server; Clerk auth; deployed on Railway from `main`). Each trading day, players see two companies and pick which will have the higher closing % change. The game page shows AI-curated research including a metrics panel rendered in two groups: **"The Long Game"** (fundamentals) and **"Game-Day Setup"** (single-session context) — see `client/src/lib/metricGroups.ts`.

The Learning Hub is a structured curriculum teaching stock-analysis metrics — individually and as a combined picture. Decisions already locked (do not revisit):

- **All lesson content is Free tier, permanently.** No gating anywhere in the Hub.
- Five levels (100–500), ~32 lessons, one concept per lesson, ~3-minute read, each ending in a quiz.
- Lessons anchor to the live daily game wherever possible.
- v1 ships in phases (Section 8) but this spec covers the entire curriculum.
- Lesson bodies are **static authored content** checked into the repo — not generated at runtime. Zero ongoing AI cost.

Hard repo rules (from `CLAUDE.md` — these are not optional):
- Read every file before editing it. `npx tsc --noEmit` and `pnpm test` must pass before any commit.
- **Schema changes require Paul's written approval before `pnpm db:push`** — see Section 6. Only ever ADD columns/tables.
- Any commit changing a feature's status updates `references/munymo-handover-v2.md` Section 4 in the same commit.
- Never force-push `main`. Every push to `main` auto-deploys to Railway.

---

## 2. Voice & style guide for lesson content

Every lesson body must follow these rules. This is the quality bar; Fable will review content against it.

1. **Plain English first.** Write as if explaining to a smart friend who has never bought a stock. Same voice as the existing static explanations in `server/_core/metricExplanations.ts` — read three of them before writing anything.
2. **At most ONE new jargon term per lesson**, defined in the sentence that introduces it. Terms already taught in earlier lessons may be reused freely.
3. **~200–300 words per lesson body.** Three to five short paragraphs. No headers inside the body, no bullet lists except where a lesson brief explicitly calls for one.
4. **No relative time, ever.** No "today", "recently", "this year" pinned to real events. Lessons are evergreen — they will be read for years. Refer to the game abstractly ("the game day", "the matchup"), never to specific dates or current companies.
5. **No real-company claims that can go stale.** Use hypothetical companies ("imagine a grocery chain...") or fully generic framing. Never cite a real company's current P/E, price, or market cap in a lesson body.
6. **Always end with the matchup connection**: the final paragraph tells the player exactly where to see this concept in the daily game (e.g. "You'll find Beta in the Game-Day Setup section of every matchup's metrics panel — check which company's is higher before your next pick.").
7. **No financial advice.** Lessons teach how to read information, never what to buy. Do not use "you should invest", "good investment", or similar phrasing.
8. **Quizzes test the concept, not memory of the lesson's exact wording.** One question per lesson, `multiple_choice` (4 options) or `true_false`. The wrong options must be plausible misconceptions, not jokes. Include a one-sentence `explanation` shown after answering, whether right or wrong.

---

## 3. Content model & file layout

Create `client/src/content/lessons/` with one file per level plus a barrel:

```
client/src/content/lessons/types.ts      — shared types (below)
client/src/content/lessons/level100.ts
client/src/content/lessons/level200.ts
client/src/content/lessons/level300.ts
client/src/content/lessons/level400.ts
client/src/content/lessons/level500.ts
client/src/content/lessons/index.ts      — exports ALL_LEVELS: Level[]
```

```ts
// types.ts
export interface LessonQuiz {
  questionType: "multiple_choice" | "true_false";
  questionText: string;
  options: string[] | null;        // 4 strings for multiple_choice, null for true_false
  correctAnswer: string;           // exact option text, or "True"/"False"
  explanation: string;             // one sentence, shown after answering
}

export interface Lesson {
  id: string;                      // stable, e.g. "l100-1" — NEVER change once shipped (progress rows reference it)
  level: 100 | 200 | 300 | 400 | 500;
  order: number;                   // position within level, 1-based
  title: string;
  jargonTerm: string | null;       // the one new term this lesson introduces, or null
  body: string;                    // the lesson prose (plain text, \n\n between paragraphs)
  matchupHook: string;             // one sentence: where to see this in the daily game
  quiz: LessonQuiz;
  isCapstone: boolean;             // capstones require the rest of the level to be complete
  tags: string[];                  // for lesson-of-the-day matching, from the vocabulary in Section 7
}

export interface Level {
  level: 100 | 200 | 300 | 400 | 500;
  title: string;                   // e.g. "How the Market Works"
  goal: string;                    // one sentence, shown on the level card
  lessons: Lesson[];
}
```

Rendering note: lesson `body` paragraphs render like the existing research content (`whitespace-pre-wrap` prose) — no markdown parsing needed.

---

## 4. The complete curriculum — all 32 lesson briefs

Each brief below gives: title — concept to teach; the allowed jargon term in *italics*; specific points that MUST appear. The implementer writes the full body, matchupHook, and quiz for each, following Section 2.

### Level 100 — "How the Market Works" (6 lessons)
Goal: a player who has never bought a stock can explain what the daily game measures.

1. **What a Share Actually Is** — ownership of a slice of a company; why it has a price at all (someone will pay it); *share*. Must include: shares exist in fixed quantities; owning one means owning a fraction of the business.
2. **Why Prices Move** — prices are set by buyers and sellers agreeing; price = the market's current best guess of what the company is worth; new information shifts the guess. No jargon term. Must include: nobody sets the price centrally.
3. **The Trading Day** — market open and close; pre-market/after-hours exist; why Munymo scores close-to-close; *closing price*. Must include: the close is the day's settled verdict.
4. **Percentage Change, Not Price** — why a $2 stock can beat a $500 stock in the game; % change normalises size; *percentage change*. Must include: a worked toy example with two made-up prices.
5. **Market Cap** — company size = price × shares outstanding; big ≠ better, small ≠ cheaper; *market capitalisation*. Must include: why a high share price alone tells you nothing about company size.
6. **CAPSTONE: Reading a Matchup Page** — guided tour of the game page: pairing rationale, research summary, the two metric groups, lockout. No new jargon. Must include: the two metric group names and what question each answers. `isCapstone: true`.

### Level 200 — "Game-Day Setup: What Moves a Stock in One Day" (7 lessons)
Goal: the player can articulate why *these two companies on this day* — the game-relevant level.

1. **Catalysts** — stocks need a reason to move; scheduled (earnings, product launches, rulings) vs. surprise (M&A, executive exits) events; *catalyst*. Must include: most big single-day moves trace to a nameable event.
2. **Earnings Day** — the quarterly report is the biggest scheduled catalyst; before-open vs. after-close timing; *earnings report*. Must include: the days around a report are jumpier than normal.
3. **Expectations vs. Surprise** — the single most important lesson in the Hub. Price already contains what everyone expects; only the *difference* from expectations moves it; that's why "good" results can drop a stock. No new jargon (build on "earnings report"). Must include: a hypothetical where a company grows 20% and falls, because 25% was expected.
4. **Beta & Volatility** — which stock is the bigger mover; beta measures swing size vs. the market; movement ≠ direction; *beta*. Must include: in a head-to-head, higher beta usually means bigger move either way.
5. **Momentum & the 52-Week High** — stocks near their high have been rewarded lately; momentum can continue or snap back; *momentum*. Must include: distance below the 52-week high as a quick momentum reading.
6. **Short Interest** — some investors bet on falls; heavy shorting = pessimism, but also fuel for sharp rebounds; *short selling*. Must include: a one-paragraph plain-English squeeze description. (Not currently in the metrics panel — the matchupHook should point to research content instead.)
7. **CAPSTONE: Decoding the Pairing Rationale** — walk through reading a pairing rationale: find the catalyst, the expected mover, the open question. No new jargon. `isCapstone: true`.

### Level 300 — "The Company Underneath" (7 lessons)
Goal: the fundamentals vocabulary — "The Long Game" half of the metrics panel.

1. **Revenue & Growth** — the top line; sales before any costs; year-over-year comparison; *revenue*. Must include: why growth rate matters more than absolute size for judging momentum of the business.
2. **Earnings & EPS** — profit after costs; per-share so owners can see their slice; trailing twelve months; *EPS (earnings per share)*. Must include: revenue can grow while earnings shrink, and what that means.
3. **The P/E Ratio** — price for a dollar of earnings; high P/E = high expectations, not necessarily overpriced; comparisons only make sense within context (sector, growth); *P/E ratio*. Must include: two hypothetical companies with the same price but different earnings.
4. **Margins** — how much of each sales dollar survives as profit; software vs. grocery-store margins as the classic contrast; *profit margin*. Must include: margin differences explain why similar-revenue companies can be worth wildly different amounts.
5. **Debt & the Balance Sheet** — borrowed money amplifies both good and bad years; *leverage*. Must include: why high debt makes a stock more sensitive to bad news and interest rates.
6. **Moats & Competition** — durable advantages (brand, switching costs, network effects); why same-sector rivals diverge over years; *moat*. Must include: connect to the game's head-to-head format — every matchup is implicitly a moat comparison.
7. **CAPSTONE: Fundamentals Don't Predict a Day** — the horizon lesson from the fundamentals side: two companies can differ hugely on fundamentals while the *day* goes to either one; fundamentals answer "the long game", catalysts answer "the game day". No new jargon. `isCapstone: true`.

### Level 400 — "The Street: Who Else Is in This Trade" (6 lessons)
Goal: interpret the humans and institutions around a stock.

1. **Analysts** — who they are, what Buy/Hold/Sell means; ratings skew optimistic; *analyst rating*. Must include: a change in rating (upgrade/downgrade) moves prices more than the standing rating.
2. **Price Targets** — the average 12-month target; useful as a gap-to-current-price reading, not a promise; *price target*. Must include: targets trail the price as much as they lead it.
3. **Institutions vs. Retail** — pension funds, index funds, hedge funds move most of the money; individual investors are a small slice; *institutional investor*. Must include: big moves usually mean big money changed its mind.
4. **Sentiment & Narrative** — sectors move on stories (AI, rates, oil); narratives overshoot in both directions; *sentiment*. Must include: a stock can move on its sector's story with no company news at all.
5. **Reading Financial News Critically** — headline vs. substance; who published it and why; anonymous "sources say"; the difference between reported numbers and commentary. No new jargon. Must include: the habit of asking "what would make this story wrong?"
6. **CAPSTONE: The Hindsight Habit** — how to re-read a finished game's Hindsight Spotlight: what was knowable before vs. only after; *hindsight bias*. Must include: the practice of writing down your reason BEFORE the result, then comparing. `isCapstone: true`.

### Level 500 — "The Combined Picture" (6 lessons)
Goal: synthesis — from metrics to judgment. The level the whole Hub builds toward.

1. **No Metric Works Alone** — one headline number always decomposes into parts (profit = margin × sales; a "cheap" P/E may hide shrinking earnings); the DuPont idea in plain English, without the formula. No new jargon. Must include: a hypothetical where a single impressive number falls apart on decomposition.
2. **Factor Lenses: Value, Quality, Momentum** — the professional vocabulary for grouping every metric the player has learned; each lesson-taught metric assigned to its lens; *factor*. Must include: a three-column mental sorting of the panel's metrics.
3. **Checklists Beat Hunches** — the Piotroski insight: simple checks, individually obvious, jointly powerful; consistency beats brilliance; *checklist*. Must include: why professionals use scorecards even when they "know" the answer.
4. **Horizon Discipline** — the Hub's spine stated as a principle: every metric answers a question at a specific time horizon; using a long-horizon metric to answer a one-day question is the most common beginner mistake. No new jargon. Must include: explicit reference to the two metric-panel groups as the daily reminder of this principle.
5. **The Munymo Matchup Scorecard** — the capstone artifact taught as a lesson: four questions in order — (1) What's the catalyst? (2) Which is the bigger mover? (3) Is the news already priced in? (4) Fundamentals as tiebreak. No new jargon. Must include: the four questions verbatim and one worked hypothetical run-through.
6. **CAPSTONE: Run It Live** — instructs the player to run the Scorecard on the current live matchup before picking, write their answer down, and compare against the Hindsight Spotlight after results. `isCapstone: true`. Must include: the point is calibration over time, not single-day wins.

---

## 5. UI specification

### Routes (Wouter, in `client/src/App.tsx`)
- `/learn` — Hub home: level ladder.
- `/learn/:lessonId` — single lesson page.

Both are **public** (education is free; also good for SEO/GEO). Progress features activate only when signed in.

### `/learn` — Hub home
- `PublicLayout` (same as Research Hub — read `client/src/pages/ResearchHub.tsx` first and match its framing/styling: `card-glass`, `animate-fade-up`, CSS variables).
- Header: "Learning Hub" + one-line promise ("Learn to read the market, one game day at a time — free for everyone.").
- Five level cards (100→500): level number, title, goal sentence, lesson count, and — when signed in — a completion ring (n of m). Levels are **visibly sequential but not locked**: any lesson is openable at any time (education is free; the ordering is guidance, not a gate). Capstone lessons show a small "Capstone" badge.
- Each level card expands (accordion or navigates) to its lesson list: order number, title, ✓ when completed.

### `/learn/:lessonId` — Lesson page
- Title, level chip, "~3 min" chip, the jargon term chip when present ("New term: Beta").
- Body rendered as prose paragraphs (`whitespace-pre-wrap` like research content).
- The `matchupHook` in a highlighted callout box, with a link to `/game` (signed-in) — label it "See it in today's matchup". The word "today" is acceptable HERE only, because this page always refers to the live game, never an archived one.
- Quiz block below the body: reuse the visual style of the game's validation question (read the validation-question rendering in `client/src/pages/DailyGame.tsx` first). On answer: show correct/incorrect + the `explanation`, then a "Mark complete →" action (auto-fires on correct answer; also available on incorrect — completion is about engagement, not passing).
- Prev/next lesson navigation within the level; "Back to Learning Hub".
- Signed-out users can read and take the quiz; completion shows a sign-in prompt instead of persisting.

### Game-page integration — "Lesson of the day"
On the game page (`DailyGame.tsx`), below the research section, a single slim card: "📚 Lesson for this matchup: **{title}** — {one-line goal} → Start (3 min)". Selection logic in Section 7. Dismissable per day (localStorage) so it never nags.

---

## 6. Backend specification

### Schema — ⚠️ STOP-POINT: requires Paul's written approval before `pnpm db:push`
One additive table, nothing else touched:

```
lesson_progress
  id            bigint pk autoincrement
  userId        (same type/convention as other user FKs — read schema first)
  lessonId      varchar(32)          — Lesson.id, e.g. "l100-1"
  completedAt   timestamp
  quizCorrect   boolean              — whether their first quiz attempt was correct
  UNIQUE (userId, lessonId)
```

`quizCorrect` is recorded for the future MunyIQ/review-card work — capture it now, use it later.

### tRPC (`server/routers.ts`, follow existing router patterns exactly)
- `learn.getProgress` — protected. Returns the caller's `{ lessonId, quizCorrect }[]`.
- `learn.markComplete` — protected. Input `{ lessonId, quizCorrect }`; validates `lessonId` against the known lesson-id list (share the id list via a small server-safe module — the content files live under `client/`, so export a plain array of valid ids from a location importable by both, e.g. `shared/lessonIds.ts`, kept in sync by a unit test that imports `ALL_LEVELS` and compares). Upsert, first write wins for `quizCorrect`.

Lesson content itself is never served by the API — it ships in the client bundle.

---

## 7. Lesson-of-the-day mapping

Deterministic, zero AI calls. Tags vocabulary for `Lesson.tags`:
`earnings`, `catalyst`, `beta`, `momentum`, `short-interest`, `analyst`, `sector-story`, `fundamentals`, `valuation`, `scorecard`, `basics`.

Selection for the live game, first match wins:
1. If either company's "Next Earnings" metric value contains the game date's month+day → the `earnings`-tagged Level 200 lesson.
2. If either Beta value parses ≥ 1.3 → the `beta` lesson.
3. If either "vs 52-Week High" parses ≤ 5% below high → the `momentum` lesson.
4. If the pairing rationale mentions an analyst action (case-insensitive "upgrade"/"downgrade"/"price target") → the `analyst` lesson.
5. Otherwise rotate: `gameId % remainingEligibleLessons` over lessons tagged `catalyst`, `fundamentals`, `valuation`, `sector-story`, `basics`.

If the user has completed the selected lesson, fall through to the next rule (then the rotation). Implement as a pure function in `client/src/lib/lessonOfTheDay.ts` with unit tests (vitest config only picks up `server/**` tests — put the test in `server/lessonOfTheDay.test.ts` importing via the `@` alias, same pattern as `server/metricGroups.test.ts`).

---

## 8. Phasing & stop-points

**Phase A — infrastructure + Levels 100–200 content.**
Types, content files for levels 100 and 200 (13 lessons), `/learn` + `/learn/:lessonId` pages with levels 300–500 shown as "Coming soon" cards (using the titles/goals from this spec), progress endpoints (schema stop-point first), game-page lesson-of-the-day card.
→ **STOP: Fable reviews diff + all 13 lesson bodies before push.**

**Phase B — Levels 300–500 content.**
The remaining 19 lessons, remove "Coming soon" state.
→ **STOP: Fable reviews content before push.**

Explicitly OUT of scope for v1 (do not build): spaced-repetition review cards, the interactive pick-page Scorecard tool, MunyIQ integration, any tier gating, localisation.

## 9. Acceptance criteria
- `npx tsc --noEmit` and `pnpm test` pass; new unit tests exist for: lesson-id/`shared/lessonIds.ts` sync, every lesson satisfying structural rules (id format, level/order uniqueness, quiz `correctAnswer` ∈ options or True/False, non-empty body/matchupHook, capstone flags per this spec), and lesson-of-the-day selection.
- No lesson body violates Section 2 (spot-checked by Fable at each stop-point; the structural parts — one-jargon-term is not machine-checkable, but body length ~200–300 words IS: test 150–400 word tolerance).
- Handover Section 4 gets a "Learning Hub" row in the same commit that ships Phase A.
- Zero schema changes beyond the approved `lesson_progress` table; zero new environment variables; zero new dependencies.
