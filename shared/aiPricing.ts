/**
 * Anthropic rate table for the running-costs ledger (references/running-costs-ledger-spec.md §5).
 *
 * Rates are US dollars per million tokens as published on Anthropic's pricing
 * page (platform.claude.com/docs/en/about-claude/pricing), checked 2026-10-17.
 * A table in code, not in the database: it is small and changes rarely. When a
 * rate changes, edit it here and bump `effectiveDate` — every logged row stores
 * the `pricingVersion` it was priced with, so old rows can be re-priced later.
 */

export type ModelRates = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite5m: number;
  cacheWrite1h: number;
};

export const AI_PRICING: {
  effectiveDate: string;
  /** Dollars per 1,000 web searches, charged on top of tokens. */
  webSearchPer1000: number;
  models: Record<string, ModelRates>;
} = {
  effectiveDate: "2026-10-17",
  webSearchPer1000: 10,
  models: {
    "claude-sonnet-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite5m: 2.5, cacheWrite1h: 4 },
    "claude-opus-5": { input: 5, output: 25, cacheRead: 0.5, cacheWrite5m: 6.25, cacheWrite1h: 10 },
    "claude-opus-4-8": { input: 5, output: 25, cacheRead: 0.5, cacheWrite5m: 6.25, cacheWrite1h: 10 },
  },
};

/** The slice of Anthropic.Usage this module reads (all fields optional so tests and old payloads work). */
export type UsageLike = {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_creation?: {
    ephemeral_5m_input_tokens?: number | null;
    ephemeral_1h_input_tokens?: number | null;
  } | null;
  server_tool_use?: { web_search_requests?: number | null } | null;
};

export type NormalizedUsage = {
  inputTokens: number;
  cacheReadTokens: number;
  cacheWrite5mTokens: number;
  cacheWrite1hTokens: number;
  outputTokens: number;
  webSearchRequests: number;
};

/**
 * Flattens an API usage object into the columns stored in ai_usage_log.
 * When the per-TTL breakdown is absent, the whole `cache_creation_input_tokens`
 * counts as 1-hour writes, because every cached call in this codebase uses
 * the 1h TTL.
 */
export function normalizeUsage(usage: UsageLike): NormalizedUsage {
  const breakdown = usage.cache_creation;
  const cacheWrite5m = breakdown ? (breakdown.ephemeral_5m_input_tokens ?? 0) : 0;
  const cacheWrite1h = breakdown
    ? (breakdown.ephemeral_1h_input_tokens ?? 0)
    : (usage.cache_creation_input_tokens ?? 0);
  return {
    inputTokens: usage.input_tokens ?? 0,
    cacheReadTokens: usage.cache_read_input_tokens ?? 0,
    cacheWrite5mTokens: cacheWrite5m,
    cacheWrite1hTokens: cacheWrite1h,
    outputTokens: usage.output_tokens ?? 0,
    webSearchRequests: usage.server_tool_use?.web_search_requests ?? 0,
  };
}

const warnedModels = new Set<string>();

/**
 * Estimated dollar cost of one API call, rounded to 6 decimals. Returns null
 * (not 0) for a model missing from the table and warns once per process per
 * unknown model, so a model id change shows up on the admin page as
 * "unpriced" rather than as a free run.
 */
export function estimateCostUsd(model: string, usage: UsageLike): number | null {
  const rates = AI_PRICING.models[model];
  if (!rates) {
    if (!warnedModels.has(model)) {
      warnedModels.add(model);
      console.warn(`[ai-pricing] No rate for model "${model}" — its calls will be logged as unpriced`);
    }
    return null;
  }
  const u = normalizeUsage(usage);
  const perMillion =
    u.inputTokens * rates.input +
    u.outputTokens * rates.output +
    u.cacheReadTokens * rates.cacheRead +
    u.cacheWrite5mTokens * rates.cacheWrite5m +
    u.cacheWrite1hTokens * rates.cacheWrite1h;
  const cost = perMillion / 1_000_000 + (u.webSearchRequests * AI_PRICING.webSearchPer1000) / 1000;
  return Math.round(cost * 1_000_000) / 1_000_000;
}
