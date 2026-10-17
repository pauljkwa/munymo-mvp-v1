import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import AdminLayout from "@/components/AdminLayout";
import {
  VENDOR_CATEGORIES,
  VENDOR_OPTIONS,
  defaultCategoryForVendor,
  type VendorCategory,
} from "@shared/aiUsage";

// Running-costs ledger (references/running-costs-ledger-spec.md §7). Plain
// numbers and tables only: the point of this phase is to prove the data is
// flowing for a month before anything is drawn.

const OTHER_VENDOR = "Other";

const RUN_KIND_LABELS: Record<string, string> = {
  daily_combined: "Full run",
  daily_results_only: "Results only",
  staging: "Staging",
  backfill_highlights: "Backfill",
  metric_explanation: "Metric note",
};

const usd = (n: number | null | undefined, digits = 2) =>
  n === null || n === undefined ? "unpriced" : `$${n.toFixed(digits)}`;

function formatDuration(ms: number | null): string {
  if (ms === null || ms === undefined) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function formatWhen(value: Date | string): string {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatTotals(totals: Record<string, number>): string {
  const parts = Object.entries(totals).map(([cur, n]) => `${cur} ${n.toFixed(2)}`);
  return parts.length > 0 ? parts.join(" · ") : "—";
}

const headingStyle = { color: "var(--color-subtle)" } as const;
const thClass = "text-left px-2 sm:px-4 py-2 text-xs font-semibold uppercase tracking-wider whitespace-nowrap";
const tdClass = "px-2 sm:px-4 py-2 text-xs tabular-nums whitespace-nowrap";

export default function AdminCosts() {
  const utils = trpc.useUtils();
  const { data: ai, isLoading: aiLoading } = trpc.admin.costs.aiSummary.useQuery({ days: 30 });
  const { data: vendors, isLoading: vendorsLoading } = trpc.admin.costs.vendorList.useQuery({ months: 12 });

  const [month, setMonth] = useState(currentMonth());
  const [vendor, setVendor] = useState<string>(VENDOR_OPTIONS[0].name);
  const [otherVendor, setOtherVendor] = useState("");
  const [category, setCategory] = useState<VendorCategory>(defaultCategoryForVendor(VENDOR_OPTIONS[0].name));
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [note, setNote] = useState("");

  const upsert = trpc.admin.costs.vendorUpsert.useMutation({
    onSuccess: () => {
      toast.success("Saved.");
      setAmount("");
      setNote("");
      utils.admin.costs.vendorList.invalidate();
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const remove = trpc.admin.costs.vendorDelete.useMutation({
    onSuccess: () => {
      toast.success("Entry deleted.");
      utils.admin.costs.vendorList.invalidate();
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const chooseVendor = (name: string) => {
    setVendor(name);
    setCategory(defaultCategoryForVendor(name));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const vendorName = vendor === OTHER_VENDOR ? otherVendor.trim() : vendor;
    const parsed = Number(amount);
    if (!vendorName) return toast.error("Enter a vendor name.");
    if (!amount.trim() || !Number.isFinite(parsed) || parsed < 0) return toast.error("Enter the amount as printed on the invoice.");
    upsert.mutate({
      month,
      vendor: vendorName,
      category,
      amount: parsed,
      currency: currency.trim().toUpperCase(),
      note: note.trim() || undefined,
    });
  };

  const failedDays = ai?.byGameDate.filter((d) => d.failedRuns > 0).length ?? 0;

  return (
    <AdminLayout>
      <div className="max-w-4xl">
        <h1 className="font-display text-2xl mb-2" style={{ color: "var(--color-foreground)" }}>
          Running costs
        </h1>
        <p className="text-sm mb-6" style={{ color: "var(--color-muted)" }}>
          AI spend is estimated from logged token counts at the published rates. The vendor ledger is filled in by hand from each invoice.
        </p>

        {/* 1. AI spend */}
        <section className="card-glass p-4 mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={headingStyle}>AI spend</h2>
          {aiLoading || !ai ? (
            <Loader2 size={20} className="animate-spin" style={{ color: "var(--color-brand)" }} />
          ) : (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div>
                <dt style={{ color: "var(--color-muted)" }}>Month to date</dt>
                <dd className="font-display text-2xl tabular-nums" style={{ color: "var(--color-foreground)" }}>{usd(ai.monthToDateUsd)}</dd>
              </div>
              <div>
                <dt style={{ color: "var(--color-muted)" }}>Last 30 days</dt>
                <dd className="font-display text-2xl tabular-nums" style={{ color: "var(--color-foreground)" }}>{usd(ai.last30DaysUsd)}</dd>
              </div>
              <div>
                <dt style={{ color: "var(--color-muted)" }}>Cache hit rate</dt>
                <dd className="font-display text-2xl tabular-nums" style={{ color: "var(--color-foreground)" }}>
                  {ai.cacheHitRate === null ? "—" : `${(ai.cacheHitRate * 100).toFixed(1)}%`}
                </dd>
              </div>
              {ai.unpricedTurns > 0 && (
                <div>
                  <dt style={{ color: "var(--color-muted)" }}>Unpriced turns</dt>
                  <dd className="font-display text-2xl tabular-nums" style={{ color: "var(--color-warning)" }}>{ai.unpricedTurns}</dd>
                </div>
              )}
            </dl>
          )}
          <p className="text-xs mt-3" style={{ color: "var(--color-subtle)" }}>
            A falling cache hit rate means something crept into the cached prompt prefix. An unpriced turn means a model id is missing from the rate table.
          </p>
        </section>

        {/* 2. Per game day */}
        <section className="card-glass mb-6 overflow-hidden">
          <h2 className="text-xs font-semibold uppercase tracking-wider px-4 pt-4 pb-3" style={headingStyle}>
            Per game day{failedDays > 0 ? ` (${failedDays} with a failed run)` : ""}
          </h2>
          {aiLoading || !ai ? null : ai.byGameDate.length === 0 ? (
            <p className="px-4 pb-4 text-sm" style={{ color: "var(--color-muted)" }}>
              No AI usage logged yet. Rows appear after the next curation run, once the migration has been applied.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderTop: "1px solid var(--color-border)", borderBottom: "1px solid var(--color-border)" }}>
                    {["Date", "Cost", "Turns", "Runs", "Failed", "Failover", "Searches"].map((h) => (
                      <th key={h} className={thClass} style={headingStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ai.byGameDate.map((d) => {
                    const failed = d.failedRuns > 0;
                    return (
                      <tr
                        key={d.gameDate}
                        style={{
                          borderBottom: "1px solid var(--color-border)",
                          background: failed ? "var(--color-warning-muted)" : undefined,
                          color: failed ? "var(--color-warning)" : "var(--color-foreground)",
                        }}
                      >
                        <td className={tdClass}>{d.gameDate}</td>
                        <td className={tdClass}>{usd(d.costUsd)}</td>
                        <td className={tdClass}>{d.turns}</td>
                        <td className={tdClass}>{d.runs}</td>
                        <td className={tdClass}>{d.failedRuns}</td>
                        <td className={tdClass}>{d.failoverTurns}</td>
                        <td className={tdClass}>{d.webSearches}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* 3. Recent runs */}
        <section className="card-glass mb-6 overflow-hidden">
          <h2 className="text-xs font-semibold uppercase tracking-wider px-4 pt-4 pb-3" style={headingStyle}>Recent runs</h2>
          {aiLoading || !ai ? null : ai.runs.length === 0 ? (
            <p className="px-4 pb-4 text-sm" style={{ color: "var(--color-muted)" }}>No runs logged yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderTop: "1px solid var(--color-border)", borderBottom: "1px solid var(--color-border)" }}>
                    {["When", "Kind", "Trigger", "Outcome", "Time", "Cost"].map((h) => (
                      <th key={h} className={thClass} style={headingStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ai.runs.map((r) => {
                    const bad = r.outcome === "failed";
                    return (
                      <tr key={`${r.runId}-${new Date(r.createdAt).getTime()}`} style={{ borderBottom: "1px solid var(--color-border)", color: "var(--color-foreground)" }}>
                        <td className={tdClass}>{formatWhen(r.createdAt)}</td>
                        <td className={tdClass}>{RUN_KIND_LABELS[r.runKind] ?? r.runKind}</td>
                        <td className={`${tdClass} font-mono`}>{r.trigger}</td>
                        <td className={tdClass} style={{ color: bad ? "var(--color-warning)" : undefined }}>
                          {bad && r.errorMessage ? (
                            <details>
                              <summary className="cursor-pointer">failed</summary>
                              <p className="whitespace-normal break-words max-w-[16rem] mt-1" style={{ color: "var(--color-muted)" }}>
                                {r.errorMessage}
                              </p>
                            </details>
                          ) : (
                            r.outcome ?? "—"
                          )}
                        </td>
                        <td className={tdClass}>{formatDuration(r.durationMs)}</td>
                        <td className={tdClass}>{usd(r.costUsd)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* 4. Vendor ledger */}
        <section className="card-glass p-4 mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={headingStyle}>Vendor ledger</h2>
          {vendorsLoading || !vendors ? (
            <Loader2 size={20} className="animate-spin" style={{ color: "var(--color-brand)" }} />
          ) : vendors.months.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--color-muted)" }}>Nothing entered yet. Use the form below after each invoice arrives.</p>
          ) : (
            <div className="flex flex-col gap-5">
              {vendors.months.map((m) => (
                <div key={m.month}>
                  <div className="flex items-baseline justify-between gap-2 mb-1.5">
                    <h3 className="font-semibold text-sm" style={{ color: "var(--color-foreground)" }}>{m.month}</h3>
                  </div>
                  {m.entries.length > 0 && (
                    <ul className="flex flex-col" style={{ borderTop: "1px solid var(--color-border)" }}>
                      {m.entries.map((e) => (
                        <li key={e.id} className="flex items-center gap-2 py-1.5 text-sm" style={{ borderBottom: "1px solid var(--color-border)" }}>
                          <div className="flex-1 min-w-0">
                            <span style={{ color: "var(--color-foreground)" }}>{e.vendor}</span>
                            <span className="text-xs ml-2" style={{ color: "var(--color-subtle)" }}>{e.category}</span>
                            {e.note && <div className="text-xs truncate" style={{ color: "var(--color-muted)" }}>{e.note}</div>}
                          </div>
                          <span className="tabular-nums" style={{ color: "var(--color-foreground)" }}>
                            {e.currency} {Number(e.amount).toFixed(2)}
                          </span>
                          <button
                            type="button"
                            aria-label={`Delete ${e.vendor} ${m.month}`}
                            disabled={remove.isPending}
                            onClick={() => {
                              if (window.confirm(`Delete the ${e.vendor} entry for ${m.month} (${e.currency} ${Number(e.amount).toFixed(2)})?`)) {
                                remove.mutate({ id: e.id });
                              }
                            }}
                            className="btn-ghost p-1.5"
                            style={{ color: "var(--color-error)" }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="text-xs mt-1.5 flex flex-col gap-0.5" style={{ color: "var(--color-muted)" }}>
                    <span>Run total: {formatTotals(m.totals.run)}</span>
                    <span>Build total: {formatTotals(m.totals.build)}</span>
                    {(m.computedAnthropicUsd !== null || m.enteredAnthropicUsd !== null) && (
                      <span>
                        Anthropic API: computed {m.computedAnthropicUsd === null ? "—" : usd(m.computedAnthropicUsd)} · entered{" "}
                        {m.enteredAnthropicUsd === null ? "—" : usd(m.enteredAnthropicUsd)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Entry form */}
          <form onSubmit={submit} className="mt-6 pt-4 flex flex-col gap-3" style={{ borderTop: "1px solid var(--color-border)" }}>
            <h3 className="text-xs font-semibold uppercase tracking-wider" style={headingStyle}>Add or correct an invoice</h3>
            <p className="text-xs" style={{ color: "var(--color-subtle)" }}>
              Saving the same vendor for the same month again replaces the earlier figure.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="cost-month" className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={headingStyle}>Billing month</label>
                <input id="cost-month" type="month" required value={month} onChange={(e) => setMonth(e.target.value)} className="input-field w-full" />
              </div>
              <div>
                <label htmlFor="cost-vendor" className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={headingStyle}>Vendor</label>
                <select id="cost-vendor" value={vendor} onChange={(e) => chooseVendor(e.target.value)} className="input-field w-full">
                  {VENDOR_OPTIONS.map((v) => (
                    <option key={v.name} value={v.name}>{v.name}</option>
                  ))}
                  <option value={OTHER_VENDOR}>{OTHER_VENDOR}</option>
                </select>
              </div>
              {vendor === OTHER_VENDOR && (
                <div className="sm:col-span-2">
                  <label htmlFor="cost-other" className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={headingStyle}>Vendor name</label>
                  <input id="cost-other" type="text" maxLength={40} value={otherVendor} onChange={(e) => setOtherVendor(e.target.value)} className="input-field w-full" />
                </div>
              )}
              <div>
                <label htmlFor="cost-category" className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={headingStyle}>Category</label>
                <select id="cost-category" value={category} onChange={(e) => setCategory(e.target.value as VendorCategory)} className="input-field w-full">
                  {VENDOR_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c === "run" ? "Run (operating cost)" : "Build (cost of building it)"}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-[1fr_5rem] gap-2">
                <div>
                  <label htmlFor="cost-amount" className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={headingStyle}>Amount</label>
                  <input id="cost-amount" type="text" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="input-field w-full" />
                </div>
                <div>
                  <label htmlFor="cost-currency" className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={headingStyle}>Currency</label>
                  <input id="cost-currency" type="text" maxLength={3} value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} className="input-field w-full" />
                </div>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="cost-note" className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={headingStyle}>Note (optional)</label>
                <input id="cost-note" type="text" maxLength={200} placeholder="e.g. annual renewal, 12 months" value={note} onChange={(e) => setNote(e.target.value)} className="input-field w-full" />
              </div>
            </div>
            <div>
              <button type="submit" disabled={upsert.isPending} className="btn-brand inline-flex items-center gap-2">
                {upsert.isPending && <Loader2 size={14} className="animate-spin" />}
                Save entry
              </button>
            </div>
          </form>
        </section>
      </div>
    </AdminLayout>
  );
}
