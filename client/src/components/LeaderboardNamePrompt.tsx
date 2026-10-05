import { useState } from "react";
import { Trophy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

const MAX_NAME = 32;

/**
 * Asks for a leaderboard name on a player's first scored result, the moment
 * they can see why it matters, instead of at sign-up (Paul, 2026-10-05).
 *
 * Shown only while `users.displayName` is empty. Either button saves one,
 * "Keep it" saves the name they're already shown under, so it never asks
 * again. Sits on the result panel of /game and on /game/:id/result.
 */
export default function LeaderboardNamePrompt({ gameId, className = "" }: { gameId: number; className?: string }) {
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const { data: profile } = trpc.dashboard.getProfile.useQuery(undefined, { enabled: isAuthenticated });
  const { data: score } = trpc.scores.getMyScoreForGame.useQuery({ gameId }, { enabled: isAuthenticated });
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");

  const save = trpc.dashboard.updateDisplayName.useMutation({
    onSuccess: () => {
      utils.dashboard.getProfile.invalidate();
      toast.success("Saved. You can change it anytime on your profile.");
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  if (!isAuthenticated || !profile || profile.displayName || !score) return null;
  const shownAs = profile.publicName ?? "Player";

  return (
    <div className={`card-glass p-5 ${className}`} style={{ borderColor: "var(--color-brand)" }}>
      <div className="flex items-start gap-3">
        <Trophy size={20} className="shrink-0 mt-0.5" style={{ color: "var(--color-brand)" }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm" style={{ color: "var(--color-foreground)" }}>
            You scored <strong>{score.totalScore}</strong> and you're on the leaderboard as{" "}
            <strong>{shownAs}</strong>.
          </p>

          {editing ? (
            <form
              className="flex gap-2 mt-3"
              onSubmit={(e) => {
                e.preventDefault();
                const trimmed = name.trim();
                if (trimmed) save.mutate({ displayName: trimmed });
              }}
            >
              <input
                autoFocus
                value={name}
                maxLength={MAX_NAME}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your leaderboard name"
                aria-label="Your leaderboard name"
                className="flex-1 min-w-0 rounded-lg px-3 py-2 text-sm border"
                style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
              />
              <button type="submit" className="btn-brand text-sm py-2 px-4" disabled={!name.trim() || save.isPending}>
                {save.isPending ? <Loader2 size={14} className="animate-spin" /> : "Save"}
              </button>
            </form>
          ) : (
            <div className="flex gap-2 mt-3">
              <button
                className="btn-brand text-sm py-2 px-4"
                disabled={save.isPending}
                onClick={() => save.mutate({ displayName: shownAs })}
              >
                Keep it
              </button>
              <button
                className="btn-ghost text-sm py-2 px-4"
                onClick={() => {
                  setName(shownAs);
                  setEditing(true);
                }}
              >
                Change name
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
