import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import AdminLayout from "@/components/AdminLayout";
import { Link } from "wouter";
import {
  Plus,
  Trophy,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  ArrowRight,
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
          <Link href="/admin/games/new" className="btn-brand">
            <Plus size={16} /> New Game
          </Link>
        </div>

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
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                  <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-subtle)" }}>
                    Date
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-subtle)" }}>
                    Matchup
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider hidden sm:table-cell" style={{ color: "var(--color-subtle)" }}>
                    Status
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-subtle)" }}>
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
                      <td className="px-5 py-4 text-sm tabular-nums" style={{ color: "var(--color-muted)" }}>
                        {game.gameDate}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span className="ticker-chip">{game.companyATicker}</span>
                          <span className="text-xs" style={{ color: "var(--color-subtle)" }}>vs</span>
                          <span className="ticker-chip">{game.companyBTicker}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 hidden sm:table-cell">
                        <span
                          className="text-xs font-semibold"
                          style={{ color: statusMeta.color }}
                        >
                          {statusMeta.label}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
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
                              Publish Result
                            </Link>
                          )}
                          {game.status === "result_published" && (
                            <Link
                              href={`/research/${game.id}`}
                              className="text-xs btn-ghost py-1 px-2"
                            >
                              View Archive
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
        )}
      </div>
    </AdminLayout>
  );
}
