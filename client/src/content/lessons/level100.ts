import type { Level } from "./types";

const level100: Level = {
  level: 100,
  title: "How the Market Works",
  goal: "Explain what the daily game is actually measuring, from the ground up.",
  lessons: [
    {
      id: "l100-1",
      level: 100,
      order: 1,
      title: "What a Share Actually Is",
      jargonTerm: "share",
      body:
        "A company that wants to raise money can slice its ownership into equal pieces and sell them off. Each of those pieces is a share — a small, tradeable slice of everything the company owns and everything it might earn in the future. If a company has issued one million shares, owning one means you own one-millionth of the whole business: its factories, its brand, its cash, its debts, all of it.\n\n" +
        "Shares exist in a fixed quantity at any given moment. A company doesn't print a new share every time someone wants to buy one — it issues a set number when it goes public (and can issue more later, or buy some back), but on any ordinary trading day the pool of shares is fixed. That's why buying and selling shares is really just existing owners trading their slices back and forth, not the company handing out new pieces on demand.\n\n" +
        "Because a share represents real ownership, it has a price for the same reason anything else does: someone is willing to pay for it. A share in a business that's expected to grow and earn money is worth something to a buyer, and that value gets a price tag the moment someone agrees to trade it. The price isn't set by the company — it's set by whoever is willing to buy and sell at that moment.\n\n" +
        "Every matchup you'll play is really a comparison between two of these ownership slices. When you're deciding which company will do better, you're deciding which slice of real ownership the market will value more highly by the end of the day. You'll see both companies' shares represented throughout the matchup page — ticker, name, and price — as a reminder that behind every chart is an actual piece of a real business.",
      matchupHook:
        "Every matchup page shows both companies by name and ticker — a reminder that you're comparing two real, ownable businesses, not just two lines on a chart.",
      quiz: {
        questionType: "multiple_choice",
        questionText: "What does owning one share of a company mean?",
        options: [
          "You own a small, fixed fraction of the entire company",
          "You are owed a fixed dollar amount by the company",
          "You have a temporary loan agreement with the company",
          "You own the rights to one specific product the company sells",
        ],
        correctAnswer: "You own a small, fixed fraction of the entire company",
        explanation:
          "A share is a slice of ownership in the whole business, not a loan, a coupon, or a claim on one product.",
      },
      isCapstone: false,
      tags: ["basics"],
    },
    {
      id: "l100-2",
      level: 100,
      order: 2,
      title: "Why Prices Move",
      jargonTerm: null,
      body:
        "A stock's price isn't handed down by the company, a government body, or any single authority. It's set continuously by buyers and sellers agreeing to trade — someone offers to sell at a price, someone else offers to buy, and every completed trade becomes the new \"last price.\" Nobody sets the price centrally; it emerges from thousands of separate decisions happening at once.\n\n" +
        "You can think of the price as the market's current best guess of what the company is worth. It's not a fact carved in stone — it's a constantly updated estimate, built from everything every buyer and seller currently knows or believes about the company's future.\n\n" +
        "That's exactly why prices move. The moment new information arrives — a product launch, a lawsuit, a stronger-than-expected quarterly report, even a rumor — buyers and sellers reassess what the company is worth, and their new guess becomes the new price. A more optimistic guess pulls the price up; a more pessimistic one pushes it down.\n\n" +
        "This is the whole engine behind the daily game. Two companies enter the trading day with two current \"guesses\" attached to their share prices. What happens next depends on which company's guess gets revised upward by more (or downward by less) once the day's information lands. You're not predicting a random number — you're predicting whose story the market will like better by the closing bell.",
      matchupHook:
        "The pairing rationale on every matchup page is essentially a preview of what new information might arrive that day and reprice one company more than the other.",
      quiz: {
        questionType: "true_false",
        questionText:
          "A stock's price is set by a central authority, like the stock exchange or the company itself.",
        options: null,
        correctAnswer: "False",
        explanation:
          "The price emerges from buyers and sellers agreeing to trade — no single party sets it.",
      },
      isCapstone: false,
      tags: ["basics"],
    },
    {
      id: "l100-3",
      level: 100,
      order: 3,
      title: "The Trading Day",
      jargonTerm: "closing price",
      body:
        "A stock market doesn't trade around the clock. It opens at a set time, trades continuously through the session, and then closes at a set time — and only during that main session does the deepest, widest pool of buyers and sellers participate. Some trading does happen before the open and after the close, but far fewer people take part, so prices there can swing on thin activity that doesn't always hold up once the main session resumes.\n\n" +
        "The price a stock settles at when the main session ends each day is its closing price. It's the last agreed-upon trade of the regular session — the number that appears in every table, every headline, and every scoreboard for that day.\n\n" +
        "That's why the close matters so much more than any single moment during the day. A stock can spike or dip an hour into trading and fully reverse by the end of the session. The close is the day's settled verdict — it's what's left standing after every buyer and seller who wanted a say has had one.\n\n" +
        "It's also exactly what Munymo scores. The game compares each company's price at the start of the session to its closing price, because that comparison reflects the full day's worth of information and trading, not a random snapshot from the middle of the afternoon. When you're picking a winner, you're picking whichever company's closing price ends up further ahead.",
      matchupHook:
        "The performance numbers shown after a matchup ends are always close-to-close — the same settled verdict this lesson describes.",
      quiz: {
        questionType: "multiple_choice",
        questionText: "Why does Munymo score close-to-close instead of using a mid-day price?",
        options: [
          "The close reflects the full day's trading, settled by the widest pool of participants",
          "Mid-day prices are not publicly available",
          "Closing prices are always higher than opening prices",
          "Regulators require it for all stock games",
        ],
        correctAnswer:
          "The close reflects the full day's trading, settled by the widest pool of participants",
        explanation:
          "The close is the day's settled verdict after the deepest trading activity of the session — a mid-day price could still reverse.",
      },
      isCapstone: false,
      tags: ["basics"],
    },
    {
      id: "l100-4",
      level: 100,
      order: 4,
      title: "Percentage Change, Not Price",
      jargonTerm: "percentage change",
      body:
        "Two companies can trade at wildly different prices for reasons that have nothing to do with which one is bigger or better — it mostly comes down to how many shares each has issued. Comparing them by raw dollar price tells you almost nothing useful.\n\n" +
        "That's why Munymo scores matchups on percentage change: how much a price moved, expressed as a share of where it started, rather than in raw dollars. Percentage change normalizes size, so a company trading at a low price and one trading at a high price can be compared on equal footing.\n\n" +
        "Here's a toy example. Imagine Company X starts the day at $10 and closes at $10.50 — that's a rise of fifty cents, or 5%. Now imagine Company Y starts the day at $500 and closes at $510 — a rise of ten dollars. Ten dollars looks like the bigger move, but it's only a 2% gain. Company X actually had the stronger day, even though its dollar move was tiny by comparison.\n\n" +
        "This is exactly why a $2 stock can beat a $500 stock in the game. It isn't about which company is more expensive to buy — it's about which one moved further, proportionally, from where it started. Every matchup result you see is built entirely on this percentage comparison, never on raw price.",
      matchupHook:
        "The performance figures shown for each company at the end of every matchup (like \"+2.45%\") are percentage changes — that's the actual scoring measure, never the dollar price.",
      quiz: {
        questionType: "multiple_choice",
        questionText:
          "Company X rises from $10 to $10.50. Company Y rises from $500 to $510. Which company had the bigger percentage change?",
        options: ["Company X", "Company Y", "They are exactly equal", "It cannot be determined from this information"],
        correctAnswer: "Company X",
        explanation:
          "Company X gained 5% (50 cents on $10) while Company Y gained only 2% ($10 on $500), even though Y's dollar move was larger.",
      },
      isCapstone: false,
      tags: ["basics"],
    },
    {
      id: "l100-5",
      level: 100,
      order: 5,
      title: "Market Cap",
      jargonTerm: "market capitalization",
      body:
        "How big is a company, really? Not by counting its offices or its employees, but by the value the stock market currently places on the whole business. That figure is called market capitalization — usually shortened to \"market cap\" — and it's calculated simply as the share price multiplied by the total number of shares outstanding.\n\n" +
        "This is where a common mix-up happens: a high share price does not mean a company is large, and a low share price does not mean a company is small or cheap. A company with a $20 share price and five billion shares outstanding is worth far more than a company with a $400 share price and ten million shares outstanding. Price alone tells you what one slice costs — it says nothing about how many slices exist or what the whole business is worth.\n\n" +
        "Market cap is what actually answers the size question. Big does not automatically mean better, and small does not automatically mean cheap — a large market cap usually signals an established business with a long track record, while a smaller one usually signals a younger company with more room to grow (and more room to stumble).\n\n" +
        "When you're comparing two companies in a matchup, market cap gives you a quick read on what kind of contest you're watching: two giants of similar size, two young challengers, or a mismatched David-and-Goliath pairing. That framing shapes how much a single day's news is likely to move each one.",
      matchupHook:
        "Market Cap sits in the Long Game section of every matchup's metrics panel — check it before assuming the higher-priced company is automatically the bigger one.",
      quiz: {
        questionType: "true_false",
        questionText:
          "A company with a higher share price is always a bigger company than one with a lower share price.",
        options: null,
        correctAnswer: "False",
        explanation:
          "Company size depends on share price multiplied by total shares outstanding — market cap — not price alone.",
      },
      isCapstone: false,
      tags: ["basics"],
    },
    {
      id: "l100-6",
      level: 100,
      order: 6,
      title: "CAPSTONE: Reading a Matchup Page",
      jargonTerm: null,
      body:
        "You now know what a share is, why prices move, why the close is what matters, why percentage change is the real scoreboard, and how market cap measures size. This lesson pulls it together into a guided tour of the matchup page itself.\n\n" +
        "At the top sits the pairing rationale — a short explanation of why these two companies were put head-to-head on this particular game day. It usually points at whatever event or story might cause one of them to move more than the other, which is the whole reason the matchup is interesting.\n\n" +
        "Below that is the research summary — a plain-English rundown of each company's situation, written so a first-time player can follow it without prior knowledge. Underneath the summary sits the metrics panel, split into two labelled groups that ask two different questions. The Long Game group covers fundamentals — the kind of numbers that matter over years, like market cap, revenue growth, and analyst consensus. Game-Day Setup covers what shapes the single session being played — numbers like beta and next earnings date, which speak to what might happen today specifically, not over the long run.\n\n" +
        "Finally, every matchup carries a lockout — a fixed deadline after which no more picks are accepted, so the game can be scored fairly once trading begins in earnest. Reading a matchup page well means knowing which section answers which question: rationale for \"why these two,\" the metric groups for \"the long game\" versus \"the game day,\" and the lockout for \"how much time do I have left to decide.\"",
      matchupHook:
        "Open today's matchup right now and find both metric groups — The Long Game and Game-Day Setup — before you make your next pick.",
      quiz: {
        questionType: "multiple_choice",
        questionText:
          "What question does the \"Game-Day Setup\" group of metrics answer, as opposed to \"The Long Game\"?",
        options: [
          "What might shape this single trading session, rather than the company's long-run fundamentals",
          "How much the company's stock has historically returned over ten years",
          "How many employees the company currently has",
          "Which company has the higher share price",
        ],
        correctAnswer:
          "What might shape this single trading session, rather than the company's long-run fundamentals",
        explanation:
          "Game-Day Setup metrics (like beta and next earnings) speak to the single session being played, while The Long Game covers years-long fundamentals.",
      },
      isCapstone: true,
      tags: ["basics"],
    },
  ],
};

export default level100;
