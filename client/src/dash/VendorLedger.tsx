import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  VENDOR_CATEGORIES,
  VENDOR_OPTIONS,
  defaultCategoryForVendor,
  type VendorCategory,
  type VendorMonth,
} from "@shared/aiUsage";
import { currentMonth, formatTotals, usd } from "./format";
import { headingClass, headingStyle } from "./ui";

// The vendor ledger and its entry form, moved as-is from the old
// /admin/costs page (references/running-costs-ledger-spec.md §7). The rows now
// arrive with owner.dashboard; saving or deleting refreshes that one query.

const OTHER_VENDOR = "Other";

type LedgerMonth = VendorMonth<{
  id: number;
  month: string;
  vendor: string;
  category: string;
  amount: string | number;
  currency: string;
  note: string | null;
}>;

export default function VendorLedger({ months }: { months: LedgerMonth[] }) {
  const utils = trpc.useUtils();

  const [month, setMonth] = useState(currentMonth());
  const [vendor, setVendor] = useState<string>(VENDOR_OPTIONS[0].name);
  const [otherVendor, setOtherVendor] = useState("");
  const [category, setCategory] = useState<VendorCategory>(defaultCategoryForVendor(VENDOR_OPTIONS[0].name));
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [note, setNote] = useState("");

  const upsert = trpc.owner.costs.vendorUpsert.useMutation({
    onSuccess: () => {
      toast.success("Saved.");
      setAmount("");
      setNote("");
      utils.owner.dashboard.invalidate();
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const remove = trpc.owner.costs.vendorDelete.useMutation({
    onSuccess: () => {
      toast.success("Entry deleted.");
      utils.owner.dashboard.invalidate();
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

  return (
    <section className="card-glass p-4 mb-4">
      <h2 className={`${headingClass} mb-3`} style={headingStyle}>Vendor ledger</h2>
      {months.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--color-muted)" }}>Nothing entered yet. Use the form below after each invoice arrives.</p>
      ) : (
        <div className="flex flex-col gap-5">
          {months.map((m) => (
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
        <h3 className={headingClass} style={headingStyle}>Add or correct an invoice</h3>
        <p className="text-xs" style={{ color: "var(--color-subtle)" }}>
          Saving the same vendor for the same month again replaces the earlier figure.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="cost-month" className={`block ${headingClass} mb-1.5`} style={headingStyle}>Billing month</label>
            <input id="cost-month" type="month" required value={month} onChange={(e) => setMonth(e.target.value)} className="input-field w-full" />
          </div>
          <div>
            <label htmlFor="cost-vendor" className={`block ${headingClass} mb-1.5`} style={headingStyle}>Vendor</label>
            <select id="cost-vendor" value={vendor} onChange={(e) => chooseVendor(e.target.value)} className="input-field w-full">
              {VENDOR_OPTIONS.map((v) => (
                <option key={v.name} value={v.name}>{v.name}</option>
              ))}
              <option value={OTHER_VENDOR}>{OTHER_VENDOR}</option>
            </select>
          </div>
          {vendor === OTHER_VENDOR && (
            <div className="sm:col-span-2">
              <label htmlFor="cost-other" className={`block ${headingClass} mb-1.5`} style={headingStyle}>Vendor name</label>
              <input id="cost-other" type="text" maxLength={40} value={otherVendor} onChange={(e) => setOtherVendor(e.target.value)} className="input-field w-full" />
            </div>
          )}
          <div>
            <label htmlFor="cost-category" className={`block ${headingClass} mb-1.5`} style={headingStyle}>Category</label>
            <select id="cost-category" value={category} onChange={(e) => setCategory(e.target.value as VendorCategory)} className="input-field w-full">
              {VENDOR_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c === "run" ? "Run (operating cost)" : "Build (cost of building it)"}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-[1fr_5rem] gap-2">
            <div>
              <label htmlFor="cost-amount" className={`block ${headingClass} mb-1.5`} style={headingStyle}>Amount</label>
              <input id="cost-amount" type="text" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="input-field w-full" />
            </div>
            <div>
              <label htmlFor="cost-currency" className={`block ${headingClass} mb-1.5`} style={headingStyle}>Currency</label>
              <input id="cost-currency" type="text" maxLength={3} value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} className="input-field w-full" />
            </div>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="cost-note" className={`block ${headingClass} mb-1.5`} style={headingStyle}>Note (optional)</label>
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
  );
}
