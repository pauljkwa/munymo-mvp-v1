import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import PublicLayout from "@/components/PublicLayout";
import { usePageMeta } from "@/hooks/usePageMeta";
import { formatAverageScore } from "@shared/leaderboard";
import { Dumbbell, Loader2, ArrowRight, Info, Trophy } from "lucide-react";

/**
 * Practice hub — the archive as a training ground.
 *
 * Exists because a new player cannot experience Munymo on the day they arrive:
 * the live loop takes a full day to close, so they make a gut pick and are then
 * asked to leave and come back. The first real signup did exactly that and
 * never returned. Archived games let someone play the complete loop — gut,
 * research, final, question, result — in five minutes.
 */
export default function Practice() {
  usePageMeta({ title: "Practice — Play the Archive | Munymo" });
  // likelyAuthenticated, not loading: gating on `loading` leaves the page on a
  // spinner forever whenever Clerk never resolves, with no way out. This
  // settles immediately from the cached hint and self-corrects once Clerk
  // loads — same reasoning as the PWA cold-launch fix.
  const { isAuthenticated, likelyAuthenticated } = useAuth();

  const { data, isLoading } = trpc.practice.available.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: stats } = trpc.practice.stats.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  if (!likelyAuthenticated) {
    return (
      <PublicLayout>
        <div className="container py-16 max-w-lg mx-auto text-center">
          <Dumbbell size={40} className="mx-auto mb-4" style={{ color: "var(--color-brand)" }} />
          <h1 className="font-display text-2xl mb-3" style={{ color: "var(--color-foreground)" }}>
            Practice with past matchups
          </h1>
          <p className="text-sm mb-6" style={{ color: "var(--color-muted)" }}>
            Sign in to play completed games from the archive — the full loop, start to
            finish, without waiting for the market to close.
          </p>
          <Link href="/game" className="btn-gold text-sm px-6 py-3">
            Get started <ArrowRight size={16} />
          </Link>
        </div>
      </PublicLayout>
    );
  }

  const games = data?.games ?? [];

  return (
    <PublicLayout>
      <div className="container py-10 max-w-3xl mx-auto">
        <div className="mb-6 animate-fade-up">
          <div className="flex items-center gap-3 mb-2">
            <Dumbbell size={26} style={{ color: "var(--color-brand)" }} />
            <h1 className="font-display text-3xl" style={{ color: "var(--color-foreground)" }}>
              Practice
            </h1>
          </div>
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            Play completed matchups from the archive. Same game, same scoring — you just
            don't have to wait for the market to close.
          </p>
        </div>

        {/* The honest caveat. Practice deliberately doesn't count, and players
            deserve to know why rather than assuming it's an arbitrary rule. */}
        <div
          className="card-glass p-4 mb-6 flex items-start gap-3"
          style={{ borderColor: "var(--color-brand-muted)" }}
        >
          <Info size={18} className="flex-shrink-0 mt-0.5" style={{ color: "var(--color-brand)" }} />
          <div className="text-xs leading-relaxed" style={{ color: "var(--color-muted)" }}>
            <p className="mb-1.5">
              <strong style={{ color: "var(--color-foreground)" }}>
                Practice scores don't affect the leaderboard, your streak, or qualification.
              </strong>{" "}
              These games already happened, so the result can be looked up — ranking them
              alongside real predictions would compare guessing the future with checking the
              past.
            </p>
            <p>
              We hide the date and the result while you play, but the research still
              mentions news from that week. If you go looking you'll find the answer — and
              you'll only be fooling yourself.
            </p>
          </div>
        </div>

        {/* Practice record */}
        {stats && stats.gamesPlayed > 0 && (
          <div className="card-glass p-4 mb-6 flex items-center gap-4 animate-fade-up delay-75">
            <Trophy size={18} style={{ color: "var(--color-brand)" }} />
            <div className="flex-1">
              <p className="text-sm font-medium" style={{ color: "var(--color-foreground)" }}>
                {stats.gamesPlayed} practice {stats.gamesPlayed === 1 ? "game" : "games"} ·
                average {formatAverageScore(stats.averageScore)}
              </p>
              {stats.projectedRank !== null && stats.liveBoardSize > 0 && (
                <p className="text-xs mt-0.5" style={{ color: "var(--color-subtle)" }}>
                  That would place you {stats.projectedRank}
                  {ordinalSuffix(stats.projectedRank)} on the live board — but practice runs
                  high, because the result already exists and you can read at your own pace.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Available games */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={28} className="animate-spin" style={{ color: "var(--color-brand)" }} />
          </div>
        ) : games.length === 0 ? (
          <div className="card-glass p-10 text-center">
            <p className="font-medium mb-2" style={{ color: "var(--color-foreground)" }}>
              {data && data.practised > 0
                ? "You've practised every archived game"
                : "No archived games available yet"}
            </p>
            <p className="text-sm mb-5" style={{ color: "var(--color-muted)" }}>
              {data && data.practised > 0
                ? "A new one is added every trading day — come back tomorrow, or play today's live game."
                : "Games appear here once they've been played and scored."}
            </p>
            <Link href="/game" className="btn-gold text-sm px-6 py-3">
              Play today's game <ArrowRight size={16} />
            </Link>
          </div>
        ) : (
          <>
            <p className="text-xs mb-3" style={{ color: "var(--color-subtle)" }}>
              {games.length} available · {data?.practised ?? 0} of {data?.totalArchive ?? 0}{" "}
              practised
            </p>
            <div className="card-glass overflow-hidden animate-fade-up delay-100">
              {games.map((g, i) => (
                <Link
                  key={g.id}
                  href={`/practice/${g.id}`}
                  className="flex items-center gap-4 p-4 sm:px-5 transition-colors hover:opacity-90"
                  style={{
                    borderBottom:
                      i < games.length - 1 ? "1px solid var(--color-border)" : undefined,
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded"
                        style={{
                          background: "var(--color-surface-raised)",
                          color: "var(--color-foreground)",
                        }}
                      >
                        {g.companyATicker}
                      </span>
                      <span className="text-xs" style={{ color: "var(--color-subtle)" }}>
                        vs
                      </span>
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded"
                        style={{
                          background: "var(--color-surface-raised)",
                          color: "var(--color-foreground)",
                        }}
                      >
                        {g.companyBTicker}
                      </span>
                    </div>
                    <p className="text-sm truncate" style={{ color: "var(--color-muted)" }}>
                      {g.companyAName} vs {g.companyBName}
                    </p>
                    {/* Sector is safe to show; the DATE is not — it would make
                        the outcome searchable. The server withholds it. */}
                    {g.sector && (
                      <p className="text-xs mt-0.5" style={{ color: "var(--color-subtle)" }}>
                        {g.sector}
                      </p>
                    )}
                  </div>
                  <ArrowRight size={16} style={{ color: "var(--color-brand)" }} />
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </PublicLayout>
  );
}

function ordinalSuffix(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 13) return "th";
  if (n % 10 === 1) return "st";
  if (n % 10 === 2) return "nd";
  if (n % 10 === 3) return "rd";
  return "th";
}
