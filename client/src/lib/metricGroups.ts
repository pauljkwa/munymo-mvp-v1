/**
 * Grouping for the research metrics panel.
 *
 * Metrics are displayed in two labelled groups that teach the horizon
 * distinction every game day:
 *   - "The Long Game"  — fundamentals that matter over years
 *   - "Game-Day Setup" — what shapes the single session being played
 *
 * Labels arrive ticker-prefixed (e.g. "NVDA Market Cap"), so matching is done
 * on word-boundary key phrases rather than exact equality. Labels that match
 * no known key (one-off admin-typed metrics, the Demo page's sample metrics)
 * fall into a trailing "More Metrics" group. Legacy games whose metrics all
 * land in one group render without group headers, exactly as before.
 */

export type MetricGroupId = "long" | "setup" | "other";

export interface MetricGroupInfo {
  id: MetricGroupId;
  title: string;
  /** Sort rank: group order first, then the metric's position within its group */
  rank: number;
}

const GROUPS: { id: MetricGroupId; title: string; keys: string[] }[] = [
  {
    id: "long",
    title: "The Long Game",
    keys: [
      "market cap",
      "p/e ratio",
      "revenue growth",
      "eps (ttm)",
      "analyst consensus",
      "52-week range",
    ],
  },
  {
    id: "setup",
    title: "Game-Day Setup",
    keys: ["next earnings", "beta", "last session move", "vs 52-week high"],
  },
];

const OTHER: Omit<MetricGroupInfo, "rank"> = { id: "other", title: "More Metrics" };

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Word-boundary containment: "GOOGL Beta" matches "beta", "Alphabet Revenue" does not
function labelMatchesKey(label: string, key: string): boolean {
  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(key)}([^a-z0-9]|$)`).test(label);
}

export function metricGroupInfo(label: string): MetricGroupInfo {
  const normalised = label.trim().toLowerCase();
  for (let g = 0; g < GROUPS.length; g++) {
    const group = GROUPS[g];
    for (let k = 0; k < group.keys.length; k++) {
      if (labelMatchesKey(normalised, group.keys[k])) {
        return { id: group.id, title: group.title, rank: g * 100 + k };
      }
    }
  }
  return { ...OTHER, rank: 10_000 };
}
