import type { Level } from "./types";

const level500: Level = {
  level: 500,
  title: "The Combined Picture",
  goal: "Synthesize every metric learned so far into a single before-the-pick judgment.",
  lessons: [
    {
      id: "l500-1",
      level: 500,
      order: 1,
      title: "No Metric Works Alone",
      jargonTerm: null,
      body:
        "Every headline number you've met so far — a P/E ratio, a margin, a revenue growth figure — is really a summary. Underneath it sits a combination of smaller parts, and one of the most common mistakes is treating the summary as the whole story instead of pulling it apart to see what it's actually made of.\n\n" +
        "Take profit itself: it's simply margin multiplied by sales. A company can report growing profit purely because sales are rising, even while its margin is quietly shrinking — the same idea taught back in Level 300's lesson on margins, now applied one level up. A single impressive profit figure can hide a business that's becoming less efficient at converting each sale into profit, a detail that only shows up once you decompose the number into its parts.\n\n" +
        "Here's a hypothetical to make this concrete. Imagine a company boasting record profit, up 15% from the year before. On the surface, that looks unambiguously strong. But suppose sales actually grew 40% over the same period — meaning margin, the share of each sales dollar kept as profit, actually fell sharply. The company grew its way to a bigger profit number while quietly becoming a less efficient business. The headline number alone would never have revealed that; only decomposing it into sales and margin does.\n\n" +
        "This is the plain-English version of a well-known professional idea sometimes called the DuPont approach: break a headline number into the smaller ratios that produced it, and each of those ratios usually tells you something the combined number hides.",
      matchupHook:
        "Whenever one company's metrics panel numbers look unusually strong, check whether they hold up once decomposed — a strong Revenue Growth figure paired with a weak margin story tells a different tale than the headline alone.",
      quiz: {
        questionType: "multiple_choice",
        questionText:
          "A company's profit rises 15%, but its sales rise 40% over the same period. What does this combination most likely reveal?",
        options: [
          "The company's profit margin actually shrank, even though the headline profit number grew",
          "The company's profit margin must have grown, since profit rose at all",
          "The company's revenue and profit figures must be reported incorrectly",
          "The company has definitely taken on too much debt",
        ],
        correctAnswer: "The company's profit margin actually shrank, even though the headline profit number grew",
        explanation:
          "If sales grew much faster than profit, the share of each sales dollar kept as profit — the margin — must have fallen, even while the profit total still rose.",
      },
      isCapstone: false,
      tags: ["fundamentals"],
    },
    {
      id: "l500-2",
      level: 500,
      order: 2,
      title: "Factor Lenses: Value, Quality, Momentum",
      jargonTerm: "factor",
      body:
        "Professional investors have a vocabulary for grouping metrics by what underlying question they answer, rather than by which financial statement they came from. Each of these groupings is called a factor — a shared characteristic that helps explain why a stock behaves the way it does.\n\n" +
        "Three factors cover almost everything taught in this Hub so far. Value asks whether a stock is cheap or expensive relative to what it earns — this is where the P/E ratio lives. Quality asks how healthy and durable the underlying business is — margins, debt levels, and moats all belong here. Momentum asks how the stock has been behaving lately — the 52-week high reading and recent price behavior both sit in this lens.\n\n" +
        "Sorting the metrics panel into these three columns is a useful mental exercise. Market Cap and Revenue Growth mostly describe size and quality; P/E Ratio and Analyst Consensus lean toward value; Beta and vs 52-Week High lean toward momentum. A company can score well on one lens and poorly on another — a high-quality business can still look expensive on value, and a cheap stock on value can still have terrible momentum.\n\n" +
        "No single factor is universally \"the right one\" to weight most heavily — professionals disagree constantly about which lens matters most, and the answer often depends on the specific decision being made. What matters here is simply recognizing which lens a given metric belongs to, so a strong reading in one lens isn't mistaken for a strong reading everywhere.",
      matchupHook:
        "Try sorting each metric in a matchup's panel into value, quality, or momentum — it's a quick way to see whether a company is strong across the board or only in one lens.",
      quiz: {
        questionType: "multiple_choice",
        questionText: "Which factor lens does the P/E ratio primarily belong to?",
        options: ["Value", "Quality", "Momentum", "None of these — P/E isn't a factor-based metric"],
        correctAnswer: "Value",
        explanation:
          "P/E measures how a stock is priced relative to its earnings, which is the core question the value lens asks.",
      },
      isCapstone: false,
      tags: ["valuation"],
    },
    {
      id: "l500-3",
      level: 500,
      order: 3,
      title: "Checklists Beat Hunches",
      jargonTerm: "checklist",
      body:
        "One of the more surprising findings in investing research is how well simple, mechanical checklists perform compared to expert gut instinct. A checklist here means a short, fixed list of yes-or-no questions applied consistently to every decision, rather than a fresh judgment call made from scratch each time.\n\n" +
        "The insight, often associated with the researcher Joseph Piotroski, is that individually each check on a good checklist is fairly obvious — is profit positive, is debt falling, is margin improving. None of these alone is a deep secret. But applied together, consistently, across every decision, they catch problems and opportunities that an expert relying purely on impression and memory frequently misses, simply because no person can perfectly weigh a dozen factors the same way every single time.\n\n" +
        "This is exactly why consistency beats brilliance in this context. An expert who is right eighty percent of the time by instinct, but whose attention wanders or whose mood colors a handful of decisions, can be outperformed over many decisions by a plain checklist applied the same way every time, with no bad days and no shortcuts taken under pressure.\n\n" +
        "This is also why professionals use scorecards even when they \"know\" the answer already. The checklist isn't there because the expert lacks knowledge — it's there because consistent process protects against the very human tendency to skip a step exactly when overconfidence is highest.",
      matchupHook:
        "The next lesson turns this idea into an actual checklist built specifically for Munymo matchups — a fixed set of questions to run through before every pick.",
      quiz: {
        questionType: "true_false",
        questionText:
          "Research suggests that simple, consistently-applied checklists tend to underperform expert judgment made fresh each time.",
        options: null,
        correctAnswer: "False",
        explanation:
          "Simple checklists applied consistently often outperform case-by-case expert judgment, because consistency guards against skipped steps and overconfidence.",
      },
      isCapstone: false,
      tags: ["scorecard"],
    },
    {
      id: "l500-4",
      level: 500,
      order: 4,
      title: "Horizon Discipline",
      jargonTerm: null,
      body:
        "Nearly every mistake covered in this Hub traces back to one root cause: answering a question at the wrong time horizon. Every metric answers a question at a specific time horizon, and using a long-horizon metric to answer a one-day question is the single most common beginner mistake in reading a matchup.\n\n" +
        "A company can have outstanding fundamentals — strong margins, low debt, a durable moat — and still lose a single trading session to a weaker business, because fundamentals answer a years-long question, not a one-day one. Conversely, a company can have a highly favorable catalyst and still be a poor long-term holding, because a catalyst answers a one-day question, not a years-long one. Neither metric is wrong; each is simply being asked about the wrong timeframe if misapplied.\n\n" +
        "This principle has a built-in daily reminder, hiding in plain sight on every matchup page: the two metric-panel groups. The Long Game section exists specifically to hold the years-long questions — market cap, P/E, revenue growth, analyst consensus. Game-Day Setup exists specifically to hold the single-session questions — beta, next earnings, momentum. The panel's entire two-group structure is horizon discipline made visible.\n\n" +
        "Before weighing any single metric heavily in a pick, it's worth pausing to ask which section it lives in, and whether that matches the actual question being decided — a single day's winner, not a multi-year investment.",
      matchupHook:
        "The Long Game and Game-Day Setup headers on every matchup panel are this exact principle, built into the page itself — use them as your daily horizon check.",
      quiz: {
        questionType: "multiple_choice",
        questionText: "What is the most common beginner mistake this lesson identifies?",
        options: [
          "Using a long-horizon metric (like a fundamental) to answer a one-day question",
          "Reading the pairing rationale before the metrics panel",
          "Checking beta before checking market cap",
          "Trusting analyst ratings more than price targets",
        ],
        correctAnswer: "Using a long-horizon metric (like a fundamental) to answer a one-day question",
        explanation:
          "Every metric answers a question at a specific time horizon — the most common mistake is applying a years-long metric to a single trading day's question.",
      },
      isCapstone: false,
      tags: ["fundamentals"],
    },
    {
      id: "l500-5",
      level: 500,
      order: 5,
      title: "The Munymo Matchup Scorecard",
      jargonTerm: null,
      body:
        "This lesson turns everything in the Hub into one short, repeatable checklist: the Munymo Matchup Scorecard. Run through these four questions, in order, before locking in a pick.\n\n" +
        "One: what's the catalyst? Identify the specific event, scheduled or surprise, that gives either company a reason to make an outsized move. Two: which is the bigger mover? Compare beta and recent momentum to judge which company is set up to swing further, in either direction. Three: is the news already priced in? Weigh whether the market has already absorbed the expected story, since a genuinely good result can still disappoint if something even better was expected. Four: fundamentals as tiebreak. When the first three questions leave things close, let the Long Game metrics — margins, growth, moat — break the tie.\n\n" +
        "Here's a worked hypothetical. Company A reports earnings in two days and carries a beta of 1.6; Company B has no near-term catalyst and a beta of 0.8. Catalyst: clearly Company A. Bigger mover: also Company A, given its higher beta. Priced in: suppose analysts already expect strong results from Company A, narrowing the room for a positive surprise. Fundamentals as tiebreak: if Company B has notably stronger margins and lower debt, that's a real point in its favor for a close call — even though Company A remains the more catalyst-driven pick heading into the session.\n\n" +
        "The four questions won't always point at the same company, and that's fine — the Scorecard's job is to force a structured comparison, not to guarantee a single obvious answer every time.",
      matchupHook:
        "Run these four questions against a live matchup right now, in order, before you lock in your next pick — that's the whole exercise.",
      quiz: {
        questionType: "multiple_choice",
        questionText: "What is the correct order of the four Munymo Matchup Scorecard questions?",
        options: [
          "Catalyst, bigger mover, priced in, fundamentals as tiebreak",
          "Fundamentals, catalyst, bigger mover, priced in",
          "Bigger mover, fundamentals, catalyst, priced in",
          "Priced in, catalyst, fundamentals, bigger mover",
        ],
        correctAnswer: "Catalyst, bigger mover, priced in, fundamentals as tiebreak",
        explanation:
          "The Scorecard runs catalyst first, then bigger mover, then whether the news is priced in, and finally fundamentals only as a tiebreaker.",
      },
      isCapstone: false,
      tags: ["scorecard"],
    },
    {
      id: "l500-6",
      level: 500,
      order: 6,
      title: "CAPSTONE: Run It Live",
      jargonTerm: null,
      body:
        "Everything in the Learning Hub has been building toward this single habit: actually running the Scorecard on a live matchup before picking, not just understanding it in theory. This capstone is an instruction, not a concept — the doing is the lesson.\n\n" +
        "Before locking in a pick, work through the four Scorecard questions from the previous lesson against the two real companies in front of you. Write your answer down somewhere — even a single sentence naming your pick and your main reason is enough. The writing matters as much as the thinking, because it's what makes the next step possible.\n\n" +
        "After results are published, compare your written reasoning against that game's Hindsight Spotlight, the same practice introduced back in Level 400's hindsight lesson. Did the catalyst you named actually drive the move? Was the news priced in the way you expected? This comparison is where the real learning happens — not in winning or losing any single day, but in checking whether your reasoning process matches what actually happened.\n\n" +
        "The point of this whole exercise is calibration over time, not single-day wins. Any single matchup can go against good reasoning, and any single matchup can go for bad reasoning — one day proves very little. Run the Scorecard consistently across many matchups, honestly compare your reasoning to each outcome, and your judgment will sharpen in ways no single win or loss ever could.",
      matchupHook:
        "Open the live matchup now, run the four-question Scorecard, and write down your pick and reasoning before you commit — then check it against the Hindsight Spotlight once results are in.",
      quiz: {
        questionType: "multiple_choice",
        questionText: "What is the actual goal of running the Scorecard and comparing it to the Hindsight Spotlight over time?",
        options: [
          "Calibrating your judgment over many matchups, not winning any single day",
          "Guaranteeing a correct pick on every matchup",
          "Proving that fundamentals always outweigh catalysts",
          "Eliminating the need to ever read a pairing rationale again",
        ],
        correctAnswer: "Calibrating your judgment over many matchups, not winning any single day",
        explanation:
          "A single matchup proves very little either way — the value is in comparing reasoning to outcomes consistently over time.",
      },
      isCapstone: true,
      tags: ["scorecard"],
    },
  ],
};

export default level500;
