/**
 * The "which market would you play?" survey on the landing page's Road Ahead
 * card. Shared so the client's option list, the server's input validation and
 * the admin tally can never drift apart.
 *
 * Markets are named by COUNTRY, not by exchange (Paul, 2026-10-02): a player
 * thinks "the Australian market", and exchanges within one country share a
 * trading clock. The US is listed even though its game is already live — a
 * vote for it is a signal too.
 */
export const MARKET_OPTIONS = [
  { code: "US", label: "United States" },
  { code: "GB", label: "United Kingdom" },
  { code: "CA", label: "Canada" },
  { code: "AU", label: "Australia" },
  { code: "IN", label: "India" },
  { code: "DE", label: "Germany" },
  { code: "JP", label: "Japan" },
  { code: "HK", label: "Hong Kong" },
  { code: "SG", label: "Singapore" },
  { code: "OTHER", label: "Other" },
] as const;

export type MarketCode = (typeof MARKET_OPTIONS)[number]["code"];

export const MARKET_CODES = MARKET_OPTIONS.map((m) => m.code) as [
  MarketCode,
  ...MarketCode[],
];

/** A voter names one first choice plus up to two more they would also play.
 *  Capped so the tally keeps its shape: with no limit people tick everything.
 *  The first choice is ASKED FOR EXPLICITLY in the UI — it is never inferred
 *  from tap order, which just rewards whatever sits first in the list. */
export const MAX_MARKET_PICKS = 3;

export function marketLabel(code: string): string {
  return MARKET_OPTIONS.find((m) => m.code === code)?.label ?? code;
}

/** "Australia", "Australia and India", "Australia, India and Japan". */
export function joinMarketLabels(codes: readonly string[]): string {
  const labels = codes.map(marketLabel);
  if (labels.length <= 1) return labels[0] ?? "";
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

/**
 * How a recorded vote reads back to the voter: the first code is their stated
 * first choice, the rest are markets they would also play (unranked).
 * "Australia" / "Australia first, plus India" / "Australia first, plus India and Japan".
 */
export function describeMarketVote(codes: readonly string[]): string {
  if (codes.length === 0) return "";
  const [first, ...others] = codes;
  if (others.length === 0) return marketLabel(first);
  return `${marketLabel(first)} first, plus ${joinMarketLabels(others)}`;
}

/**
 * One vote per voter. A signed-in player is keyed by account; an anonymous
 * visitor by a random id their browser generated. Returns null when neither
 * is usable, so the caller rejects rather than storing an unkeyed row.
 */
export function resolveVoterKey(
  userId: number | null | undefined,
  anonKey: string | null | undefined
): string | null {
  if (typeof userId === "number") return `user:${userId}`;
  if (anonKey && /^[A-Za-z0-9_-]{16,64}$/.test(anonKey)) return `anon:${anonKey}`;
  return null;
}

/** Drops duplicates, keeps order, enforces the cap. */
export function normalizeMarketPicks(picks: readonly MarketCode[]): MarketCode[] {
  return Array.from(new Set(picks)).slice(0, MAX_MARKET_PICKS);
}

export type MarketVoteRow = {
  firstChoice: string;
  secondChoice: string | null;
  thirdChoice: string | null;
  visitorCountry: string | null;
  otherText: string | null;
};

export type MarketVoteTally = {
  totalVoters: number;
  /** Voters who ranked more than one market: the multiple-play signal. */
  multiPickVoters: number;
  byMarket: Array<{ code: string; label: string; first: number; mentions: number }>;
  byVisitorCountry: Array<{ country: string; voters: number }>;
  otherTexts: string[];
};

/**
 * Pure aggregation for the admin page. `first` ranks which market to launch
 * next; `mentions` (any rank) shows total interest. Sorted by first choice,
 * then mentions.
 */
export function tallyMarketVotes(rows: readonly MarketVoteRow[]): MarketVoteTally {
  const first = new Map<string, number>();
  const mentions = new Map<string, number>();
  const countries = new Map<string, number>();
  const otherTexts: string[] = [];
  let multiPickVoters = 0;

  for (const row of rows) {
    const picks = [row.firstChoice, row.secondChoice, row.thirdChoice].filter(
      (p): p is string => Boolean(p)
    );
    if (picks.length > 1) multiPickVoters++;
    first.set(row.firstChoice, (first.get(row.firstChoice) ?? 0) + 1);
    Array.from(new Set(picks)).forEach((p) => mentions.set(p, (mentions.get(p) ?? 0) + 1));
    const country = row.visitorCountry ?? "Unknown";
    countries.set(country, (countries.get(country) ?? 0) + 1);
    if (row.otherText) otherTexts.push(row.otherText);
  }

  const byMarket = Array.from(mentions.entries())
    .map(([code, m]) => ({ code, label: marketLabel(code), first: first.get(code) ?? 0, mentions: m }))
    .sort((a, b) => b.first - a.first || b.mentions - a.mentions || a.label.localeCompare(b.label));

  const byVisitorCountry = Array.from(countries.entries())
    .map(([country, voters]) => ({ country, voters }))
    .sort((a, b) => b.voters - a.voters || a.country.localeCompare(b.country));

  return { totalVoters: rows.length, multiPickVoters, byMarket, byVisitorCountry, otherTexts };
}
