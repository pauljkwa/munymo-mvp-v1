# A Stock Game That Teaches Well and Scores the Wrong Thing

*Munymo borrows its rhythm from Wordle and its ambitions from Duolingo. Its lesson design is smarter than either comparison suggests. Its scoreboard is where the thinking still has to be done.*

**By a Personal Technology critic, The Wall Street Journal** — *written by Claude Fable 5.1 at the founder's request, 2026-10-05. A mechanics review of a product in beta: how the game is built, and how it stands in the gamified-learning field. Audience size is deliberately not assessed. The September piece is `wsj-critic-article-2026-09-17.md`.*

---

I spend most of my working week inside apps that promise to teach me something by turning it into a game. Nearly all of them make the same trade. They take a subject, bolt on streaks, points and a mascot, and quietly optimize for the streak. You come back every day. Whether you learn anything is somebody else's department.

Munymo, a daily stock-analysis game still in beta, makes a more interesting set of choices. Some of them are better than what the big names do. One of them is a real problem. Both are worth describing carefully, because the good parts are unusual and the weak part is fixable.

## The loop

Each trading day there is one matchup: two real companies in the same sector. On Monday it was Western Digital against Seagate. The sequence is fixed.

You pick a winner on instinct, with no information at all. Then the research opens: a plain-English brief, a side-by-side table of sixteen metrics, a chart for each stock, the news article that prompted the pairing. You declare that you have read it. You pick again, and this pick counts. A timed question checks the reading. Picks lock at the New York open, the market settles it, and a debrief arrives after the close.

No account is needed to try it. That alone puts it ahead of most of the category, which still asks for an email address before showing you what you are signing up for.

## What the design gets right

**It makes you commit before it teaches you.** Learning researchers call this a pretest: ask the question first, let the learner be wrong, then supply the material. People retain more of what follows a guess, and far more of what corrects one. Language apps have known this for a decade and mostly ignore it in favor of tapping the right tile. Munymo builds its whole session around it. The gut pick is not a gimmick. It is the best single decision in the product.

**It then shows you what your studying did.** A signed-in player's dashboard reports how often the research changed their pick, and whether changing helped or hurt, alongside accuracy by sector and by month. I review a great many learning products and I can name very few that give a learner feedback on their own decision process rather than on their answers. Chess sites do a version of it. Forecasting tournaments do. Consumer learning apps almost never do.

**The friction is in the right place.** The explicit "I've read the research" step before the final pick is a small act of design discipline. So is "What does this mean?" beside every metric, a beginner summary shown by default with the full analysis one tap away, and a five-level curriculum of 32 short lessons that each link back to the live game.

**It is scarce, and it is calm.** One game a day, as with Wordle. A streak you can pause for as long as you like, with no purchase, no guilt screen and no owl. There are no coins, gems, hearts or lives. Next to the manipulation that is standard in this field, the restraint reads as respect.

**It put par on the scorecard.** The leaderboard runs in monthly seasons, ranked by total points, and one row on it is a bot labeled Coin Flip that picks at random. Every player can see, every month, whether they are beating chance. A golf course tells you par. Almost no learning game tells you what not trying would have scored.

**The grading is clean.** Results settle on each stock's move from the open to the close, the rule is printed under the numbers, and the server derives the outcome from the prices rather than taking anyone's word for it. I checked the last fifty results against their printed prices. All fifty agree.

## Where it comes apart

**The points reward the part that is luck.** Eighty of the hundred points go to calling the winner. Which of two large companies in one sector has the better single day is very nearly a toss-up, and Munymo knows it: a recent debrief described its own matchup as "a classic same-sector coin flip." So four-fifths of the score is noise, and the fifth that isn't goes to a recall question that can often be answered from the first sentence of the brief, with a bonus for answering in under fifteen seconds.

That is backwards, and the consequence is not just an unfair scoreboard. It is a teaching problem. Poker players have a word, "resulting," for judging a decision by how it turned out. A game that pays 80 points for a lucky call and nothing for a sound one that lost trains exactly that habit. The careful process Munymo walks you through in the first four minutes is graded, in the fifth, by a mechanism that cannot tell care from chance.

**The debrief explains noise as if it were cause.** The post-game essay is thoughtful and well sourced. It is also, on a day decided by a quarter of a percentage point, a confident story about why something happened that may have had no reason. The most valuable sentence a debrief can contain on such a day is "this one was too close to mean anything; here is what would have mattered if it weren't." The product should learn to say it.

**The decision is one bit deep.** A or B. Wordle's appeal is that you can feel yourself getting better at it within a week. Here the felt experience of improvement is thin, because a better process does not reliably produce better results over twenty games. The dashboard insight is meant to supply that feeling, and with a yes-or-no outcome it needs a great many games before its verdict is more than an anecdote.

**Nothing you learn is ever asked again.** You can read what a price-to-earnings ratio means on Monday and never be tested on it afterward. There is no review schedule, no record of which concepts you have shown you understand, no adjustment for a novice versus a professional beyond the summary toggle. The curriculum is good, and it sits beside the game rather than inside it. Completing a lesson changes nothing about what you are asked the next day.

**The lesson arrives long after the decision.** Seven or more hours pass between the pick and the result. That is the price of using a real market, and the practice mode, which replays past matchups with the date hidden and scores them at once, is a sensible patch. It is still a slower feedback loop than anything else in the category.

## What the genre already knows

The fix for the central problem is not exotic. Forecasting tournaments solved it years ago: ask for a confidence level along with the pick, and score calibration. A player who says "60%" and is right six times in ten is skilled, whichever six they were. That turns one bit into a real decision, makes ability visible in a fraction of the games, and gives the long-promised composite score something honest to measure.

Two smaller moves would close most of the remaining gap. Weight the quiz toward a question that requires comparing the two companies rather than retrieving a date. And bring yesterday's concept back in tomorrow's question, so the lessons and the game finally touch.

## The verdict

Judged as a habit product, Munymo is already well made: a tight daily appointment, an honest board, no tricks. Judged as a learning product, it is two-thirds of something excellent. The front of each session, commit, read, recommit, is better instructional design than most of what the category's giants ship. The back of it hands out the marks for the wrong thing.

That is a much better problem to have than the usual one. Most gamified learning has the scoring working beautifully and nothing underneath worth scoring. Munymo has the substance and needs the scoreboard to catch up with it. I would rather review this at beta than the reverse at scale.

*Munymo is free at munymo.com and its terms require players to be 18 or older. The site says it does not offer investment advice, and this column does not either.*
