import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import PublicLayout from "@/components/PublicLayout";
import { TrendingUp, Brain, BookOpen, Trophy, ArrowRight, Flame, Lock } from "lucide-react";

export default function Home() {
  const { isAuthenticated } = useAuth();
  const { data: todayGame } = trpc.games.getToday.useQuery();

  return (
    <PublicLayout>
      {/* ── Hero ── */}
      <section className="relative overflow-hidden pt-24 pb-20 md:pt-32 md:pb-28">
        {/* Background glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 80% 50% at 50% -10%, oklch(0.78 0.14 75 / 0.12) 0%, transparent 70%)",
          }}
        />
        <div className="container relative text-center">
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest mb-8 animate-fade-in"
            style={{
              background: "var(--color-brand-muted)",
              color: "var(--color-brand)",
              border: "1px solid oklch(0.78 0.14 75 / 0.3)",
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
            Daily Stock Prediction Game
          </div>

          <h1
            className="font-display mb-6 animate-fade-up"
            style={{ color: "var(--color-foreground)" }}
          >
            Trust Your Gut.
            <br />
            <span className="text-gradient-brand">Back It With Research.</span>
          </h1>

          <p
            className="text-lg md:text-xl max-w-2xl mx-auto mb-10 animate-fade-up delay-75"
            style={{ color: "var(--color-muted)" }}
          >
            Each day, two companies go head to head. Make your instinctive pick first, then
            study the research and confirm your final prediction. Score points, build streaks,
            and learn from every outcome.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-up delay-150">
            {isAuthenticated ? (
              <Link href="/game" className="btn-brand text-base px-8 py-3">
                Play Today's Game
                <ArrowRight size={18} />
              </Link>
            ) : (
              <a href={getLoginUrl()} className="btn-brand text-base px-8 py-3">
                Start Playing Free
                <ArrowRight size={18} />
              </a>
            )}
            <Link href="/leaderboard" className="btn-ghost text-base px-8 py-3">
              View Leaderboard
            </Link>
          </div>

          {/* Live game teaser */}
          {todayGame && (
            <div
              className="mt-16 max-w-lg mx-auto card-glass p-6 animate-fade-up delay-225"
            >
              <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--color-brand)" }}>
                Today's Matchup
              </p>
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 text-center">
                  <div className="ticker-chip mb-2">{todayGame.companyATicker}</div>
                  <p className="text-sm font-medium" style={{ color: "var(--color-foreground)" }}>
                    {todayGame.companyAName}
                  </p>
                </div>
                <div
                  className="text-2xl font-display font-bold"
                  style={{ color: "var(--color-brand)" }}
                >
                  vs
                </div>
                <div className="flex-1 text-center">
                  <div className="ticker-chip mb-2">{todayGame.companyBTicker}</div>
                  <p className="text-sm font-medium" style={{ color: "var(--color-foreground)" }}>
                    {todayGame.companyBName}
                  </p>
                </div>
              </div>
              {todayGame.sector && (
                <p className="text-xs text-center mt-4" style={{ color: "var(--color-subtle)" }}>
                  Sector: {todayGame.sector}
                </p>
              )}
              <Link href="/game" className="btn-brand w-full justify-center mt-5 text-sm">
                Make Your Pick
                <ArrowRight size={15} />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="py-20 border-t" style={{ borderColor: "var(--color-border)" }}>
        <div className="container">
          <div className="text-center mb-14">
            <h2 className="font-display mb-3" style={{ color: "var(--color-foreground)" }}>
              How It Works
            </h2>
            <p style={{ color: "var(--color-muted)" }}>
              A two-step prediction process that separates instinct from informed judgement.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: Brain,
                step: "01",
                title: "Gut Selection",
                body: "Before reading anything, pick the company you instinctively believe will outperform. Your raw intuition, unfiltered.",
              },
              {
                icon: BookOpen,
                step: "02",
                title: "Read the Research",
                body: "Review curated research, sector context, and the pairing rationale provided for today's matchup.",
              },
              {
                icon: TrendingUp,
                step: "03",
                title: "Final Selection",
                body: "Confirm your official prediction and answer one validation question drawn from the research. This is your scored pick.",
              },
              {
                icon: Trophy,
                step: "04",
                title: "Score & Learn",
                body: "After lockout, results are published. See your Daily Score, community statistics, and educational commentary.",
              },
            ].map((item, i) => (
              <div
                key={item.step}
                className={`card-glass p-6 animate-fade-up`}
                style={{ animationDelay: `${i * 75}ms` }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ background: "var(--color-brand-muted)" }}
                  >
                    <item.icon size={18} style={{ color: "var(--color-brand)" }} />
                  </div>
                  <span
                    className="font-mono text-xs font-bold"
                    style={{ color: "var(--color-subtle)" }}
                  >
                    {item.step}
                  </span>
                </div>
                <h4 className="mb-2" style={{ color: "var(--color-foreground)" }}>
                  {item.title}
                </h4>
                <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Scoring ── */}
      <section className="py-20 border-t" style={{ borderColor: "var(--color-border)" }}>
        <div className="container">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="font-display mb-4" style={{ color: "var(--color-foreground)" }}>
                Scoring That Rewards
                <br />
                <span className="text-gradient-brand">Both Picks and Knowledge</span>
              </h2>
              <p className="mb-6" style={{ color: "var(--color-muted)" }}>
                Your Daily Score is calculated entirely on the server after results are published.
                It reflects both your prediction accuracy and your engagement with the research.
              </p>
              <div className="flex flex-col gap-3">
                <div
                  className="flex items-center justify-between p-4 rounded-xl"
                  style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
                >
                  <div className="flex items-center gap-3">
                    <TrendingUp size={16} style={{ color: "var(--color-success)" }} />
                    <span className="text-sm font-medium" style={{ color: "var(--color-foreground)" }}>
                      Correct Final Selection
                    </span>
                  </div>
                  <span className="score-badge score-badge-perfect">+80</span>
                </div>
                <div
                  className="flex items-center justify-between p-4 rounded-xl"
                  style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
                >
                  <div className="flex items-center gap-3">
                    <BookOpen size={16} style={{ color: "var(--color-brand)" }} />
                    <span className="text-sm font-medium" style={{ color: "var(--color-foreground)" }}>
                      Correct Validation Answer
                    </span>
                  </div>
                  <span className="score-badge score-badge-partial">+20</span>
                </div>
                <div
                  className="flex items-center justify-between p-4 rounded-xl"
                  style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
                >
                  <div className="flex items-center gap-3">
                    <Trophy size={16} style={{ color: "var(--color-warning)" }} />
                    <span className="text-sm font-medium" style={{ color: "var(--color-foreground)" }}>
                      Perfect Day
                    </span>
                  </div>
                  <span className="score-badge score-badge-perfect">100</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div
                className="card-glass p-6"
              >
                <div className="flex items-center gap-3 mb-3">
                  <Flame size={18} style={{ color: "var(--color-warning)" }} />
                  <h4 style={{ color: "var(--color-foreground)" }}>Participation Streaks</h4>
                </div>
                <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                  Play every day to build your streak. Away Status preserves your streak when
                  you need a break. Market-closed and cancelled days never penalise you.
                </p>
              </div>
              <div
                className="card-glass p-6"
              >
                <div className="flex items-center gap-3 mb-3">
                  <Trophy size={18} style={{ color: "var(--color-brand)" }} />
                  <h4 style={{ color: "var(--color-foreground)" }}>Leaderboard Qualification</h4>
                </div>
                <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                  Ranked by Average Daily Score. You qualify for the leaderboard after
                  completing 20 games — ensuring rankings reflect sustained performance.
                </p>
              </div>
              <div
                className="card-glass p-6"
              >
                <div className="flex items-center gap-3 mb-3">
                  <Lock size={18} style={{ color: "var(--color-info)" }} />
                  <h4 style={{ color: "var(--color-foreground)" }}>Server-Side Integrity</h4>
                </div>
                <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                  All scores are calculated server-side after results are published. Lockout
                  is enforced on the server, not the browser. No manipulation is possible.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      {!isAuthenticated && (
        <section className="py-20 border-t" style={{ borderColor: "var(--color-border)" }}>
          <div className="container text-center">
            <div
              className="max-w-2xl mx-auto card-glass p-12"
              style={{
                background:
                  "radial-gradient(ellipse 80% 60% at 50% 0%, oklch(0.78 0.14 75 / 0.08) 0%, var(--color-surface) 70%)",
              }}
            >
              <h2 className="font-display mb-4" style={{ color: "var(--color-foreground)" }}>
                Ready to Test Your Market Instincts?
              </h2>
              <p className="mb-8" style={{ color: "var(--color-muted)" }}>
                Join Munymo and start building your prediction record today.
              </p>
              <a href={getLoginUrl()} className="btn-brand text-base px-10 py-3">
                Get Started Free
                <ArrowRight size={18} />
              </a>
            </div>
          </div>
        </section>
      )}
    </PublicLayout>
  );
}
