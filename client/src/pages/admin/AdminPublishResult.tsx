import { trpc } from "@/lib/trpc";
import AdminLayout from "@/components/AdminLayout";
import { useParams, useLocation } from "wouter";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2 } from "lucide-react";

export default function AdminPublishResult() {
  const { id } = useParams<{ id: string }>();
  const gameId = parseInt(id ?? "0", 10);
  const [, navigate] = useLocation();

  const { data: game } = trpc.games.getById.useQuery({ id: gameId });

  const [winner, setWinner] = useState<"A" | "B" | "">("");
  const [commentary, setCommentary] = useState("");

  const publishResult = trpc.admin.publishResult.useMutation({
    onSuccess: () => {
      toast.success("Result published and scores calculated.");
      navigate("/admin");
    },
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

  return (
    <AdminLayout>
      <div className="max-w-xl">
        <h1 className="font-display text-2xl mb-2" style={{ color: "var(--color-foreground)" }}>
          Publish Result
        </h1>
        <p className="text-sm mb-6" style={{ color: "var(--color-muted)" }}>
          {game.companyATicker} vs {game.companyBTicker} · {game.gameDate}
        </p>

        <div className="card-glass p-6 flex flex-col gap-5">
          {/* Winner selection */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--color-subtle)" }}>
              Winning Company
            </label>
            <div className="grid grid-cols-2 gap-3">
              {(["A", "B"] as const).map((side) => {
                const name = side === "A" ? game.companyAName : game.companyBName;
                const ticker = side === "A" ? game.companyATicker : game.companyBTicker;
                return (
                  <button
                    key={side}
                    type="button"
                    onClick={() => setWinner(side)}
                    className="p-4 rounded-xl border-2 transition-all text-left"
                    style={{
                      borderColor: winner === side ? "var(--color-brand)" : "var(--color-border)",
                      background: winner === side ? "oklch(from var(--color-brand) l c h / 0.08)" : "transparent",
                    }}
                  >
                    <div className="ticker-chip mb-2">{ticker}</div>
                    <div className="text-sm font-medium" style={{ color: "var(--color-foreground)" }}>{name}</div>
                    {winner === side && (
                      <CheckCircle2 size={16} className="mt-2" style={{ color: "var(--color-brand)" }} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Educational commentary */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--color-subtle)" }}>
              Educational Commentary
            </label>
            <p className="text-xs mb-2" style={{ color: "var(--color-subtle)" }}>
              Explain why the winner outperformed. This will be shown on the Results page and archived in the Research Hub.
            </p>
            <textarea
              value={commentary}
              onChange={(e) => setCommentary(e.target.value)}
              rows={6}
              placeholder="Provide context about the result, key factors, and learning takeaways..."
              className="input-field w-full resize-y"
            />
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => navigate("/admin")} className="btn-ghost">
              Cancel
            </button>
            <button
              onClick={() => {
                if (!winner) { toast.error("Please select a winning company."); return; }
                if (!commentary.trim()) { toast.error("Please add educational commentary."); return; }
                publishResult.mutate({ gameId, winner, resultCommentary: commentary });
              }}
              disabled={publishResult.isPending}
              className="btn-brand"
            >
              {publishResult.isPending ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
              Publish Result
            </button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
