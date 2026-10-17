import { afterEach, describe, expect, it, vi } from "vitest";
import { AI_PRICING, estimateCostUsd, normalizeUsage } from "@shared/aiPricing";

describe("estimateCostUsd", () => {
  it("prices a Sonnet turn with cache reads and 1h cache writes", () => {
    // 1,000 input + 200,000 cache read + 50,000 1h write + 4,000 output
    const cost = estimateCostUsd("claude-sonnet-5", {
      input_tokens: 1_000,
      cache_read_input_tokens: 200_000,
      cache_creation_input_tokens: 50_000,
      cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 50_000 },
      output_tokens: 4_000,
    });
    // 1k*$2 + 200k*$0.20 + 50k*$4 + 4k*$10 = 0.002 + 0.04 + 0.2 + 0.04
    expect(cost).toBeCloseTo(0.282, 6);
  });

  it("prices an Opus failover turn at the Opus rates", () => {
    const cost = estimateCostUsd("claude-opus-5", {
      input_tokens: 10_000,
      cache_read_input_tokens: 100_000,
      cache_creation: { ephemeral_5m_input_tokens: 8_000, ephemeral_1h_input_tokens: 20_000 },
      output_tokens: 2_000,
    });
    // 10k*$5 + 100k*$0.50 + 8k*$6.25 + 20k*$10 + 2k*$25 = 0.05 + 0.05 + 0.05 + 0.2 + 0.05
    expect(cost).toBeCloseTo(0.4, 6);
  });

  it("adds the web search surcharge on top of tokens", () => {
    const tokensOnly = estimateCostUsd("claude-sonnet-5", { input_tokens: 1_000_000 });
    const withSearch = estimateCostUsd("claude-sonnet-5", {
      input_tokens: 1_000_000,
      server_tool_use: { web_search_requests: 7 },
    });
    expect(tokensOnly).toBeCloseTo(2, 6);
    expect(withSearch! - tokensOnly!).toBeCloseTo((7 * AI_PRICING.webSearchPer1000) / 1000, 6);
  });

  describe("unknown model", () => {
    afterEach(() => vi.restoreAllMocks());

    it("returns null (not 0) and warns once per model", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      expect(estimateCostUsd("claude-made-up-9", { input_tokens: 100 })).toBeNull();
      expect(estimateCostUsd("claude-made-up-9", { input_tokens: 100 })).toBeNull();
      expect(warn).toHaveBeenCalledTimes(1);
    });
  });

  it("treats a missing cache_creation breakdown as 1h writes", () => {
    const usage = { cache_creation_input_tokens: 30_000, cache_creation: null };
    expect(normalizeUsage(usage)).toMatchObject({ cacheWrite5mTokens: 0, cacheWrite1hTokens: 30_000 });
    expect(estimateCostUsd("claude-sonnet-5", usage)).toBeCloseTo(0.12, 6); // 30k * $4/M
  });

  it("tolerates null usage fields", () => {
    expect(
      estimateCostUsd("claude-opus-4-8", {
        input_tokens: 0,
        output_tokens: 0,
        cache_read_input_tokens: null,
        cache_creation_input_tokens: null,
        server_tool_use: null,
      })
    ).toBe(0);
  });
});
