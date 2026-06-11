import { trpc } from "@/lib/trpc";
import AdminLayout from "@/components/AdminLayout";
import { Loader2 } from "lucide-react";
import { useState } from "react";

export default function AdminAuditLog() {
  const [offset, setOffset] = useState(0);
  const limit = 30;

  const { data: entries, isLoading } = trpc.admin.getAuditLog.useQuery({ limit, offset });

  return (
    <AdminLayout>
      <div className="max-w-4xl">
        <h1 className="font-display text-2xl mb-2" style={{ color: "var(--color-foreground)" }}>
          Audit Log
        </h1>
        <p className="text-sm mb-6" style={{ color: "var(--color-muted)" }}>
          A chronological record of all admin actions.
        </p>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={28} className="animate-spin" style={{ color: "var(--color-brand)" }} />
          </div>
        ) : !entries || entries.length === 0 ? (
          <div className="card-glass p-10 text-center" style={{ color: "var(--color-muted)" }}>
            No audit entries yet.
          </div>
        ) : (
          <div className="card-glass overflow-hidden">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                  <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-subtle)" }}>Time</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-subtle)" }}>Action</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider hidden md:table-cell" style={{ color: "var(--color-subtle)" }}>Entity</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider hidden lg:table-cell" style={{ color: "var(--color-subtle)" }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry: NonNullable<typeof entries>[number], i: number) => (
                  <tr key={entry.id} style={{ borderBottom: i < entries.length - 1 ? "1px solid var(--color-border)" : undefined }}>
                    <td className="px-5 py-3 text-xs tabular-nums whitespace-nowrap" style={{ color: "var(--color-muted)" }}>
                      {new Date(entry.createdAt).toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-xs font-mono" style={{ color: "var(--color-brand)" }}>
                      {entry.action}
                    </td>
                    <td className="px-5 py-3 text-xs hidden md:table-cell" style={{ color: "var(--color-muted)" }}>
                      {entry.targetType}{entry.targetId ? ` #${entry.targetId}` : ""}
                    </td>
                    <td className="px-5 py-3 text-xs hidden lg:table-cell max-w-xs truncate" style={{ color: "var(--color-subtle)" }}>
                      {entry.detail ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: "1px solid var(--color-border)" }}>
              <button
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0}
                className="btn-ghost text-xs py-1 px-3"
              >
                ← Previous
              </button>
              <span className="text-xs" style={{ color: "var(--color-muted)" }}>
                Showing {offset + 1}–{offset + entries.length}
              </span>
              <button
                onClick={() => setOffset(offset + limit)}
                disabled={entries.length < limit}
                className="btn-ghost text-xs py-1 px-3"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
