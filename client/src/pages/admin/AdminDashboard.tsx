import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import AdminLayout from "@/components/AdminLayout";
import { Link } from "wouter";
import { toast } from "sonner";
import {
  Plus,
  CheckCircle2,
  Loader2,
  AlertCircle,
  ArrowRight,
  RotateCcw,
  ExternalLink,
  Bell,
} from "lucide-react";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "var(--color-subtle)" },
  active: { label: "Active", color: "var(--color-brand)" },
  locked: { label: "Locked", color: "oklch(0.75 0.18 35)" },
  result_published: { label: "Published", color: "var(--color-success)" },
  cancelled: { label: "Cancelled", color: "var(--color-error)" },
};

export default function AdminDashboard() {
  const { user } = useAuth();
  const { data: games, isLoading } = trpc.admin.listAllGames.useQuery({ limit: 20, offset: 0 });
  const { data: clickStats } = trpc.admin.outboundClickStats.useQuery();

  const resetMyPick = trpc.admin.resetPlayerPick.useMutation({
    onSuccess: () => toast.success("Your pick has been reset — you can replay the game."),
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const sendTestPush = trpc.admin.sendTestPush.useMutation({
    onSuccess: (r: { sent: number; expired: number; errors: number }) => {
      if (r.sent > 0) {
        toast.success(`Test push sent to ${r.sent} device${r.sent === 1 ? "" : "s"}. Check your notifications.`);
      } else if (r.expired > 0) {
        toast.error("Your subscription is stale. Turn notifications off and on again on this device, then retry.");
      } else {
        toast.error("No devices subscribed. Enable notifications on your profile first, then retry.");
      }
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  // Find the current active game to reset pick for
  const activeGame = games?.find((g: NonNullable<typeof games>[number]) => g.status === "active" || g.status === "locked");

  return (
    <AdminLayout>
      <div className="max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-2xl mb-1" style={{ color: "var(--color-foreground)" }}>
              Admin Dashboard
            </h1>
            <p className="text-sm" style={{ color: "var(--color-muted)" }}>
              Manage daily games, results, and players.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link href="/admin/end-of-day" className="btn-brand" style={{ background: "var(--color-success)", borderColor: "var(--color-success)" }}>
              <CheckCircle2 size={16} /> End of Day
            </Link>
            <Link href="/admin/games/new" className="btn-brand">
              <Plus size={16} /> New Game
            </Link>
          </div>
        </div>

        {/* Article referral traffic */}
        {clickStats && clickStats.total > 0 && (
          <div className="card-glass p-4 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <ExternalLink size={15} style={{ color: "var(--color-brand)" }} />
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-subtle)" }}>
                Article referral traffic
              </span>
            </div>
            <div className="flex items-baseline gap-2 mb-3">
              <span className="font-display text-2xl tabular-nums" style={{ color: "var(--color-foreground)" }}>
                {clickStats.total.toLocaleString()}
              </span>
              <span className="text-sm" style={{ color: "var(--color-muted)" }}>
                clicks sent to publishers
              </span>
            </div>
            {clickStats.byPublisher.length > 0 && (
              <div className="flex flex-col gap-1.5">
                {clickStats.byPublisher.slice(0, 6).map((p) => (
                  <div key={p.publisher} className="flex items-center justify-between text-sm">
                    <span style={{ color: "var(--color-muted)" }}>{p.publisher}</span>
                    <span className="tabular-nums font-medium" style={{ color: "var(--color-foreground)" }}>
                      {p.clicks.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Notifications test */}
        <div className="card-glass p-4 mb-6 flex items-center gap-3 flex-wrap" style={{ borderColor: "var(--color-subtle)" }}>
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-subtle)" }}>Notifications</span>
          <button
            onClick={() => sendTestPush.mutate()}
            disabled={sendTestPush.isPending}
            className="btn-ghost text-xs py-1 px-3 flex items-center gap-1"
            style={{ color: "var(--color-brand)" }}
          >
            <Bell size={13} />
            Send Test Push To Me
          </button>
          <span className="text-xs" style={{ color: "var(--color-subtle)" }}>Sends a push to your subscribed devices. Enable notifications on your <Link href="/profile" style={{ color: "var(--color-brand)" }}>profile</Link> first.</span>
        </div>

        {/* Testing Tools */}
        {activeGame && user && (
          <div className="card-glass p-4 mb-6 flex items-center gap-3 flex-wrap" style={{ borderColor: "var(--color-subtle)" }}>
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-subtle)" }}>Testing</span>
            <button
              onClick={() => {
                if (user?.id && activeGame?.id) {
                  resetMyPick.mutate({ userId: user.id as unknown as number, gameId: activeGame.id });
                }
              }}
              disabled={resetMyPick.isPending}
              className="btn-ghost text-xs py-1 px-3 flex items-center gap-1"
              style={{ color: "var(--color-error)" }}
            >
              <RotateCcw size={13} />
              Reset My Pick ({activeGame.companyATicker} vs {activeGame.companyBTicker})
            </button>
            <span className="text-xs" style={{ color: "var(--color-subtle)" }}>Clears your pick so you can replay. For full player management, go to <Link href="/admin/players" style={{ color: "var(--color-brand)" }}>Players</Link>.</span>
          </div>
        )}

        {/* Games list */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={28} className="animate-spin" style={{ color: "var(--color-brand)" }} />
          </div>
        ) : !games || games.length === 0 ? (
          <div className="card-glass p-12 text-center">
            <AlertCircle size={40} className="mx-auto mb-4" style={{ color: "var(--color-subtle)" }} />
            <p className="font-medium mb-2" style={{ color: "var(--color-foreground)" }}>
              No games yet
            </p>
            <p className="text-sm mb-4" style={{ color: "var(--color-muted)" }}>
              Create the first daily game to get started.
            </p>
            <Link href="/admin/games/new" className="btn-brand inline-flex">
              <Plus size={15} /> Create Game
            </Link>
          </div>
        ) : (
          <div className="card-glass overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                  <th className="text-left px-2 sm:px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-subtle)" }}>
                    Date
                  </th>
                  <th className="text-left px-2 sm:px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-subtle)" }}>
                    Matchup
                  </th>
                  <th className="text-left px-2 sm:px-5 py-3 text-xs font-semibold uppercase tracking-wider hidden sm:table-cell" style={{ color: "var(--color-subtle)" }}>
                    Status
                  </th>
                  <th className="text-right px-2 sm:px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-subtle)" }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {games.map((game: NonNullable<typeof games>[number], i: number) => {
                  const statusMeta = STATUS_LABELS[game.status] ?? STATUS_LABELS.draft;
                  return (
                    <tr
                      key={game.id}
                      style={{ borderBottom: i < games.length - 1 ? "1px solid var(--color-border)" : undefined }}
                    >
                      <td className="px-2 sm:px-5 py-4 text-sm tabular-nums whitespace-nowrap" style={{ color: "var(--color-muted)" }}>
                        {/* MM-DD on phones; full date from sm up */}
                        <span className="sm:hidden">{game.gameDate.slice(5)}</span>
                        <span className="hidden sm:inline">{game.gameDate}</span>
                      </td>
                      <td className="px-2 sm:px-5 py-4">
                        <div className="flex items-center gap-1 sm:gap-2">
                          <span className="ticker-chip">{game.companyATicker}</span>
                          <span className="text-xs" style={{ color: "var(--color-subtle)" }}>vs</span>
                          <span className="ticker-chip">{game.companyBTicker}</span>
                        </div>
                      </td>
                      <td className="px-2 sm:px-5 py-4 hidden sm:table-cell">
                        <span
                          className="text-xs font-semibold"
                          style={{ color: statusMeta.color }}
                        >
                          {statusMeta.label}
                        </span>
                      </td>
                      <td className="px-2 sm:px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1 sm:gap-2 whitespace-nowrap">
                          {game.status === "draft" && (
                            <Link
                              href={`/admin/games/${game.id}/edit`}
                              className="text-xs btn-ghost py-1 px-2"
                            >
                              Edit
                            </Link>
                          )}
                          {(game.status === "locked") && (
                            <Link
                              href={`/admin/games/${game.id}/result`}
                              className="text-xs btn-brand py-1 px-2"
                            >
                              Publish<span className="hidden sm:inline"> Result</span>
                            </Link>
                          )}
                          {game.status === "result_published" && (
                            <Link
                              href={`/research/${game.id}`}
                              className="text-xs btn-ghost py-1 px-2"
                            >
                              <span className="hidden sm:inline">View </span>Archive
                            </Link>
                          )}
                          <Link
                            href={`/admin/games/${game.id}/edit`}
                            className="text-xs"
                            style={{ color: "var(--color-subtle)" }}
                          >
                            <ArrowRight size={14} />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
