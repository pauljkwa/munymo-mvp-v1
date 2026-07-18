import type { Level } from "./types";

const level300: Level = {
  level: 300,
  title: "The Company Underneath",
  goal: "Learn the fundamentals vocabulary behind The Long Game half of the metrics panel.",
  lessons: [
    {
      id: "l300-1",
      level: 300,
      order: 1,
      title: "Revenue & Growth",
      jargonTerm: "revenue",
      body:
        "Every company's story starts with the same number: revenue, the total value of everything it sold, before any costs, salaries, or taxes are subtracted. It's often called the \"top line\" because of where it sits on a financial statement, and it's the simplest possible measure of demand for what a company makes or does.\n\n" +
        "On its own, a revenue figure doesn't say much — a company can be enormous or tiny, and the number alone won't tell you which direction it's heading. That's why revenue growth, the year-over-year change in that figure, usually matters more than the absolute size. A smaller company growing quickly is often judged more favorably than a much larger one that has stopped growing at all, because growth is a sign of a business gaining ground rather than standing still.\n\n" +
        "This is especially true for younger, expanding businesses, where investors are often willing to overlook thin or negative profits as long as revenue is climbing fast — the bet is that scale will eventually bring profit with it. For a mature business, slowing revenue growth can be an early warning sign, even while the company still looks large and stable on the surface.\n\n" +
        "Revenue growth is a momentum read on the underlying business itself, separate from anything happening in a single trading session. It answers a slow-moving question — is this company's core business expanding — rather than what might move its stock in the next few hours.",
      matchupHook:
        "Revenue Growth sits in the Long Game section of every matchup's metrics panel — a fast grower and a slow grower can still have an equally exciting single session, so don't confuse the two questions.",
      quiz: {
        questionType: "multiple_choice",
        questionText: "Why does revenue growth often matter more than a company's absolute revenue size?",
        options: [
          "Growth signals whether the business is expanding or standing still, which absolute size alone can't show",
          "A larger revenue figure is always a red flag for investors",
          "Revenue growth is the only number regulators require companies to report",
          "Absolute revenue size is never reported to the public",
        ],
        correctAnswer:
          "Growth signals whether the business is expanding or standing still, which absolute size alone can't show",
        explanation:
          "A company's size doesn't reveal its direction — growth rate shows whether it's gaining or losing ground.",
      },
      isCapstone: false,
      tags: ["fundamentals"],
    },
    {
      id: "l300-2",
      level: 300,
      order: 2,
      title: "Earnings & EPS",
      jargonTerm: "EPS (earnings per share)",
      body:
        "Revenue is only the starting point. Once a company subtracts everything it costs to run the business — materials, wages, rent, interest, taxes — what's left over is profit, more formally called earnings. Earnings are the number that actually belongs to the owners of the business.\n\n" +
        "Because companies have very different numbers of shares outstanding, raw earnings figures aren't easy to compare between companies. Earnings per share, or EPS, solves that by dividing total profit by the number of shares outstanding, showing how much profit each individual share is entitled to. It's usually measured on a trailing twelve month basis — the most recent full year of results — so it isn't skewed by one unusually strong or weak quarter.\n\n" +
        "Here's the detail worth sitting with: revenue can grow while earnings shrink at the very same time. A company can sell more than ever and still make less profit, if its costs are rising even faster than its sales — more competition forcing lower prices, or expenses that are growing out of control. That combination is a warning sign worth investigating, even when the top-line revenue story looks healthy.\n\n" +
        "Rising EPS over time is generally a healthy sign of a business getting more profitable per share; a shrinking or negative EPS is worth a closer look, especially alongside otherwise strong revenue growth.",
      matchupHook:
        "Archived matchups sometimes reference EPS (TTM) in their research notes — a useful cross-check against Revenue Growth to see whether sales gains are actually reaching the bottom line.",
      quiz: {
        questionType: "true_false",
        questionText:
          "It is impossible for a company's revenue to grow while its earnings shrink in the same period.",
        options: null,
        correctAnswer: "False",
        explanation:
          "Revenue can rise while earnings fall if costs are growing even faster than sales — a pattern worth investigating.",
      },
      isCapstone: false,
      tags: ["fundamentals"],
    },
    {
      id: "l300-3",
      level: 300,
      order: 3,
      title: "The P/E Ratio",
      jargonTerm: "P/E ratio",
      body:
        "Once you know a company's earnings per share, a natural next question is: how much does the market charge for a dollar of that profit? That's exactly what the Price-to-Earnings ratio, or P/E ratio, measures — a company's share price divided by its earnings per share.\n\n" +
        "A high P/E generally means investors expect strong future growth and are willing to pay a premium now for earnings they expect to arrive later. A low P/E can mean a genuine bargain, or it can mean the market has real doubts about the company's future — the ratio alone doesn't tell you which.\n\n" +
        "Consider two hypothetical companies trading at the exact same $100 share price. Company A earns $10 per share, giving it a P/E of 10. Company B earns only $2 per share, giving it a P/E of 50. Despite an identical price tag, Company B is priced far more expensively relative to what it currently earns — the market is betting heavily on its future growth, while Company A looks cheap by comparison on this measure alone.\n\n" +
        "P/E comparisons only make real sense within context — comparing companies in the same sector, at similar growth stages, is far more meaningful than comparing a mature company to a fast-growing one. Used well, though, it's the single fastest way to see which of two companies the market is more optimistic about, relative to what each currently earns.",
      matchupHook:
        "P/E Ratio sits in the Long Game section of every matchup's metrics panel — compare it alongside Revenue Growth to see whether a high P/E is backed by fast growth or just optimism.",
      quiz: {
        questionType: "multiple_choice",
        questionText:
          "Two companies both trade at $100 per share. Company A earns $10 per share; Company B earns $2 per share. What does this tell you about their P/E ratios?",
        options: [
          "Company B has a much higher P/E ratio, since its price is high relative to its current earnings",
          "Both companies have identical P/E ratios, since they share the same price",
          "Company A has a higher P/E ratio, since it earns more per share",
          "P/E ratio cannot be calculated without knowing the number of shares outstanding",
        ],
        correctAnswer:
          "Company B has a much higher P/E ratio, since its price is high relative to its current earnings",
        explanation:
          "P/E is price divided by earnings per share — the same price with much lower earnings produces a much higher ratio.",
      },
      isCapstone: false,
      tags: ["valuation"],
    },
    {
      id: "l300-4",
      level: 300,
      order: 4,
      title: "Margins",
      jargonTerm: "profit margin",
      body:
        "Two companies can report the exact same revenue and still be worth wildly different amounts, because of how much of each sales dollar actually survives as profit. That surviving share is the profit margin — profit divided by revenue, expressed as a percentage.\n\n" +
        "The classic contrast is software versus a grocery store. A software company can often keep thirty cents or more of every dollar it takes in, because once the product is built, serving one more customer costs very little extra. A grocery store might keep only a few cents of every dollar, because it has to buy, ship, and stock physical goods for every single sale. Neither business model is wrong — they simply convert sales into profit at very different rates.\n\n" +
        "This is exactly why margin differences explain so much of the gap between similarly-sized companies. Two businesses with identical revenue can have wildly different total value, because the market prices a company partly on how efficiently it turns sales into profit, not on sales alone. A high-margin business generally has more room to absorb a bad quarter, invest in growth, or return money to shareholders.\n\n" +
        "Margins can also shrink or expand over time — rising costs, new competition, or pricing power can all move them — so a margin trend often tells you as much as the current number itself.",
      matchupHook:
        "Margins aren't a standalone metric in the panel, but they explain a lot of the gap you'll sometimes see between two companies with similar Revenue Growth but very different Market Cap.",
      quiz: {
        questionType: "multiple_choice",
        questionText:
          "Two companies report identical revenue, but one has much higher profit margins than the other. What does this most likely explain?",
        options: [
          "Why the two companies can be worth very different total amounts despite equal sales",
          "That the lower-margin company has broken the law",
          "That both companies must have identical earnings per share",
          "That the higher-margin company has more shares outstanding",
        ],
        correctAnswer: "Why the two companies can be worth very different total amounts despite equal sales",
        explanation:
          "Margin measures how efficiently sales convert to profit — a big margin gap can justify a big gap in overall value, even with equal revenue.",
      },
      isCapstone: false,
      tags: ["fundamentals"],
    },
    {
      id: "l300-5",
      level: 300,
      order: 5,
      title: "Debt & the Balance Sheet",
      jargonTerm: "leverage",
      body:
        "Companies don't only fund themselves with money from selling shares — many also borrow, taking on debt to build factories, buy competitors, or simply keep the lights on through a slow patch. Using borrowed money to fund a business is called leverage, and it acts like an amplifier on whatever happens next.\n\n" +
        "In a good year, leverage can work in a company's favor: it borrows at a fixed cost, grows revenue and profit well beyond that cost, and the owners keep all the extra upside without having sold off more of the business to raise the same cash. In a bad year, the same leverage cuts the other way — debt payments don't shrink just because revenue does, so a company with heavy debt can see its profits (and its stock) fall much harder than a similar company with a cleaner balance sheet.\n\n" +
        "This is exactly why high debt makes a stock more sensitive to bad news and to interest rates. A jump in borrowing costs, or a rough quarter of sales, hits a heavily indebted company harder than it hits a lightly indebted one, because fixed debt payments still have to be made regardless of how business is going.\n\n" +
        "None of this makes debt automatically bad — plenty of well-run companies use it deliberately. But two companies with similar earnings can carry very different risk depending on how much they owe, and that risk tends to show up fastest exactly when conditions turn unfavorable.",
      matchupHook:
        "Debt levels aren't a standalone panel metric, but they're worth checking in a matchup's research notes whenever a company's reaction to bad news looks unusually sharp.",
      quiz: {
        questionType: "true_false",
        questionText:
          "A company with high debt is generally less sensitive to bad news than a company with little or no debt.",
        options: null,
        correctAnswer: "False",
        explanation:
          "Fixed debt payments don't shrink when revenue does, so highly leveraged companies tend to be more sensitive to bad news and rising interest rates, not less.",
      },
      isCapstone: false,
      tags: ["fundamentals"],
    },
    {
      id: "l300-6",
      level: 300,
      order: 6,
      title: "Moats & Competition",
      jargonTerm: "moat",
      body:
        "Some companies keep winning against their rivals year after year, while others in the exact same industry slowly fall behind. The durable advantage that protects a company from being copied or undercut is often called a moat — the same idea as a castle's moat keeping invaders out.\n\n" +
        "Moats come in several common forms. A strong brand can let a company charge more for what looks like the same product. High switching costs can make customers reluctant to leave, even if a rival is slightly cheaper. Network effects mean a product actually gets more valuable as more people use it, making it harder for a smaller rival to catch up. None of these advantages show up as a single number on a financial statement, but they show up over time in steadier revenue, fatter margins, and more resilient profits.\n\n" +
        "Same-sector rivals can start out looking almost identical and diverge sharply over the years, precisely because one built a moat and the other didn't. A company without any real moat has to compete mostly on price, which tends to squeeze margins over time as rivals copy whatever advantage briefly existed.\n\n" +
        "This connects directly to the game's head-to-head format: every matchup is implicitly a moat comparison. Two companies are placed side by side, and part of judging who has the edge is asking which one has the more durable advantage the other can't easily copy.",
      matchupHook:
        "A matchup's pairing rationale or research notes will often hint at each company's competitive position — read it with the moat question in mind: which one is harder to copy?",
      quiz: {
        questionType: "multiple_choice",
        questionText: "Which of these is the best example of a competitive \"moat\"?",
        options: [
          "A network effect that makes a product more valuable as more people use it",
          "A one-time discount offered to new customers",
          "A brief drop in the company's stock price",
          "An increase in the number of shares the company has issued",
        ],
        correctAnswer: "A network effect that makes a product more valuable as more people use it",
        explanation:
          "Network effects are a classic durable advantage — a temporary discount or a price move isn't a structural barrier to competition.",
      },
      isCapstone: false,
      tags: ["fundamentals"],
    },
    {
      id: "l300-7",
      level: 300,
      order: 7,
      title: "CAPSTONE: Fundamentals Don't Predict a Day",
      jargonTerm: null,
      body:
        "You've now met the core fundamentals vocabulary — revenue, earnings, P/E, margins, debt, and moats. This lesson is the horizon lesson from the fundamentals side, and it's worth taking seriously before moving on.\n\n" +
        "Two companies can differ hugely on every fundamental in this level — one with faster growth, fatter margins, a cleaner balance sheet, and a stronger moat — and still lose a single trading session to the other one entirely. Fundamentals describe the business as it stands over years of operating history; they say very little about what will happen between one market open and the next close.\n\n" +
        "This isn't a contradiction — it's two different questions being answered by two different sets of tools. Fundamentals answer the long game: which business is stronger, more durable, and more likely to compound value over years. Catalysts, covered back in Level 200, answer the game day: what specific event might move a price sharply within a single session, regardless of how strong the underlying business is.\n\n" +
        "A player who only ever checks fundamentals is answering the wrong question for a single-day game; a player who ignores them entirely loses a useful tiebreaker when nothing else points clearly one way or the other. Knowing which question each tool answers, and when to reach for which one, is the whole point of this level.",
      matchupHook:
        "Compare the Long Game and Game-Day Setup sections side by side on any matchup — they exist specifically to keep these two separate questions from getting blurred together.",
      quiz: {
        questionType: "multiple_choice",
        questionText:
          "A company has excellent fundamentals — strong growth, healthy margins, low debt. What does this tell you about a single day's trading session?",
        options: [
          "Very little on its own — fundamentals answer a long-run question, not what will happen in one session",
          "It guarantees the stock will rise that day",
          "It means the stock has no catalyst risk",
          "It means the company's P/E ratio must be low",
        ],
        correctAnswer:
          "Very little on its own — fundamentals answer a long-run question, not what will happen in one session",
        explanation:
          "Fundamentals describe the business over years; a single day's move is driven by catalysts and expectations, not by long-run business quality alone.",
      },
      isCapstone: true,
      tags: ["fundamentals"],
    },
  ],
};

export default level300;
