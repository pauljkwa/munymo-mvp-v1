import { trpc } from "@/lib/trpc";
import AdminLayout from "@/components/AdminLayout";
import { toast } from "sonner";
import { useState } from "react";
import { Loader2, RotateCcw, BellOff, Mail, Flame } from "lucide-react";

type Player = {
  id: number;
  name: string | null;
  displayName: string | null;
  email: string | null;
  role: string;
  awayStatus: "active" | "away" | "missing";
  currentStreak: number;
  pushDevices: number;
  pushOptIn: boolean;
  emailOptIn: boolean;
  deactivated: boolean;
};

const STATUS_STYLE: Record<Player["awayStatus"], { label: string; bg: string; fg: string }> = {
  active: { label: "Active", bg: "oklch(0.58 0.16 155 / 0.14)", fg: "oklch(0.45 0.16 155)" },
  away: { label: "Away", bg: "oklch(0.78 0.14 75 / 0.18)", fg: "oklch(0.52 0.14 75)" },
  missing: { label: "Missing", bg: "oklch(0.62 0.20 25 / 0.14)", fg: "oklch(0.52 0.20 25)" },
};

function StatusBadge({ status }: { status: Player["awayStatus"] }) {
  const s = STATUS_STYLE[status];
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold flex-shrink-0"
      style={{ background: s.bg, color: s.fg }}
    >
      {s.label}
    </span>
  );
}

export default function AdminPlayers() {
  const { data: players, isLoading, refetch } = trpc.admin.listPlayers.useQuery();
  const { data: games } = trpc.admin.listAllGames.useQuery({ limit: 50, offset: 0 });
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);

  const setAway = trpc.admin.setPlayerAwayStatus.useMutation({
    onSuccess: () => {
      toast.success("Player status updated.");
      refetch();
    },
    onError: (e: { message: string }) => toast.error(e.message),
    onSettled: () => setPendingId(null),
  });

  const resetPick = trpc.admin.resetPlayerPick.useMutation({
    onSuccess: () => toast.success("Player pick reset — they can replay this game."),
    onError: (e: { message: string }) => toast.error(e.message),
  });

  // One button that names the change it will make, behind a confirm. The old
  // UI showed two identical unlabelled-on-mobile buttons and never displayed
  // the current status, so it was impossible to tell what a tap would do —
  // or that anything had happened.
  function toggleAway(player: Player) {
    const next = player.awayStatus === "away" ? "active" : "away";
    const who = player.displayName || player.name || player.email || `player ${player.id}`;
    const message =
      next === "away"
        ? `Set ${who} to Away?\n\nTheir streak is protected while away, and they are skipped by streak-at-risk reminder emails.`
        : `Set ${who} back to Active?\n\nTheir streak resumes normal rules and reminder emails apply again.`;
    if (!confirm(message)) return;
    setPendingId(player.id);
    setAway.mutate({ userId: player.id, status: next });
  }

  return (
    <AdminLayout>
      <div className="max-w-3xl">
        <h1 className="font-display text-2xl mb-2" style={{ color: "var(--color-foreground)" }}>
          Player Management
        </h1>
        <p className="text-sm mb-4" style={{ color: "var(--color-muted)" }}>
          Away Status preserves a player's streak while they're absent and stops their reminder
          emails. Use Reset Pick to let a player replay a specific game (for testing).
        </p>

        {/* Game selector for reset */}
        <div className="card-glass p-4 mb-6 flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium" style={{ color: "var(--color-foreground)" }}>
            Reset pick for game:
          </span>
          <select
            value={selectedGameId ?? ""}
            onChange={(e) => setSelectedGameId(e.target.value ? Number(e.target.value) : null)}
            className="text-sm border rounded px-2 py-1"
            style={{
              background: "var(--color-surface)",
              color: "var(--color-foreground)",
              borderColor: "var(--color-border)",
            }}
          >
            <option value="">— select a game —</option>
            {(games ?? []).map((g: NonNullable<typeof games>[number]) => (
              <option key={g.id} value={g.id}>
                {g.gameDate} · {g.companyATicker} vs {g.companyBTicker}
              </option>
            ))}
          </select>
          {!selectedGameId && (
            <span className="text-xs" style={{ color: "var(--color-subtle)" }}>
              Select a game first, then use Reset Pick on a player.
            </span>
          )}
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
          /* A stacking list, not a table: the old <table> squeezed its action
             column off the right edge of a phone, leaving a single unlabelled
             icon as the only visible control. */
          <div className="card-glass overflow-hidden">
            {(players as Player[]).map((player, i) => (
              <div
                key={player.id}
                className="p-4 sm:px-5"
                style={{
                  borderBottom: i < players.length - 1 ? "1px solid var(--color-border)" : undefined,
                }}
              >
                {/* Identity + status */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <div
                      className="text-sm font-medium truncate"
                      style={{ color: "var(--color-foreground)" }}
                    >
                      {player.displayName || player.name || "—"}
                      {player.role === "admin" && (
                        <span
                          className="ml-2 text-xs font-semibold"
                          style={{ color: "var(--color-brand)" }}
                        >
                          admin
                        </span>
                      )}
                    </div>
                    <div className="text-xs truncate" style={{ color: "var(--color-muted)" }}>
                      {player.email ?? ""}
                    </div>
                  </div>
                  <StatusBadge status={player.awayStatus} />
                </div>

                {/* Signals worth knowing before acting */}
                <div
                  className="flex items-center gap-3 flex-wrap text-xs mb-3"
                  style={{ color: "var(--color-subtle)" }}
                >
                  <span className="inline-flex items-center gap-1">
                    <Flame size={12} /> streak {player.currentStreak}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Mail size={12} /> email {player.emailOptIn ? "on" : "off"}
                  </span>
                  {/* pushOptIn defaults to true at signup, so it says nothing
                      about reachability — only a registered device does. */}
                  <span
                    className="inline-flex items-center gap-1"
                    style={player.pushDevices === 0 ? { color: "var(--color-muted)" } : undefined}
                    title={
                      player.pushDevices === 0
                        ? "No push subscription — notifications cannot be delivered, regardless of the opt-in flag"
                        : undefined
                    }
                  >
                    {player.pushDevices === 0 ? <BellOff size={12} /> : null}
                    {player.pushDevices === 0
                      ? "no push device"
                      : `${player.pushDevices} push device${player.pushDevices > 1 ? "s" : ""}`}
                  </span>
                  {player.deactivated && (
                    <span style={{ color: "var(--color-error)" }}>deactivated</span>
                  )}
                </div>

                {/* Actions — always labelled, never icon-only */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => toggleAway(player)}
                    disabled={setAway.isPending && pendingId === player.id}
                    className="btn-ghost text-xs py-1.5 px-3"
                  >
                    {setAway.isPending && pendingId === player.id ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : null}
                    {player.awayStatus === "away" ? "Set Active" : "Set Away"}
                  </button>
                  {selectedGameId && (
                    <button
                      onClick={() => {
                        if (
                          confirm(
                            `Reset ${player.name ?? player.email}'s pick for this game? They will be able to replay.`
                          )
                        ) {
                          resetPick.mutate({ userId: player.id, gameId: selectedGameId });
                        }
                      }}
                      disabled={resetPick.isPending}
                      className="btn-ghost text-xs py-1.5 px-3"
                      style={{ color: "var(--color-error)" }}
                    >
                      <RotateCcw size={13} /> Reset Pick
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
