import { trpc } from "@/lib/trpc";
import AdminLayout from "@/components/AdminLayout";
import { toast } from "sonner";
import { useState } from "react";
import { Loader2, UserCheck, RotateCcw } from "lucide-react";

export default function AdminPlayers() {
  const { data: players, isLoading, refetch } = trpc.admin.listPlayers.useQuery();
  const { data: games } = trpc.admin.listAllGames.useQuery({ limit: 50, offset: 0 });
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);

  const setAway = trpc.admin.setPlayerAwayStatus.useMutation({
    onSuccess: () => { toast.success("Player status updated."); refetch(); },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const resetPick = trpc.admin.resetPlayerPick.useMutation({
    onSuccess: () => toast.success("Player pick reset — they can replay this game."),
    onError: (e: { message: string }) => toast.error(e.message),
  });

  return (
    <AdminLayout>
      <div className="max-w-3xl">
        <h1 className="font-display text-2xl mb-2" style={{ color: "var(--color-foreground)" }}>
          Player Management
        </h1>
        <p className="text-sm mb-4" style={{ color: "var(--color-muted)" }}>
          Set Away Status to preserve a player's streak while they are absent. Use Reset Pick to let a player replay a specific game (for testing).
        </p>

        {/* Game selector for reset */}
        <div className="card-glass p-4 mb-6 flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium" style={{ color: "var(--color-foreground)" }}>Reset pick for game:</span>
          <select
            value={selectedGameId ?? ""}
            onChange={e => setSelectedGameId(e.target.value ? Number(e.target.value) : null)}
            className="text-sm border rounded px-2 py-1"
            style={{ background: "var(--color-surface)", color: "var(--color-foreground)", borderColor: "var(--color-border)" }}
          >
            <option value="">— select a game —</option>
            {(games ?? []).map((g: NonNullable<typeof games>[number]) => (
              <option key={g.id} value={g.id}>
                {g.gameDate} · {g.companyATicker} vs {g.companyBTicker}
              </option>
            ))}
          </select>
          {!selectedGameId && <span className="text-xs" style={{ color: "var(--color-subtle)" }}>Select a game first, then click Reset on a player row.</span>}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={28} className="animate-spin" style={{ color: "var(--color-brand)" }} />
          </div>
        ) : !players || players.length === 0 ? (
          <div className="card-glass p-10 text-center" style={{ color: "var(--color-muted)" }}>
            No players registered yet.
          </div>
        ) : (
          <div className="card-glass overflow-hidden">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                  <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-subtle)" }}>Player</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider hidden sm:table-cell" style={{ color: "var(--color-subtle)" }}>Status</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-subtle)" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {players.map((player: NonNullable<typeof players>[number], i: number) => (
                  <tr key={player.id} style={{ borderBottom: i < players.length - 1 ? "1px solid var(--color-border)" : undefined }}>
                    <td className="px-5 py-4">
                      <div className="text-sm font-medium" style={{ color: "var(--color-foreground)" }}>{player.name ?? "—"}</div>
                      <div className="text-xs" style={{ color: "var(--color-muted)" }}>{player.email ?? ""}</div>
                    </td>
                    <td className="px-5 py-4 hidden sm:table-cell">
                      <span
                        className="text-xs font-semibold"
                        style={{
                          color:
                            player.role === "admin"
                              ? "var(--color-brand)"
                              : "var(--color-muted)",
                        }}
                      >
                        {player.role}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setAway.mutate({ userId: player.id, status: "away" })}
                          disabled={setAway.isPending}
                          className="btn-ghost text-xs py-1 px-2"
                          title="Mark Away (preserves streak)"
                        >
                          <UserCheck size={13} /> Away
                        </button>
                        <button
                          onClick={() => setAway.mutate({ userId: player.id, status: "active" as "active" | "away" | "missing" })}
                          disabled={setAway.isPending}
                          className="btn-ghost text-xs py-1 px-2"
                          title="Set Active"
                        >
                          Active
                        </button>
                        {selectedGameId && (
                          <button
                            onClick={() => {
                              if (confirm(`Reset ${player.name ?? player.email}'s pick for this game? They will be able to replay.`)) {
                                resetPick.mutate({ userId: player.id, gameId: selectedGameId });
                              }
                            }}
                            disabled={resetPick.isPending}
                            className="btn-ghost text-xs py-1 px-2"
                            title="Reset pick so player can replay"
                            style={{ color: "var(--color-error)" }}
                          >
                            <RotateCcw size={13} /> Reset Pick
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
