import { trpc } from "@/lib/trpc";
import AdminLayout from "@/components/AdminLayout";
import { useLocation } from "wouter";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";

export default function AdminCreateGame() {
  const [, navigate] = useLocation();
  const [form, setForm] = useState({
    gameDate: new Date().toISOString().split("T")[0] ?? "",
    companyAName: "",
    companyATicker: "",
    companyBName: "",
    companyBTicker: "",
    sector: "",
    pairingRationale: "",
    lockoutAt: "",
  });

  const createGame = trpc.admin.createGame.useMutation({
    onSuccess: () => {
      toast.success("Game created. Add research and validation question from the dashboard.");
      navigate("/admin");
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createGame.mutate({
      gameDate: form.gameDate,
      companyAName: form.companyAName,
      companyATicker: form.companyATicker.toUpperCase(),
      companyBName: form.companyBName,
      companyBTicker: form.companyBTicker.toUpperCase(),
      sector: form.sector || undefined,
      pairingRationale: form.pairingRationale || undefined,
      lockoutAt: form.lockoutAt || undefined,
    });
  };

  const field = (label: string, key: keyof typeof form, type = "text", placeholder = "") => (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--color-subtle)" }}>
        {label}
      </label>
      <input
        type={type}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder}
        className="input-field w-full"
      />
    </div>
  );

  return (
    <AdminLayout>
      <div className="max-w-2xl">
        <h1 className="font-display text-2xl mb-6" style={{ color: "var(--color-foreground)" }}>
          Create New Game
        </h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="card-glass p-6 flex flex-col gap-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-brand)" }}>
              Game Details
            </h2>
            {field("Game Date", "gameDate", "date")}
            {field("Sector / Context", "sector", "text", "e.g. Technology — Cloud Infrastructure")}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--color-subtle)" }}>
                Lockout Time (optional)
              </label>
              <input
                type="datetime-local"
                value={form.lockoutAt}
                onChange={(e) => setForm((f) => ({ ...f, lockoutAt: e.target.value }))}
                className="input-field w-full"
              />
            </div>
          </div>

          <div className="card-glass p-6 flex flex-col gap-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-brand)" }}>
              Company A
            </h2>
            {field("Company Name", "companyAName", "text", "e.g. Apple Inc.")}
            {field("Ticker Symbol", "companyATicker", "text", "e.g. AAPL")}
          </div>

          <div className="card-glass p-6 flex flex-col gap-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-brand)" }}>
              Company B
            </h2>
            {field("Company Name", "companyBName", "text", "e.g. Microsoft Corp.")}
            {field("Ticker Symbol", "companyBTicker", "text", "e.g. MSFT")}
          </div>

          <div className="card-glass p-6 flex flex-col gap-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-brand)" }}>
              Pairing Rationale
            </h2>
            <div>
              <textarea
                value={form.pairingRationale}
                onChange={(e) => setForm((f) => ({ ...f, pairingRationale: e.target.value }))}
                placeholder="Why are these two companies being compared today?"
                rows={3}
                className="input-field w-full resize-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => navigate("/admin")} className="btn-ghost">
              Cancel
            </button>
            <button type="submit" disabled={createGame.isPending} className="btn-brand">
              {createGame.isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              Create Game
            </button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
