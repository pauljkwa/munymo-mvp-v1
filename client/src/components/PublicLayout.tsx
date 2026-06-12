import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { Menu, X, TrendingUp, Sun, Moon } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

const navLinks = [
  { href: "/game", label: "Today's Game" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/research", label: "Research Hub" },
];

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, logout } = useAuth();
  const [location] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: "var(--color-background)" }}>
      {/* ── Nav ── */}
      <header
        className="sticky top-0 z-50 border-b"
        style={{
          background: "var(--color-surface)",
          borderColor: "var(--color-border)",
          boxShadow: "0 1px 0 var(--color-border)",
        }}
      >
        <div className="container flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div
              className="w-8 h-8 rounded-md flex items-center justify-center"
              style={{ background: "var(--color-brand)" }}
            >
              <TrendingUp size={15} style={{ color: "var(--color-brand-foreground)" }} />
            </div>
            <span
              className="font-display font-semibold text-lg tracking-tight"
              style={{ color: "var(--color-foreground)" }}
            >
              Munymo
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-0.5">
            {navLinks.map((link) => {
              const isActive = location === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="px-4 py-2 rounded-md text-sm font-medium transition-all duration-150"
                  style={{
                    color: isActive ? "var(--color-brand)" : "var(--color-muted)",
                    background: isActive ? "var(--color-brand-muted)" : "transparent",
                    fontWeight: isActive ? 600 : 500,
                  }}
                >
                  {link.label}
                </Link>
              );
            })}
            {user?.role === "admin" && (
              <Link
                href="/admin"
                className="px-4 py-2 rounded-md text-sm font-medium transition-all duration-150"
                style={{ color: "var(--color-warning)" }}
              >
                Admin
              </Link>
            )}
          </nav>

          {/* Right side: auth + theme toggle */}
          <div className="hidden md:flex items-center gap-2">
            {/* Dark mode toggle */}
            {toggleTheme && (
              <button
                onClick={toggleTheme}
                className="w-9 h-9 rounded-md flex items-center justify-center transition-colors duration-150"
                style={{
                  color: "var(--color-muted)",
                  border: "1px solid var(--color-border)",
                  background: "transparent",
                }}
                aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              >
                {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
              </button>
            )}

            {isAuthenticated ? (
              <>
                <Link
                  href="/profile"
                  className="text-sm font-medium px-3 py-2 rounded-md transition-colors"
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
              <a href={getLoginUrl()} className="btn-brand text-sm" style={{ padding: "0.5rem 1.25rem" }}>
                Sign in
              </a>
            )}
          </div>

          {/* Mobile: theme toggle + hamburger */}
          <div className="md:hidden flex items-center gap-2">
            {toggleTheme && (
              <button
                onClick={toggleTheme}
                className="w-9 h-9 rounded-md flex items-center justify-center"
                style={{ color: "var(--color-muted)", border: "1px solid var(--color-border)" }}
                aria-label="Toggle theme"
              >
                {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
              </button>
            )}
            <button
              className="w-9 h-9 rounded-md flex items-center justify-center"
              style={{ color: "var(--color-muted)", border: "1px solid var(--color-border)" }}
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle menu"
            >
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div
            className="md:hidden border-t px-4 py-3 flex flex-col gap-1"
            style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
          >
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-3 py-2.5 rounded-md text-sm font-medium"
                style={{
                  color: location === link.href ? "var(--color-brand)" : "var(--color-muted)",
                  background: location === link.href ? "var(--color-brand-muted)" : "transparent",
                }}
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            {user?.role === "admin" && (
              <Link
                href="/admin"
                className="px-3 py-2.5 rounded-md text-sm font-medium"
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
                  className="w-full text-left px-3 py-2.5 text-sm rounded-md"
                  style={{ color: "var(--color-muted)" }}
                >
                  Sign out ({user?.name})
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
        className="border-t py-10 mt-20"
        style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
      >
        <div className="container">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-6 h-6 rounded flex items-center justify-center"
                  style={{ background: "var(--color-brand)" }}
                >
                  <TrendingUp size={12} style={{ color: "var(--color-brand-foreground)" }} />
                </div>
                <span className="font-display font-semibold text-sm" style={{ color: "var(--color-foreground)" }}>
                  Munymo
                </span>
              </div>
              <p className="text-xs" style={{ color: "var(--color-subtle)" }}>
                Daily stock prediction game. For educational purposes only.
              </p>
            </div>
            <div className="flex items-center gap-6">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-xs font-medium transition-colors"
                  style={{ color: "var(--color-subtle)" }}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
          <div
            className="mt-8 pt-6 text-xs"
            style={{ borderTop: "1px solid var(--color-border)", color: "var(--color-subtle)" }}
          >
            © {new Date().getFullYear()} Munymo. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
