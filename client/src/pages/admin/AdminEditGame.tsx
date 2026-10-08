import { trpc } from "@/lib/trpc";
import AdminLayout from "@/components/AdminLayout";
import { useParams, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Save, Play, XCircle, Loader2, HelpCircle, BookOpen } from "lucide-react";
import { emptyGrid, joinMetrics, splitMetrics, HighlightPicker, MetricsGridFields, HIGHLIGHT_COUNT, type MetricsGrid } from "./MetricsPanelFields";

export default function AdminEditGame() {
  const { id } = useParams<{ id: string }>();
  const gameId = parseInt(id ?? "0", 10);
  const [, navigate] = useLocation();

  const { data: game, refetch } = trpc.games.getById.useQuery({ id: gameId });
  const { data: research, refetch: refetchResearch } = trpc.games.getResearch.useQuery({ gameId });
  const { data: validationQ, refetch: refetchVQ } = trpc.games.getValidationQuestion.useQuery({ gameId });

  const [researchContent, setResearchContent] = useState("");
  const [researchSummary, setResearchSummary] = useState("");
  const [lockoutAtInput, setLockoutAtInput] = useState("");
  const [metricsGrid, setMetricsGrid] = useState<MetricsGrid>(emptyGrid());
  // Saved panel rows that are not one of the eight standard labels — kept untouched on save
  const [metricExtras, setMetricExtras] = useState<Record<string, string>>({});
  const [highlights, setHighlights] = useState<string[]>([]);
  const [matchupForm, setMatchupForm] = useState({
    pairingRationale: "",
    sourceTitle: "",
    sourcePublisher: "",
    sourceUrl: "",
  });
  const [vqForm, setVqForm] = useState({
    questionText: "",
    questionType: "multiple_choice" as "multiple_choice" | "yes_no" | "true_false",
    options: "",
    correctAnswer: "",
  });

  useEffect(() => {
    if (research?.content) setResearchContent(research.content);
    if (research?.researchSummary) setResearchSummary(research.researchSummary);
  }, [research]);

  useEffect(() => {
    if (game) {
      const { grid, extras } = splitMetrics(
        (research?.metrics ?? {}) as Record<string, string>,
        game.companyATicker,
        game.companyBTicker
      );
      setMetricsGrid(grid);
      setMetricExtras(extras);
    }
  }, [research, game?.companyATicker, game?.companyBTicker]);

  useEffect(() => {
    setHighlights(Array.isArray(game?.highlightedMetrics) ? (game!.highlightedMetrics as string[]) : []);
  }, [game?.highlightedMetrics]);

  useEffect(() => {
    if (game) {
      setMatchupForm({
        pairingRationale: game.pairingRationale ?? "",
        sourceTitle: game.sourceTitle ?? "",
        sourcePublisher: game.sourcePublisher ?? "",
        sourceUrl: game.sourceUrl ?? "",
      });
    }
  }, [game]);

  // Pre-populate lockoutAt from the game record (convert ISO → datetime-local)
  useEffect(() => {
    if (game?.lockoutAt) {
      const iso = new Date(game.lockoutAt).toISOString();
      setLockoutAtInput(iso.slice(0, 16)); // "YYYY-MM-DDTHH:mm"
    }
  }, [game?.lockoutAt]);

  useEffect(() => {
    if (validationQ) {
      setVqForm({
        questionText: validationQ.questionText,
        questionType: validationQ.questionType as "multiple_choice" | "yes_no" | "true_false",
        options: Array.isArray(validationQ.options) ? validationQ.options.join(", ") : "",
        correctAnswer: validationQ.correctAnswer ?? "",
      });
    }
  }, [validationQ]);

  const utils = trpc.useUtils();

  const saveLockout = trpc.admin.updateGame.useMutation({
    onSuccess: () => { toast.success("Lockout time updated."); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const saveResearch = trpc.admin.updateResearch.useMutation({
    onSuccess: (res) => {
      toast.success("Research saved.");
      if (res && res.highlightsStillValid === false) {
        toast.warning("The saved highlighted metrics no longer match this panel. Re-pick them below.");
      }
      refetchResearch();
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const saveHighlights = trpc.admin.updateGame.useMutation({
    onSuccess: () => { toast.success("Highlighted metrics saved."); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const saveMatchup = trpc.admin.updateGame.useMutation({
    onSuccess: () => { toast.success("Matchup details saved."); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const saveVQ = trpc.admin.setValidationQuestion.useMutation({
    onSuccess: () => { toast.success("Validation question saved."); refetchVQ(); },
    onError: (e) => toast.error(e.message),
  });

  const activateGame = trpc.admin.activateGame.useMutation({
    onSuccess: () => { toast.success("Game activated — now visible to players."); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const cancelGame = trpc.admin.cancelGame.useMutation({
    onSuccess: () => { toast.success("Game cancelled."); navigate("/admin"); },
    onError: (e) => toast.error(e.message),
  });

  if (!game) {
    return (
      <AdminLayout>
        <div className="flex justify-center py-16">
          <Loader2 size={28} className="animate-spin" style={{ color: "var(--color-brand)" }} />
        </div>
      </AdminLayout>
    );
  }

  const isEditable = game.status === "draft" || game.status === "active";
  const canEditLockout = game.status === "active" || game.status === "locked";

  return (
    <AdminLayout>
      <div className="max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-2xl mb-1" style={{ color: "var(--color-foreground)" }}>
              {game.companyATicker} vs {game.companyBTicker}
            </h1>
            <p className="text-sm" style={{ color: "var(--color-muted)" }}>
              {game.gameDate} · <span style={{ color: "var(--color-brand)" }}>{game.status}</span>
            </p>
          </div>
          <div className="flex gap-2">
            {game.status === "draft" && (
              <button
                onClick={() => activateGame.mutate({ gameId })}
                disabled={activateGame.isPending}
                className="btn-brand"
              >
                {activateGame.isPending ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
                Activate
              </button>
            )}
            {(game.status === "draft" || game.status === "active") && (
              <button
                onClick={() => {
                  if (confirm("Cancel this game? This cannot be undone.")) {
                    cancelGame.mutate({ gameId });
                  }
                }}
                disabled={cancelGame.isPending}
                className="btn-ghost text-sm"
                style={{ color: "var(--color-error)" }}
              >
                <XCircle size={15} /> Cancel
              </button>
            )}
          </div>
        </div>

        {/* Lockout Time */}
        {canEditLockout && (
          <div className="card-glass p-6 mb-5">
            <div className="flex items-center gap-2 mb-4">
              <Save size={16} style={{ color: "var(--color-brand)" }} />
              <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-brand)" }}>
                Lockout Time (UTC)
              </h2>
            </div>
            <p className="text-xs mb-3" style={{ color: "var(--color-subtle)" }}>
              The time at which the game locks and players can no longer submit picks. All times are UTC.
            </p>
            <input
              type="datetime-local"
              value={lockoutAtInput}
              onChange={(e) => setLockoutAtInput(e.target.value)}
              className="input-field w-full"
            />
            <div className="flex justify-end mt-3">
              <button
                onClick={() => {
                  if (!lockoutAtInput) return;
                  // datetime-local gives "YYYY-MM-DDTHH:mm" — append :00Z to make a valid ISO string
                  const iso = lockoutAtInput.length === 16 ? lockoutAtInput + ":00.000Z" : new Date(lockoutAtInput).toISOString();
                  saveLockout.mutate({ gameId, lockoutAt: iso });
                }}
                disabled={saveLockout.isPending || !lockoutAtInput}
                className="btn-brand"
              >
                {saveLockout.isPending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                Save Lockout Time
              </button>
            </div>
          </div>
        )}

        {/* Matchup Details */}
        <div className="card-glass p-6 mb-5">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen size={16} style={{ color: "var(--color-brand)" }} />
            <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-brand)" }}>
              Matchup Details
            </h2>
          </div>
          <p className="text-xs mb-3" style={{ color: "var(--color-subtle)" }}>
            The pairing rationale and news source shown to players alongside the matchup.
          </p>
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--color-subtle)" }}>
                Pairing Rationale
              </label>
              <textarea
                value={matchupForm.pairingRationale}
                onChange={(e) => setMatchupForm((f) => ({ ...f, pairingRationale: e.target.value }))}
                disabled={!isEditable}
                rows={3}
                placeholder="Why these two companies, today."
                className="input-field w-full resize-y"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--color-subtle)" }}>
                  Source Title
                </label>
                <input
                  type="text"
                  value={matchupForm.sourceTitle}
                  onChange={(e) => setMatchupForm((f) => ({ ...f, sourceTitle: e.target.value }))}
                  disabled={!isEditable}
                  placeholder="Article headline"
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--color-subtle)" }}>
                  Source Publisher
                </label>
                <input
                  type="text"
                  value={matchupForm.sourcePublisher}
                  onChange={(e) => setMatchupForm((f) => ({ ...f, sourcePublisher: e.target.value }))}
                  disabled={!isEditable}
                  placeholder="e.g. Reuters"
                  className="input-field w-full"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--color-subtle)" }}>
                Source URL
              </label>
              <input
                type="url"
                value={matchupForm.sourceUrl}
                onChange={(e) => setMatchupForm((f) => ({ ...f, sourceUrl: e.target.value }))}
                disabled={!isEditable}
                placeholder="https://…"
                className="input-field w-full"
              />
            </div>
            {isEditable && (
              <div className="flex justify-end">
                <button
                  onClick={() => saveMatchup.mutate({ gameId, ...matchupForm })}
                  disabled={saveMatchup.isPending}
                  className="btn-brand"
                >
                  {saveMatchup.isPending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                  Save Matchup Details
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Research */}
        <div className="card-glass p-6 mb-5">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen size={16} style={{ color: "var(--color-brand)" }} />
            <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-brand)" }}>
              Active-Game Research
            </h2>
          </div>
          <p className="text-xs mb-3" style={{ color: "var(--color-subtle)" }}>
            This content is displayed on the game page for players to review before making their Final Selection.
          </p>
          <div className="mb-4">
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--color-subtle)" }}>
              Basic Summary (default beginner view — all players)
            </label>
            <textarea
              value={researchSummary}
              onChange={(e) => setResearchSummary(e.target.value)}
              disabled={!isEditable}
              rows={3}
              placeholder="Plain-English beginner summary of the research."
              className="input-field w-full resize-y"
            />
          </div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--color-subtle)" }}>
            Full Analysis
          </label>
          <textarea
            value={researchContent}
            onChange={(e) => setResearchContent(e.target.value)}
            disabled={!isEditable}
            rows={10}
            placeholder="Paste research content here. Players will see this after submitting their Gut Selection."
            className="input-field w-full resize-y"
          />
          <h3 className="text-xs font-semibold uppercase tracking-wider mt-5 mb-3" style={{ color: "var(--color-brand)" }}>
            Metrics Panel
          </h3>
          <MetricsGridFields
            grid={metricsGrid}
            onChange={setMetricsGrid}
            tickerA={game.companyATicker}
            tickerB={game.companyBTicker}
            disabled={!isEditable}
          />
          {isEditable && (
            <div className="flex justify-end mt-3">
              <button
                onClick={() => {
                  const metrics = joinMetrics(metricsGrid, game.companyATicker, game.companyBTicker, metricExtras);
                  saveResearch.mutate({
                    gameId,
                    content: researchContent,
                    summary: researchSummary || undefined,
                    researchMetrics: Object.keys(metrics).length > 0 ? metrics : undefined,
                  });
                }}
                disabled={saveResearch.isPending}
                className="btn-brand"
              >
                {saveResearch.isPending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                Save Research
              </button>
            </div>
          )}
        </div>

        {/* Highlighted Metrics */}
        <div className="card-glass p-6 mb-5">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen size={16} style={{ color: "var(--color-brand)" }} />
            <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-brand)" }}>
              Highlighted Metrics
            </h2>
          </div>
          <p className="text-xs mb-3" style={{ color: "var(--color-subtle)" }}>
            The four metrics where the two companies differ most today. Players name one as the reason for their pick.
            Save the metrics panel first. They can only change while the game is a draft; clearing all four runs the game under legacy scoring.
          </p>
          <HighlightPicker selected={highlights} onChange={setHighlights} disabled={game.status !== "draft"} />
          {game.status === "draft" && (
            <div className="flex justify-end mt-3">
              <button
                onClick={() => {
                  if (highlights.length !== 0 && highlights.length !== HIGHLIGHT_COUNT) {
                    toast.error(`Tick exactly ${HIGHLIGHT_COUNT} highlighted metrics, or none.`);
                    return;
                  }
                  saveHighlights.mutate({ gameId, highlightedMetrics: highlights.length === HIGHLIGHT_COUNT ? highlights : null });
                }}
                disabled={saveHighlights.isPending}
                className="btn-brand"
              >
                {saveHighlights.isPending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                Save Highlighted Metrics
              </button>
            </div>
          )}
        </div>

        {/* Validation Question */}
        <div className="card-glass p-6 mb-5">
          <div className="flex items-center gap-2 mb-4">
            <HelpCircle size={16} style={{ color: "var(--color-brand)" }} />
            <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-brand)" }}>
              Reading Check Question
            </h2>
          </div>
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--color-subtle)" }}>
                Question Type
              </label>
              <select
                value={vqForm.questionType}
                onChange={(e) => setVqForm((f) => ({ ...f, questionType: e.target.value as typeof f.questionType }))}
                disabled={!isEditable}
                className="input-field w-full"
              >
                <option value="multiple_choice">Multiple Choice</option>
                <option value="yes_no">Yes / No</option>
                <option value="true_false">True / False</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--color-subtle)" }}>
                Question Text
              </label>
              <textarea
                value={vqForm.questionText}
                onChange={(e) => setVqForm((f) => ({ ...f, questionText: e.target.value }))}
                disabled={!isEditable}
                rows={2}
                placeholder="Ask a question answerable from the research above."
                className="input-field w-full resize-none"
              />
            </div>
            {vqForm.questionType === "multiple_choice" && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--color-subtle)" }}>
                  Options (comma-separated)
                </label>
                <input
                  type="text"
                  value={vqForm.options}
                  onChange={(e) => setVqForm((f) => ({ ...f, options: e.target.value }))}
                  disabled={!isEditable}
                  placeholder="e.g. Option A, Option B, Option C"
                  className="input-field w-full"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--color-subtle)" }}>
                Correct Answer
              </label>
              <input
                type="text"
                value={vqForm.correctAnswer}
                onChange={(e) => setVqForm((f) => ({ ...f, correctAnswer: e.target.value }))}
                disabled={!isEditable}
                placeholder="Must exactly match one of the options"
                className="input-field w-full"
              />
            </div>
            {isEditable && (
              <div className="flex justify-end">
                <button
                  onClick={() =>
                    saveVQ.mutate({
                      gameId,
                      questionText: vqForm.questionText,
                      questionType: vqForm.questionType,
                      options: vqForm.options ? vqForm.options.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
                      correctAnswer: vqForm.correctAnswer,
                    })
                  }
                  disabled={saveVQ.isPending}
                  className="btn-brand"
                >
                  {saveVQ.isPending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                  Save Question
                </button>
              </div>
            )}
          </div>
        </div>

        {game.status === "locked" && (
          <div className="flex justify-end">
            <button
              onClick={() => navigate(`/admin/games/${gameId}/result`)}
              className="btn-brand"
            >
              Publish Result →
            </button>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
