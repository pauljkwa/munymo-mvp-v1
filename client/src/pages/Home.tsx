import { useState, useRef } from "react";
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
  Sparkles,
  BarChart2,
  CheckCircle2,
} from "lucide-react";

const MUNYIQ_CARDS = [
  {
    tier: "Sapphire",
    score: 112,
    scoreDisplay: "112",
    name: "Richard Citizen",
    memberSince: "Jan 2025",
    validUntil: "Dec 2026",
    instinct: "72%",
    research: "88%",
    consistency: "A+",
    description: "The entry point to recognised financial intelligence. Sapphire holders have demonstrated consistent engagement and reliable prediction accuracy. A MunyIQ above 100 places you in the upper half of all participants.",
    scoreRange: "100 – 119",
    img: "https://d2xsxph8kpxj0f.cloudfront.net/110945286/eKLqbcXcmD3p6GhwsMA3tE/munyiq-card-sapphire-v2-i8oSTMtX32anHab7t8qL8P.webp",
    accentColor: "#2563eb",
    glowColor: "rgba(37,99,235,0.15)",
  },
  {
    tier: "Emerald",
    score: 127,
    scoreDisplay: "127",
    name: "Alexandra Mercer",
    memberSince: "Mar 2025",
    validUntil: "Feb 2027",
    instinct: "79%",
    research: "91%",
    consistency: "A",
    description: "Emerald status signals a player whose instincts and research habits are measurably above average. A MunyIQ in this range corresponds to superior financial reasoning — a meaningful credential in any professional context.",
    scoreRange: "120 – 129",
    img: "https://d2xsxph8kpxj0f.cloudfront.net/110945286/eKLqbcXcmD3p6GhwsMA3tE/munyiq-card-emerald-v2-9hdxL4mXhcEwHfx9ZdvutS.webp",
    accentColor: "#059669",
    glowColor: "rgba(5,150,105,0.15)",
  },
  {
    tier: "Ruby",
    score: 138,
    scoreDisplay: "138",
    name: "James Thornton",
    memberSince: "Jun 2025",
    validUntil: "May 2027",
    instinct: "84%",
    research: "95%",
    consistency: "A+",
    description: "Ruby holders operate at the level of gifted analysts. A MunyIQ of 130–139 places you in the top 2% of all participants — approaching the threshold of genuine financial genius.",
    scoreRange: "130 – 139",
    img: "https://d2xsxph8kpxj0f.cloudfront.net/110945286/eKLqbcXcmD3p6GhwsMA3tE/munyiq-card-ruby-v2-dAsHLuGRJ6QN5i7YdXbQen.webp",
    accentColor: "#dc2626",
    glowColor: "rgba(220,38,38,0.15)",
  },
  {
    tier: "Diamond",
    score: 147,
    scoreDisplay: "147",
    name: "Victoria Ashford",
    memberSince: "Sep 2024",
    validUntil: "Aug 2026",
    instinct: "93%",
    research: "99%",
    consistency: "S",
    description: "Diamond is genius-level. A MunyIQ of 140 or above — the threshold recognised internationally as genius — places you among fewer than 0.5% of all participants. The rarest credential Munymo will ever issue.",
    scoreRange: "140 – 200",
    img: "https://d2xsxph8kpxj0f.cloudfront.net/110945286/eKLqbcXcmD3p6GhwsMA3tE/munyiq-card-diamond-v2-ZgzStMMuBgYsgnMFBXpURJ.webp",
    accentColor: "#6366f1",
    glowColor: "rgba(99,102,241,0.15)",
  },
];

export default function Home() {
  const { isAuthenticated } = useAuth();
  const { data: todayGame } = trpc.games.getToday.useQuery();
  const [activeCard, setActiveCard] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const card = MUNYIQ_CARDS[activeCard];

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > 40) {
      if (delta < 0) {
        setActiveCard((p) => (p + 1) % MUNYIQ_CARDS.length);
      } else {
        setActiveCard((p) => (p - 1 + MUNYIQ_CARDS.length) % MUNYIQ_CARDS.length);
      }
    }
    touchStartX.current = null;
  };

  return (
    <PublicLayout>

      {/* ── Hero — asymmetric two-column ── */}
      <section className="border-b" style={{ borderColor: "var(--color-border)" }}>
        <div className="container">
          <div className="grid lg:grid-cols-2 gap-0 min-h-[580px]">

            {/* Left column — copy */}
            <div className="flex flex-col justify-center py-20 lg:py-24 lg:pr-16">
              <div
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-widest mb-8 w-fit"
                style={{
                  background: "var(--color-brand-muted)",
                  color: "var(--color-brand)",
                  border: "1px solid oklch(0.42 0.12 255 / 0.2)",
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                Daily Stock Prediction Game
              </div>

              <h1
                className="font-display mb-6 animate-fade-up"
                style={{ color: "var(--color-foreground)", lineHeight: 1.1 }}
              >
                Trust Your Gut.
                <br />
                <span className="text-gradient-gold">Back It With Research.</span>
              </h1>

              <p
                className="text-base md:text-lg mb-4 animate-fade-up delay-75 max-w-xl"
                style={{ color: "var(--color-muted)", lineHeight: 1.7 }}
              >
                Munymo fills a genuine gap in financial education — a daily game designed to help
                beginners develop the market instincts they have yet to form, while giving the
                experienced investor a rigorous new way to test and refine the ones they already have.
              </p>

              <p
                className="text-sm font-semibold uppercase tracking-wider mb-10 animate-fade-up delay-150"
                style={{ color: "var(--color-brand)", letterSpacing: "0.08em" }}
              >
                Built to educate the novice. Built to stimulate the professional.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 animate-fade-up delay-150">
                {isAuthenticated ? (
                  <Link href="/game" className="btn-gold text-sm px-6 py-2.5">
                    Play Today's Game
                    <ArrowRight size={16} />
                  </Link>
                ) : (
                  <a href={getLoginUrl()} className="btn-gold text-sm px-6 py-2.5">
                    Start Playing Free
                    <ArrowRight size={16} />
                  </a>
                )}
                <Link href="/leaderboard" className="btn-ghost text-sm px-6 py-2.5">
                  View Leaderboard
                </Link>
              </div>
            </div>

            {/* Right column — live game card or stat panel */}
            <div
              className="hidden lg:flex flex-col justify-center items-center border-l py-24 pl-16"
              style={{ borderColor: "var(--color-border)" }}
            >
              {todayGame ? (
                <div className="w-full max-w-sm">
                  <p
                    className="text-xs font-semibold uppercase tracking-widest mb-5"
                    style={{ color: "var(--color-subtle)" }}
                  >
                    Today's Matchup
                  </p>
                  <div
                    className="card-glass p-6 shadow-card"
                  >
                    <div className="flex items-center justify-between gap-4 mb-5">
                      <div className="flex-1 text-center">
                        <div className="ticker-chip mb-2">{todayGame.companyATicker}</div>
                        <p className="text-sm font-medium" style={{ color: "var(--color-foreground)" }}>
                          {todayGame.companyAName}
                        </p>
                      </div>
                      <div
                        className="text-lg font-display font-bold px-3"
                        style={{ color: "var(--color-subtle)" }}
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
                      <p
                        className="text-xs text-center mb-5 pb-5"
                        style={{ color: "var(--color-subtle)", borderBottom: "1px solid var(--color-border)" }}
                      >
                        Sector: {todayGame.sector}
                      </p>
                    )}
                    <Link href="/game" className="btn-brand w-full justify-center text-sm">
                      Make Your Pick
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="w-full max-w-sm space-y-4">
                  <p
                    className="text-xs font-semibold uppercase tracking-widest mb-5"
                    style={{ color: "var(--color-subtle)" }}
                  >
                    Why Munymo
                  </p>
                  {[
                    { icon: Brain, text: "Two-step prediction: gut instinct then informed research" },
                    { icon: BarChart2, text: "Server-calculated scores — no manipulation possible" },
                    { icon: Trophy, text: "Leaderboard qualification after 20 games" },
                    { icon: Flame, text: "Streak tracking with Away Status protection" },
                  ].map(({ icon: Icon, text }) => (
                    <div key={text} className="flex items-start gap-3">
                      <div
                        className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: "var(--color-brand-muted)" }}
                      >
                        <Icon size={15} style={{ color: "var(--color-brand)" }} />
                      </div>
                      <p className="text-sm" style={{ color: "var(--color-muted)" }}>{text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="py-20 border-b" style={{ borderColor: "var(--color-border)" }}>
        <div className="container">
          <div className="max-w-xl mb-12">
            <p className="section-label mb-3">How It Works</p>
            <h2 className="font-display mb-3" style={{ color: "var(--color-foreground)" }}>
              A two-step process that separates instinct from informed judgement
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-px"
            style={{ background: "var(--color-border)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}
          >
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
                className="p-7 animate-fade-up"
                style={{ background: "var(--color-surface)", animationDelay: `${i * 60}ms` }}
              >
                <div className="flex items-start justify-between mb-5">
                  <div
                    className="w-9 h-9 rounded-md flex items-center justify-center"
                    style={{ background: "var(--color-brand-muted)" }}
                  >
                    <item.icon size={16} style={{ color: "var(--color-brand)" }} />
                  </div>
                  <span
                    className="font-mono text-xs font-bold"
                    style={{ color: "var(--color-border-strong)" }}
                  >
                    {item.step}
                  </span>
                </div>
                <h4 className="mb-2 text-base" style={{ color: "var(--color-foreground)" }}>
                  {item.title}
                </h4>
                <p className="text-sm leading-relaxed" style={{ color: "var(--color-muted)" }}>
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Scoring ── */}
      <section className="py-20 border-b" style={{ borderColor: "var(--color-border)" }}>
        <div className="container">
          <div className="grid md:grid-cols-2 gap-16 items-start">
            <div>
              <p className="section-label mb-3">Scoring System</p>
              <h2 className="font-display mb-4" style={{ color: "var(--color-foreground)" }}>
                Rewards both prediction accuracy and research engagement
              </h2>
              <p className="mb-8 text-sm leading-relaxed" style={{ color: "var(--color-muted)" }}>
                Your Daily Score is calculated entirely on the server after results are published —
                reflecting both your prediction accuracy and your engagement with the research.
              </p>

              <div className="space-y-3">
                {[
                  { label: "Correct Final Selection", value: "+80", variant: "success" },
                  { label: "Correct Validation Answer", value: "+20", variant: "info" },
                  { label: "Perfect Day", value: "100", variant: "gold" },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between px-4 py-3 rounded-lg"
                    style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border)" }}
                  >
                    <div className="flex items-center gap-3">
                      <CheckCircle2
                        size={15}
                        style={{
                          color: row.variant === "success" ? "var(--color-success)"
                            : row.variant === "info" ? "var(--color-brand)"
                            : "var(--color-gold)"
                        }}
                      />
                      <span className="text-sm font-medium" style={{ color: "var(--color-foreground)" }}>
                        {row.label}
                      </span>
                    </div>
                    <span
                      className="font-mono text-sm font-bold px-3 py-1 rounded"
                      style={{
                        background: row.variant === "success" ? "var(--color-success-muted)"
                          : row.variant === "info" ? "var(--color-brand-muted)"
                          : "var(--color-gold-muted)",
                        color: row.variant === "success" ? "var(--color-success)"
                          : row.variant === "info" ? "var(--color-brand)"
                          : "var(--color-gold)",
                      }}
                    >
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {[
                {
                  icon: Flame,
                  iconColor: "var(--color-warning)",
                  iconBg: "var(--color-warning-muted)",
                  title: "Participation Streaks",
                  body: "Play every day to build your streak. Away Status preserves your streak when you need a break. Market-closed and cancelled days never penalise you.",
                },
                {
                  icon: Trophy,
                  iconColor: "var(--color-brand)",
                  iconBg: "var(--color-brand-muted)",
                  title: "Leaderboard Qualification",
                  body: "Ranked by Average Daily Score. You qualify for the leaderboard after completing 20 games — ensuring rankings reflect sustained performance.",
                },
                {
                  icon: Lock,
                  iconColor: "var(--color-info)",
                  iconBg: "var(--color-info-muted)",
                  title: "Server-Side Integrity",
                  body: "All scores are calculated server-side after results are published. Lockout is enforced on the server, not the browser. No manipulation is possible.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="card-glass p-5 shadow-card flex gap-4"
                >
                  <div
                    className="w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: item.iconBg }}
                  >
                    <item.icon size={16} style={{ color: item.iconColor }} />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold mb-1" style={{ color: "var(--color-foreground)" }}>
                      {item.title}
                    </h4>
                    <p className="text-sm leading-relaxed" style={{ color: "var(--color-muted)" }}>
                      {item.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── MunyIQ Card Showcase ── */}
      <section
        className="py-24 border-b"
        style={{ borderColor: "var(--color-border)", background: "var(--color-surface-raised)" }}
      >
        <div className="container">
          {/* Header */}
          <div className="max-w-2xl mb-14">
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-widest mb-5"
              style={{
                background: "var(--color-gold-muted)",
                color: "var(--color-gold)",
                border: "1px solid oklch(0.72 0.14 75 / 0.2)",
              }}
            >
              <Sparkles size={11} />
              Coming Soon
            </div>
            <h2 className="font-display mb-4" style={{ color: "var(--color-foreground)" }}>
              Introducing <span className="text-gradient-gold">MunyIQ</span>
            </h2>
            <p className="text-base leading-relaxed" style={{ color: "var(--color-muted)" }}>
              As Munymo matures, your game history will power a composite intelligence score — a
              living measure of your instinct accuracy, research engagement, and consistency over
              time. Aligned with the internationally recognised IQ scale (1–200), MunyIQ is the
              credential that proves your financial intelligence is more than a feeling.
            </p>
          </div>

          {/* Card + Info layout */}
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Card display */}
            <div className="relative flex flex-col items-center">
              <div
                className="absolute inset-0 rounded-3xl blur-3xl opacity-30 transition-all duration-700 pointer-events-none"
                style={{ background: card.glowColor, transform: "scale(0.8)" }}
              />
              <div
                className="relative w-full max-w-md select-none"
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
              >
                <img
                  src={card.img}
                  alt={`MunyIQ ${card.tier} Tier Card`}
                  className="w-full rounded-2xl transition-all duration-500"
                  style={{
                    boxShadow: `0 0 40px ${card.glowColor}, 0 20px 40px rgba(0,0,0,0.12)`,
                  }}
                />
              </div>

              {/* Tier selector — dots only, swipe to navigate on mobile */}
              <div className="flex items-center justify-center gap-3 mt-8">
                {MUNYIQ_CARDS.map((c, i) => (
                  <button
                    key={c.tier}
                    onClick={() => setActiveCard(i)}
                    className="w-2 h-2 rounded-full transition-all duration-300"
                    style={{
                      background: i === activeCard ? card.accentColor : "var(--color-border-strong)",
                      transform: i === activeCard ? "scale(1.5)" : "scale(1)",
                    }}
                    aria-label={`${c.tier} tier`}
                  />
                ))}
              </div>
            </div>

            {/* Tier info */}
            <div className="animate-fade-up">
              <div
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest mb-4"
                style={{ background: `${card.accentColor}18`, color: card.accentColor, border: `1px solid ${card.accentColor}30` }}
              >
                {card.tier} Tier
              </div>
              <p
                className="text-5xl font-display font-bold mb-2"
                style={{ color: card.accentColor }}
              >
                {card.scoreRange}
              </p>
              <p className="text-sm font-medium mb-6" style={{ color: "var(--color-subtle)" }}>
                MunyIQ Score Range
              </p>
              <p className="text-sm mb-8 leading-relaxed" style={{ color: "var(--color-muted)" }}>
                {card.description}
              </p>

              {/* IQ scale reference */}
              <div
                className="rounded-lg p-5 mb-6"
                style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
              >
                <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--color-subtle)" }}>
                  MunyIQ Scale Reference
                </p>
                <div className="space-y-2.5">
                  {[
                    { range: "Below 100", label: "Building", color: "var(--color-subtle)" },
                    { range: "100 – 119", label: "Sapphire", color: "#2563eb" },
                    { range: "120 – 129", label: "Emerald", color: "#059669" },
                    { range: "130 – 139", label: "Ruby", color: "#dc2626" },
                    { range: "140 – 200", label: "Diamond — Genius Level", color: "#6366f1" },
                  ].map((row) => (
                    <div key={row.range} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: row.color }} />
                        <span style={{ color: "var(--color-muted)" }}>{row.range}</span>
                      </div>
                      <span className="font-semibold text-xs" style={{ color: row.color }}>{row.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-xs leading-relaxed" style={{ color: "var(--color-subtle)" }}>
                Cards are digitally verifiable via QR code and designed to be shared, displayed,
                and included in professional profiles. Early Munymo members will be first to earn them.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Road Ahead ── */}
      <section className="py-20 border-b" style={{ borderColor: "var(--color-border)" }}>
        <div className="container">
          <div className="max-w-xl mb-12">
            <p className="section-label mb-3">The Road Ahead</p>
            <h2 className="font-display mb-4" style={{ color: "var(--color-foreground)" }}>
              You are joining at the beginning
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: "var(--color-muted)" }}>
              The MVP is the foundation. Early members will be first to access every feature
              as Munymo grows into a complete financial intelligence platform.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Award,
                iconColor: "var(--color-gold)",
                iconBg: "var(--color-gold-muted)",
                title: "Certificates of Achievement",
                body: "Official, digitally verifiable Certificates of Achievement for significant milestones — leaderboard qualification, streak records, and tier attainment. Designed to be included in CVs, LinkedIn profiles, and professional portfolios as evidence of applied financial intelligence.",
              },
              {
                icon: Users,
                iconColor: "var(--color-brand)",
                iconBg: "var(--color-brand-muted)",
                title: "Head-to-Head Challenges",
                body: "Challenge a friend, a colleague, or a rival to a private prediction contest. Head-to-head competitions are coming for those who want to prove their edge beyond the public leaderboard — and for workplaces that want to run their own internal Munymo leagues.",
              },
              {
                icon: Smartphone,
                iconColor: "var(--color-success)",
                iconBg: "var(--color-success-muted)",
                title: "Native Mobile Apps",
                body: "Dedicated iOS and Android apps are on the roadmap — built for the commute, the lunch break, and the habit. Push notifications, offline research reading, and a native experience optimised for the daily game loop.",
              },
            ].map((item, i) => (
              <div
                key={item.title}
                className="card-glass p-7 shadow-card animate-fade-up"
                style={{ animationDelay: `${i * 75}ms` }}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center mb-5"
                  style={{ background: item.iconBg }}
                >
                  <item.icon size={18} style={{ color: item.iconColor }} />
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <h4 className="text-sm font-semibold" style={{ color: "var(--color-foreground)" }}>
                    {item.title}
                  </h4>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-semibold"
                    style={{ background: "var(--color-border)", color: "var(--color-subtle)" }}
                  >
                    Coming
                  </span>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: "var(--color-muted)" }}>
                  {item.body}
                </p>
              </div>
            ))}
          </div>

          {/* Early member callout */}
          <div
            className="mt-8 rounded-xl p-8"
            style={{
              background: "var(--color-brand-muted)",
              border: "1px solid oklch(0.42 0.12 255 / 0.15)",
            }}
          >
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold mb-1" style={{ color: "var(--color-brand)" }}>
                  Early Member Advantage
                </p>
                <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                  Every game you play now builds the prediction record that your future MunyIQ score
                  will be calculated from. The players who join earliest will have the deepest history
                  — and the most credible credentials — when these features launch.
                </p>
              </div>
              {!isAuthenticated && (
                <a href={getLoginUrl()} className="btn-brand text-sm flex-shrink-0" style={{ padding: "0.5rem 1.25rem" }}>
                  Join Now
                  <ArrowRight size={14} />
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      {!isAuthenticated && (
        <section className="py-20">
          <div className="container">
            <div
              className="max-w-2xl mx-auto text-center rounded-2xl p-12 shadow-card"
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
              }}
            >
              <p className="section-label mb-4 justify-center">Get Started</p>
              <h2 className="font-display mb-4" style={{ color: "var(--color-foreground)" }}>
                Ready to start building your record?
              </h2>
              <p className="mb-8 text-sm leading-relaxed" style={{ color: "var(--color-muted)" }}>
                Join Munymo today. Every game you play is a data point in your financial
                intelligence story — and the story starts now.
              </p>
              <a href={getLoginUrl()} className="btn-gold text-sm px-8 py-3">
                Get Started Free
                <ArrowRight size={16} />
              </a>
            </div>
          </div>
        </section>
      )}
    </PublicLayout>
  );
}
