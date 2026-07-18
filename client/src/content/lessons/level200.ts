import type { Level } from "./types";

const level200: Level = {
  level: 200,
  title: "Game-Day Setup: What Moves a Stock in One Day",
  goal: "Explain why these two companies, on this specific day, are the matchup worth watching.",
  lessons: [
    {
      id: "l200-1",
      level: 200,
      order: 1,
      title: "Catalysts",
      jargonTerm: "catalyst",
      body:
        "Stocks don't move in big ways for no reason. A stock that jumps or drops sharply in a single session almost always has a catalyst behind it — a specific event that gives buyers and sellers a reason to change their minds about what the company is worth right now.\n\n" +
        "Catalysts come in two flavors. Scheduled catalysts are events everyone can see coming on a calendar: a quarterly earnings report, a product launch date, a regulatory ruling with a known decision date. Everyone knows it's happening, even if nobody knows the outcome yet. Surprise catalysts arrive with no warning at all — a merger announcement, a sudden executive departure, an unexpected lawsuit or recall.\n\n" +
        "Most big single-day moves trace back to a nameable event of one of these two kinds. That's genuinely useful to know, because it means a stock's daily behavior is rarely mysterious after the fact — there's almost always something you could point to and say \"that's what did it.\"\n\n" +
        "This is the whole logic behind how Munymo's daily matchups get built. Each day's pairing is chosen because something — scheduled or surprise — has put one or both companies in a position where today's move is likely to be bigger than an ordinary day. Learning to spot the catalyst is the first step to understanding why a matchup was set up the way it was.",
      matchupHook:
        "The pairing rationale on every matchup page exists specifically to name the catalyst behind that day's pairing — read it first, before anything else.",
      quiz: {
        questionType: "multiple_choice",
        questionText: "Which of these is an example of a scheduled catalyst, rather than a surprise catalyst?",
        options: [
          "A quarterly earnings report with a known release date",
          "A surprise executive resignation",
          "An unexpected lawsuit being filed",
          "A sudden merger announcement",
        ],
        correctAnswer: "A quarterly earnings report with a known release date",
        explanation:
          "Scheduled catalysts appear on a known calendar, like earnings dates; surprise catalysts (resignations, lawsuits, mergers) arrive without warning.",
      },
      isCapstone: false,
      tags: ["catalyst"],
    },
    {
      id: "l200-2",
      level: 200,
      order: 2,
      title: "Earnings Day",
      jargonTerm: "earnings report",
      body:
        "Of all the scheduled catalysts a company can have, none is bigger or more regular than its earnings report — the quarterly announcement of how much it sold, how much profit it made, and what it expects going forward. Every public company reports roughly four times a year, and the market treats each one as a genuine event.\n\n" +
        "Timing matters here. Some companies report before the market opens, giving traders the whole day to react to the news during normal hours. Others report after the market closes, which means the real reaction often shows up the next morning, sometimes as a large jump between one day's close and the next day's open.\n\n" +
        "Either way, the days around a report are jumpier than normal — even before the numbers are out, traders are positioning themselves based on guesses about what the report will say, which can move the price on its own. Once the actual numbers land, the price frequently makes its biggest move of the entire quarter within minutes.\n\n" +
        "When you're sizing up a matchup, checking whether either company has an earnings report landing on or near the game day is one of the fastest ways to spot which one is more likely to make an outsized move — in either direction.",
      matchupHook:
        "The Next Earnings metric in the Game-Day Setup section tells you exactly how close either company is to its next report — the single biggest thing to check before picking.",
      quiz: {
        questionType: "true_false",
        questionText:
          "The days immediately before a company's earnings report tend to be calmer than usual, since nothing has been announced yet.",
        options: null,
        correctAnswer: "False",
        explanation:
          "The days around an earnings report tend to be jumpier than normal, as traders position themselves ahead of the news.",
      },
      isCapstone: false,
      tags: ["earnings", "catalyst"],
    },
    {
      id: "l200-3",
      level: 200,
      order: 3,
      title: "Expectations vs. Surprise",
      jargonTerm: null,
      body:
        "This is arguably the single most important idea in the whole Learning Hub. A stock's price already contains everyone's current expectations about the company — good news that everyone already saw coming is, in a sense, already \"priced in\" before it's officially announced. What actually moves the price on the day itself is not the news being good or bad in absolute terms, but the difference between what happened and what was expected.\n\n" +
        "This is exactly why a genuinely good earnings report can send a stock falling. Imagine a company whose sales grow by 20% over the past year — a strong, healthy result by almost any normal standard. But if the market had been expecting 25% growth, that \"good\" 20% is actually a disappointment relative to expectations, and the stock can drop sharply on the news, even though the company's business is objectively doing well.\n\n" +
        "The reverse works too: a company reporting a loss can rally hard if the loss is smaller than everyone feared. It's never just about the number — it's always about the number compared to what the market had already built into the price.\n\n" +
        "Keep this in mind on every game day. Before assuming \"good news equals a rising stock,\" ask what the market was expecting in the first place. The gap between expectation and outcome, not the outcome alone, is usually what actually moves the needle.",
      matchupHook:
        "Whenever a matchup's pairing rationale mentions analyst expectations ahead of a report, that's this exact lesson playing out live — the surprise, not the raw result, is what to watch.",
      quiz: {
        questionType: "multiple_choice",
        questionText:
          "A company's sales grow 20% year-over-year, but the market expected 25% growth. What is the most likely reaction?",
        options: [
          "The stock could fall, because the result missed expectations even though it was objectively strong",
          "The stock will definitely rise, because 20% growth is always good news",
          "The stock price won't move at all, since growth of any kind is priced in automatically",
          "The company will be forced to restate its earnings",
        ],
        correctAnswer:
          "The stock could fall, because the result missed expectations even though it was objectively strong",
        explanation:
          "Prices move on the gap between actual results and what was already expected, not on whether the result is good in absolute terms.",
      },
      isCapstone: false,
      tags: ["earnings"],
    },
    {
      id: "l200-4",
      level: 200,
      order: 4,
      title: "Beta & Volatility",
      jargonTerm: "beta",
      body:
        "When two companies are paired up in a matchup, one question matters as much as which direction each will move: which one is likely to move by more? That's what beta measures — how much a stock tends to swing compared to the overall market.\n\n" +
        "A beta of 1.0 means a stock roughly tracks the market: a 1% move in the broader market tends to produce something close to a 1% move in that stock. A beta above 1.0 means the stock swings harder than the market in both directions — a beta of 1.5 suggests a 1% market move often becomes something closer to a 1.5% move in that stock. A beta below 1.0 means the opposite: a steadier stock that tends to move less than the market around it.\n\n" +
        "It's important to be precise about what beta does and doesn't tell you. It says nothing about which direction a stock will move — only how forcefully it tends to move once something happens. A high-beta stock isn't more likely to go up; it's more likely to go up a lot, or down a lot.\n\n" +
        "In a head-to-head matchup, the higher-beta company is usually the bigger mover on the day, for better or worse — more likely to deliver a large win, and just as likely to deliver a large loss if things go the other way. It's a measure of magnitude, not of direction.",
      matchupHook:
        "Beta lives in the Game-Day Setup section of every matchup — compare the two companies' beta values to see which one is set up to be the bigger mover today.",
      quiz: {
        questionType: "true_false",
        questionText:
          "A stock with a high beta is more likely to move upward than a stock with a low beta.",
        options: null,
        correctAnswer: "False",
        explanation:
          "Beta measures the size of a stock's typical move, not its direction — a high-beta stock can move sharply either way.",
      },
      isCapstone: false,
      tags: ["beta"],
    },
    {
      id: "l200-5",
      level: 200,
      order: 5,
      title: "Momentum & the 52-Week High",
      jargonTerm: "momentum",
      body:
        "Stocks that have been trading near their highest price of the past year have, by definition, been rewarded by the market lately — something about the story has kept buyers willing to pay up. That tendency for a moving stock to keep moving in the same direction is called momentum.\n\n" +
        "Momentum can behave in two very different ways. Sometimes it continues: a stock near its highs keeps climbing because whatever has been driving it hasn't run out of steam yet. Other times it snaps back: a stock that has run up quickly attracts investors looking to lock in gains, and the price pulls back even without any bad news at all.\n\n" +
        "One of the fastest ways to get a read on momentum is to check how far a stock's latest closing price sits below its 52-week high — the highest closing price it has reached over the past year. A stock sitting only a few percent below its high has strong, current momentum behind it; a stock sitting far below its high has been out of favor for a while, for reasons that may or may not still apply.\n\n" +
        "Neither position guarantees anything about today's game specifically — momentum can continue or reverse on any given day — but it's a useful, quick signal about which company currently has the market's confidence, and which one has ground to make up.",
      matchupHook:
        "The \"vs 52-Week High\" metric in Game-Day Setup is exactly this reading — check which company is closer to its high before your next pick.",
      quiz: {
        questionType: "multiple_choice",
        questionText: "What does it mean if a stock is trading only 2% below its 52-week high?",
        options: [
          "It has strong recent momentum — the market has been rewarding it lately",
          "It is guaranteed to keep rising for the rest of the year",
          "It is undervalued compared to its competitors",
          "It has just reported disappointing earnings",
        ],
        correctAnswer: "It has strong recent momentum — the market has been rewarding it lately",
        explanation:
          "Trading close to a 52-week high signals recent strength, though momentum can still continue or reverse from there.",
      },
      isCapstone: false,
      tags: ["momentum"],
    },
    {
      id: "l200-6",
      level: 200,
      order: 6,
      title: "Short Interest",
      jargonTerm: "short selling",
      body:
        "Not every investor is betting that a stock will rise. Short selling is a way of betting the opposite — an investor borrows shares, sells them immediately, and hopes to buy them back later at a lower price, pocketing the difference. It's a real, if riskier, way to profit specifically when a stock falls.\n\n" +
        "When a large share of a company's stock is being held this way, that's called heavy short interest, and it tells you something meaningful: a significant number of sophisticated investors currently expect the stock to drop. That's useful information about market pessimism toward the company.\n\n" +
        "But heavy short interest is also fuel for the opposite outcome. If good news arrives and the stock starts rising instead of falling, short sellers face mounting losses on a bet that keeps getting more expensive to hold. Many of them rush to buy shares back to close out their position and limit the damage — and that rush of buying can push the price up even further, in a self-reinforcing cycle often called a short squeeze. In plain terms: a stock everyone bet against can become the stock that rises the fastest, precisely because so many people need to buy it back at once.\n\n" +
        "Short interest isn't currently shown as a metric in the panel, but it's exactly the kind of detail worth watching for in a matchup's research notes — a heavily shorted stock carries the potential for a much sharper rebound than its fundamentals alone would suggest.",
      matchupHook:
        "This isn't one of the standard panel metrics — watch for it mentioned in a matchup's research notes instead, especially when a rebound looks larger than expected.",
      quiz: {
        questionType: "multiple_choice",
        questionText: "What is a \"short squeeze\"?",
        options: [
          "A rush of short sellers buying shares back to limit losses, which pushes the price up further",
          "A company voluntarily reducing the number of shares it has issued",
          "A sudden drop in a stock caused entirely by bad earnings",
          "A rule that forces all short sellers to sell at the same time each quarter",
        ],
        correctAnswer:
          "A rush of short sellers buying shares back to limit losses, which pushes the price up further",
        explanation:
          "When a heavily shorted stock rises, short sellers scrambling to buy back shares can accelerate the rise even further.",
      },
      isCapstone: false,
      tags: ["short-interest"],
    },
    {
      id: "l200-7",
      level: 200,
      order: 7,
      title: "CAPSTONE: Decoding the Pairing Rationale",
      jargonTerm: null,
      body:
        "You've now met the building blocks of a single trading day: catalysts, earnings reports, the gap between expectation and surprise, beta, momentum, and short interest. This lesson is about putting them to work by reading a matchup's pairing rationale like someone who knows what to look for.\n\n" +
        "Start by finding the catalyst. Somewhere in the rationale there should be a nameable reason these two companies were paired today — a scheduled event, a piece of breaking news, a shared sector story. If you can't identify it, reread the rationale until you can; it's almost always there.\n\n" +
        "Next, ask which company is the expected bigger mover. This is where beta and momentum come in — the rationale may hint at it directly, or you may need to check the metrics panel yourself to see which company looks more primed for a large swing.\n\n" +
        "Finally, look for the open question the rationale is quietly posing — usually some version of \"will this beat or miss what's expected?\" That's the expectations-versus-surprise idea in action, and it's usually the real crux of the matchup, more than any single fact stated outright. Reading a pairing rationale well means walking away with a catalyst, a likely bigger mover, and an open question — not just a summary of company news.",
      matchupHook:
        "Practice this on today's live matchup: find the catalyst, the likely bigger mover, and the open question in the pairing rationale before you lock in your pick.",
      quiz: {
        questionType: "multiple_choice",
        questionText:
          "When decoding a pairing rationale, what three things should you look for, in order?",
        options: [
          "The catalyst, the likely bigger mover, and the open question",
          "A prediction of which company will win, so you can copy it",
          "Each company's share price, ticker symbol, and exchange",
          "A complete history of both companies' past earnings reports",
        ],
        correctAnswer: "The catalyst, the likely bigger mover, and the open question",
        explanation:
          "A well-read pairing rationale yields a nameable catalyst, a sense of which company is the likely bigger mover, and the open question the matchup is really asking.",
      },
      isCapstone: true,
      tags: ["catalyst"],
    },
  ],
};

export default level200;
