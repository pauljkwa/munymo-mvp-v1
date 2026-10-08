import { PRICE_TREND_LABEL } from "@shared/const";

/**
 * Shared admin pieces for a game's metrics panel and its four highlighted
 * metrics (scoring v2). Labels mirror the "researchMetrics rules" in
 * server/_core/curationAgent.ts exactly.
 */
export const LONG_GAME_LABELS = ["Market Cap", "P/E Ratio", "Revenue Growth", "Analyst Consensus"] as const;
export const GAME_DAY_LABELS = ["Next Earnings", "Beta", "Last Session Move", "vs 52-Week High"] as const;
export const PANEL_LABELS: readonly string[] = [...LONG_GAME_LABELS, ...GAME_DAY_LABELS];
export const HIGHLIGHT_OPTIONS: readonly string[] = [...PANEL_LABELS, PRICE_TREND_LABEL];
export const HIGHLIGHT_COUNT = 4;

/** Panel values keyed by un-prefixed label, per side. */
export type MetricsGrid = { A: Record<string, string>; B: Record<string, string> };

export const emptyGrid = (): MetricsGrid => ({ A: {}, B: {} });

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Splits a stored `{"<TICKER> <Label>": value}` record into the grid plus any rows that are not one of the eight labels. */
export function splitMetrics(
  record: Record<string, string> | null | undefined,
  tickerA: string,
  tickerB: string
): { grid: MetricsGrid; extras: Record<string, string> } {
  const grid = emptyGrid();
  const extras: Record<string, string> = {};
  for (const [key, value] of Object.entries(record ?? {})) {
    let placed = false;
    for (const [side, ticker] of [["A", tickerA], ["B", tickerB]] as const) {
      if (!ticker) continue;
      const m = key.trim().match(new RegExp(`^${escapeRe(ticker)}\\s*(?:[—–-]\\s*)?(.+)$`, "i"));
      const label = m ? PANEL_LABELS.find((l) => l.toLowerCase() === m[1].trim().toLowerCase()) : undefined;
      if (label) {
        grid[side][label] = value;
        placed = true;
        break;
      }
    }
    if (!placed) extras[key] = value;
  }
  return { grid, extras };
}

/** Builds the `{"<TICKER> <Label>": value}` object the server expects. Blank cells are left out. */
export function joinMetrics(
  grid: MetricsGrid,
  tickerA: string,
  tickerB: string,
  extras: Record<string, string> = {}
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const label of PANEL_LABELS) {
    for (const [side, ticker] of [["A", tickerA], ["B", tickerB]] as const) {
      const v = grid[side][label]?.trim();
      if (ticker && v) out[`${ticker} ${label}`] = v;
    }
  }
  return { ...out, ...extras };
}

const labelCls = "block text-xs font-semibold uppercase tracking-wider mb-1.5";

export function MetricsGridFields({
  grid,
  onChange,
  tickerA,
  tickerB,
  disabled,
}: {
  grid: MetricsGrid;
  onChange: (next: MetricsGrid) => void;
  tickerA: string;
  tickerB: string;
  disabled?: boolean;
}) {
  const A = tickerA || "Company A";
  const B = tickerB || "Company B";
  const set = (side: "A" | "B", label: string, v: string) =>
    onChange({ ...grid, [side]: { ...grid[side], [label]: v } });
  const group = (title: string, labels: readonly string[]) => (
    <div className="flex flex-col gap-2">
      <p className={labelCls} style={{ color: "var(--color-subtle)" }}>{title}</p>
      <div className="grid grid-cols-[minmax(7rem,1fr)_2fr_2fr] gap-2 items-center text-xs">
        <span />
        <span className="font-semibold" style={{ color: "var(--color-muted)" }}>{A}</span>
        <span className="font-semibold" style={{ color: "var(--color-muted)" }}>{B}</span>
        {labels.map((label) => (
          <div key={label} className="contents">
            <span style={{ color: "var(--color-subtle)" }}>{label}</span>
            <input
              type="text"
              value={grid.A[label] ?? ""}
              onChange={(e) => set("A", label, e.target.value)}
              disabled={disabled}
              className="input-field w-full"
              aria-label={`${A} ${label}`}
            />
            <input
              type="text"
              value={grid.B[label] ?? ""}
              onChange={(e) => set("B", label, e.target.value)}
              disabled={disabled}
              className="input-field w-full"
              aria-label={`${B} ${label}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
  return (
    <div className="flex flex-col gap-5">
      {group("The Long Game (fundamentals)", LONG_GAME_LABELS)}
      {group("Game-Day Setup (what shapes this session)", GAME_DAY_LABELS)}
    </div>
  );
}

/** Pick exactly four of the eight panel labels plus "Price trend". Zero ticked means "no highlights" (legacy scoring). */
export function HighlightPicker({
  selected,
  onChange,
  disabled,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const toggle = (label: string) => {
    if (selected.includes(label)) onChange(selected.filter((l) => l !== label));
    else if (selected.length < HIGHLIGHT_COUNT) onChange([...selected, label]);
  };
  const full = selected.length >= HIGHLIGHT_COUNT;
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {HIGHLIGHT_OPTIONS.map((label) => {
          const checked = selected.includes(label);
          return (
            <label key={label} className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: "var(--color-foreground)" }}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(label)}
                disabled={disabled || (!checked && full)}
              />
              {label}
            </label>
          );
        })}
      </div>
      <p
        className="text-xs"
        style={{ color: selected.length > 0 && selected.length !== HIGHLIGHT_COUNT ? "var(--color-error)" : "var(--color-subtle)" }}
      >
        {selected.length}/{HIGHLIGHT_COUNT} ticked.{" "}
        {selected.length === 0
          ? "Leave all unticked and this game scores under the legacy 80/20 rules."
          : selected.length !== HIGHLIGHT_COUNT
            ? "Tick exactly four to submit."
            : "Players name one of these as the reason for their pick."}
      </p>
    </div>
  );
}
