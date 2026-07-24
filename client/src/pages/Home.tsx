import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { SignUpButton } from "@clerk/clerk-react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import PublicLayout from "@/components/PublicLayout";
import MunymoLogo from "@/components/MunymoLogo";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ArrowRight,
  Brain,
  BookOpen,
  TrendingUp,
  Trophy,
  Flame,
  Lock,
  Smartphone,
  Users,
  Award,
  Sparkles,
  BarChart2,
  CheckCircle2,
  ChevronRight,
  X,
  FlaskConical,
  Star,
  Zap,
  Gift,
  Loader2,
} from "lucide-react";

/**
 * Shown while games.getToday is in flight: a plain spinner in the matchup
 * card's frame — an unmistakable "loading" signal. Never show placeholder
 * game content here: the old demo mockup used to render during this window
 * and visibly flashed before being replaced by the live game every page load.
 */
function HeroMatchupLoading() {
  return (
    <div className="w-full max-w-sm mx-auto">
      <p
        className="text-xs font-bold uppercase tracking-widest mb-5"
        style={{ color: "var(--color-subtle)" }}
      >
        Today's Matchup
      </p>
      <div className="card-glass p-6 shadow-card flex flex-col items-center justify-center gap-3 min-h-[220px]">
        <Loader2 size={28} className="animate-spin" style={{ color: "var(--color-brand)" }} />
        <p className="text-sm" style={{ color: "var(--color-subtle)" }}>
          Loading today's matchup…
        </p>
      </div>
    </div>
  );
}

/**
 * Shown only when loading has finished and there is genuinely no live game
 * (rare — normally only between a game closing and the next one publishing).
 */
function HeroMatchupUnavailable() {
  return (
    <div className="w-full max-w-sm mx-auto">
      <p
        className="text-xs font-bold uppercase tracking-widest mb-5"
        style={{ color: "var(--color-subtle)" }}
      >
        Today's Matchup
      </p>
      <div className="card-glass p-6 shadow-card flex flex-col items-center justify-center gap-3 min-h-[220px] text-center">
        <Trophy size={24} style={{ color: "var(--color-brand)" }} />
        <p className="text-sm font-medium" style={{ color: "var(--color-foreground)" }}>
          The next matchup is being prepared.
        </p>
        <p className="text-xs" style={{ color: "var(--color-subtle)" }}>
          A new game goes live every US trading day.
        </p>
        <Link href="/demo" className="btn-ghost text-xs px-4 py-2 mt-1">
          See how the game works
        </Link>
      </div>
    </div>
  );
}

// ─── FAQ ──────────────────────────────────────────────────────────────────────
// About Munymo itself — the why and how of the game as a daily learning tool.
// Answers distilled from the Evolution of Munymo document. Plain strings so the
// same data feeds both the visible accordion and the FAQPage JSON-LD below.
const FAQ_ITEMS = [
  {
    q: "What exactly is Munymo?",
    a: "Munymo is a daily stock market training game. Each US trading day we publish one matchup between two well-known companies in the same sector, and you predict which one will post the better performance by the close. There's no real money involved — the goal is to build genuine market intuition through daily practice, feedback, and a track record you can watch improve.",
  },
  {
    q: "How does a game day work?",
    a: "Each game takes about five minutes. First you make a gut pick on instinct alone. Then you read the day's research brief — a balanced, plain-English rundown of both companies. Finally you lock in your scored prediction and answer one quick question that checks you actually read the research. After the market closes, results are published and your score is updated.",
  },
  {
    q: "Why do I pick twice — once before the research and once after?",
    a: "The first pick captures your raw instinct before any information can influence it. Comparing your gut picks with your final picks over time reveals something no course can teach you: whether research genuinely improves your judgment, and in which direction. The gut pick is also your safety net: it registers you as in the game, so if life pulls you away before you finish, it's automatically submitted as your final pick at lockout — your streak stays alive — and the validation question is held for you to answer later, even after the next trading day has begun, so its 20 points aren't lost.",
  },
  {
    q: "How does scoring work?",
    a: "A perfect day is 100 points: 80 for a correct final prediction and 20 for correctly answering the validation question about the day's research. The split is deliberate — the prediction is the harder, more consequential skill, while the validation points reward the habit of reading carefully. All scores are calculated on our servers after results are published, so no score can be gamed or disputed.",
  },
  {
    q: "Do I need trading or investing experience to play?",
    a: "No. Munymo is daily calisthenics for your financial brain, whichever end of the spectrum you're on. If you're new to markets, the plain-English research briefs and daily repetition build genuine intuition from zero. If you already know your way around a balance sheet, it's a morning kickstart for the trading day, or five focused minutes on the train — and the leaderboard doesn't care which one you are.",
  },
  {
    q: "Is Munymo a trading app, financial advice, or gambling?",
    a: "None of the three. You can't buy or sell anything on Munymo, nothing on the platform is a recommendation about any security, and there is no money at stake — you can't win or lose a cent. Munymo is a training ground: the competition is real, but it's played entirely with points, streaks, and rankings.",
  },
  {
    q: "Why is it daily, and what happens if I miss a day?",
    a: "Financial intuition is a skill, and skills are built through consistent repetition — one focused decision a day beats a weekend cram. Streaks track that consistency. If life gets in the way, Away Status lets you protect your streak for a defined period while you're not playing: you keep the streak, but you don't earn points for days you sit out.",
  },
  {
    q: "How are the two companies chosen each day?",
    a: "Every matchup is curated fresh from what's actually happening in the market. The two companies always share a sector so the comparison is meaningful, both must have a genuine case for outperforming, and the pairing is tied to a real news story from the last couple of days. That article is credited and linked right on the game page — click through and read it if you want the full story behind the day's pairing. Strict freshness rules stop sectors and companies from repeating too often, so the game keeps showing you new territory.",
  },
  {
    q: "What is MunyIQ?",
    a: "MunyIQ is Munymo's upcoming financial intelligence score — a single number built from your full track record: instinct accuracy, research engagement, prediction accuracy, consistency, and — most important of all — improvement over time. That last one is the learned metric: it measures whether you're actually getting better, which is the whole point. MunyIQ needs a meaningful sample of games before it can be calculated, which is by design: a credential is only worth having if it can't be lucked into. Tiered cards from Sapphire to Diamond will mark the milestones.",
  },
  {
    q: "What does it cost?",
    a: "Munymo is free to play during the beta. Founding members — the players who join now — keep their join date on record and will be recognized when MunyIQ and premium features launch later.",
  },
];

// ─── MunyIQ card data ─────────────────────────────────────────────────────────
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
    description:
      "Consistent engagement and reliable prediction accuracy. A MunyIQ above 100 places you in the upper half of all participants.",
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
    description:
      "Instincts and research habits measurably above average. Emerald status is a meaningful signal of superior financial reasoning.",
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
    description:
      "Ruby holders operate at the level of gifted analysts — top 2% of all participants.",
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
    description:
      "Diamond is genius-level. A MunyIQ of 140+ places you among fewer than 0.5% of all participants.",
    scoreRange: "140 – 200",
    img: "https://d2xsxph8kpxj0f.cloudfront.net/110945286/eKLqbcXcmD3p6GhwsMA3tE/munyiq-card-diamond-v2-ZgzStMMuBgYsgnMFBXpURJ.webp",
    accentColor: "#6366f1",
    glowColor: "rgba(99,102,241,0.15)",
  },
];

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Home() {
  const { isAuthenticated, user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { data: todayGame, isLoading: todayGameLoading } = trpc.games.getToday.useQuery();
  const [activeCard, setActiveCard] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(() => {
    try { return sessionStorage.getItem("munymo_beta_banner_dismissed") === "1"; } catch { return false; }
  });

  function dismissBanner() {
    setBannerDismissed(true);
    try { sessionStorage.setItem("munymo_beta_banner_dismissed", "1"); } catch { /* ignore */ }
  }

  // Admins always see the banner and beta section — never dismissed, never hidden
  const showBanner = isAdmin || !bannerDismissed;

  // Auto-cycle MunyIQ cards
  useEffect(() => {
    const t = setInterval(() => {
      setActiveCard((p) => (p + 1) % MUNYIQ_CARDS.length);
    }, 3500);
    return () => clearInterval(t);
  }, []);

  const card = MUNYIQ_CARDS[activeCard];

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > 40) {
      setActiveCard((p) =>
        delta < 0
          ? (p + 1) % MUNYIQ_CARDS.length
          : (p - 1 + MUNYIQ_CARDS.length) % MUNYIQ_CARDS.length
      );
    }
    touchStartX.current = null;
  };

  return (
    <PublicLayout>

      {/* ══════════════════════════════════════════════════════════════════════
          ANNOUNCEMENT BAR — Beta recruitment
      ══════════════════════════════════════════════════════════════════════ */}
      {showBanner && (
        <div
          className="relative flex items-center justify-center gap-3 pl-4 pr-10 py-2.5 text-sm font-medium"
          style={{
            background: "var(--color-brand)",
            borderBottom: "1px solid oklch(0.28 0.12 160)",
            color: "oklch(0.95 0.02 155)",
          }}
        >
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[0.625rem] font-bold uppercase tracking-widest flex-shrink-0"
            style={{ background: "oklch(0.58 0.16 155 / 0.30)", color: "oklch(0.88 0.12 155)" }}
          >
            <FlaskConical size={10} />
            Beta
          </span>
          <span className="hidden sm:inline" style={{ color: "oklch(0.92 0.04 155)" }}>We're recruiting founding beta testers — play free, shape the product, earn founding member status.</span>
          <span className="sm:hidden" style={{ color: "oklch(0.92 0.04 155)" }}>Beta testers wanted.</span>
          {!isAuthenticated && (
            <SignUpButton mode="modal">
              <button
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold flex-shrink-0 transition-all duration-150 hover:opacity-90 active:scale-95"
                style={{ background: "oklch(0.58 0.16 155)", color: "#ffffff" }}
              >
                Join now <ArrowRight size={11} />
              </button>
            </SignUpButton>
          )}
          <button
            onClick={dismissBanner}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full transition-opacity"
            style={{ color: "oklch(0.70 0.06 155)", opacity: 0.7 }}
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 1 — HERO
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden border-b" style={{ borderColor: "var(--color-border)" }}>

        {/* Subtle radial glow behind hero */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 50% at 50% -10%, oklch(0.58 0.16 155 / 0.07) 0%, transparent 70%)",
          }}
        />

        <div className="container relative">
          <div className="grid lg:grid-cols-2 gap-0 min-h-[600px] items-center">

            {/* ── Left: copy ── */}
            <div className="flex flex-col justify-center py-16 lg:py-24 lg:pr-16">

              {/* Eyebrow label */}
              <div
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest mb-6 w-fit animate-fade-up"
                style={{
                  background: "var(--color-brand-muted)",
                  color: "var(--color-brand)",
                  border: "1px solid oklch(0.35 0.10 160 / 0.2)",
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                <span className="sm:hidden">Daily Training Game</span>
                <span className="hidden sm:inline">Daily Stock Market Training Game</span>
              </div>

              {/* Hook */}
              <p
                className="font-display italic mb-4 animate-fade-up"
                style={{
                  color: "var(--color-muted)",
                  fontSize: "clamp(1.1rem, 2.5vw, 1.4rem)",
                  animationDelay: "40ms",
                }}
              >
                eeny meeny...
              </p>

              {/* Logo */}
              <div className="mb-5 animate-fade-up" style={{ animationDelay: "80ms" }}>
                <MunymoLogo height={52} />
              </div>

              {/* Introducing headline */}
              <p
                className="font-display font-bold animate-fade-up mb-4"
                style={{
                  color: "var(--color-foreground)",
                  fontSize: "clamp(1.1rem, 2vw, 1.25rem)",
                  animationDelay: "110ms",
                }}
              >
                Introducing Munymo.
              </p>

              {/* Body copy — single combined paragraph */}
              <div
                className="mb-8 animate-fade-up"
                style={{ animationDelay: "150ms" }}
              >
                <p
                  className="text-base leading-relaxed"
                  style={{ color: "var(--color-muted)" }}
                >
                  Not a guessing game. A daily stock market training game that asks one simple question: who will perform better today — Company A or Company B?
                </p>
              </div>

              {/* CTA */}
              <div
                className="flex flex-col sm:flex-row gap-3 animate-fade-up"
                style={{ animationDelay: "200ms" }}
              >
                {isAuthenticated ? (
                  <Link href="/game" className="btn-gold text-sm px-7 py-3">
                    Play Today's Game
                    <ArrowRight size={16} />
                  </Link>
                ) : (
                  <SignUpButton mode="modal">
                    <button className="btn-gold text-sm px-7 py-3">
                      Start Playing — It's Free
                      <ArrowRight size={16} />
                    </button>
                  </SignUpButton>
                )}
                <Link href="/demo" className="btn-ghost text-sm px-6 py-3">
                  See How It Works
                </Link>
              </div>
            </div>

            {/* ── Right: interactive game card mockup ── */}
            <div
              className="hidden lg:flex flex-col justify-center items-center border-l py-24 pl-16"
              style={{ borderColor: "var(--color-border)" }}
            >
              {todayGameLoading ? (
                <HeroMatchupLoading />
              ) : todayGame ? (
                /* Live game card when a game is active */
                <div className="w-full max-w-sm">
                  <p
                    className="text-xs font-bold uppercase tracking-widest mb-5"
                    style={{ color: "var(--color-subtle)" }}
                  >
                    Today's Matchup
                  </p>
                  <div className="card-glass p-6 shadow-card">
                    <div className="flex items-center justify-between gap-4 mb-5">
                      <div className="flex-1 text-center">
                        <div className="ticker-chip mb-2">{todayGame.companyATicker}</div>
                        <p className="text-sm font-medium" style={{ color: "var(--color-foreground)" }}>
                          {todayGame.companyAName}
                        </p>
                      </div>
                      <div className="text-lg font-display font-bold px-3" style={{ color: "var(--color-subtle)" }}>
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
                <HeroMatchupUnavailable />
              )}
            </div>

          </div>
        </div>

        {/* Mobile hero card — shown below copy on small screens.
            Live matchup when a game is running (same as desktop), demo card otherwise. */}
        <div className="lg:hidden container pb-12">
          {todayGameLoading ? (
            <HeroMatchupLoading />
          ) : todayGame ? (
            <div className="mx-auto max-w-sm">
              <p
                className="text-xs font-bold uppercase tracking-widest mb-4 text-center"
                style={{ color: "var(--color-subtle)" }}
              >
                Today's Matchup
              </p>
              <div className="card-glass p-6 shadow-card">
                <div className="flex items-center justify-between gap-4 mb-5">
                  <div className="flex-1 text-center">
                    <div className="ticker-chip mb-2">{todayGame.companyATicker}</div>
                    <p className="text-sm font-medium" style={{ color: "var(--color-foreground)" }}>
                      {todayGame.companyAName}
                    </p>
                  </div>
                  <div className="text-lg font-display font-bold px-3" style={{ color: "var(--color-subtle)" }}>
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
            <HeroMatchupUnavailable />
          )}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 2 — HOW IT WORKS
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="py-20 border-b" style={{ borderColor: "var(--color-border)" }}>
        <div className="container">
          <div className="max-w-lg mb-14">
            <p className="section-label mb-3">How It Works</p>
            <h2 className="font-display" style={{ color: "var(--color-foreground)" }}>
              Four steps. Five minutes.
              <br />
              <span className="text-gradient-gold">One daily habit.</span>
            </h2>
          </div>

          {/* Steps — horizontal timeline on desktop, stacked on mobile */}
          <div className="relative">
            {/* Connector line (desktop only) */}
            <div
              className="hidden md:block absolute top-[2.2rem] left-[calc(12.5%+1.5rem)] right-[calc(12.5%+1.5rem)] h-px"
              style={{ background: "var(--color-border)" }}
            />

            <div className="grid md:grid-cols-4 gap-6 md:gap-8">
              {[
                {
                  icon: Brain,
                  step: "01",
                  title: "Gut Pick",
                  body: "Choose a winner before you see any data. Raw instinct only.",
                },
                {
                  icon: BookOpen,
                  step: "02",
                  title: "Read the Research",
                  body: "Charts, financial metrics, and an expert-curated research brief.",
                },
                {
                  icon: TrendingUp,
                  step: "03",
                  title: "Final Pick + Quiz",
                  body: "Lock in your call. Answer one timed question from the research.",
                },
                {
                  icon: Trophy,
                  step: "04",
                  title: "See the Result",
                  body: "Score, community stats, and the Hindsight Spotlight lesson.",
                },
              ].map((item, i) => (
                <div
                  key={item.step}
                  className="flex flex-row items-start gap-4 text-left md:flex-col md:gap-0 animate-fade-up"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  {/* Step circle — compact beside the text on mobile, large above it on desktop */}
                  <div className="relative flex-shrink-0 md:mb-5">
                    <div
                      className="w-12 h-12 md:w-[4.5rem] md:h-[4.5rem] rounded-full flex items-center justify-center"
                      style={{
                        background: "var(--color-brand-muted)",
                        border: "1px solid oklch(0.35 0.10 160 / 0.2)",
                      }}
                    >
                      <item.icon size={22} style={{ color: "var(--color-brand)" }} />
                    </div>
                    <span
                      className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[0.625rem] font-bold"
                      style={{
                        background: "var(--color-gold)",
                        color: "white",
                      }}
                    >
                      {i + 1}
                    </span>
                  </div>
                  <div>
                    <h4
                      className="font-display text-base mb-2"
                      style={{ color: "var(--color-foreground)" }}
                    >
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

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 3 — SCORING (tight, visual)
      ══════════════════════════════════════════════════════════════════════ */}
      <section
        className="py-20 border-b"
        style={{
          borderColor: "var(--color-border)",
          background: "var(--color-surface-raised)",
        }}
      >
        <div className="container">
          <div className="grid md:grid-cols-2 gap-12 items-center">

            {/* Score display */}
            <div>
              <p className="section-label mb-4">The Score</p>
              <div className="flex items-end gap-6 mb-8">
                <div>
                  <div
                    className="font-display font-black leading-none mb-1"
                    style={{
                      fontSize: "clamp(4rem, 10vw, 6rem)",
                      color: "var(--color-gold)",
                    }}
                  >
                    80
                  </div>
                  <p className="text-sm font-semibold" style={{ color: "var(--color-muted)" }}>
                    Correct prediction
                  </p>
                </div>
                <div
                  className="text-3xl font-display font-bold pb-8"
                  style={{ color: "var(--color-border-strong)" }}
                >
                  +
                </div>
                <div>
                  <div
                    className="font-display font-black leading-none mb-1"
                    style={{
                      fontSize: "clamp(4rem, 10vw, 6rem)",
                      color: "var(--color-brand)",
                    }}
                  >
                    20
                  </div>
                  <p className="text-sm font-semibold" style={{ color: "var(--color-muted)" }}>
                    Validation question
                  </p>
                </div>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: "var(--color-muted)" }}>
                Answer the validation question faster and score closer to the full 20 pts.
                Scores are calculated server-side after market close.{" "}
                <span style={{ color: "var(--color-foreground)", fontWeight: 600 }}>
                  No manipulation possible.
                </span>
              </p>
            </div>

            {/* Feature pills */}
            <div className="space-y-4">
              {[
                {
                  icon: Flame,
                  iconColor: "var(--color-warning)",
                  iconBg: "var(--color-warning-muted)",
                  title: "Participation Streaks",
                  body: "Play every day to build your streak. Away Status protects it when life gets in the way.",
                },
                {
                  icon: Trophy,
                  iconColor: "var(--color-brand)",
                  iconBg: "var(--color-brand-muted)",
                  title: "Leaderboard",
                  body: "Ranked by Average Daily Score. Qualify after 20 games — rankings reflect sustained performance, not luck.",
                },
                {
                  icon: Lock,
                  iconColor: "var(--color-info)",
                  iconBg: "var(--color-info-muted)",
                  title: "Server-Side Integrity",
                  body: "Lockout is enforced on the server, not the browser. Every score is tamper-proof.",
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

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 4 — MUNYIQ TEASER
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="py-24 border-b" style={{ borderColor: "var(--color-border)" }}>
        <div className="container">
          <div className="grid lg:grid-cols-2 gap-16 items-center">

            {/* Card carousel */}
            <div
              className="relative flex flex-col items-center select-none"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              {/* Glow */}
              <div
                className="absolute inset-0 rounded-3xl blur-3xl opacity-40 transition-all duration-700 pointer-events-none"
                style={{ background: card.glowColor, transform: "scale(0.75)" }}
              />
              <img
                src={card.img}
                alt={`MunyIQ ${card.tier} Tier Card`}
                className="relative w-full max-w-md rounded-2xl transition-all duration-500"
                style={{
                  boxShadow: `0 0 48px ${card.glowColor}, 0 24px 48px rgba(0,0,0,0.14)`,
                }}
              />
              {/* Tier dots */}
              <div className="flex items-center justify-center gap-3 mt-8">
                {MUNYIQ_CARDS.map((c, i) => (
                  <button
                    key={c.tier}
                    onClick={() => setActiveCard(i)}
                    className="rounded-full transition-all duration-300"
                    style={{
                      width: i === activeCard ? "1.5rem" : "0.5rem",
                      height: "0.5rem",
                      background: i === activeCard ? card.accentColor : "var(--color-border-strong)",
                    }}
                    aria-label={`${c.tier} tier`}
                  />
                ))}
              </div>
            </div>

            {/* Copy */}
            <div>
              <div
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest mb-5"
                style={{
                  background: "var(--color-gold-muted)",
                  color: "var(--color-gold)",
                  border: "1px solid oklch(0.58 0.16 155 / 0.2)",
                }}
              >
                <Sparkles size={11} />
                Coming Soon
              </div>

              <h2 className="font-display mb-4" style={{ color: "var(--color-foreground)" }}>
                Your game history becomes{" "}
                <span className="text-gradient-gold">your credential.</span>
              </h2>

              <p className="text-base leading-relaxed mb-6" style={{ color: "var(--color-muted)" }}>
                As Munymo grows, your prediction record will power{" "}
                <strong style={{ color: "var(--color-foreground)" }}>MunyIQ</strong> — a composite
                score of instinct accuracy, research engagement, and consistency over time.
              </p>
              <p className="text-base leading-relaxed mb-8" style={{ color: "var(--color-muted)" }}>
                Earn a card. Share it. Prove it.
              </p>

              {/* Tier list — compact */}
              <div className="space-y-2">
                {[
                  { range: "100 – 119", label: "Sapphire", color: "#2563eb" },
                  { range: "120 – 129", label: "Emerald", color: "#059669" },
                  { range: "130 – 139", label: "Ruby", color: "#dc2626" },
                  { range: "140+", label: "Diamond", color: "#6366f1" },
                ].map((row) => (
                  <div
                    key={row.range}
                    className="flex items-center justify-between px-4 py-2.5 rounded-lg"
                    style={{
                      background: `${row.color}10`,
                      border: `1px solid ${row.color}25`,
                    }}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: row.color }}
                      />
                      <span className="text-sm font-semibold" style={{ color: row.color }}>
                        {row.label}
                      </span>
                    </div>
                    <span className="text-xs font-mono" style={{ color: "var(--color-muted)" }}>
                      {row.range}
                    </span>
                  </div>
                ))}
              </div>

              <p className="text-xs mt-6 leading-relaxed" style={{ color: "var(--color-subtle)" }}>
                Players who join now will have the deepest prediction history when MunyIQ launches — and the most credible credentials.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 5 — ROAD AHEAD (icon + title + one line)
      ══════════════════════════════════════════════════════════════════════ */}
      <section
        className="py-20 border-b"
        style={{
          borderColor: "var(--color-border)",
          background: "var(--color-surface-raised)",
        }}
      >
        <div className="container">
          <div className="max-w-lg mb-12">
            <p className="section-label mb-3">The Road Ahead</p>
            <h2 className="font-display" style={{ color: "var(--color-foreground)" }}>
              You are joining{" "}
              <span className="text-gradient-gold">at the beginning.</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Award,
                iconColor: "var(--color-gold)",
                iconBg: "var(--color-gold-muted)",
                title: "Certificates of Achievement",
                body: "Digitally verifiable credentials for leaderboard qualification, streak records, and tier attainment — designed for CVs and LinkedIn.",
                tag: "Coming",
              },
              {
                icon: Users,
                iconColor: "var(--color-brand)",
                iconBg: "var(--color-brand-muted)",
                title: "Head-to-Head Challenges",
                body: "Challenge a friend or colleague to a private prediction contest. Workplace leagues included.",
                tag: "Coming",
              },
              {
                icon: Smartphone,
                iconColor: "var(--color-success)",
                iconBg: "var(--color-success-muted)",
                title: "Native Mobile Apps",
                body: "Dedicated iOS and Android apps built for the commute, the lunch break, and the daily habit.",
                tag: "Coming",
              },
            ].map((item, i) => (
              <div
                key={item.title}
                className="card-glass p-7 shadow-card animate-fade-up group"
                style={{ animationDelay: `${i * 75}ms` }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110"
                  style={{ background: item.iconBg }}
                >
                  <item.icon size={18} style={{ color: item.iconColor }} />
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="text-sm font-semibold" style={{ color: "var(--color-foreground)" }}>
                    {item.title}
                  </h4>
                  <span
                    className="text-[0.625rem] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide"
                    style={{
                      background: "var(--color-border)",
                      color: "var(--color-subtle)",
                    }}
                  >
                    {item.tag}
                  </span>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: "var(--color-muted)" }}>
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 5b — BETA RECRUITMENT
      ══════════════════════════════════════════════════════════════════════ */}
      <section
          className="py-24 border-y"
          style={{
            borderColor: "var(--color-border)",
            background: "oklch(0.96 0.018 155)",
          }}
        >
          <div className="container">
            <div className="max-w-4xl mx-auto">

              {/* Header */}
              <div className="text-center mb-14">
                <div
                  className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest mb-5"
                  style={{
                    background: "oklch(0.58 0.16 155 / 0.15)",
                    color: "oklch(0.30 0.12 155)",
                    border: "1px solid oklch(0.58 0.16 155 / 0.25)",
                  }}
                >
                  <FlaskConical size={11} />
                  Founding Beta
                </div>
                <h2
                  className="font-display mb-4"
                  style={{ color: "oklch(0.15 0.010 260)" }}
                >
                  Be part of building{" "}
                  <span className="text-gradient-gold">something real.</span>
                </h2>
                <p
                  className="text-base leading-relaxed max-w-xl mx-auto"
                  style={{ color: "oklch(0.38 0.010 260)" }}
                >
                  Munymo is in active beta. We're looking for curious, financially-minded people to play every day,
                  give honest feedback, and help shape what this becomes.
                </p>
              </div>

              {/* Benefits grid */}
              <div className="grid md:grid-cols-3 gap-5 mb-12">
                {[
                  {
                    icon: Star,
                    iconColor: "oklch(0.50 0.16 65)",
                    iconBg: "oklch(0.62 0.16 65 / 0.12)",
                    title: "Founding Member Status",
                    body: "Your join date is recorded permanently. When MunyIQ launches, founding members will be recognised with an exclusive badge.",
                  },
                  {
                    icon: Zap,
                    iconColor: "oklch(0.35 0.10 160)",
                    iconBg: "oklch(0.35 0.10 160 / 0.10)",
                    title: "Deepest Prediction History",
                    body: "MunyIQ is built on your track record. Players who join now will have the most credible, data-rich credentials when it launches.",
                  },
                  {
                    icon: Gift,
                    iconColor: "oklch(0.45 0.16 230)",
                    iconBg: "oklch(0.52 0.16 230 / 0.10)",
                    title: "Shape the Product",
                    body: "Direct access to the team. Your feedback influences what gets built next — features, exchanges, scoring, everything.",
                  },
                ].map((item, i) => (
                  <div
                    key={item.title}
                    className="rounded-2xl p-6 animate-fade-up shadow-sm"
                    style={{
                      background: "oklch(1.00 0.000 0)",
                      border: "1px solid oklch(0.88 0.020 155)",
                      animationDelay: `${i * 60}ms`,
                    }}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                      style={{ background: item.iconBg }}
                    >
                      <item.icon size={18} style={{ color: item.iconColor }} />
                    </div>
                    <h4 className="text-sm font-semibold mb-2" style={{ color: "oklch(0.15 0.010 260)" }}>
                      {item.title}
                    </h4>
                    <p className="text-sm leading-relaxed" style={{ color: "oklch(0.42 0.010 260)" }}>
                      {item.body}
                    </p>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <div className="text-center">
                {isAuthenticated ? (
                  <Link href="/game">
                    <button className="btn-gold text-sm px-8 py-3.5 mb-4">
                      Play Today's Game
                      <ArrowRight size={16} />
                    </button>
                  </Link>
                ) : (
                  <SignUpButton mode="modal">
                    <button className="btn-gold text-sm px-8 py-3.5 mb-4">
                      Apply as a Beta Tester — It's Free
                      <ArrowRight size={16} />
                    </button>
                  </SignUpButton>
                )}
                <p className="text-xs" style={{ color: "oklch(0.55 0.008 260)" }}>
                  No credit card. No financial knowledge required. Just play every day and tell us what you think.
                </p>
              </div>

            </div>
          </div>
        </section>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 6 — FAQ
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="py-20 border-b" style={{ borderColor: "var(--color-border)" }}>
        <div className="container">
          <div className="max-w-lg mb-12">
            <p className="section-label mb-3">FAQ</p>
            <h2 className="font-display mb-4" style={{ color: "var(--color-foreground)" }}>
              Questions, answered.
            </h2>
            <p className="text-base leading-relaxed" style={{ color: "var(--color-muted)" }}>
              The why and how of Munymo — what the game is, how it works, and why five
              minutes a day is enough to sharpen real market judgment.
            </p>
          </div>

          <div className="max-w-3xl">
            <Accordion type="single" collapsible>
              {FAQ_ITEMS.map((item, i) => (
                <AccordionItem
                  key={item.q}
                  value={`faq-${i}`}
                  style={{ borderColor: "var(--color-border)" }}
                >
                  <AccordionTrigger
                    className="text-base font-semibold py-5 hover:no-underline"
                    style={{ color: "var(--color-foreground)" }}
                  >
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="pb-5">
                    <p
                      className="text-sm leading-relaxed max-w-2xl"
                      style={{ color: "var(--color-muted)" }}
                    >
                      {item.a}
                    </p>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>

          {/* FAQPage structured data — lets Google and AI search engines read the
              Q&A directly. Built from the same FAQ_ITEMS the accordion renders. */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "FAQPage",
                mainEntity: FAQ_ITEMS.map((item) => ({
                  "@type": "Question",
                  name: item.q,
                  acceptedAnswer: { "@type": "Answer", text: item.a },
                })),
              }),
            }}
          />
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 7 — FINAL CTA
      ══════════════════════════════════════════════════════════════════════ */}
      {!isAuthenticated && (
        <section className="py-24">
          <div className="container">
            <div
              className="relative max-w-2xl mx-auto text-center rounded-3xl p-12 overflow-hidden"
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                boxShadow: "0 8px 40px oklch(0.15 0.01 260 / 0.06)",
              }}
            >
              {/* Background glow */}
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    "radial-gradient(ellipse 80% 60% at 50% 120%, oklch(0.58 0.16 155 / 0.08) 0%, transparent 70%)",
                }}
              />

              <div className="relative">
                <p className="section-label mb-5 justify-center">Get Started</p>
                <h2
                  className="font-display mb-4"
                  style={{ color: "var(--color-foreground)", lineHeight: 1.1 }}
                >
                  Five minutes a day.
                  <br />
                  <span className="text-gradient-gold">Real companies. Real results.</span>
                </h2>
                <p className="mb-8 text-sm leading-relaxed" style={{ color: "var(--color-muted)" }}>
                  Free to play. No financial knowledge required. Just curiosity.
                </p>
                <SignUpButton mode="modal">
                  <button className="btn-gold text-sm px-8 py-3">
                    Start Playing Free
                    <ArrowRight size={16} />
                  </button>
                </SignUpButton>
              </div>
            </div>
          </div>
        </section>
      )}

    </PublicLayout>
  );
}
