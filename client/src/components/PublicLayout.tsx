import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { Menu, X, TrendingUp } from "lucide-react";

const navLinks = [
  { href: "/game", label: "Today's Game" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/research", label: "Research Hub" },
];

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, logout } = useAuth();
  const [location] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: "var(--color-background)" }}>
      {/* ── Nav ── */}
      <header
        className="sticky top-0 z-50 border-b"
        style={{
          background: "oklch(0.11 0.012 260 / 0.85)",
          backdropFilter: "blur(16px)",
          borderColor: "var(--color-border)",
        }}
      >
        <div className="container flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "var(--color-brand)" }}
            >
              <TrendingUp size={16} style={{ color: "var(--color-brand-foreground)" }} />
            </div>
            <span
              className="font-display font-semibold text-lg tracking-tight"
              style={{ color: "var(--color-foreground)" }}
            >
              Munymo
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150"
                style={{
                  color: location === link.href ? "var(--color-brand)" : "var(--color-muted)",
                  background: location === link.href ? "var(--color-brand-muted)" : "transparent",
                }}
              >
                {link.label}
              </Link>
            ))}
            {user?.role === "admin" && (
              <Link
                href="/admin"
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150"
                style={{ color: "var(--color-warning)" }}
              >
                Admin
              </Link>
            )}
          </nav>

          {/* Auth */}
          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated ? (
              <>
                <Link
                  href="/profile"
                  className="text-sm font-medium transition-colors"
                  style={{ color: "var(--color-muted)" }}
                >
                  {user?.name ?? "Profile"}
                </Link>
                <button
                  onClick={() => logout()}
                  className="btn-ghost text-sm"
                  style={{ padding: "0.375rem 0.875rem" }}
                >
                  Sign out
                </button>
              </>
            ) : (
              <a href={getLoginUrl()} className="btn-brand text-sm">
                Sign in
              </a>
            )}
          </div>

          {/* Mobile menu toggle */}
          <button
            className="md:hidden p-2 rounded-lg"
            style={{ color: "var(--color-muted)" }}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div
            className="md:hidden border-t px-4 py-4 flex flex-col gap-2"
            style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
          >
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-3 py-2 rounded-lg text-sm font-medium"
                style={{ color: "var(--color-muted)" }}
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            {user?.role === "admin" && (
              <Link
                href="/admin"
                className="px-3 py-2 rounded-lg text-sm font-medium"
                style={{ color: "var(--color-warning)" }}
                onClick={() => setMenuOpen(false)}
              >
                Admin Console
              </Link>
            )}
            <div className="mt-2 pt-2" style={{ borderTop: "1px solid var(--color-border)" }}>
              {isAuthenticated ? (
                <button
                  onClick={() => { logout(); setMenuOpen(false); }}
                  className="w-full text-left px-3 py-2 text-sm"
                  style={{ color: "var(--color-muted)" }}
                >
                  Sign out
                </button>
              ) : (
                <a href={getLoginUrl()} className="btn-brand w-full justify-center text-sm">
                  Sign in
                </a>
              )}
            </div>
          </div>
        )}
      </header>

      {/* ── Content ── */}
      <main className="flex-1">{children}</main>

      {/* ── Footer ── */}
      <footer
        className="border-t py-8 mt-16"
        style={{ borderColor: "var(--color-border)" }}
      >
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <TrendingUp size={14} style={{ color: "var(--color-brand)" }} />
            <span className="text-sm font-medium" style={{ color: "var(--color-muted)" }}>
              Munymo
            </span>
          </div>
          <p className="text-xs" style={{ color: "var(--color-subtle)" }}>
            Daily stock prediction game. For educational purposes only.
          </p>
        </div>
      </footer>
    </div>
  );
}
