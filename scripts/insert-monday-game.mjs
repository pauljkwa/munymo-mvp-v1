/**
 * Manual insert: Monday 23 June 2026 — Netflix vs Disney
 * Inserts into: daily_games, game_research, validation_questions
 * Run: node scripts/insert-monday-game.mjs
 */
import mysql from "mysql2/promise";

const DB_URL = process.env.MUNYMO_DATABASE_URL;
if (!DB_URL) throw new Error("MUNYMO_DATABASE_URL not set");

const conn = await mysql.createConnection(DB_URL);

// Check if a game for 2026-06-23 already exists
const [existing] = await conn.query(
  "SELECT id FROM daily_games WHERE gameDate = '2026-06-23'"
);
if (existing.length > 0) {
  console.log("Game for 2026-06-23 already exists (id=" + existing[0].id + "). Aborting.");
  await conn.end();
  process.exit(0);
}

const pairingRationale = `Netflix and Disney are the two most recognisable names in global streaming, and in June 2026 they are at a pivotal inflection point. Netflix has just announced a landmark $82.7 billion acquisition of Warner Bros. Discovery — the largest media deal in history — which would give it control of HBO, CNN, DC Studios, and the Warner Bros. film library, fundamentally reshaping the competitive landscape. Disney, meanwhile, is executing a quiet but steady turnaround under CEO Bob Iger, with Disney+ and Hulu gaining subscribers, theme parks delivering record revenue, and the stock trading at a significant discount to analyst fair value estimates. The investment debate is genuine: does Netflix's audacious scale-up make it the dominant long-term winner in streaming, or does Disney's diversified empire, lower valuation (P/E ~16x vs Netflix's ~43x), and iconic IP make it the more compelling risk-adjusted bet right now?`;

const researchContent = `Netflix enters this matchup as the undisputed streaming market leader, with over 300 million global subscribers across approximately 190 countries. Its Q1 FY2026 results were strong — revenue of $12.25 billion and EPS of $1.23, broadly in line with estimates — and the company is guiding for Q2 revenue of approximately $12.58 billion, representing 13.5% year-over-year growth. The Warner Bros. Discovery acquisition, if it closes, would be transformational: adding HBO's prestige content library, CNN's news infrastructure, and DC Studios' superhero franchise to Netflix's already formidable slate. The deal has drawn regulatory scrutiny, but Netflix's management has argued it is a defensive move against the fragmentation of streaming and the growing threat from ad-supported competitors.

Disney's streaming story is more nuanced. Disney+ reached profitability in late 2024 and has since been growing steadily, while Hulu continues to be a strong performer in the US market. The company's Experiences segment — theme parks, cruises, and resorts — remains a genuine competitive moat that no pure-play streaming company can replicate. Q2 FY2026 revenue came in at $25.17 billion, with EPS of $1.57 beating estimates by $0.07. Revenue growth of approximately 7.7% year-over-year is slower than Netflix's, but Disney's business is far more diversified: it generates revenue from theatrical releases, merchandise licensing, ESPN sports rights, and international park operations in addition to streaming.

The valuation gap between the two companies is striking and central to the investment debate. Netflix trades at approximately 43x trailing earnings and 10.5x revenue — a premium that reflects its dominant market position and strong free cash flow generation ($23.4 billion levered FCF in the trailing twelve months). Disney, by contrast, trades at just 15.7x earnings and 2.1x revenue, with analyst consensus price targets of $132.50 implying roughly 24% upside from current levels. The question is whether Disney's lower valuation reflects genuine undervaluation or justified caution about the pace of its streaming transition.

Netflix's key risks centre on the Warner Bros. acquisition. At $82.7 billion, the deal is expensive, and integrating two very different corporate cultures — Netflix's data-driven, algorithm-first approach and Warner Bros.' traditional Hollywood studio model — will be complex. There is also the question of whether Netflix's ad-supported tier can scale fast enough to justify the premium multiple. Disney's risks are different: the company still carries significant debt from its Fox acquisition, ESPN's traditional cable business is in structural decline, and the theme parks segment is sensitive to macroeconomic downturns and consumer spending confidence.

Looking ahead, the key catalysts to watch are: Netflix's Q2 earnings (expected mid-July), which will give the first read on subscriber growth under the Warner Bros. deal announcement; Disney's Q3 FY2026 earnings (expected August), which will show whether the parks segment can sustain its record revenue trajectory; and any regulatory developments on the Netflix-WBD merger, which could take 12-18 months to clear. Both stocks have underperformed the S&P 500 year-to-date, making this a matchup where the market is genuinely uncertain about which company has the stronger near-term catalyst.`;

const researchMetrics = {
  "NFLX Market Cap": "$440.5B",
  "NFLX P/E Ratio": "43.4x (TTM)",
  "NFLX Revenue Growth": "+13.8% (YoY, FY2026E)",
  "NFLX EPS (TTM)": "$2.39",
  "NFLX 52-Week Range": "$82.11 - $134.12",
  "NFLX Analyst Consensus": "Buy, avg target $133.42",
  "DIS Market Cap": "$192.2B",
  "DIS P/E Ratio": "15.7x (TTM)",
  "DIS Revenue Growth": "+7.7% (YoY, FY2026E)",
  "DIS EPS (TTM)": "$6.85",
  "DIS 52-Week Range": "$80.10 - $124.69",
  "DIS Analyst Consensus": "Buy, avg target $132.50"
};

// lockoutAt = 2026-06-23 at 13:00:00 UTC (9:00 AM ET, DST in effect)
const lockoutAt = "2026-06-23T13:00:00.000Z";
const now = new Date().toISOString().slice(0, 19).replace("T", " ");

// 1. Insert the game
const [gameResult] = await conn.query(
  `INSERT INTO daily_games (
    gameDate, exchange, sector,
    companyAName, companyATicker,
    companyBName, companyBTicker,
    pairingRationale, lockoutAt, status,
    createdBy, createdAt, updatedAt
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  [
    "2026-06-23",
    "NASDAQ",
    "Communication Services",
    "Netflix, Inc.",
    "NFLX",
    "The Walt Disney Company",
    "DIS",
    pairingRationale,
    lockoutAt,
    "active",
    1,
    now,
    now
  ]
);

const gameId = gameResult.insertId;
console.log("✅ Game inserted! ID:", gameId);

// 2. Insert research
await conn.query(
  `INSERT INTO game_research (gameId, content, researchMetrics, snapshotTakenAt, updatedAt)
   VALUES (?, ?, ?, ?, ?)`,
  [
    gameId,
    researchContent,
    JSON.stringify(researchMetrics),
    now,
    now
  ]
);
console.log("✅ Research inserted for game", gameId);

// 3. Insert validation question
await conn.query(
  `INSERT INTO validation_questions (gameId, questionType, questionText, options, correctAnswer, createdAt, updatedAt)
   VALUES (?, ?, ?, ?, ?, ?, ?)`,
  [
    gameId,
    "multiple_choice",
    "Netflix's announced acquisition of Warner Bros. Discovery is valued at approximately how much?",
    JSON.stringify(["$42 billion", "$82.7 billion", "$65 billion", "$110 billion"]),
    "$82.7 billion",
    now,
    now
  ]
);
console.log("✅ Validation question inserted for game", gameId);

console.log("\n🎯 Monday game ready!");
console.log("   NFLX vs DIS | 2026-06-23 | Communication Services");
console.log("   Lockout at:", lockoutAt, "(9:00 AM ET)");

await conn.end();
