/**
 * Static, hand-written explanations for the standard research metrics the
 * curation agent always produces (labels are ticker-prefixed, e.g.
 * "NVDA Market Cap" — the educational content is identical regardless of
 * ticker, so these are matched by suffix and returned instantly with no
 * DB round trip and no LLM call).
 *
 * Any metric label that doesn't match one of these (e.g. a one-off custom
 * label an admin typed manually) falls through to the existing DB-cache +
 * Claude-generation path in metricsRouter.getExplanation.
 */
const STATIC_EXPLANATIONS: Record<string, string> = {
  "market cap":
    "Market capitalization (\"market cap\") is the total value the stock market places on a company — its share price multiplied by the total number of shares outstanding. It tells you the company's overall size, not how expensive an individual share is. A high market cap usually means a large, established company with a long track record, often more stable but with less room for explosive growth. A lower market cap usually means a smaller, younger company — potentially more volatile, but with more room to grow quickly if things go well. When comparing two companies, market cap helps you gauge whether you're looking at a similarly-sized matchup or a David-vs-Goliath one, which can shape how each company reacts to good or bad news.",

  "p/e ratio":
    "The Price-to-Earnings (P/E) ratio compares a company's share price to how much profit it earns per share. It's essentially asking: \"How many dollars am I paying for each dollar of the company's yearly earnings?\" A high P/E often means investors expect strong future growth and are willing to pay a premium for it — but it can also mean the stock is overpriced. A low P/E can signal a bargain, or it can mean the market has doubts about the company's future. There's no universally \"good\" number — the key is comparing the two companies' P/E ratios to each other to see which one the market is more optimistic about.",

  "revenue growth":
    "Revenue growth measures how much a company's total sales have increased (or decreased) compared to a year earlier, expressed as a percentage. It's one of the clearest signs of business momentum — money coming in the door, before any costs or profits are factored in. High revenue growth usually signals rising demand for a company's products or services, and is especially prized for younger, expanding companies. Slower or negative growth can mean a business is maturing, losing market share, or facing headwinds. When comparing two companies, faster revenue growth often points to the one gaining ground — though it's worth checking whether that growth is actually turning into profit.",

  "eps (ttm)":
    "Earnings Per Share (EPS) shows how much profit a company made for each individual share of stock, over the trailing twelve months (TTM) — the most recent full year of results. It's calculated by dividing total profit by the number of shares outstanding. A higher EPS generally means the company is more profitable per share, though it needs to be judged relative to the share price (that's what the P/E ratio does) rather than compared directly between two very differently priced or sized companies. Rising EPS over time is usually a healthy sign; a shrinking or negative EPS can be a red flag worth investigating further.",

  "52-week range":
    "The 52-week range shows the lowest and highest price a stock has traded at over the past year. It gives you a quick sense of how volatile the stock has been and where today's price sits relative to its recent history. A stock trading near its 52-week high suggests strong recent momentum and investor confidence; one near its 52-week low may be out of favor, undervalued, or facing real trouble — the range alone won't tell you which. Comparing two companies' ranges can highlight which one has had a smoother, more stable year versus which one has seen bigger swings.",

  "analyst consensus":
    "Analyst consensus summarizes what professional stock analysts, on average, currently recommend for a stock — typically Buy, Hold, or Sell — along with their average 12-month price target. It reflects the collective view of people who study the company closely, but it's an opinion, not a guarantee: analysts can be wrong, slow to update, or biased toward optimism. A strong \"Buy\" consensus with a price target well above the current share price suggests analysts see upside; a \"Hold\" or \"Sell\" suggests more caution. When comparing two companies, consensus can be a useful gut-check against your own reasoning — but it shouldn't replace it.",
};

/**
 * Returns the static explanation for a metric label if it matches one of the
 * standard research metrics (matched by suffix, since labels are always
 * ticker-prefixed — e.g. "NVDA Market Cap" ends with "market cap").
 */
export function getStaticMetricExplanation(metricLabel: string): string | undefined {
  const normalised = metricLabel.trim().toLowerCase();
  for (const [suffix, explanation] of Object.entries(STATIC_EXPLANATIONS)) {
    if (normalised.endsWith(suffix)) return explanation;
  }
  return undefined;
}
