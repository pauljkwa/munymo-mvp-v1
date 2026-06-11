import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import PublicLayout from "@/components/PublicLayout";
import {
  TrendingUp,
  Brain,
  BookOpen,
  Trophy,
  ArrowRight,
  Flame,
  Lock,
  Smartphone,
  Users,
  Award,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";

const MUNYIQ_CARDS = [
  {
    tier: "Sapphire",
    score: 847,
    scoreDisplay: "847",
    name: "Richard Citizen",
    memberSince: "Jan 2025",
    validUntil: "Dec 2026",
    instinct: "72%",
    research: "88%",
    consistency: "A+",
    description: "The entry point to recognised financial intelligence. Sapphire holders have demonstrated consistent engagement and reliable prediction accuracy across 20+ games.",
    scoreRange: "700 – 999",
    img: "https://d2xsxph8kpxj0f.cloudfront.net/110945286/eKLqbcXcmD3p6GhwsMA3tE/munyiq-card-sapphire-gDwWXqwMYBFbyVfoaG5xWC.webp",
    accentColor: "#3b82f6",
    glowColor: "rgba(59,130,246,0.25)",
  },
  {
    tier: "Emerald",
    score: 1042,
    scoreDisplay: "1042",
    name: "Alexandra Mercer",
    memberSince: "Mar 2025",
    validUntil: "Feb 2027",
    instinct: "79%",
    research: "91%",
    consistency: "A",
    description: "Emerald status signals a player whose instincts and research habits are measurably above average. A meaningful credential in any professional financial context.",
    scoreRange: "1000 – 1139",
    img: "https://d2xsxph8kpxj0f.cloudfront.net/110945286/eKLqbcXcmD3p6GhwsMA3tE/munyiq-card-emerald-LMpLeKjvdYMPHQ5pPofo3g.webp",
    accentColor: "#10b981",
    glowColor: "rgba(16,185,129,0.25)",
  },
  {
    tier: "Ruby",
    score: 1156,
    scoreDisplay: "1156",
    name: "James Thornton",
    memberSince: "Jun 2025",
    validUntil: "May 2027",
    instinct: "84%",
    research: "95%",
    consistency: "A+",
    description: "Ruby holders operate at the level of gifted analysts. Their prediction record and research engagement place them in the top tier of active Munymo participants.",
    scoreRange: "1140 – 1399",
    img: "https://d2xsxph8kpxj0f.cloudfront.net/110945286/eKLqbcXcmD3p6GhwsMA3tE/munyiq-card-ruby-Ut9LzSN349EWZaoNb4McJy.webp",
    accentColor: "#ef4444",
    glowColor: "rgba(239,68,68,0.25)",
  },
  {
    tier: "Diamond",
    score: 1400,
    scoreDisplay: "1400+",
    name: "Victoria Ashford",
    memberSince: "Sep 2024",
    validUntil: "Aug 2026",
    instinct: "93%",
    research: "99%",
    consistency: "S",
    description: "Diamond is genius-level. Fewer than 1% of players will reach this tier. A Diamond MunyIQ card is one of the most distinctive credentials in applied financial intelligence.",
    scoreRange: "1400+",
    img: "https://d2xsxph8kpxj0f.cloudfront.net/110945286/eKLqbcXcmD3p6GhwsMA3tE/munyiq-card-diamond-Em2Lwh8JvBdYdJWtUy9oVR.webp",
    accentColor: "#e2e8f0",
    glowColor: "rgba(226,232,240,0.2)",
  },
];

export default function Home() {
  const { isAuthenticated } = useAuth();
  const { data: todayGame } = trpc.games.getToday.useQuery();
  const [activeCard, setActiveCard] = useState(0);

  const card = MUNYIQ_CARDS[activeCard];

  return (
    <PublicLayout>
      {/* ── Hero ── */}
      <section className="relative overflow-hidden pt-24 pb-20 md:pt-32 md:pb-28">
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
            className="text-lg md:text-xl max-w-3xl mx-auto mb-5 animate-fade-up delay-75"
            style={{ color: "var(--color-muted)" }}
          >
            Munymo fills a genuine gap in financial education — a daily game designed to help
            beginners develop the market instincts they have yet to form, while giving the
            experienced investor a rigorous new way to test and refine the ones they already have.
          </p>

          <p
            className="text-base md:text-lg max-w-2xl mx-auto mb-10 animate-fade-up delay-100 font-medium"
            style={{ color: "var(--color-foreground)", opacity: 0.85 }}
          >
            Built to educate the novice. Built to stimulate the professional.
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
            <div className="mt-16 max-w-lg mx-auto card-glass p-6 animate-fade-up delay-225">
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
                <div className="text-2xl font-display font-bold" style={{ color: "var(--color-brand)" }}>
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
                className="card-glass p-6 animate-fade-up"
                style={{ animationDelay: `${i * 75}ms` }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ background: "var(--color-brand-muted)" }}
                  >
                    <item.icon size={18} style={{ color: "var(--color-brand)" }} />
                  </div>
                  <span className="font-mono text-xs font-bold" style={{ color: "var(--color-subtle)" }}>
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
              <div className="card-glass p-6">
                <div className="flex items-center gap-3 mb-3">
                  <Flame size={18} style={{ color: "var(--color-warning)" }} />
                  <h4 style={{ color: "var(--color-foreground)" }}>Participation Streaks</h4>
                </div>
                <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                  Play every day to build your streak. Away Status preserves your streak when
                  you need a break. Market-closed and cancelled days never penalise you.
                </p>
              </div>
              <div className="card-glass p-6">
                <div className="flex items-center gap-3 mb-3">
                  <Trophy size={18} style={{ color: "var(--color-brand)" }} />
                  <h4 style={{ color: "var(--color-foreground)" }}>Leaderboard Qualification</h4>
                </div>
                <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                  Ranked by Average Daily Score. You qualify for the leaderboard after
                  completing 20 games — ensuring rankings reflect sustained performance.
                </p>
              </div>
              <div className="card-glass p-6">
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

      {/* ── MunyIQ Card Showcase ── */}
      <section className="py-24 border-t overflow-hidden" style={{ borderColor: "var(--color-border)" }}>
        <div className="container">
          {/* Header */}
          <div className="text-center mb-4">
            <div
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest mb-6"
              style={{
                background: "var(--color-brand-muted)",
                color: "var(--color-brand)",
                border: "1px solid oklch(0.78 0.14 75 / 0.3)",
              }}
            >
              <Sparkles size={12} />
              Coming Soon
            </div>
            <h2 className="font-display mb-4" style={{ color: "var(--color-foreground)" }}>
              Introducing{" "}
              <span className="text-gradient-brand">MunyIQ</span>
            </h2>
            <p className="max-w-2xl mx-auto text-lg" style={{ color: "var(--color-muted)" }}>
              As Munymo matures, your game history will power a composite intelligence score — a
              living measure of your instinct accuracy, research engagement, and consistency over
              time. Aligned with the internationally recognised IQ scale, MunyIQ is the credential
              that proves your financial intelligence is more than a feeling.
            </p>
          </div>

          {/* Card + Info layout */}
          <div className="mt-14 grid lg:grid-cols-2 gap-12 items-center">
            {/* Card display */}
            <div className="relative flex flex-col items-center">
              {/* Glow behind card */}
              <div
                className="absolute inset-0 rounded-3xl blur-3xl opacity-40 transition-all duration-700"
                style={{ background: card.glowColor, transform: "scale(0.85)" }}
              />
              <div className="relative w-full max-w-md">
                <img
                  src={card.img}
                  alt={`MunyIQ ${card.tier} Tier Card`}
                  className="w-full rounded-2xl shadow-2xl transition-all duration-500"
                  style={{
                    boxShadow: `0 0 60px ${card.glowColor}, 0 25px 50px rgba(0,0,0,0.5)`,
                  }}
                />
              </div>

              {/* Tier selector */}
              <div className="flex items-center gap-3 mt-8">
                <button
                  onClick={() => setActiveCard((p) => (p - 1 + MUNYIQ_CARDS.length) % MUNYIQ_CARDS.length)}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                  style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-muted)" }}
                  aria-label="Previous tier"
                >
                  <ChevronLeft size={16} />
                </button>
                {MUNYIQ_CARDS.map((c, i) => (
                  <button
                    key={c.tier}
                    onClick={() => setActiveCard(i)}
                    className="w-2.5 h-2.5 rounded-full transition-all duration-300"
                    style={{
                      background: i === activeCard ? card.accentColor : "var(--color-border)",
                      transform: i === activeCard ? "scale(1.4)" : "scale(1)",
                    }}
                    aria-label={`${c.tier} tier`}
                  />
                ))}
                <button
                  onClick={() => setActiveCard((p) => (p + 1) % MUNYIQ_CARDS.length)}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                  style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-muted)" }}
                  aria-label="Next tier"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Tier info */}
            <div className="animate-fade-up">
              <div
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest mb-4"
                style={{ background: `${card.accentColor}22`, color: card.accentColor, border: `1px solid ${card.accentColor}44` }}
              >
                {card.tier} Tier
              </div>
              <h3 className="font-display text-3xl mb-3" style={{ color: "var(--color-foreground)" }}>
                MunyIQ Score Range
              </h3>
              <p
                className="text-5xl font-display font-bold mb-4"
                style={{ color: card.accentColor }}
              >
                {card.scoreRange}
              </p>
              <p className="text-base mb-8 leading-relaxed" style={{ color: "var(--color-muted)" }}>
                {card.description}
              </p>

              {/* IQ scale reference */}
              <div
                className="rounded-xl p-5 mb-6"
                style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
              >
                <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--color-subtle)" }}>
                  MunyIQ Scale Reference
                </p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {[
                    { range: "Below 700", label: "Building", color: "var(--color-muted)" },
                    { range: "700 – 999", label: "Sapphire", color: "#3b82f6" },
                    { range: "1000 – 1139", label: "Emerald", color: "#10b981" },
                    { range: "1140 – 1399", label: "Ruby", color: "#ef4444" },
                    { range: "1400+", label: "Diamond — Genius Level", color: "#e2e8f0" },
                  ].map((row) => (
                    <div key={row.range} className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: row.color }} />
                      <span style={{ color: "var(--color-muted)" }}>{row.range}</span>
                      <span className="font-medium" style={{ color: row.color }}>{row.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-sm" style={{ color: "var(--color-subtle)" }}>
                Cards are digitally verifiable via QR code and designed to be shared, displayed, and included in professional profiles. Early Munymo members will be first to earn them.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Road Ahead ── */}
      <section className="py-20 border-t" style={{ borderColor: "var(--color-border)" }}>
        <div className="container">
          <div className="text-center mb-14">
            <div
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest mb-6"
              style={{
                background: "var(--color-brand-muted)",
                color: "var(--color-brand)",
                border: "1px solid oklch(0.78 0.14 75 / 0.3)",
              }}
            >
              <Sparkles size={12} />
              The Road Ahead
            </div>
            <h2 className="font-display mb-4" style={{ color: "var(--color-foreground)" }}>
              You Are Joining at the Beginning
            </h2>
            <p className="max-w-2xl mx-auto" style={{ color: "var(--color-muted)" }}>
              The MVP is the foundation. Early members will be first to access every feature
              as Munymo grows into a complete financial intelligence platform.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Certificates of Achievement */}
            <div
              className="card-glass p-7 flex flex-col gap-4 animate-fade-up"
              style={{ animationDelay: "0ms" }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: "oklch(0.78 0.14 75 / 0.15)" }}
              >
                <Award size={22} style={{ color: "var(--color-brand)" }} />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h4 style={{ color: "var(--color-foreground)" }}>Certificates of Achievement</h4>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-semibold"
                    style={{ background: "var(--color-brand-muted)", color: "var(--color-brand)" }}
                  >
                    Coming
                  </span>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: "var(--color-muted)" }}>
                  Munymo will issue official, digitally verifiable Certificates of Achievement for
                  significant milestones — leaderboard qualification, streak records, and tier
                  attainment. Designed to be included in CVs, LinkedIn profiles, and professional
                  portfolios as evidence of applied financial intelligence.
                </p>
              </div>
            </div>

            {/* Head-to-Head Challenges */}
            <div
              className="card-glass p-7 flex flex-col gap-4 animate-fade-up"
              style={{ animationDelay: "75ms" }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: "oklch(0.55 0.18 250 / 0.15)" }}
              >
                <Users size={22} style={{ color: "oklch(0.65 0.18 250)" }} />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h4 style={{ color: "var(--color-foreground)" }}>Head-to-Head Challenges</h4>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-semibold"
                    style={{ background: "oklch(0.55 0.18 250 / 0.15)", color: "oklch(0.65 0.18 250)" }}
                  >
                    Coming
                  </span>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: "var(--color-muted)" }}>
                  Challenge a friend, a colleague, or a rival to a private prediction contest.
                  Head-to-head competitions are coming for those who want to prove their edge
                  beyond the public leaderboard — and for workplaces that want to run their own
                  internal Munymo leagues.
                </p>
              </div>
            </div>

            {/* Native Mobile Apps */}
            <div
              className="card-glass p-7 flex flex-col gap-4 animate-fade-up"
              style={{ animationDelay: "150ms" }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: "oklch(0.65 0.18 160 / 0.15)" }}
              >
                <Smartphone size={22} style={{ color: "oklch(0.65 0.18 160)" }} />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h4 style={{ color: "var(--color-foreground)" }}>Native Mobile Apps</h4>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-semibold"
                    style={{ background: "oklch(0.65 0.18 160 / 0.15)", color: "oklch(0.65 0.18 160)" }}
                  >
                    Coming
                  </span>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: "var(--color-muted)" }}>
                  Dedicated iOS and Android apps are on the roadmap — built for the commute, the
                  lunch break, and the habit. Push notifications, offline research reading, and
                  a native experience optimised for the daily game loop.
                </p>
              </div>
            </div>
          </div>

          {/* Early member callout */}
          <div
            className="mt-10 rounded-2xl p-8 text-center"
            style={{
              background: "radial-gradient(ellipse 80% 60% at 50% 0%, oklch(0.78 0.14 75 / 0.08) 0%, var(--color-surface) 70%)",
              border: "1px solid var(--color-border)",
            }}
          >
            <p className="text-sm font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--color-brand)" }}>
              Early Member Advantage
            </p>
            <p className="max-w-xl mx-auto" style={{ color: "var(--color-muted)" }}>
              Every game you play now builds the prediction record that your future MunyIQ score
              will be calculated from. The players who join earliest will have the deepest history
              — and the most credible credentials — when these features launch.
            </p>
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
                Ready to Start Building Your Record?
              </h2>
              <p className="mb-8" style={{ color: "var(--color-muted)" }}>
                Join Munymo today. Every game you play is a data point in your financial
                intelligence story — and the story starts now.
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
