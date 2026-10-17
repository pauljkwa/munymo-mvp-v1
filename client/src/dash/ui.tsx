import type { ReactNode } from "react";

// Shared building blocks for the owner dashboard: the section card with the
// small uppercase heading used on /admin, and the number tile.

export const headingStyle = { color: "var(--color-subtle)" } as const;
export const headingClass = "text-xs font-semibold uppercase tracking-wider";
export const thClass = "text-left px-2 sm:px-4 py-2 text-xs font-semibold uppercase tracking-wider whitespace-nowrap";
export const tdClass = "px-2 sm:px-4 py-2 text-xs tabular-nums whitespace-nowrap";

export function Section({
  title,
  children,
  bare = false,
}: {
  title: string;
  children: ReactNode;
  /** Table sections: no inner padding, the table runs edge to edge. */
  bare?: boolean;
}) {
  return (
    <section className={bare ? "card-glass mb-4 overflow-hidden" : "card-glass p-4 mb-4"}>
      <h2 className={`${headingClass} ${bare ? "px-4 pt-4 pb-3" : "mb-3"}`} style={headingStyle}>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function TileGrid({ children }: { children: ReactNode }) {
  return <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-4 text-sm">{children}</dl>;
}

export function Tile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "warning";
}) {
  return (
    <div className="min-w-0">
      <dt style={{ color: "var(--color-muted)" }}>{label}</dt>
      <dd
        className="font-display text-2xl tabular-nums"
        style={{ color: tone === "warning" ? "var(--color-warning)" : "var(--color-foreground)" }}
      >
        {value}
      </dd>
      {hint && (
        <div className="text-xs" style={{ color: "var(--color-subtle)" }}>
          {hint}
        </div>
      )}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="px-4 pb-4 text-sm" style={{ color: "var(--color-muted)" }}>
      {children}
    </p>
  );
}
