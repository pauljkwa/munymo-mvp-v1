import { createConnection } from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config({ path: "/home/ubuntu/munymo-mvp-fresh/.env" });

const conn = await createConnection(process.env.DATABASE_URL);

try {
  // 1. Insert the game
  const [gameResult] = await conn.execute(
    `INSERT INTO daily_games 
      (gameDate, exchange, companyAName, companyATicker, companyBName, companyBTicker,
       sector, pairingRationale, lockoutAt, status, createdBy, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 1, NOW(), NOW())`,
    [
      "2026-06-16",
      "NASDAQ",
      "Advanced Micro Devices, Inc.",
      "AMD",
      "Intel Corporation",
      "INTC",
      "Technology",
      "Both AMD and Intel are fiercely competing for dominance in the data center and AI accelerator markets, making this a pivotal moment for the semiconductor sector. With Intel's recent massive 427% run-up and new foundry deals challenging AMD's established position as the primary alternative to Nvidia, investors are sharply divided on which CPU giant offers the better growth trajectory.",
      "2026-06-16 13:00:00",
    ]
  );

  const gameId = gameResult.insertId;
  console.log(`✅ Game created with ID: ${gameId}`);

  // 2. Insert research + metrics (metrics stored as JSON in researchMetrics column)
  const researchContent = `The semiconductor sector is currently experiencing intense volatility and rotation, driven by shifting expectations around AI infrastructure spending and hyperscaler capital expenditures. Following a dramatic sector-wide selloff and rapid recovery in early June 2026, the market is closely evaluating which chipmakers can sustain their momentum. This matchup between two historic CPU rivals is particularly timely as both companies are aggressively positioning themselves as the premier alternative to Nvidia in the lucrative AI data center market, while navigating complex supply chain dynamics and a shifting macroeconomic landscape ahead of the upcoming FOMC meeting.

Advanced Micro Devices (AMD) has demonstrated remarkable resilience and growth, with its stock up approximately 139% year-to-date. The company recently reported strong Q1 2026 results, delivering $10.3 billion in revenue—a 38% year-over-year increase driven primarily by surging demand for its AI infrastructure and Data Center segment. AMD's MI300 series accelerators continue to gain traction among hyperscalers, cementing its position as a formidable player in the AI hardware space. Despite trading at a premium valuation with a trailing P/E of 170.5, AMD's robust free cash flow generation and expanding gross margins reflect strong operational execution.

Intel Corporation (INTC) is in the midst of an aggressive and closely watched turnaround strategy under CEO Lip-Bu Tan, which has propelled its stock up an astonishing 237% year-to-date. The company is leaning heavily into its foundry business, recently securing a massive order from Google to manufacture over three million Tensor Processing Units (TPUs) by 2028. While Intel's Q1 2026 revenue of $13.58 billion represented a more modest 7% year-over-year growth, its Data Center and AI revenue jumped 22%. However, Intel still faces significant profitability challenges, reporting negative operating margins and a net loss over the trailing twelve months, making its current valuation highly dependent on future execution.

When making a prediction for Monday's trading session, players should weigh AMD's proven execution and strong revenue growth against Intel's explosive momentum and emerging foundry narrative. The key question is whether the market will reward AMD's established AI market share and profitability, or if investors will continue to bid up Intel based on its strategic partnerships and long-term turnaround potential despite its current bottom-line struggles.`;

  const metricsJson = JSON.stringify([
    { label: "AMD — Current Price", value: "$511.57" },
    { label: "AMD — 52-Week High", value: "$546.44" },
    { label: "AMD — 52-Week Low", value: "$117.78" },
    { label: "AMD — Market Cap", value: "$834.17B" },
    { label: "AMD — P/E Ratio", value: "170.5" },
    { label: "AMD — EPS (TTM)", value: "$3.02" },
    { label: "AMD — Revenue (MRQ)", value: "$10.3B" },
    { label: "INTC — Current Price", value: "$124.57" },
    { label: "INTC — 52-Week High", value: "$132.75" },
    { label: "INTC — 52-Week Low", value: "$18.97" },
    { label: "INTC — Market Cap", value: "$626.09B" },
    { label: "INTC — P/E Ratio", value: "904.2" },
    { label: "INTC — EPS (TTM)", value: "-$0.60" },
    { label: "INTC — Revenue (MRQ)", value: "$13.58B" },
  ]);

  await conn.execute(
    `INSERT INTO game_research (gameId, content, researchMetrics, updatedAt)
     VALUES (?, ?, ?, NOW())`,
    [gameId, researchContent, metricsJson]
  );
  console.log(`✅ Research + 14 metrics inserted`);

  // 3. Insert validation question
  const optionsJson = JSON.stringify([
    "A major order from Google to manufacture Tensor Processing Units (TPUs)",
    "Reaching a higher profit margin than AMD in the most recent quarter",
    "Overtaking Nvidia as the primary supplier of AI data center chips",
    "A 38% year-over-year increase in total overall company revenue",
  ]);

  await conn.execute(
    `INSERT INTO validation_questions 
      (gameId, questionType, questionText, options, correctAnswer, createdAt, updatedAt)
     VALUES (?, 'multiple_choice', ?, ?, ?, NOW(), NOW())`,
    [
      gameId,
      "According to the research content, what recent development has been a major driver for Intel's turnaround strategy and stock momentum?",
      optionsJson,
      "A major order from Google to manufacture Tensor Processing Units (TPUs)",
    ]
  );
  console.log(`✅ Validation question inserted`);

  console.log(`\n🎉 Game 1 is live!`);
  console.log(`   Game ID: ${gameId}`);
  console.log(`   AMD vs INTC — 2026-06-16`);
  console.log(`   Lockout: 2026-06-16 13:00 UTC (21:00 Perth / 09:00 ET)`);
  console.log(`   Status: active`);

} catch (err) {
  console.error("❌ Error:", err.message);
} finally {
  await conn.end();
}
