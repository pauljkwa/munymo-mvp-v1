import { useAuth } from "@/_core/hooks/useAuth";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  PlusCircle,
  Users,
  ScrollText,
  ChevronRight,
  LogOut,
  Sunset,
} from "lucide-react";
import MunymoLogo from "@/components/MunymoLogo";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/end-of-day", label: "End of Day", icon: Sunset },
  { href: "/admin/games/new", label: "New Game", icon: PlusCircle },
  { href: "/admin/players", label: "Players", icon: Users },
  { href: "/admin/audit", label: "Audit Log", icon: ScrollText },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  const isActive = (href: string, exact?: boolean) =>
    exact ? location === href : location.startsWith(href);

  return (
    <div className="min-h-dvh flex" style={{ background: "var(--color-background)" }}>
      {/* ── Sidebar ── */}
      <aside
        className="hidden md:flex flex-col w-60 shrink-0 border-r"
        style={{
          background: "var(--color-surface)",
          borderColor: "var(--color-border)",
          boxShadow: "1px 0 0 var(--color-border)",
        }}
      >
        {/* Logo */}
        <div className="h-16 flex items-center gap-2 px-5 border-b" style={{ borderColor: "var(--color-border)" }}>
          <MunymoLogo variant="full" height={30} />
          <div
            className="ml-1 text-xs font-semibold px-2 py-0.5 rounded"
            style={{ background: "var(--color-warning-muted)", color: "var(--color-warning)" }}
          >
            Admin
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {navItems.map((item) => {
            const active = isActive(item.href, item.exact);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150"
                style={{
                  color: active ? "var(--color-brand)" : "var(--color-muted)",
                  background: active ? "var(--color-brand-muted)" : "transparent",
                }}
              >
                <item.icon size={16} />
                {item.label}
                {active && <ChevronRight size={14} className="ml-auto" />}
              </Link>
            );
          })}
        </nav>

        {/* Back to site + user */}
        <div className="px-3 py-4 border-t flex flex-col gap-2" style={{ borderColor: "var(--color-border)" }}>
          <Link
            href="/"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors"
            style={{ color: "var(--color-subtle)" }}
          >
            ← Back to site
          </Link>
          <button
            onClick={() => logout()}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors w-full text-left"
            style={{ color: "var(--color-subtle)" }}
          >
            <LogOut size={14} />
            Sign out
          </button>
          {user && (
            <div className="px-3 pt-2" style={{ borderTop: "1px solid var(--color-border)" }}>
              <p className="text-xs font-medium truncate" style={{ color: "var(--color-foreground)" }}>
                {user.name}
              </p>
              <p className="text-xs" style={{ color: "var(--color-subtle)" }}>Administrator</p>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header
          className="md:hidden h-14 flex items-center gap-3 px-4 border-b"
          style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
        >
          <MunymoLogo variant="full" height={26} />
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded"
            style={{ background: "var(--color-warning-muted)", color: "var(--color-warning)" }}
          >
            Admin
          </span>
        </header>
        <main className="flex-1 p-6 overflow-auto">{children}</main>
        {/* Footer */}
        <footer
          className="px-6 py-4 border-t text-xs"
          style={{
            borderColor: "var(--color-border)",
            background: "var(--color-surface)",
            color: "var(--color-subtle)",
          }}
        >
          © {new Date().getFullYear()} Munymo &mdash; Admin Console
        </footer>
      </div>
    </div>
  );
}
