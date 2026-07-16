import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { Menu, X, Sun, Moon, ChevronRight } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import MunymoLogo from "@/components/MunymoLogo";
import TextSizeToggle from "@/components/TextSizeToggle";
import { SignInButton, SignOutButton } from "@clerk/clerk-react";
import { useState } from "react";
import { trpc } from "@/lib/trpc";

const mainLinks = [
  { href: "/game", label: "Today's Game" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/research", label: "Research Hub" },
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
  const [location] = useLocation();
  const { user, isAuthenticated, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);

  const close = () => setOpen(false);

  const { data: recentPublished } = trpc.games.listArchive.useQuery(
    { limit: 1, offset: 0 },
    { staleTime: 5 * 60 * 1000 }
  );
  const previousGame = recentPublished?.[0] ?? null;

  const allNavLinks = [
    ...mainLinks,
    ...(previousGame ? [{ href: `/game/${previousGame.id}/result`, label: "Yesterday's Result" }] : []),
    ...(isAuthenticated ? [{ href: "/dashboard", label: "My Dashboard" }] : []),
    ...(isAuthenticated ? [{ href: "/profile", label: "My Profile" }] : []),
    { href: "/feedback", label: "Give Feedback" },
    ...(user?.role === "admin" ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--color-bg)", color: "var(--color-text)" }}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-50 flex items-center justify-between px-4 h-14"
        style={{
          background: "var(--color-surface)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        {/* Logo — fixed px height, not rem: the wordmark is a brand mark, not
            reading text, so it must not grow with the text-size setting and
            crowd out the controls beside it on narrow phones. */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <MunymoLogo height={28} />
        </Link>

        {/* Right controls */}
        <div className="flex items-center gap-2">
          {/* Text size */}
          <TextSizeToggle />

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="w-9 h-9 flex items-center justify-center rounded-lg transition-colors"
            style={{ color: "var(--color-muted)" }}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* Hamburger */}
          <button
            onClick={() => setOpen((v) => !v)}
            className="w-9 h-9 flex items-center justify-center rounded-lg transition-colors"
            style={{ color: "var(--color-text)" }}
            aria-label="Open menu"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {/* ── Dropdown nav ───────────────────────────────────────────────── */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.3)" }}
            onClick={close}
          />

          {/* Panel */}
          <div
            className="fixed top-14 right-0 left-0 z-50 mx-4 mt-2 rounded-2xl shadow-xl overflow-hidden"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              maxHeight: "calc(100dvh - 5rem)",
              overflowY: "auto",
            }}
          >
            <div className="p-3 flex flex-col gap-0.5">
              {/* Main nav links */}
              {allNavLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center justify-between px-3 py-3 rounded-xl text-sm font-medium transition-all duration-150"
                  style={{
                    color:
                      location === link.href
                        ? "var(--color-brand)"
                        : "var(--color-text)",
                    background:
                      location === link.href
                        ? "var(--color-brand-muted)"
                        : "transparent",
                  }}
                  onClick={close}
                >
                  {link.label}
                  <ChevronRight size={14} style={{ color: "var(--color-subtle)" }} />
                </Link>
              ))}

              {/* Legal links */}
              <div
                className="mt-2 pt-3 flex flex-col gap-0.5"
                style={{ borderTop: "1px solid var(--color-border)" }}
              >
                <p
                  className="px-3 pb-1 text-xs font-semibold uppercase tracking-widest"
                  style={{ color: "var(--color-subtle)" }}
                >
                  Legal
                </p>
                {moreLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all duration-150"
                    style={{
                      color:
                        location === link.href
                          ? "var(--color-brand)"
                          : "var(--color-muted)",
                      background:
                        location === link.href
                          ? "var(--color-brand-muted)"
                          : "transparent",
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
                  <>
                    <div
                      className="px-3 py-2 rounded-lg text-sm"
                      style={{ color: "var(--color-muted)" }}
                    >
                      Signed in as{" "}
                      <span
                        className="font-semibold"
                        style={{ color: "var(--color-text)" }}
                      >
                        {user?.displayName || user?.name || "Player"}
                      </span>
                    </div>
                    <SignOutButton>
                      <button
                        className="flex items-center justify-between px-3 py-3 rounded-xl text-sm w-full text-left transition-colors"
                        style={{ color: "var(--color-danger, #dc2626)" }}
                        onClick={close}
                      >
                        Sign out
                        <ChevronRight size={14} style={{ color: "var(--color-subtle)" }} />
                      </button>
                    </SignOutButton>
                  </>
                ) : (
                  <SignInButton mode="modal">
                    <button
                      className="flex items-center justify-between px-3 py-3 rounded-xl text-sm font-semibold w-full text-left transition-colors"
                      style={{
                        background: "var(--color-brand)",
                        color: "#fff",
                        borderRadius: "0.75rem",
                      }}
                      onClick={close}
                    >
                      Sign in to Munymo
                      <ChevronRight size={14} style={{ opacity: 0.7 }} />
                    </button>
                  </SignInButton>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Main content ───────────────────────────────────────────────── */}
      <main className="flex-1">{children}</main>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer
        className="mt-auto"
        style={{
          background: "var(--color-surface)",
          borderTop: "1px solid var(--color-border)",
        }}
      >
        <div className="max-w-5xl mx-auto px-4 py-10 grid grid-cols-2 gap-8 sm:grid-cols-3">
          {/* Brand */}
          <div className="col-span-2 sm:col-span-1">
            <Link href="/">
              <MunymoLogo className="h-7 w-auto mb-3" />
            </Link>
            <p className="text-xs leading-relaxed" style={{ color: "var(--color-muted)" }}>
              A daily stock prediction game. Not financial advice. Play responsibly.
            </p>
          </div>

          {/* Navigate */}
          <div>
            <p
              className="text-xs font-semibold uppercase tracking-widest mb-3"
              style={{ color: "var(--color-subtle)" }}
            >
              Navigate
            </p>
            <ul className="flex flex-col gap-2">
              {[...mainLinks, { href: "/dashboard", label: "My Dashboard" }].map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-sm transition-colors hover:underline"
                    style={{ color: "var(--color-muted)" }}
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <p
              className="text-xs font-semibold uppercase tracking-widest mb-3"
              style={{ color: "var(--color-subtle)" }}
            >
              Legal
            </p>
            <ul className="flex flex-col gap-2">
              {legalLinks.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-sm transition-colors hover:underline"
                    style={{ color: "var(--color-muted)" }}
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          className="px-4 py-4 text-center text-xs"
          style={{
            borderTop: "1px solid var(--color-border)",
            color: "var(--color-subtle)",
          }}
        >
          © {new Date().getFullYear()} Munymo. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
