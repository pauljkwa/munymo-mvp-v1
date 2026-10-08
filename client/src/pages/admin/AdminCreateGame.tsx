import { trpc } from "@/lib/trpc";
import AdminLayout from "@/components/AdminLayout";
import { useLocation } from "wouter";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
import { emptyGrid, joinMetrics, HighlightPicker, MetricsGridFields, HIGHLIGHT_COUNT, type MetricsGrid } from "./MetricsPanelFields";

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
    exchange: "NASDAQ",
    sourceUrl: "",
    sourceTitle: "",
    sourcePublisher: "",
    researchContent: "",
    researchSummary: "",
    questionType: "multiple_choice" as "multiple_choice" | "yes_no" | "true_false",
    questionText: "",
    correctAnswer: "",
  });
  const [grid, setGrid] = useState<MetricsGrid>(emptyGrid());
  const [highlights, setHighlights] = useState<string[]>([]);
  const [options, setOptions] = useState<string[]>(["", "", "", ""]);

  const createGame = trpc.admin.createGame.useMutation({
    onSuccess: (res) => {
      toast.success(`Game #${res.gameId} created as a draft.`);
      if (res.highlightedMetricsDropped) {
        toast.warning("Highlighted metrics did not match the metrics panel and were not saved. This game will run legacy scoring until fixed.");
      }
      navigate(`/admin/games/${res.gameId}/edit`);
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const tickerA = form.companyATicker.trim().toUpperCase();
    const tickerB = form.companyBTicker.trim().toUpperCase();
    if (highlights.length > 0 && highlights.length !== HIGHLIGHT_COUNT) {
      toast.error(`Tick exactly ${HIGHLIGHT_COUNT} highlighted metrics, or none.`);
      return;
    }
    const metrics = joinMetrics(grid, tickerA, tickerB);
    const hasQuestion = !!(form.questionText.trim() || form.correctAnswer.trim());
    const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
    if (hasQuestion && (!form.questionText.trim() || !form.correctAnswer.trim())) {
      toast.error("The reading check needs both question text and a correct answer.");
      return;
    }
    if (hasQuestion && form.questionType === "multiple_choice" && !cleanOptions.includes(form.correctAnswer.trim())) {
      toast.error("The correct answer must exactly match one of the options.");
      return;
    }
    if ((Object.keys(metrics).length > 0 || form.researchSummary.trim()) && !form.researchContent.trim()) {
      toast.error("Add the full analysis text before saving metrics or a summary.");
      return;
    }
    const lockoutDate = form.lockoutAt ? new Date(form.lockoutAt) : null;
    createGame.mutate({
      gameDate: form.gameDate,
      exchange: form.exchange.trim() || "NASDAQ",
      companyAName: form.companyAName,
      companyATicker: tickerA,
      companyBName: form.companyBName,
      companyBTicker: tickerB,
      sector: form.sector || undefined,
      pairingRationale: form.pairingRationale || undefined,
      lockoutAt: lockoutDate && !isNaN(lockoutDate.getTime()) ? lockoutDate.toISOString() : undefined,
      sourceUrl: form.sourceUrl.trim() || undefined,
      sourceTitle: form.sourceTitle.trim() || undefined,
      sourcePublisher: form.sourcePublisher.trim() || undefined,
      researchContent: form.researchContent.trim() || undefined,
      researchSummary: form.researchSummary.trim() || undefined,
      researchMetrics: Object.keys(metrics).length > 0 ? metrics : undefined,
      highlightedMetrics: highlights.length === HIGHLIGHT_COUNT ? highlights : undefined,
      ...(hasQuestion
        ? {
            questionType: form.questionType,
            questionText: form.questionText.trim(),
            options: form.questionType === "multiple_choice" ? cleanOptions : undefined,
            correctAnswer: form.correctAnswer.trim(),
          }
        : {}),
    });
  };

  const textarea = (label: string, key: keyof typeof form, rows: number, placeholder = "") => (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--color-subtle)" }}>
        {label}
      </label>
      <textarea
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder}
        rows={rows}
        className="input-field w-full resize-y"
      />
    </div>
  );

  const sectionTitle = (t: string) => (
    <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-brand)" }}>{t}</h2>
  );

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
            {field("Exchange", "exchange", "text", "NASDAQ")}
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
            {field("Company Name", "companyAName", "text", "e.g. Vistra")}
            {field("Ticker Symbol", "companyATicker", "text", "e.g. AAPL")}
          </div>

          <div className="card-glass p-6 flex flex-col gap-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-brand)" }}>
              Company B
            </h2>
            {field("Company Name", "companyBName", "text", "e.g. Constellation")}
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

          <div className="card-glass p-6 flex flex-col gap-4">
            {sectionTitle("Source Article")}
            {field("Article URL", "sourceUrl", "url", "https://…")}
            {field("Article Title", "sourceTitle", "text", "Headline")}
            {field("Publisher", "sourcePublisher", "text", "e.g. Reuters")}
          </div>

          <div className="card-glass p-6 flex flex-col gap-4">
            {sectionTitle("Research")}
            {textarea("Basic Summary (beginner view)", "researchSummary", 3, "Plain-English beginner summary of the research.")}
            {textarea("Full Analysis", "researchContent", 10, "Paste the research content players read before their final pick.")}
          </div>

          <div className="card-glass p-6 flex flex-col gap-4">
            {sectionTitle("Metrics Panel")}
            <p className="text-xs" style={{ color: "var(--color-subtle)" }}>
              Eight metrics per company. Blank cells are left out. Anchor any date explicitly (no "today" or "tomorrow").
            </p>
            <MetricsGridFields
              grid={grid}
              onChange={setGrid}
              tickerA={form.companyATicker.trim().toUpperCase()}
              tickerB={form.companyBTicker.trim().toUpperCase()}
            />
          </div>

          <div className="card-glass p-6 flex flex-col gap-4">
            {sectionTitle("Highlighted Metrics")}
            <p className="text-xs" style={{ color: "var(--color-subtle)" }}>
              The four metrics where the two companies differ most today. Players name one as the reason for their pick.
            </p>
            <HighlightPicker selected={highlights} onChange={setHighlights} />
          </div>

          <div className="card-glass p-6 flex flex-col gap-4">
            {sectionTitle("Reading Check Question")}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--color-subtle)" }}>
                Question Type
              </label>
              <select
                value={form.questionType}
                onChange={(e) => setForm((f) => ({ ...f, questionType: e.target.value as typeof f.questionType }))}
                className="input-field w-full"
              >
                <option value="multiple_choice">Multiple Choice</option>
                <option value="yes_no">Yes / No</option>
                <option value="true_false">True / False</option>
              </select>
            </div>
            {textarea("Question Text", "questionText", 2, "A comparative question that needs both columns of the metrics panel.")}
            {form.questionType === "multiple_choice" && (
              <div className="flex flex-col gap-2">
                <label className="block text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-subtle)" }}>
                  Options
                </label>
                {options.map((opt, i) => (
                  <input
                    key={i}
                    type="text"
                    value={opt}
                    onChange={(e) => setOptions((o) => o.map((x, j) => (j === i ? e.target.value : x)))}
                    placeholder={`Option ${i + 1}`}
                    className="input-field w-full"
                  />
                ))}
              </div>
            )}
            {field(
              "Correct Answer",
              "correctAnswer",
              "text",
              form.questionType === "yes_no" ? "Yes or No" : form.questionType === "true_false" ? "True or False" : "Must exactly match one of the options"
            )}
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
