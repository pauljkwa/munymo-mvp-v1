import { describe, expect, it, vi } from "vitest";
import {
  describeSessionBarsForAgent,
  etDateOf,
  fetchSessionBar,
  parseYahooChart,
  pctOpenToClose,
  summarizeSessionBars,
  toYahooSymbol,
} from "./_core/sessionPrices";

// 2026-10-19 09:30 ET (EDT) = 13:30Z. Yahoo stamps each daily bar at the open.
const MON_OPEN = 1792416600;
const FRI_OPEN = MON_OPEN - 3 * 86400;

function chart(bars: Array<{ ts: number; open: number | null; close: number | null }>) {
  return {
    chart: {
      result: [
        {
          meta: { symbol: "EIX" },
          timestamp: bars.map((b) => b.ts),
          indicators: { quote: [{ open: bars.map((b) => b.open), close: bars.map((b) => b.close) }] },
        },
      ],
      error: null,
    },
  };
}

describe("sessionPrices", () => {
  it("maps Yahoo's bar timestamps to the New York calendar date", () => {
    expect(etDateOf(MON_OPEN)).toBe("2026-10-19");
    expect(etDateOf(FRI_OPEN)).toBe("2026-10-16");
    // 23:30Z Monday is still Monday evening in New York, not Tuesday.
    expect(etDateOf(MON_OPEN + 10 * 3600)).toBe("2026-10-19");
  });

  it("spells share classes the Yahoo way", () => {
    expect(toYahooSymbol("brk.b")).toBe("BRK-B");
    expect(toYahooSymbol(" EIX ")).toBe("EIX");
  });

  it("extracts the bar for the requested date and rounds to cents", () => {
    const json = chart([
      { ts: FRI_OPEN, open: 55.95000076, close: 55.93000031 },
      { ts: MON_OPEN, open: 55.38000107, close: 55.68000031 },
    ]);
    expect(parseYahooChart(json, "2026-10-19")).toEqual({ open: 55.38, close: 55.68 });
    expect(parseYahooChart(json, "2026-10-16")).toEqual({ open: 55.95, close: 55.93 });
  });

  it("returns null when there is no bar for the date (holiday / not yet published)", () => {
    const json = chart([{ ts: FRI_OPEN, open: 55.95, close: 55.93 }]);
    expect(parseYahooChart(json, "2026-10-19")).toBeNull();
  });

  it("returns null on malformed payloads and null prices", () => {
    expect(parseYahooChart(null, "2026-10-19")).toBeNull();
    expect(parseYahooChart({ chart: { result: null, error: { code: "Not Found" } } }, "2026-10-19")).toBeNull();
    expect(parseYahooChart(chart([{ ts: MON_OPEN, open: null, close: 55.68 }]), "2026-10-19")).toBeNull();
    expect(parseYahooChart(chart([{ ts: MON_OPEN, open: 0, close: 55.68 }]), "2026-10-19")).toBeNull();
  });

  it("computes open-to-close percentages to 2 decimals", () => {
    expect(pctOpenToClose({ open: 55.38, close: 55.68 })).toBe(0.54);
    expect(pctOpenToClose({ open: 120.99, close: 119.27 })).toBe(-1.42);
  });

  it("fetchSessionBar never throws: non-200, network error and bad JSON all yield null", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const notOk = async () => ({ ok: false, status: 429, json: async () => ({}) });
    expect(await fetchSessionBar("EIX", "2026-10-19", { fetchImpl: notOk })).toBeNull();
    const boom = async () => {
      throw new Error("ECONNRESET");
    };
    expect(await fetchSessionBar("EIX", "2026-10-19", { fetchImpl: boom })).toBeNull();
    const garbage = async () => ({ ok: true, status: 200, json: async () => "nope" });
    expect(await fetchSessionBar("EIX", "2026-10-19", { fetchImpl: garbage })).toBeNull();
    warn.mockRestore();
  });

  it("fetchSessionBar requests the hyphenated symbol and parses a good response", async () => {
    const seen: string[] = [];
    const good = async (url: string) => {
      seen.push(url);
      return { ok: true, status: 200, json: async () => chart([{ ts: MON_OPEN, open: 120.99, close: 119.27 }]) };
    };
    expect(await fetchSessionBar("brk.b", "2026-10-19", { fetchImpl: good })).toEqual({ open: 120.99, close: 119.27 });
    expect(seen[0]).toContain("/chart/BRK-B?");
  });

  it("tells the agent the market WAS open when both bars exist", () => {
    const text = describeSessionBarsForAgent(2550001, {
      tickerA: "EIX",
      tickerB: "DUK",
      dateEt: "2026-10-19",
      a: { open: 55.38, close: 55.68 },
      b: { open: 120.99, close: 119.27 },
    });
    expect(text).toContain("#2550001");
    expect(text).toContain("EIX: open 55.38, close 55.68 (+0.54% open-to-close)");
    expect(text).toContain("DUK: open 120.99, close 119.27 (-1.42% open-to-close)");
    expect(text).toContain("market WAS open");
    expect(text).toContain('do not set "marketClosed": true');
  });

  it("degrades to web_search guidance when the server has no bars, without claiming a closure", () => {
    const text = describeSessionBarsForAgent(1, { tickerA: "EIX", tickerB: "DUK", dateEt: "2026-10-19", a: null, b: null });
    expect(text).toContain("unavailable");
    expect(text).toContain("NOT evidence the market was closed");
    expect(text).not.toContain("market WAS open");
  });

  it("summarizes bars for logs and 422 details", () => {
    expect(
      summarizeSessionBars({ tickerA: "EIX", tickerB: "DUK", dateEt: "2026-10-19", a: { open: 55.38, close: 55.68 }, b: null })
    ).toBe("EIX: open 55.38, close 55.68 (+0.54% open-to-close); DUK: no bar available");
  });
});

describe("compareWithBars", () => {
  const bars = {
    tickerA: "EIX",
    tickerB: "DUK",
    dateEt: "2026-10-19",
    a: { open: 55.38, close: 55.68 },
    b: { open: 120.99, close: 119.27 },
  };

  it("accepts prices that agree to the cent", async () => {
    const { compareWithBars } = await import("./_core/sessionPrices");
    const r = compareWithBars(bars, { companyAStartPrice: 55.38, companyAEndPrice: 55.68, companyBStartPrice: 120.99, companyBEndPrice: 119.27 });
    expect(r.status).toBe("ok");
    expect(r.serverWinner).toBe("A");
  });

  it("rejects the 2026-10-19 submission (wrong EIX prices, flipped winner)", async () => {
    const { compareWithBars } = await import("./_core/sessionPrices");
    const r = compareWithBars(bars, { companyAStartPrice: 55.9, companyAEndPrice: 54.85, companyBStartPrice: 120.99, companyBEndPrice: 119.27 });
    expect(r.status).toBe("mismatch");
    expect(r.detail).toContain("EIX open 55.90 vs server 55.38");
    expect(r.detail).toContain("EIX close 54.85 vs server 55.68");
    expect(r.detail).toContain("winner would be DUK on the submitted prices but EIX on the server's bars");
    expect(r.detail).toContain("Server bars for 2026-10-19");
  });

  it("rejects a flipped winner even when every price is inside tolerance", async () => {
    const { compareWithBars } = await import("./_core/sessionPrices");
    const close = { tickerA: "X", tickerB: "Y", dateEt: "2026-10-19", a: { open: 100, close: 100.2 }, b: { open: 100, close: 100.1 } };
    const r = compareWithBars(close, { companyAStartPrice: 100, companyAEndPrice: 100.0, companyBStartPrice: 100, companyBEndPrice: 100.1 });
    expect(r.status).toBe("mismatch");
    expect(r.detail).toContain("winner would be Y");
  });

  it("skips missing submitted prices and reports unavailable when the server has no bars", async () => {
    const { compareWithBars } = await import("./_core/sessionPrices");
    expect(compareWithBars(bars, { companyAStartPrice: 55.38 }).status).toBe("ok");
    expect(compareWithBars({ ...bars, b: null }, { companyAStartPrice: 55.38 }).status).toBe("unavailable");
  });
});
