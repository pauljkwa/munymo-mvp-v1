import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { Menu, X, Sun, Moon, ChevronRight } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import MunymoLogo from "@/components/MunymoLogo";

const mainLinks = [
  { href: "/game", label: "Today's Game" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/research", label: "Research Hub" },
  { href: "/evolution", label: "Evolution of Munymo" },
];

const moreLinks = [
  { href: "/terms", label: "Terms of Use" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/disclaimer", label: "Disclaimer" },
  { href: "/responsible-gaming", label: "Responsible Gaming" },
];

const legalLinks = [
  { href: "/terms", label: "Terms of Use" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/disclaimer", label: "Disclaimer" },
  { href: "/responsible-gaming", label: "Responsible Gaming" },
];

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, logout } = useAuth();
  const [location] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const close = () => setMenuOpen(false);

  const allNavLinks = [
    ...mainLinks,
    ...(isAuthenticated ? [{ href: "/profile", label: "My Profile" }] : []),
    ...(user?.role === "admin" ? [{ href: "/admin", label: "Admin Console", admin: true }] : []),
  ];

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: "var(--color-background)" }}>
      {/* ── Header ── */}
      <header
        className="sticky top-0 z-50 border-b"
        style={{
          background: "var(--color-surface)",
          borderColor: "var(--color-border)",
          boxShadow: "0 1px 0 var(--color-border)",
        }}
      >
        <div className="container flex items-center justify-between h-16 gap-3">
          {/* Logo → home */}
          <Link href="/" className="flex items-center shrink-0" aria-label="Munymo home" onClick={close}>
            <MunymoLogo variant="full" height={36} />
          </Link>

          {/* Right controls: theme toggle + hamburger (always visible) */}
          <div className="flex items-center gap-2 ml-auto">
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
            <button
              className="w-9 h-9 rounded-md flex items-center justify-center transition-colors duration-150"
              style={{
                color: menuOpen ? "var(--color-brand)" : "var(--color-muted)",
                border: `1px solid ${menuOpen ? "var(--color-brand)" : "var(--color-border)"}`,
                background: menuOpen ? "var(--color-brand-muted)" : "transparent",
              }}
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle menu"
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {/* ── Dropdown menu ── */}
        {menuOpen && (
          <div
            className="border-t"
            style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
          >
            <div className="container py-3 flex flex-col gap-0.5">
              {/* Main nav links */}
              {allNavLinks.map((link) => {
                const isActive = location === link.href || location.startsWith(link.href + "/");
                const isAdmin = "admin" in link && link.admin;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center justify-between px-3 py-3 rounded-lg text-sm font-medium transition-all duration-150"
                    style={{
                      color: isAdmin
                        ? "var(--color-warning)"
                        : isActive
                        ? "var(--color-brand)"
                        : "var(--color-foreground)",
                      background: isActive ? "var(--color-brand-muted)" : "transparent",
                    }}
                    onClick={close}
                  >
                    {link.label}
                    <ChevronRight size={14} style={{ color: "var(--color-subtle)" }} />
                  </Link>
                );
              })}

              {/* Legal links */}
              <div
                className="mt-2 pt-3 flex flex-col gap-0.5"
                style={{ borderTop: "1px solid var(--color-border)" }}
              >
                <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--color-subtle)" }}>Legal</p>
                {moreLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all duration-150"
                    style={{
                      color: location === link.href ? "var(--color-brand)" : "var(--color-muted)",
                      background: location === link.href ? "var(--color-brand-muted)" : "transparent",
                    }}
                    onClick={close}
                  >
                    {link.label}
                    <ChevronRight size={14} style={{ color: "var(--color-subtle)" }} />
                  </Link>
                ))}
              </div>

              {/* Auth section */}
              <div
                className="mt-2 pt-3 flex flex-col gap-1"
                style={{ borderTop: "1px solid var(--color-border)" }}
              >
                {isAuthenticated ? (
                  <button
                    onClick={() => { logout(); close(); }}
                    className="flex items-center justify-between px-3 py-3 rounded-lg text-sm w-full text-left transition-colors"
                    style={{ color: "var(--color-muted)" }}
                  >
                    Sign out
                    <span className="text-xs" style={{ color: "var(--color-subtle)" }}>
                      {user?.name}
                    </span>
                  </button>
                ) : (
                  <a
                    href={getLoginUrl()}
                    className="btn-brand w-full justify-center text-sm"
                    onClick={close}
                  >
                    Sign in
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* ── Content ── */}
      <main className="flex-1">{children}</main>

      {/* ── Footer ── */}
      <footer
        className="border-t pt-12 pb-8 mt-20"
        style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
      >
        <div className="container">
          {/* Top row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-10">
            {/* Brand */}
            <div>
              <Link href="/" className="inline-block mb-3">
                <MunymoLogo variant="full" height={28} />
              </Link>
              <p className="text-xs leading-relaxed" style={{ color: "var(--color-subtle)" }}>
                Daily stock prediction game.<br />For educational purposes only.
              </p>
            </div>

            {/* Navigate */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--color-muted)" }}>
                Navigate
              </p>
              <div className="flex flex-col gap-2">
                {mainLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="text-xs font-medium transition-colors hover:underline"
                    style={{ color: "var(--color-subtle)" }}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>

            {/* Legal */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--color-muted)" }}>
                Legal
              </p>
              <div className="flex flex-col gap-2">
                {legalLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="text-xs font-medium transition-colors hover:underline"
                    style={{ color: "var(--color-subtle)" }}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div
            className="pt-6 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2"
            style={{ borderTop: "1px solid var(--color-border)", color: "var(--color-subtle)" }}
          >
            <span>© {new Date().getFullYear()} Munymo. All rights reserved.</span>
            <span>Not financial advice. Play responsibly.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
