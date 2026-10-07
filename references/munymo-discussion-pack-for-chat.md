# Munymo design discussions — briefing pack for a Claude chat

**How to use this file.** Paul uploads it to a Claude Project (or pastes it at the start of a chat) so he can hold these discussions on his phone. The chat has no access to Munymo's code, database or the main working session, so everything it needs is in this file. Prepared 2026-10-05 by Claude Fable 5.1 from the Claude Code session that builds Munymo.

---

## Instructions for the Claude reading this

You are helping Paul Kennedy, the founder of Munymo, think through eight design questions about his game. Paul is not a coder. He is on his phone between clients, so:

- **Keep every reply short.** A few sentences, one idea at a time. No walls of text, no tables unless he asks.
- **One discussion at a time.** Start with whichever number he names. If he doesn't say, start with Discussion 1, because it sets the principle for the rest.
- **This is a conversation that ends in a decision he owns.** Do not hand him a verdict. Lay out the trade-off, ask what he thinks, and push back when you disagree. He has asked not to be flattered: be nice only when it is warranted.
- **Stay inside what this file says about the product.** You cannot see the code or the data. If a question needs a fact that isn't here (how many past questions were fact lookups, what the margins looked like), say so and add it to the "homework for Fable" list at the end, rather than guessing.
- **Do not design the implementation.** Screens, database columns and code are for the Claude Code session ("Fable"). Here the job is to decide *what* and *why*.
- **Plain US English.** The game's AI research agent is called "Mo".
- **Respect what is already settled** (listed below). If a discussion would overturn one of those, flag it clearly as a founder decision being reopened.
- **When Paul says he is done, or a discussion reaches agreement, produce a "Decisions to take back" block** in exactly the format at the bottom of this file. He will paste it into the Claude Code session, which will record it and build from it.

---

## What Munymo is

A free daily stock-analysis game at munymo.com, in beta. Each US trading day there is one matchup: two real, well-known companies in the same sector (for example Western Digital vs Seagate). No real money is involved. The founder's own description of the intent: "morning financial calisthenics", a small daily rep for novice and professional alike, where the value is in showing up, not in being right on a given day.

**The daily loop, in order:**
1. **Gut pick.** Choose a winner on instinct, before seeing any information.
2. **Research.** A plain-English brief written each day by Mo (an AI research agent, disclosed as such), a side-by-side table of 16 metrics in two groups ("The Long Game" and "Game-Day Setup"), a chart per company, and the credited news article behind the pairing. Every metric has a "What does this mean?" explainer. Beginners see a summary by default with the full analysis one tap away.
3. **Declare** "I've read the research", then make the **final pick**. This is the one that is scored.
4. **Timed validation question** about the research. One attempt.
5. Picks **lock at 9:30 am New York time** (the market open). If a player made a gut pick but no final pick, the gut pick is auto-submitted.
6. **After the close**, the result is published: winner, each stock's open-to-close move, how players voted, a short "What happened", and a longer "Hindsight Spotlight" debrief written by Mo.

**Scoring today.** 100 points a day: **80 for a correct final pick, 0 if wrong; up to 20 for a correct quiz answer**, full 20 if answered within 15 seconds, sliding down to 12 at a minute or more, 0 if wrong. The winner is the company with the higher percentage move from the regular-session open to the close (this is a binding founder decision; the server computes it from the prices).

**Around the loop.**
- **Streaks**: a playing streak, a win streak, a losing run. "Away Status" pauses the streak for as long as the player likes; the founder is firm that the streak must not become "a ball and chain".
- **Leaderboard**: monthly seasons ranked by total points, reset on the 1st, anyone is on it from their first game. A second tab ranks all-time average score after 10 games. A bot called **Coin Flip**, which picks at random, sits on every board as a declared benchmark.
- **Dashboard "Gut vs Research"**: how often research changed the player's pick and whether that helped or hurt; accuracy by sector and by month.
- **Milestones** on the result page (first game, streak landmarks, perfect game), a **share button** that makes a Wordle-style block, and at five wrong in a row a link to a specific lesson.
- **Learning Hub**: 32 short lessons in five levels, each with a quick quiz, free for everyone. A "lesson for this matchup" card links from the result. Lessons do not affect the score.
- **Practice mode**: replay any past matchup with the date and result hidden, scored immediately; does not count toward anything.
- **Guest play**: today's game can be played without an account; sign-up is asked for afterward.
- **Notifications**: push first, email only as a fallback.
- **Coming, not built**: "MunyIQ" (a composite skill score built from a player's whole record, including whether they are improving), certificates, head-to-head and league play, other countries' markets, native apps, paid membership (founding members get the first year free).

**Stage.** Beta. Paul is effectively the only real tester. There is no player data to settle arguments with. That is why Discussion 8 exists.

---

## What the review found

A mechanics review (written as a newspaper critic's piece) concluded: **as a habit product Munymo is well made; as a learning product it is two-thirds of something excellent.**

**Praised:** committing to a gut pick before being taught (a well-supported learning technique); the Gut vs Research feedback (rare in consumer learning products); friction in the right places; scarcity and calm with no coins, hearts or guilt; the Coin Flip benchmark; clean, verifiable grading; guest play.

**The weak third:**
1. **The points reward the part that is luck.** Which of two large same-sector companies has the better single day is close to a coin flip, and it carries 80 of 100 points. The remaining 20 go to a recall question, often answerable from the first sentence of the brief, with a bonus for speed. A careful process is graded by a mechanism that cannot tell care from chance. It trains "resulting": judging a decision by how it turned out.
2. **The debrief explains noise as if it were cause.** A confident story about a result decided by a quarter of a percentage point teaches a false lesson.
3. **The decision is one bit deep.** A or B gives little felt sense of getting better.
4. **Nothing learned is ever asked again.** The lessons sit beside the game, not inside it.
5. **Feedback is slow.** Seven or more hours between pick and result; practice mode is the patch.

The reviewer's suggested direction: ask for a confidence level with the final pick and score calibration, as forecasting tournaments do; make the quiz comparative; bring yesterday's concept back in tomorrow's question.

---

## Already settled — do not reopen without flagging it

- The winner is the higher open-to-close move. (Founder Decision 6.)
- Auto-submit of the gut pick at lockout; the quiz stays answerable until the result publishes. (Decision 1.)
- Away Status is unlimited and penalty-free. Paul: it "could and even should be exploited any way the player chooses".
- Monthly season board by total points, with Coin Flip as benchmark.
- The existing 32 lessons and the archive stay free for every tier.
- Munymo pays no cash and is never framed as gambling, trading or advice. Players must be 18+.
- Research is written by Mo and disclosed as AI-written.
- Database changes need Paul's written approval and may only add, never remove.
- Simplicity matters: "five minutes a day" is a public promise.

---

## The eight discussions

For each: the question, the options, where Fable (the Claude Code session) leans, and the best argument against that lean. Fable's leans are a starting position for Paul to attack, not a recommendation to accept.

### 1. What should a score reward? *(have this first)*
Being right today, or deciding well?
- **A** Leave 80/20. Simple, already explained everywhere, and "did I call it?" is the fun.
- **B** Rebalance the split (say 50/50). Dilutes the luck without measuring skill.
- **C** Change what the prediction points measure, so a good process wins over time (see 2).
- **D** Two numbers: keep the daily "did I call it" score, add a separate skill number the season board can use.

*Fable leans* C, delivered as D during a transition. *Against:* every extra number is something a newcomer must learn. *Only Paul can decide* whether Munymo is at heart about calling winners or about judgment; that is positioning, not just scoring.

### 2. Should the final pick carry a confidence level?
- **A** No. **B** Two levels (Leaning / Confident). **C** Three or four named levels with percentages behind them (Toss-up 50, Leaning 60, Confident 75, Certain 90). **D** A 50–100 slider.
- Inside it: required or optional; what a skipped or auto-submitted pick counts as; a published points table vs a formula; how hard a wrong "Certain" should bite; whether "Toss-up" on a genuinely close matchup should score well.

*Fable leans* C, required, published table. *Against:* adds a step to a five-minute game and a beginner may freeze on "how sure am I?". *Only Paul can decide* whether the step is worth it for a first-timer and how punishing overconfidence should feel.

### 3. What should the quiz test, and should speed matter?
- **A** Leave it as a reading check. **B** Comparative questions needing both companies' columns. **C** Keep a time limit but drop the sliding speed bonus. **D** Ask about the concept rather than the fact (see 5).

*Fable leans* B and C. *Against B:* Mo writes the question, and an AI-written comparative question is likelier to have a debatable "right" answer; a wrong answer key is worse than a shallow question. *Against C:* the timer is the only moment of tension in the session. *Only Paul can decide* how much tension is worth versus fairness to slow readers, and how much risk of a disputable answer to accept.

### 4. When a result is too close to mean anything
- **A** Wording only: Mo's debrief opens by classing the day (decisive / clear / too close to call) against a published margin. **B** Plus a visible label on the result card ("Photo finish"). **C** Score close results differently (changes the settlement rule). **D** Leave it.

*Fable leans* A and B; C only as part of whatever 1 and 2 produce. *Against:* telling players the result was meaningless undercuts the drama of the reveal. *Only Paul can decide* the threshold, and whether Decision 6 stays untouched (Fable's lean leaves it alone).

### 5. How do the lessons get inside the game?
- **A** Leave them as a library. **B** Concept of the day: each game is tagged with one curriculum concept and the quiz (or an optional second question) applies it to today's companies. **C** Spaced review: an optional "one from last week" question. **D** A concept record on the dashboard showing what the player has met, been tested on, and got right.

*Fable leans* B, then D, with C later. *Against:* every addition lengthens a five-minute session. *Only Paul can decide* how sacred five minutes is, and whether lessons may ever affect the score.

### 6. What makes a player feel they are improving?
Options, not exclusive: a calibration trend (needs 2), concepts mastered (needs 5), a monthly "what changed in your game" report, a MunyIQ progress bar, an optional harder mode for experienced players.

*Fable leans* wait for 2 and 5, then design one monthly summary. *Only Paul can decide* whether an expert track belongs in the product, and whether it is paid.

### 7. Does a newcomer need a faster first payoff?
- **A** Leave it: today's live game is the first experience. **B** A one-minute labeled practice round first. **C** After a guest's first live pick, offer a practice game while they wait.

*Fable leans* C. *Against B:* a rehearsal in front of the real thing. *Only Paul can decide* whether anything should ever stand between a visitor and today's live game.

### 8. Judging without players, and what happens to history
- *Judging:* replay every past game under each candidate rule using Paul's real picks and Coin Flip's random ones; simulate invented players of known skill; or run old and new rules side by side for a month.
- *History:* start a new season under new rules and leave the past as it was; re-score where possible; or keep both numbers.

*Fable leans* replay and simulate first, side by side for one season, switch at a season boundary, leave the past alone. *Against:* two numbers at once is the complexity Discussion 1 worries about. *Only Paul can decide* how much change founding members should be asked to absorb and whether it is announced as a feature. *Fable has offered* to prepare the replay as a short report; it only reads data.

---

## "Decisions to take back" — the format to produce at the end

When Paul wraps up, write this block and nothing else, so he can paste it straight into the Claude Code session:

```
MUNYMO DISCUSSION OUTCOMES — <date>

Discussion <number>: <title>
Status: Agreed / Leaning / Still open
Decision: <one or two plain sentences in Paul's terms>
Why: <the reason that settled it>
Conditions or limits: <anything Paul attached>
Changes a settled decision? <No / Yes: which one>

(repeat for each discussion covered)

Homework for Fable:
- <facts, mockups or analysis needed before a discussion can close>

Not discussed this time: <numbers>
```
