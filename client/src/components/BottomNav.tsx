import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { Target, BookOpen, GraduationCap, Trophy, CircleUserRound } from "lucide-react";

/**
 * App-style bottom tab bar — mobile only, signed-in players only.
 *
 * Signed-out visitors keep the clean marketing site (header + hamburger);
 * players get native-app navigation to the five most-used destinations.
 * Originally built in the Manus era but its code never landed in this repo —
 * only the countdown bar's 56px offset in DailyGame.tsx survived. Rebuilt
 * 2026-07-24. Layout contract other elements rely on:
 *
 * - Height is 56px (h-14) + env(safe-area-inset-bottom) for iPhone home
 *   indicators. DailyGame's lockout countdown bar offsets itself by the same
 *   calc() on mobile so it docks directly on top of this bar.
 * - z-30: below the header dropdown's backdrop (z-40) so an open menu dims it,
 *   and far below ChartSheet (z-[200]).
 * - The fragment includes an in-flow spacer of the same height so the footer's
 *   last rows are never hidden behind the fixed bar.
 */
const TABS = [
  { href: "/game", label: "Today", icon: Target, match: ["/game"] },
  { href: "/research", label: "Research", icon: BookOpen, match: ["/research"] },
  { href: "/learn", label: "Learn", icon: GraduationCap, match: ["/learn"] },
  { href: "/leaderboard", label: "Ranks", icon: Trophy, match: ["/leaderboard"] },
  { href: "/dashboard", label: "Me", icon: CircleUserRound, match: ["/dashboard", "/profile"] },
];

const BAR_HEIGHT = "calc(56px + env(safe-area-inset-bottom))";

export default function BottomNav() {
  const [location] = useLocation();
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) return null;

  return (
    <>
      {/* In-flow spacer so the footer isn't hidden behind the fixed bar */}
      <div className="md:hidden shrink-0" style={{ height: BAR_HEIGHT }} aria-hidden="true" />

      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-30"
        style={{
          background: "var(--color-surface)",
          borderTop: "1px solid var(--color-border)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
        aria-label="Primary"
      >
        <div className="flex h-14">
          {TABS.map((tab) => {
            const active = tab.match.some(
              (m) => location === m || location.startsWith(`${m}/`)
            );
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors duration-150"
                style={{ color: active ? "var(--color-brand)" : "var(--color-subtle)" }}
              >
                <Icon size={20} strokeWidth={active ? 2.4 : 2} />
                {/* Fixed px, not rem — like the logo, tab labels are chrome, not
                    reading text; they must not grow with the text-size setting
                    and wrap on narrow phones. */}
                <span
                  className="text-[10px] leading-none"
                  style={{ fontWeight: active ? 700 : 500 }}
                >
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
