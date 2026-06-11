import { trpc } from "@/lib/trpc";
import AdminLayout from "@/components/AdminLayout";
import { useParams, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Save, Play, XCircle, Loader2, HelpCircle, BookOpen } from "lucide-react";

export default function AdminEditGame() {
  const { id } = useParams<{ id: string }>();
  const gameId = parseInt(id ?? "0", 10);
  const [, navigate] = useLocation();

  const { data: game, refetch } = trpc.games.getById.useQuery({ id: gameId });
  const { data: research, refetch: refetchResearch } = trpc.games.getResearch.useQuery({ gameId });
  const { data: validationQ, refetch: refetchVQ } = trpc.games.getValidationQuestion.useQuery({ gameId });

  const [researchContent, setResearchContent] = useState("");
  const [vqForm, setVqForm] = useState({
    questionText: "",
    questionType: "multiple_choice" as "multiple_choice" | "yes_no" | "true_false",
    options: "",
    correctAnswer: "",
  });

  useEffect(() => {
    if (research?.content) setResearchContent(research.content);
  }, [research]);

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

  const saveResearch = trpc.admin.updateResearch.useMutation({
    onSuccess: () => { toast.success("Research saved."); refetchResearch(); },
    onError: (e: { message: string }) => toast.error(e.message),
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
          <textarea
            value={researchContent}
            onChange={(e) => setResearchContent(e.target.value)}
            disabled={!isEditable}
            rows={10}
            placeholder="Paste research content here. Players will see this after submitting their Gut Selection."
            className="input-field w-full resize-y"
          />
          {isEditable && (
            <div className="flex justify-end mt-3">
              <button
                onClick={() => saveResearch.mutate({ gameId, content: researchContent })}
                disabled={saveResearch.isPending}
                className="btn-brand"
              >
                {saveResearch.isPending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                Save Research
              </button>
            </div>
          )}
        </div>

        {/* Validation Question */}
        <div className="card-glass p-6 mb-5">
          <div className="flex items-center gap-2 mb-4">
            <HelpCircle size={16} style={{ color: "var(--color-brand)" }} />
            <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-brand)" }}>
              Validation Question (20% of Daily Score)
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
