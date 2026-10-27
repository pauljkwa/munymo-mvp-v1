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
    return { open: round2(open), close: round2(close) };
  }
  return null;
}

export type FetchLike = (url: string, init?: any) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Open/close for `dateEt` from an intraday (`interval=5m`, regular session
 * only) chart: the first bar's open and the last bar's close for that New
 * York date. Yahoo appends a live-quote element stamped at the regular close,
 * which simply becomes the last bar. The first 5-minute bar's open can sit a
 * cent or two from the official opening print (INTC 2026-10-26: 87.92 vs
 * 87.94), far inside the 0.5% cross-check tolerance.
 *
 * Why it exists (2026-10-27): between the end of post-market (~20:00 ET) and
 * Yahoo writing the finalised daily bar (present again by 00:15 ET), the
 * `interval=1d` chart has no entry for the day just traded — the live-quote
 * element that stood in for it all afternoon is gone. Every 16:15 ET
 * cross-check from 2026-10-20 to 10-26 found the bar; every 20:30 ET audit
 * reported "no bar available". The 5-minute bars are already stored by then.
 */
export function parseYahooIntraday(json: unknown, dateEt: string): SessionBar | null {
  const result = (json as any)?.chart?.result?.[0];
  const timestamps: unknown = result?.timestamp;
  const quote = result?.indicators?.quote?.[0];
  if (!Array.isArray(timestamps) || !quote || !Array.isArray(quote.open) || !Array.isArray(quote.close)) {
    return null;
  }
  let open: number | null = null;
  let close: number | null = null;
  for (let i = 0; i < timestamps.length; i++) {
    const ts = timestamps[i];
    if (typeof ts !== "number" || etDateOf(ts) !== dateEt) continue;
    if (open === null && isPrice(quote.open[i])) open = quote.open[i];
    if (isPrice(quote.close[i])) close = quote.close[i];
  }
  if (open === null || close === null) return null;
  return { open: round2(open), close: round2(close) };
}

/** Unix-second window that surely contains `dateEt`'s regular session (00:00Z that day to 12:00Z the next). */
export function intradayWindow(dateEt: string): { period1: number; period2: number } {
  const [y, m, d] = dateEt.split("-").map(Number);
  const period1 = Math.floor(Date.UTC(y, m - 1, d) / 1000);
  return { period1, period2: period1 + 36 * 3600 };
}

/**
 * Fetch one ticker's bar for `dateEt`: the daily chart first, then the
 * 5-minute bars when the daily bar is not published yet (see
 * parseYahooIntraday). Never throws — any failure (network, non-200, bad
 * JSON, no bar) logs a warning and resolves to null so the caller can degrade
 * to the agent's web_search path.
 */
export async function fetchSessionBar(
  ticker: string,
  dateEt: string,
  opts: { fetchImpl?: FetchLike; timeoutMs?: number } = {}
): Promise<SessionBar | null> {
  const fetchImpl: FetchLike = opts.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
  const timeoutMs = opts.timeoutMs ?? 10_000;
  const symbol = toYahooSymbol(ticker);
  const base = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`;

  // One request; null on any failure (already logged).
  const getJson = async (url: string): Promise<unknown | null> => {
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
      return await res.json();
    } catch (err) {
      console.warn(`[session-prices] ${symbol}: fetch failed —`, err instanceof Error ? err.message : err);
      return null;
    } finally {
      clearTimeout(timer);
    }
  };

  const daily = await getJson(`${base}?range=5d&interval=1d`);
  if (daily === null) return null; // network/HTTP trouble: don't hit Yahoo again
  let bar = parseYahooChart(daily, dateEt);
  if (!bar) {
    const { period1, period2 } = intradayWindow(dateEt);
    const intraday = await getJson(`${base}?period1=${period1}&period2=${period2}&interval=5m&includePrePost=false`);
    bar = intraday === null ? null : parseYahooIntraday(intraday, dateEt);
    if (bar) console.log(`[session-prices] ${symbol}: ${dateEt} bar built from 5-minute bars (daily bar not published yet)`);
  }
  if (!bar) console.warn(`[session-prices] ${symbol}: no regular-session bar for ${dateEt}`);
  return bar;
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

// ─── Cross-check: do the agent's (or a stored game's) four prices agree with the bars? ───

export type FourPrices = {
  companyAStartPrice?: number | null;
  companyAEndPrice?: number | null;
  companyBStartPrice?: number | null;
  companyBEndPrice?: number | null;
};

export type CrossCheck = {
  /** ok = within tolerance and same winner; mismatch = reject/alert; unavailable = server has no bars to compare. */
  status: "ok" | "mismatch" | "unavailable";
  detail: string;
  serverWinner?: "A" | "B";
  bars: PairSessionBars;
};

/** Default tolerance: official opens/closes agree to the cent across sources; half a percent is generous. */
export const PRICE_TOLERANCE_PCT = 0.5;

function winnerFromBars(a: SessionBar, b: SessionBar): "A" | "B" {
  return pctOpenToClose(a) >= pctOpenToClose(b) ? "A" : "B"; // tie → A, same as settleFromPrices
}

/**
 * Compare four submitted prices with the server's bars. Pure; the 2026-10-19
 * EIX error (55.90/54.85 submitted vs 55.38/55.68 traded, winner flipped)
 * is exactly what this catches. Missing submitted prices are skipped in the
 * per-price comparison; the winner comparison needs all four.
 */
export function compareWithBars(bars: PairSessionBars, submitted: FourPrices, tolerancePct = PRICE_TOLERANCE_PCT): CrossCheck {
  if (!bars.a || !bars.b) {
    return { status: "unavailable", detail: `No server bars to compare for ${bars.dateEt} (${summarizeSessionBars(bars)}).`, bars };
  }
  const serverWinner = winnerFromBars(bars.a, bars.b);
  const rows: Array<[string, number | null | undefined, number]> = [
    [`${bars.tickerA} open`, submitted.companyAStartPrice, bars.a.open],
    [`${bars.tickerA} close`, submitted.companyAEndPrice, bars.a.close],
    [`${bars.tickerB} open`, submitted.companyBStartPrice, bars.b.open],
    [`${bars.tickerB} close`, submitted.companyBEndPrice, bars.b.close],
  ];
  const problems: string[] = [];
  for (const [label, got, want] of rows) {
    if (!isPrice(got)) continue;
    const dev = (Math.abs(got - want) / want) * 100;
    if (dev > tolerancePct) problems.push(`${label} ${got.toFixed(2)} vs server ${want.toFixed(2)} (${dev.toFixed(2)}% off)`);
  }
  const allFour =
    isPrice(submitted.companyAStartPrice) && isPrice(submitted.companyAEndPrice) &&
    isPrice(submitted.companyBStartPrice) && isPrice(submitted.companyBEndPrice);
  if (allFour) {
    const submittedWinner = winnerFromBars(
      { open: submitted.companyAStartPrice!, close: submitted.companyAEndPrice! },
      { open: submitted.companyBStartPrice!, close: submitted.companyBEndPrice! }
    );
    if (submittedWinner !== serverWinner) {
      problems.push(`winner would be ${submittedWinner === "A" ? bars.tickerA : bars.tickerB} on the submitted prices but ${serverWinner === "A" ? bars.tickerA : bars.tickerB} on the server's bars`);
    }
  }
  const serverLine = `Server bars for ${bars.dateEt}: ${summarizeSessionBars(bars)}.`;
  if (problems.length) {
    return { status: "mismatch", serverWinner, bars, detail: `Price mismatch — ${problems.join("; ")}. ${serverLine}` };
  }
  return { status: "ok", serverWinner, bars, detail: `Prices agree with the server's bars within ${tolerancePct}%. ${serverLine}` };
}
