Fable, this is the homework from the scoring and learning discussions. It's research and design, not a build: nothing goes into the live game until Paul agrees to it.

**Read first**
1. `references/scoring-and-learning-discussions-2026-10-05.md`, the agenda you wrote on 2026-10-05. The decisions log at the bottom now has Paul's first positions on all eight discussions, recorded 2026-10-07 in an Opus session. Those log edits are not committed yet.
2. `references/wsj-critic-article-2026-10-05.md`, the mechanics review.
3. `server/scoring.ts`, the current scoring code.

**What Paul has said (2026-10-07), in short**
- **Pre-beta.** Site copy and season boundaries are not constraints. Now is the time to change mechanics, and the score weighting was kept adjustable on purpose. Don't argue from "the landing page says five minutes". The real limit is that **play time stays at 5–10 minutes**.
- **Two numbers is acceptable.**
- **Confidence on the final pick goes back in**, worth about **10%** of the score. It was parked for MunyIQ in `references/leaderboard-seasons-spec.md` on 2026-09-17, and Paul had thought it was already decided. On its own it doesn't separate a player from the crowd.
- **The new idea: score the player's "working".** Like a maths exam, a student follows a simple method with the metrics we already show, and earns points for applying it accurately, whatever the market does. Paul is not an investor or a mathematician. He wants a basic method a novice can follow, found through research or invented.
- **The timer.** The decay was meant to separate players more finely than 100/80/20/0. Paul's original intent: decay starts immediately (or after about 5 seconds of reading) and is timed to the millisecond, so scores visibly differ. What's built: a flat 20 for the first 15 seconds, then linear down to 12 at 60 seconds, rounded to whole points. So almost everyone ties.
- **Playability check.** Every candidate change gets a sample game built from real past data, so Paul can feel whether it's playable. In his words: "we don't want to turn this into the Spanish Inquisition."
- **Discussion 8** (what happens to old scores) is deferred until the mechanics are settled.

**The homework**
1. **Research** simple, student-followable methods for comparing two companies with the metrics in our research panel. Examples: Piotroski F-score-style pass/fail checklists, Greenblatt-style two-factor rankings, plain "which side does each metric favor" tallies. Note which of our metrics have an unambiguous "better" direction and which don't (P/E, for example). Cite your sources.
2. **Design 2–3 candidate score recipes.** Each one combines: correct call + working + quiz (with Paul's millisecond decay) + confidence at about 10%. Working should be marked from the numbers on the panel, never from the market result, and never from an answer key Mo writes. Say how many taps each adds and estimate the extra seconds.
3. **Test the recipes on past games.** Read-only. Score the archive under each recipe, using Paul's real picks against Coin Flip's random ones, and simulate players of known skill. Report how well each recipe separates a thoughtful player from chance, and how spread out the scores are, since separating players is the timer's purpose.
4. **Build a playable sample game** for each recipe from one real past matchup, as a private Artifact page Paul can play on his phone. No changes to the live game.

**Ground rules**
- Read-only against the production database. Never run tests in a shell that has sourced `.env`. No schema changes; any new column needs Paul's written approval first.
- Paul is not a coder and reads on his phone. Keep chat replies short: outcome first, detail in the report file. Put the findings in a new `references/` file and link it from the decisions log.
- This is a discussion. Give a lean and the strongest argument against it, and leave the decision to Paul. Use US English, and call the AI agent "Mo".
- When you're done, give Paul a short summary plus the links to the sample games, then stop for his reactions before building anything.
