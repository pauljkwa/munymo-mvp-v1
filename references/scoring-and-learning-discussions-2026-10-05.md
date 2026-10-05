# Fixing "the poor third": discussions to have before anything is built

**Date opened:** 2026-10-05
**Source:** the mechanics review in `references/wsj-critic-article-2026-10-05.md`. Its verdict: as a habit product Munymo is well made; as a learning product it is two-thirds of something excellent. The weak third is that **the score rewards luck, the debrief explains noise, the decision is one bit deep, and nothing learned is ever asked again.**

**What this document is.** An agenda, not a plan. Each item is a conversation between Paul and Fable that ends in a decision we both agree on. Nothing here is approved. Nothing here gets built until its discussion is closed and the outcome is written into this file and the handover.

**How each discussion is laid out.**
- **The question** in one sentence.
- **Why it matters** to a player.
- **The options**, including "leave it alone".
- **Where Fable leans**, and the strongest argument against that lean. Paul should push on these.
- **What only Paul can decide.**
- **What Fable brings to the conversation** so we are arguing from evidence, not taste.
- **What it touches** if we change it (existing scores, binding founder decisions, the database, the public copy).

**Ground rules we already have.** Schema changes need Paul's written approval. Only ever add columns. Binding founder decisions (handover Section 3) are changed only by a new founder decision. Player-facing copy is US English. The AI agent is "Mo". Paul is still the only real tester, so nothing here can be judged by player data yet; see Discussion 8 for how we judge it instead.

**Suggested order.** 1 first, because it sets the principle everything else follows. Then 2, 3, 4. Then 5, 6, 7 in any order. 8 runs alongside all of them.

---

## Discussion 1 — What should a Munymo score actually reward?

**The question.** Is the daily score a measure of *being right today*, or of *deciding well*?

**Why it matters.** Today 80 of 100 points go to calling the winner of a matchup that is close to a coin flip. A player who reasons carefully and loses gets 0 to 20. A player who guesses and wins gets 80. Over a month that teaches people to judge a decision by how it turned out, which is the opposite of what the game is for. It is also why the leaderboard needed a Coin Flip row to stay honest.

**The options.**
- **A. Leave it.** 80/20 is simple, already explained everywhere, and "did I call it?" is the fun. Accept that the score is mostly luck and let the dashboard and MunyIQ carry the skill story.
- **B. Rebalance the split.** Same two components, different weights, for example 50/50. Easy, but it only dilutes the luck; it does not measure skill.
- **C. Change what the prediction points measure.** Keep a prediction component, but score it on something a good process reliably wins at over time. This is Discussion 2.
- **D. Two numbers.** Keep the daily score as the fun, add a separate process or skill number that the season board can be ranked by. More honest, more to explain.

**Where Fable leans.** C, delivered as D during a transition: keep "did I call it" visible because it is the hook, and add a skill number built on calibration. The strongest argument against: every extra number is something a newcomer has to learn, and Munymo's simplicity is an asset.

**What only Paul can decide.** Whether Munymo is, at heart, a game about calling winners or a game about judgment. This is a positioning choice as much as a scoring one, and it changes the landing page.

**What Fable brings.** A replay of all 60-plus past games under each candidate scoring rule, using Paul's real picks and the Coin Flip bots' random ones, showing how many games each rule needs before it can tell a real player from chance (Discussion 8).

**What it touches.** Every stored score, the season boards, the 80/20 explanation on the landing page, FAQ, welcome email and demo, and the unbuilt MunyIQ.

---

## Discussion 2 — Should the final pick carry a confidence level?

**The question.** When a player locks in a final pick, should they also say how sure they are, and be scored on how well that sureness matches reality?

**Why it matters.** It is the one change that addresses three weaknesses at once. It turns a one-bit choice (A or B) into a real decision. It makes skill visible in far fewer games, because being 60% sure and right six times in ten is measurably good whichever six they were. And it gives MunyIQ something honest to measure. Forecasting tournaments have scored this way for years.

**The options.**
- **A. No confidence.** Keep A or B.
- **B. Two levels.** "Leaning" or "Confident". Easy to grasp, coarse to score.
- **C. Three or four levels**, shown as words with the percentages behind them (for example Toss-up 50, Leaning 60, Confident 75, Certain 90).
- **D. A slider** from 50 to 100. Most precise, most intimidating, fiddly on a phone.

Sub-questions inside this one: is it required or optional; what is the default if a player skips it; how is it scored (a published points table is easier to trust than a formula); what does a gut pick that is auto-submitted at lockout count as; what confidence does Coin Flip declare; does saying "Toss-up" on a genuinely close matchup score *well*, as it should.

**Where Fable leans.** C, required, with a small published points table in which a wrong "Certain" costs real points and a "Toss-up" can never lose many. The strongest argument against: it adds a step to a five-minute game, and a beginner may freeze on "how sure am I?".

**What only Paul can decide.** Whether the extra step is worth it for a first-time player, and how punishing overconfidence should feel. That second one is a tone decision.

**What Fable brings.** Three phone mockups of the final-pick screen (B, C, D), a draft points table, and the Discussion 8 replay with simulated confidence to show how quickly each option separates skill from luck.

**What it touches.** A new column on the picks table (schema approval), the final-pick screen in live, guest and practice play, auto-submit rules (Decision 1), the result page, the share card, the bots.

---

## Discussion 3 — What should the quiz test, and should speed matter?

**The question.** Is the validation question a "did you read it" gate or a test of understanding?

**Why it matters.** It is the only part of the score that is entirely about the player, and today it is usually a fact that can be lifted from the first sentence of the brief, with full marks for answering inside 15 seconds. That rewards skimming for a date, not weighing two companies.

**The options.**
- **A. Leave it** as a reading check.
- **B. Ask comparative questions.** "Which company has more riding on today?" "Which metric favors Seagate?" The answer needs both columns of the panel.
- **C. Drop or soften the speed bonus** so careful readers are not penalized. Keep a time limit, lose the sliding scale.
- **D. Ask about the concept, not the fact.** Ties to Discussion 5.

**Where Fable leans.** B and C together. The strongest argument against B: Mo writes the question, and comparative questions written by an AI are more likely to have a debatable "correct" answer than factual ones. A wrong answer key is worse than a shallow question. Against C: the timer is the only moment of tension in the session.

**What only Paul can decide.** Whether the timer's tension is worth more than fairness to slow readers, and how much risk of a disputable answer he will accept.

**What Fable brings.** An audit of the last 60 questions sorted by type (fact lookup, comparison, concept), how many are answerable from the first sentence, and a proposed revision to Mo's question-writing rules with ten sample questions written under it for past games.

**What it touches.** Mo's prompt, the 20-to-12 time decay in the scoring code, the quiz copy, and Decision 1's "timed scoring still active" wording.

---

## Discussion 4 — When a result is too close to mean anything, what do we say and how do we score it?

**The question.** If the winner is decided by a tiny margin, should the debrief say so, and should the score treat it differently?

**Why it matters.** A confident story about why one stock beat another by a quarter of a percentage point teaches a false lesson. The most valuable thing a debrief can say that day is "this one was noise; here is what would have mattered otherwise."

**The options.**
- **A. Wording only.** Mo's Hindsight Spotlight must open by classifying the day: decisive, clear, or too close to call, using a published margin threshold, and write accordingly.
- **B. Wording plus a visible label** on the result card ("Photo finish").
- **C. Change the scoring of close results**, for example half points to both sides inside the threshold. This alters the settlement rule.
- **D. Leave it.**

**Where Fable leans.** A and B now. C only as part of whatever comes out of Discussions 1 and 2, because calibration scoring already handles close games properly. The strongest argument against A/B: telling players the result was meaningless undercuts the drama of the reveal.

**What only Paul can decide.** The threshold, and whether Decision 6 (winner is the higher open-to-close move, full stop) stays untouched. Fable's lean leaves it untouched.

**What Fable brings.** The distribution of winning margins across all past games, so the threshold is chosen from the data, and three past debriefs rewritten under the new rule for comparison.

**What it touches.** Mo's prompt, the result card, possibly Decision 6.

---

## Discussion 5 — How do the lessons get inside the game?

**The question.** Should what a player has been taught come back and be asked again?

**Why it matters.** Thirty-two good lessons sit beside the game. Finishing one changes nothing about tomorrow's game, and a concept explained on Monday is never tested afterward. Returning to a thing after a gap is how it sticks.

**The options.**
- **A. Leave them as a library.**
- **B. Concept of the day.** Each game is tagged with one concept from the curriculum; the quiz, or a second optional question, is about that concept as it applies to today's two companies.
- **C. Spaced review.** A short optional "one from last week" question after the main game, drawn from concepts the player has already met.
- **D. A concept record.** The dashboard shows which ideas a player has met, been tested on, and got right, like a skill map.

**Where Fable leans.** B first, then D, with C later. The strongest argument against: every addition lengthens a five-minute session, and "five minutes" is a promise on the landing page.

**What only Paul can decide.** How sacred the five minutes are, and whether lessons should stay entirely optional and free of any effect on the score (they are free for every tier by standing decision).

**What Fable brings.** A mapping of the last 60 games to the 32 lessons to show how often each concept naturally comes up, and a mockup of the dashboard concept record.

**What it touches.** Mo's prompt, the quiz, new tables for concept history (schema approval), the dashboard, and the lesson-of-the-day card that already exists.

---

## Discussion 6 — What makes a player feel they are getting better?

**The question.** After three weeks, what tells a player they have improved?

**Why it matters.** In Wordle you can feel it within days. Here a better process does not reliably produce better results over twenty games, so the feeling has to be manufactured honestly from something other than wins.

**The options.** These are not exclusive: a calibration trend (needs Discussion 2), concepts mastered (needs Discussion 5), "your picks now cite more of the panel", a monthly personal report, a visible MunyIQ progress bar, harder optional modes for experienced players.

**Where Fable leans.** Let Discussions 2 and 5 produce the raw material, then design one monthly "what changed in your game" summary from it. The strongest argument against: until those two exist there is little to report, so this one waits.

**What only Paul can decide.** Whether an expert track (same matchup, harder questions or less hand-holding) belongs in the product at all, and whether it is a paid feature.

**What Fable brings.** A one-page mock of the monthly summary using Paul's own history.

**What it touches.** MunyIQ, the membership tiers plan, the dashboard.

---

## Discussion 7 — Does a newcomer's first game need a faster payoff?

**The question.** Should a first-time player get an instant result before they are asked to wait seven hours for a real one?

**Why it matters.** The gap between picking and finding out is the price of using a live market. It is also the longest feedback delay in the whole category. Practice mode already replays past games with an immediate score; guest play already lets anyone start without an account.

**The options.**
- **A. Leave it.** Today's live game is the first experience.
- **B. Offer a one-minute practice round first**, clearly labeled, then today's game.
- **C. After a guest's first live pick, offer a practice game** while they wait, which is close to what "While you wait" does now for members.

**Where Fable leans.** C, extended to guests. The strongest argument against B: it puts a rehearsal in front of the real thing, and the real thing is the product.

**What only Paul can decide.** Whether anything should ever stand between a visitor and today's live game.

**What Fable brings.** A check of what a guest sees after submitting today, and a mockup of C.

**What it touches.** Guest play, practice mode (currently members only).

---

## Discussion 8 — How do we judge any of this without players, and what happens to the history?

**The question.** With one real tester, how do we know a scoring change is better, and what do we do with the scores already recorded?

**Why it matters.** Changing the rules mid-beta is cheap now and expensive later. But there is no player data to test against, and existing scores, streaks and season boards were earned under the old rules.

**The options for judging.**
- **Replay the archive.** Take every past game, Paul's actual picks and the Coin Flip bots' random ones, and score them under each candidate rule. A good rule separates a thoughtful player from Coin Flip in fewer games.
- **Simulate.** Invent players with known skill (55%, 60%, well or badly calibrated) and count how many games each rule needs to rank them correctly.
- **Run both rules side by side** for a month, showing the new number as "experimental".

**The options for history.**
- **Start a new season under new rules** and leave the past as it was, labeled.
- **Re-score the past** where the data allows (it does not for confidence, which was never asked).
- **Keep both** numbers for old games.

**Where Fable leans.** Replay plus simulate before any decision, then side by side for one season, then switch at a season boundary with the past left as it was. The strongest argument against: running two numbers at once is exactly the complexity Discussion 1 worries about.

**What only Paul can decide.** How much change the beta's founding members should be asked to absorb, and whether a rules change is announced as a feature or done quietly.

**What Fable brings.** The replay and the simulation, as a short readable report with one chart per rule, before Discussions 1 and 2 are closed.

**What it touches.** Everything above.

---

## Decisions log

| # | Discussion | Status | Outcome |
|---|---|---|---|
| 1 | What the score rewards | Open | |
| 2 | Confidence on the final pick | Open | |
| 3 | The quiz and the timer | Open | |
| 4 | Too close to call | Open | |
| 5 | Lessons inside the game | Open | |
| 6 | Feeling of progress | Open, waits on 2 and 5 | |
| 7 | A faster first payoff | Open | |
| 8 | Judging without players; the history | Open, prep work can start now | |
