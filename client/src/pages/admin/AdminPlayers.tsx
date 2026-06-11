import { trpc } from "@/lib/trpc";
import AdminLayout from "@/components/AdminLayout";
import { toast } from "sonner";
import { Loader2, UserCheck, UserX } from "lucide-react";

export default function AdminPlayers() {
  const { data: players, isLoading, refetch } = trpc.admin.listPlayers.useQuery();

  const setAway = trpc.admin.setPlayerAwayStatus.useMutation({
    onSuccess: () => { toast.success("Player status updated."); refetch(); },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  return (
    <AdminLayout>
      <div className="max-w-3xl">
        <h1 className="font-display text-2xl mb-2" style={{ color: "var(--color-foreground)" }}>
          Player Management
        </h1>
        <p className="text-sm mb-6" style={{ color: "var(--color-muted)" }}>
          Set Away Status to preserve a player's streak while they are absent. Missing Status breaks the streak.
        </p>

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
