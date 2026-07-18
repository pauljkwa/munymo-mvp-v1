import type { Level } from "./types";

const level400: Level = {
  level: 400,
  title: "The Street: Who Else Is in This Trade",
  goal: "Learn to interpret the humans and institutions that move around a stock.",
  lessons: [
    {
      id: "l400-1",
      level: 400,
      order: 1,
      title: "Analysts",
      jargonTerm: "analyst rating",
      body:
        "Every public company is followed by professional analysts — researchers, usually at banks or investment firms, whose job is to study a company closely and publish an opinion on it. That opinion is summarized as an analyst rating, most commonly Buy, Hold, or Sell, along with a written report explaining the reasoning.\n\n" +
        "It's worth knowing upfront that ratings as a group skew optimistic. Analysts often maintain ongoing relationships with the companies they cover, and a harsh \"Sell\" rating is relatively rare compared to \"Buy\" and \"Hold.\" That doesn't make the research worthless, but it means a standing rating should be read with that lean in mind, not treated as a neutral verdict.\n\n" +
        "Here's the detail that matters most for a single trading session: a change in rating moves prices far more than the standing rating itself. A stock can carry a \"Hold\" rating for months with barely a ripple, but the moment an analyst upgrades it to \"Buy,\" or downgrades it to \"Sell,\" that shift in opinion itself becomes a catalyst, often moving the price within minutes of being published. The rating in isolation is a snapshot; the change in rating is news.\n\n" +
        "When judging a matchup, an old, unchanged rating is far less informative than a fresh upgrade or downgrade — the second is a signal that at least one professional has just revised their view, which is exactly the kind of event that can drive an outsized single-day move.",
      matchupHook:
        "Watch for the words \"upgrade\" or \"downgrade\" in a matchup's pairing rationale — that's this exact lesson playing out, a change in view rather than a standing opinion.",
      quiz: {
        questionType: "multiple_choice",
        questionText: "Which is more likely to move a stock's price sharply: a standing analyst rating or a rating change?",
        options: [
          "A rating change (an upgrade or downgrade), since it signals a fresh shift in opinion",
          "A standing rating, since it reflects months of careful research",
          "Neither ever moves a stock's price",
          "Only a Sell rating can move a stock's price",
        ],
        correctAnswer: "A rating change (an upgrade or downgrade), since it signals a fresh shift in opinion",
        explanation:
          "An upgrade or downgrade is news — a shift in view — while an unchanged rating has already been absorbed by the market.",
      },
      isCapstone: false,
      tags: ["analyst"],
    },
    {
      id: "l400-2",
      level: 400,
      order: 2,
      title: "Price Targets",
      jargonTerm: "price target",
      body:
        "Alongside a rating, analysts usually publish a price target — their estimate of where a stock's price will land roughly twelve months out. Averaged across every analyst covering a company, this becomes a single number frequently quoted in research summaries and news coverage.\n\n" +
        "A price target is most useful as a gap-to-current-price reading: how far above or below the current price does the collective analyst view expect the stock to move over the coming year? A target sitting far above the current price suggests analysts see meaningful room to run; a target close to or below the current price suggests they see the stock as close to fully valued already.\n\n" +
        "The detail worth remembering is that targets trail the price as much as they lead it. Analysts regularly revise targets upward after a stock has already risen, and downward after it has already fallen — reacting to new information rather than always predicting it first. A price target is a reasoned estimate, not a guarantee, and it should be read as one input alongside everything else, not as a promise of where a stock is headed.\n\n" +
        "Because of this trailing tendency, a big gap between the current price and the average target is more useful as a rough gauge of sentiment than as a forecast to be taken literally.",
      matchupHook:
        "Analyst Consensus in the Long Game section of the metrics panel often includes the average price target alongside the rating — read the gap to the current price as a sentiment gauge, not a promise.",
      quiz: {
        questionType: "true_false",
        questionText:
          "Analyst price targets always predict a stock's future move before it happens, rather than reacting to moves that already occurred.",
        options: null,
        correctAnswer: "False",
        explanation:
          "Targets trail the price as much as they lead it — analysts frequently revise targets after a move has already happened.",
      },
      isCapstone: false,
      tags: ["analyst"],
    },
    {
      id: "l400-3",
      level: 400,
      order: 3,
      title: "Institutions vs. Retail",
      jargonTerm: "institutional investor",
      body:
        "Not every dollar moving a stock's price belongs to an individual sitting at home with a brokerage account. An institutional investor is a large organization — a pension fund, an index fund, a hedge fund, an insurance company — managing pooled money on behalf of many people at once. Collectively, these institutions move most of the money in the stock market; individual retail investors make up a comparatively small slice of total trading activity.\n\n" +
        "This matters because of scale. A single institutional investor can buy or sell enough shares in one transaction to noticeably move a stock's price on its own, in a way that thousands of individual retail trades acting independently rarely do. When a stock makes an unusually large move with no obvious retail-facing headline attached, it's often because one or more institutions have quietly repositioned.\n\n" +
        "That leads to a useful rule of thumb: big moves usually mean big money changed its mind. A sudden, sizable shift in a stock's price — especially one that arrives without an obvious public news story — is frequently a sign that a large institutional holder has decided to meaningfully add to or exit a position, even if the exact reason isn't disclosed publicly right away.\n\n" +
        "Retail sentiment can still matter, particularly for smaller companies with fewer institutional holders, but for most established stocks, institutional flows are the larger force behind a sharp single-day move.",
      matchupHook:
        "When a matchup's pairing rationale can't fully explain the size of a move, consider that institutional flows — not visible on the page — may be the real driver behind it.",
      quiz: {
        questionType: "multiple_choice",
        questionText:
          "A stock makes an unusually large move with no clear public news story attached. What is a likely explanation?",
        options: [
          "A large institutional investor may have quietly repositioned a sizable holding",
          "The stock exchange has made an error in its records",
          "The move must be a data glitch, since no news means no real cause",
          "Retail investors collectively caused the move, since they dominate trading volume",
        ],
        correctAnswer: "A large institutional investor may have quietly repositioned a sizable holding",
        explanation:
          "Institutions move most of the money in the market and can shift a price meaningfully with a single large transaction, even without a public headline.",
      },
      isCapstone: false,
      tags: ["basics"],
    },
    {
      id: "l400-4",
      level: 400,
      order: 4,
      title: "Sentiment & Narrative",
      jargonTerm: "sentiment",
      body:
        "Not every price move traces back to something specific a single company did. Whole sectors can rise or fall together on a shared story — artificial intelligence spending, interest rate expectations, oil supply, a new regulation affecting an entire industry. The overall mood investors hold toward a company, sector, or the market as a whole is called sentiment, and it can move prices even in the total absence of company-specific news.\n\n" +
        "Sentiment tends to move in narratives — simple, compelling stories that spread quickly among investors, like \"this sector is the next big growth area\" or \"this industry is being disrupted.\" Once a narrative takes hold, it can pull related stocks up or down together, almost regardless of each individual company's own results, simply because they're all seen through the same lens.\n\n" +
        "These narratives frequently overshoot in both directions. A popular growth narrative can push prices well beyond what any individual company's fundamentals would justify, and a pessimistic narrative can drag down perfectly healthy businesses purely by association with an out-of-favor sector.\n\n" +
        "The practical takeaway is that a stock can move on its sector's story with no company news at all. Before assuming a company-specific explanation for a move, it's worth checking whether its whole sector moved together — if so, sentiment and narrative, not anything unique to that company, may be the real driver.",
      matchupHook:
        "If both companies in a matchup move in the same direction despite no shared company news, that's sector sentiment at work — check whether their whole sector moved together.",
      quiz: {
        questionType: "true_false",
        questionText:
          "A stock can never move meaningfully unless there is specific news about that individual company.",
        options: null,
        correctAnswer: "False",
        explanation:
          "Sector-wide sentiment and narrative can move a stock even with no company-specific news at all.",
      },
      isCapstone: false,
      tags: ["sector-story"],
    },
    {
      id: "l400-5",
      level: 400,
      order: 5,
      title: "Reading Financial News Critically",
      jargonTerm: null,
      body:
        "Financial headlines are written to grab attention fast, which means the headline and the substance underneath it don't always match. A dramatic headline can sit atop a fairly routine story, and a modest-sounding one can bury the most important detail several paragraphs down. Reading past the headline is the first habit worth building.\n\n" +
        "It's also worth noticing who published a story and why. A press release from the company itself is naturally going to frame things favorably; a report citing anonymous \"sources say\" carries less certainty than one citing a named, on-the-record spokesperson or an official filing. Neither type of source is automatically wrong, but each deserves a different level of trust.\n\n" +
        "A related distinction is between reported numbers and commentary. A company's actual revenue or profit figure, taken from an official filing, is a fact. A writer's interpretation of what that figure \"means\" for the stock going forward is an opinion, however confidently it's stated. Both can appear in the very same article, and conflating the two is an easy mistake to make.\n\n" +
        "The single most useful habit to build is asking, for any story that seems to support a conclusion you've already reached: what would make this story wrong? If you can't think of anything, that's worth noticing — it usually means you haven't actually examined the story critically yet.",
      matchupHook:
        "Apply this habit directly to a matchup's pairing rationale and research notes — ask what would make the stated reasoning wrong before you lock in a pick.",
      quiz: {
        questionType: "multiple_choice",
        questionText:
          "What is the most useful habit for reading a financial news story that already seems to support your view?",
        options: [
          "Ask what would make the story wrong",
          "Assume the headline always tells the full story",
          "Trust any story with a dramatic headline more than one with a plain headline",
          "Treat any commentary in the article as an established fact",
        ],
        correctAnswer: "Ask what would make the story wrong",
        explanation:
          "Actively looking for what would disprove a story is the habit that separates critical reading from simply accepting a convenient conclusion.",
      },
      isCapstone: false,
      tags: ["basics"],
    },
    {
      id: "l400-6",
      level: 400,
      order: 6,
      title: "CAPSTONE: The Hindsight Habit",
      jargonTerm: "hindsight bias",
      body:
        "Once a game day is finished, its outcome can feel obvious in a way it never did beforehand — of course that company was going to win, given everything that happened. That feeling is hindsight bias: the tendency to believe, after the fact, that an outcome was more predictable than it actually was in the moment.\n\n" +
        "Hindsight bias quietly undermines learning, because it erases the honest uncertainty that existed before the result. Rereading a finished matchup's Hindsight Spotlight well means deliberately separating two categories: what was genuinely knowable before the game — the catalyst, the beta, the pairing rationale — from what only became clear afterward, once the actual result was in.\n\n" +
        "The practice that counters hindsight bias directly is writing down your reasoning before the result, not after. State plainly, in advance, which company you expect to win and why — the catalyst you're weighing, the metric that tipped your decision — then compare that written reasoning against the Hindsight Spotlight once the outcome is known.\n\n" +
        "Done consistently, this habit turns each matchup into a small, honest test of your own judgment rather than a story that only makes sense in retrospect. It's the single most useful habit from this entire level, and it sets up exactly the discipline the next level builds into a full pre-pick routine.",
      matchupHook:
        "Before your next pick, write one sentence stating your reasoning, then compare it against that game's Hindsight Spotlight once results are published.",
      quiz: {
        questionType: "multiple_choice",
        questionText: "What is the best way to counter hindsight bias after a matchup finishes?",
        options: [
          "Write down your reasoning before the result, then compare it to what actually happened",
          "Only read the Hindsight Spotlight after forming an opinion about how obvious the outcome was",
          "Avoid reading the Hindsight Spotlight altogether",
          "Assume every result was predictable once you see it",
        ],
        correctAnswer: "Write down your reasoning before the result, then compare it to what actually happened",
        explanation:
          "Recording your reasoning in advance preserves the real uncertainty you faced, which is exactly what hindsight bias otherwise erases.",
      },
      isCapstone: true,
      tags: ["scorecard"],
    },
  ],
};

export default level400;
