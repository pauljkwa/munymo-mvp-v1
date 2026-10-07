# Scoring homework: findings (2026-10-07)

**Brief:** `references/fable-prompt-scoring-homework-2026-10-07.md`. Research and design only; nothing here is built into the live game.
**Sample games (private, phone-sized):** https://claude.ai/artifact/7ZUsfySS8gRx9kzrkZVnSt — recipe A `#a`, B `#b`, C `#c`. One real past matchup, Netflix vs Disney, June 23, 2026, with the brief and the metrics players actually saw (committed in `scripts/insert-monday-game.mjs`).
**Status of the archive replay:** blocked. See Section 5.
**Prototype of Fable's recommended day (added later on 2026-10-07, after discussion):** https://claude.ai/artifact/NkE3Uxiiw1GHcn9RY5dp38 — call 40 / your reason 25 / confidence 20 / reading check 15, weights editable in a "prototype tools" card. Version 3 runs on the real Western Digital vs Seagate game of 2026-10-05 (id 2250001) with its full data: pairing rationale and source link, Mo's brief and full analysis, 60-session price charts, the 16-metric panel in its two groups, and the real result and debrief after a "Reveal the close" tap. "Your reason" is Paul's question (which of Mo's four highlighted metrics, and which way it points), marked on consistency with the pick plus reading accuracy where a metric has an objective direction; no answer key. No timer. Mo classifies the day (coin toss below 0.5 points). One optional unscored review question after lock-in. Playability check pending Paul.

---

## 1. The short version

- Of the eight metrics on today's panel, only **two have a direction a novice can apply without argument** (revenue growth, analyst consensus). The other six (market cap, P/E, next earnings, beta, last session move, vs 52-week high) do not say "better" on their own. So a "which side wins each metric" tally over our panel would be mostly arbitrary.
- That changes what "working" can honestly mean. It cannot be "did you reach the right verdict". It can be **"did you read the panel accurately and apply a stated rule"**: who is growing faster, who is cheaper on P/E, which gap is bigger, does anyone report earnings today. The server can mark all of that from the stored numbers, with no answer key from Mo and no reference to the market result.
- Three recipes are designed on that basis (Section 3). All three keep the call, add working, keep the quiz with Paul's millisecond decay, and add confidence at 10 points.
- In simulation (Section 4), every recipe tells a thoughtful player from Coin Flip far sooner than today's rule: **after 10 games, 98–99% of the time versus 86% today**, and after 20 games it is near-certain versus 94%. Single-game scores go from 20 possible values to thousands.
- **Fable's lean: Recipe B (Scorecard).** It is the one that teaches a method, and it separated players best. **Strongest argument against:** it rewards careful reading and arithmetic, not judgment. A player who reads the panel perfectly and then flips a coin for the call will score well. Whether that is acceptable is a founder call: it is "deciding well" in the sense of *using the information*, not in the sense of *being more often right*.

---

## 2. Research: simple methods for comparing two companies

### 2.1 What the literature offers

| Method | What it does | What we can borrow |
|---|---|---|
| **Piotroski F-score** (Stanford, 2000) | Nine pass/fail tests on one company's accounts: profitability (4), leverage and liquidity (3), operating efficiency (2). One point each, score 0–9. High scorers beat low scorers by about 7.5% a year over 20 years. | The *form*: a fixed checklist, each item binary, each item checkable from a published number. Not the *content*: it needs year-on-year accounts we do not show. |
| **Greenblatt Magic Formula** (2005) | Rank every stock on two factors, earnings yield (cheapness) and return on capital (quality), add the two ranks, buy the lowest totals. | Two factors, add the ranks. With two companies it collapses to: who is #1 on Value, who is #1 on Growth, does anyone win both. |
| **YCharts Fundamentals Score** | Ten pass/fail tests with fixed thresholds (ROE > 5%, current ratio > 1, debt-to-equity < 13, and so on). "Look for 7 or higher." | Thresholds as published rules a student applies, rather than "which is better". |
| **"Which side does each metric favor" tally** (retail guides) | For same-sector peers, compare P/E, margins, debt, ROE, growth, and count. The guides are explicit that P/E and debt ratios "depend on context" and that one metric alone misleads. | The comparison columns; and the warning that half the metrics have no safe direction. |
| **Brier score / proper scoring rules** (Brier 1950) | For a probability forecast, score = (p − outcome)². Cannot be gamed: your best move is to report what you really believe. | The confidence points table: a wrong "Confident" must cost more than a wrong "Toss-up" gains, and "Toss-up" on a coin-flip day must be the right answer. |

Sources: [Piotroski explained (ChartMill)](https://www.chartmill.com/documentation/fundamental-analysis/indicators-and-ratios/360-Piotroski-F-score-explained), [Piotroski criteria (FourWeekMBA)](https://fourweekmba.com/piotroski-f-score/), [Greenblatt's formula (Nasdaq)](https://www.nasdaq.com/articles/greenblatts-magic-formula-quite-simple-far-easy-2014-07-15), [Magic Formula guide (Quant Investing)](https://www.quant-investing.com/blog/magic-formula-complete-guide/), [YCharts Fundamentals Score](https://go.ycharts.com/knowledge-base/the-fundamentals-score), [Comparing same-industry stocks (TIKR)](https://tikr.com/blog/how-to-compare-stocks-in-the-same-industry-a-guide-to-competitor-research), [Low P/E and value traps (Yahoo/Schwab)](https://finance.yahoo.com/markets/stocks/articles/schwab-explains-why-cheap-looking-194700576.html), [Brier score](https://en.wikipedia.org/wiki/Brier_score).

### 2.2 Our eight metrics: which have a "better" direction

| Metric (panel group) | Clear direction? | What a novice can still be asked |
|---|---|---|
| Market Cap (Long Game) | **No.** Bigger is steadier, smaller moves more. Neither is "better" for one day. | Which is bigger; by roughly how much. |
| P/E Ratio (Long Game) | **No.** Lower is cheaper; higher means growth is priced in. The value-trap literature is explicit that low P/E is not a buy signal. | Which is lower; apply the stated rule "lower = cheaper". |
| Revenue Growth (Long Game) | **Yes.** Faster is stronger. | Which is faster; the gap in points. |
| Analyst Consensus (Long Game) | **Mostly.** A better rating or a larger gap to the target is more favorable. Soft, because targets lag. | Which has the better rating; which has more upside to target. |
| Next Earnings (Game-Day) | **No direction, but a flag.** Earnings on game day is the single biggest driver of a one-day move, in either direction. | Does either report today or before tomorrow's open. |
| Beta (Game-Day) | **No.** Higher = bigger mover: good on an up day, bad on a down day. | Which is the bigger mover. |
| Last Session Move (Game-Day) | **No.** Momentum and mean reversion both have evidence. | Which moved more; same direction or opposite. |
| vs 52-Week High (Game-Day) | **No.** Near the high is strength or exhaustion; far below is value or trouble. | Which is closer to its high. |

Two clear, one soft, five none. This is the central finding of the research, and it is why none of the recipes score "did you pick the better company on this metric".

---

## 3. The three recipes

Shared by all three:

- **Call.** Final pick matches the open-to-close winner (Decision 6 unchanged).
- **Working.** Marked from the stored panel numbers by the server. Every item has one objectively checkable answer, including "Tie" where the numbers are equal. Mo never writes an answer key.
- **Quiz, with Paul's timer.** Five seconds to read, then the points decay to the millisecond, linearly, to a floor of 60% at 60 seconds, kept to two decimals. Formula: `points = max × (0.6 + 0.4 × clamp(1 − (t − 5 s) / 55 s))`. Today: flat 20 for 15 s, then whole points down to 12 at 60 s.
- **Confidence, 10 points, three levels, published table:** Toss-up 7 if right / 7 if wrong · Leaning 9 / 5 · Confident 10 / 2. Checked against the Brier idea: Toss-up is the best choice when you really are at 50%, Leaning best between about 50% and 75%, Confident best above 75%. Nothing can be gamed, and a toss-up day never punishes honesty. Coin Flip declares Toss-up every day.

| | A · Panel Check | B · Scorecard | C · Two-Factor |
|---|---|---|---|
| Call | 50 | 45 | 50 |
| Working | 25 (3 items) | 30 (6 items on the live panel; 4 in the sample) | 20 (2 ranks + combined verdict) |
| Quiz | 15 | 15 | 20 |
| Confidence | 10 | 10 | 10 |
| What the working step is | Three auto-generated reading questions: who grows faster, who is cheaper, who is bigger (or: does anyone report today). | A fixed checklist of rules, one per metric that supports one: Growth, Value, Analyst, Size, Earnings flag, Bigger mover. Tap A / B / Tie per rule. A running tally shows what the method says; the final pick may follow or overrule it. | Rank both on Value (P/E) and Growth (revenue growth), then say who has the better combined rank, or Tie. The Greenblatt idea cut to two companies. |
| Extra taps | +3 | +6 (+4 in sample) | +3 |
| Extra time (est.) | 20–30 s | 45–60 s | 30–40 s |
| What it teaches | Read the table before you pick. | A repeatable method, and that the method often says "tie": then it is your call. | Two factors matter most; everything else is noise. |
| Risk | Thin. Can feel like a reading test. | The rules are *declared*, not *true* (lower P/E = "value" is a convention). Players may ask why Size counts. | The two-factor framing is a stronger claim than we can defend for one-day moves. |

Play-time check: the live game today is roughly 4–6 minutes for a reader. A adds under half a minute, B about a minute, C about half a minute. All three stay inside 5–10 minutes.

---

## 4. Testing: simulation (done) and archive replay (blocked)

### 4.1 Synthetic players, 3,000 trials per cell

Players: **Coin Flip** (50% calls, random quiz at random speed, Toss-up); **Skimmer** (50% calls, fast and 75% right on the quiz, always Confident, working 55%); **Novice** (52% calls, working 75%, Leaning); **Thoughtful** (55% calls, working 95%, quiz 90%, honest confidence); **Thoughtful + overconfident** (as Thoughtful but always Confident). Matchups vary in how much edge there is to find.

| Rule | Distinct single-game scores | Single-game spread (SD, Thoughtful) | Thoughtful ahead of Coin Flip after 10 / 20 / 60 games | Thoughtful ahead of Novice after 10 / 20 / 60 | Novice ahead of Coin Flip after 10 | Skimmer ahead of Coin Flip after 10 |
|---|---|---|---|---|---|---|
| Current 80/20 | 20 | 40 | 86% / 94% / 99.5% | 63% / 69% / 83% | 77% | 71% |
| A · Panel Check | ~2,600 | 27 | 98% / 99.7% / 100% | 78% / 87% / 97% | 88% | 73% |
| B · Scorecard | ~2,900 | 25 | 99.3% / 100% / 100% | 82% / 90% / 99% | 93% | 74% |
| C · Two-Factor | ~2,700 | 28 | 98% / 99.9% / 100% | 77% / 84% / 96% | 91% | 77% |

What the numbers say:

- **Separation comes from the working component, not the timer.** Working is where a careful player and a random one differ most, every single day. The call stays close to a coin flip under every rule.
- **The millisecond timer spreads scores but does not separate skill.** It turns 20 possible scores into thousands, which is what Paul asked for. But the player it helps most is the Skimmer: fast and shallow. The Skimmer's edge over Coin Flip grows from 71% to 73–77%, while the Thoughtful player's quiz points barely change. The spread is real; it is spread by reading speed.
- **Confidence at 10 points changes almost nothing on its own**, which matches Paul's expectation. The overconfident twin scores about half a point less per game and is caught by the Thoughtful player only slightly more often. It earns its place as an honest input to MunyIQ and as a habit, not as a separator.
- **B separates best** at every horizon, because it has the most working items. The cost is the most taps.

Script: `scratchpad/simulate.mjs` (session scratchpad; copy into `scripts/` if we want to keep it).

### 4.2 Archive replay: Paul's real picks versus Coin Flip (run 2026-10-07 after Paul authorized the read)

Read-only pull of all 77 published games, every pick and score, the questions and the research. Nothing written.

**The call really is a coin flip, for everyone.**
- Paul has a final pick on 52 games and called **22 right (42%)**. Coin Flip called 31 of 77 (40%). Neither is above 50%. Over 52 games that is not evidence Paul is bad at it; it is evidence that the one-day call carries almost no signal, which is the premise of this whole exercise.
- The research changed Paul's mind 14 times; 6 of those 14 were right (43%), the same as his overall rate. So far, changing his mind has neither helped nor hurt.

**Under today's rule, Paul beats Coin Flip because of the quiz, not the call.** On the 39 games both played, Paul averages 53.8 to Coin Flip's 48.6 and has been ahead on the running total since game 10. Every point of that gap is quiz: 47 of Paul's 51 timed answers were under 15 seconds, so he banked the full 20 almost every day while the bot guessed.

**The timer has produced no spread at all, and the millisecond version would produce very little.** 50 of the 54 timed human answers in the archive are under 15 seconds (median 7.3 s, 90th percentile 14.0 s). The built rule therefore gave full marks to 93% of answers. Under Paul's millisecond decay with a 5-second grace, a median answer would score 19.7 of 20 and a 90th-percentile one 18.7: about 1.3 points of spread across most of the field. The reason is not the formula; it is that the question is answerable in seven seconds. Spread has to come from somewhere other than speed.

**Under recipes A, B and C** (working assumed at Paul 95% / Coin Flip 50%, confidence Leaning / Toss-up, because neither was ever recorded) Paul is ahead from game 1 and stays there, by 9–10 points per game on average. That is the simulation's result confirmed on real picks, with the same caveat: the gap is made by the working component.

**Margins, for Discussion 4.** Across 77 games the median distance between the two companies' open-to-close moves is **1.30 points**. 22 games (29%) were inside 0.5 points; 12 (16%) inside 0.25. A 0.5-point coin-toss threshold would label about three days in ten as too close to mean anything; 0.25 labels about one in six. Fable leans 0.25: it catches the days that are genuinely noise without making the debrief shrug a third of the time.

Scripts: `scratchpad/dump-archive.mjs`, `replay.mjs` (session scratchpad).

---

## 5. What Paul decides

1. **Is "working" allowed to reward reading and arithmetic rather than judgment?** All three recipes do. If the answer is no, the honest alternative is the calibration route (Discussion 2 at a heavier weight), which separates players on judgment but needs far more games to do it.
2. **Which recipe to take into a build spec**, or which parts to combine. Fable's lean is B; A if the extra minute feels like the Inquisition.
3. **The timer.** The millisecond decay is implemented in the samples exactly as Paul described. The simulation says it will not separate skill; it will separate speed. Keep it for tension, or soften the slope.
4. **Permission for the archive read**, so Section 4.2 can be filled in and the sample page rebuilt from a current-format game with its real result.

Discussion 8 (old scores) stays deferred, as agreed.
