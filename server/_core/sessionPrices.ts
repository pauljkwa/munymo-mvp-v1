/**
 * Server-fetched regular-session open/close prices for settlement.
 *
 * Why this exists (2026-10-19): the curation agent's only price source was
 * `web_search`. On Monday 2026-10-19 (a normal trading day) the search index
 * had no same-day quotes for EIX or DUK, so the agent — correctly refusing to
 * invent a result — set `marketClosed: true` twice, and the server rejected
 * both submissions ("concluded game not scored"). The game sat unscored and
 * the staged next game stayed a draft. "I could not find the prices" is not
 * the same thing as "the market was closed", and the agent had no way to tell
 * them apart.
 *
 * Now the server fetches the day's bar for both tickers from Yahoo Finance's
 * public chart API (the same source the agent was told to use) and hands the
 * four prices to the agent in its opening message. The agent still writes the
 * narrative; the numbers are canonical. If the fetch fails for any reason the
 * agent gets a note saying so and falls back to web_search exactly as before,
 * so nothing here is on the critical path of a run.
 */

export type SessionBar = { open: number; close: number };

export type PairSessionBars = {
  tickerA: string;
  tickerB: string;
  dateEt: string;
  a: SessionBar | null;
  b: SessionBar | null;
};

const ET_DATE = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" });

/** Calendar date (YYYY-MM-DD) in New York of a unix timestamp in seconds. */
export function etDateOf(unixSeconds: number): string {
  return ET_DATE.format(new Date(unixSeconds * 1000));
}

/** Yahoo spells share classes with a hyphen (BRK-B), our tickers may use a dot. */
export function toYahooSymbol(ticker: string): string {
  return ticker.trim().toUpperCase().replace(/\./g, "-");
}

function isPrice(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

/**
 * Pull the regular-session open/close for `dateEt` out of a Yahoo
 * `/v8/finance/chart/{symbol}?interval=1d` response. Returns null when the
 * payload is malformed or has no bar for that date (holiday, weekend, or the
 * data is not published yet).
 */
export function parseYahooChart(json: unknown, dateEt: string): SessionBar | null {
  const result = (json as any)?.chart?.result?.[0];
  const timestamps: unknown = result?.timestamp;
  const quote = result?.indicators?.quote?.[0];
  if (!Array.isArray(timestamps) || !quote || !Array.isArray(quote.open) || !Array.isArray(quote.close)) {
    return null;
  }
  for (let i = 0; i < timestamps.length; i++) {
    const ts = timestamps[i];
    if (typeof ts !== "number") continue;
    if (etDateOf(ts) !== dateEt) continue;
    const open = quote.open[i];
    const close = quote.close[i];
    if (!isPrice(open) || !isPrice(close)) return null;
    return { open: Math.round(open * 100) / 100, close: Math.round(close * 100) / 100 };
  }
  return null;
}

export type FetchLike = (url: string, init?: any) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/**
 * Fetch one ticker's bar for `dateEt`. Never throws — any failure (network,
 * non-200, bad JSON, no bar) logs a warning and resolves to null so the
 * caller can degrade to the agent's web_search path.
 */
export async function fetchSessionBar(
  ticker: string,
  dateEt: string,
  opts: { fetchImpl?: FetchLike; timeoutMs?: number } = {}
): Promise<SessionBar | null> {
  const fetchImpl: FetchLike = opts.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
  const timeoutMs = opts.timeoutMs ?? 10_000;
  const symbol = toYahooSymbol(ticker);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MunymoCuration/1.0)", Accept: "application/json" },
    });
    if (!res.ok) {
      console.warn(`[session-prices] ${symbol}: HTTP ${res.status}`);
      return null;
    }
    const bar = parseYahooChart(await res.json(), dateEt);
    if (!bar) console.warn(`[session-prices] ${symbol}: no regular-session bar for ${dateEt}`);
    return bar;
  } catch (err) {
    console.warn(`[session-prices] ${symbol}: fetch failed —`, err instanceof Error ? err.message : err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchPairSessionBars(
  tickerA: string,
  tickerB: string,
  dateEt: string,
  opts: { fetchImpl?: FetchLike; timeoutMs?: number } = {}
): Promise<PairSessionBars> {
  const [a, b] = await Promise.all([fetchSessionBar(tickerA, dateEt, opts), fetchSessionBar(tickerB, dateEt, opts)]);
  return { tickerA, tickerB, dateEt, a, b };
}

export function pctOpenToClose(bar: SessionBar): number {
  return Math.round(((bar.close - bar.open) / bar.open) * 10000) / 100;
}

function fmtBar(ticker: string, bar: SessionBar | null): string {
  if (!bar) return `${ticker}: no bar available`;
  const pct = pctOpenToClose(bar);
  return `${ticker}: open ${bar.open.toFixed(2)}, close ${bar.close.toFixed(2)} (${pct >= 0 ? "+" : ""}${pct.toFixed(2)}% open-to-close)`;
}

/** One-line summary for logs, emails and 422 details. */
export function summarizeSessionBars(p: PairSessionBars): string {
  return `${fmtBar(p.tickerA, p.a)}; ${fmtBar(p.tickerB, p.b)}`;
}

/**
 * The paragraph appended to the agent's opening message. When both bars
 * exist it also settles the "was the market open?" question outright, which
 * is the whole point: the agent must never again translate "prices not found
 * in search" into `marketClosed: true` when the exchange traded.
 */
export function describeSessionBarsForAgent(gameId: number, p: PairSessionBars): string {
  const head =
    `SERVER-FETCHED SESSION PRICES for the concluded game #${gameId} (${p.tickerA} vs ${p.tickerB}, ${p.dateEt}), ` +
    `regular session, from Yahoo Finance's chart API:\n`;
  if (p.a && p.b) {
    return (
      head +
      `- ${fmtBar(p.tickerA, p.a)}\n- ${fmtBar(p.tickerB, p.b)}\n` +
      `These four prices are CANONICAL: use them verbatim as companyAStartPrice/companyAEndPrice/companyBStartPrice/` +
      `companyBEndPrice and compute the two open-to-close moves from them. Because bars exist for this date, the market ` +
      `WAS open — do not set "marketClosed": true and do not set "today": null. Use web_search only for the narrative ` +
      `(what moved each stock), not to second-guess these prices.`
    );
  }
  if (p.a || p.b) {
    return (
      head +
      `- ${fmtBar(p.tickerA, p.a)}\n- ${fmtBar(p.tickerB, p.b)}\n` +
      `One bar is missing on the server side, so the market WAS open on this date. Use the price given verbatim, find ` +
      `the other company's regular-session open and close via web_search, and score the game. Do not set "marketClosed": true.`
    );
  }
  return (
    head +
    `- unavailable (the server could not fetch either bar — network or data error, NOT evidence the market was closed).\n` +
    `Find both companies' regular-session open and close via web_search. Treat "marketClosed": true as a last resort that ` +
    `needs positive evidence of a US market holiday or closure on ${p.dateEt}; failing to find a quote is never that evidence.`
  );
}
