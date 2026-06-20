import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { SignInButton } from "@clerk/clerk-react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import PublicLayout from "@/components/PublicLayout";
import MunymoLogo from "@/components/MunymoLogo";
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
} from "lucide-react";

// ─── Fake candlestick data for hero mockup ────────────────────────────────────
const CANDLES_A = [
  { o: 52, h: 58, l: 49, c: 56 },
  { o: 56, h: 60, l: 53, c: 54 },
  { o: 54, h: 57, l: 50, c: 51 },
  { o: 51, h: 55, l: 48, c: 53 },
  { o: 53, h: 62, l: 52, c: 60 },
  { o: 60, h: 65, l: 57, c: 58 },
  { o: 58, h: 63, l: 55, c: 62 },
  { o: 62, h: 68, l: 60, c: 65 },
  { o: 65, h: 70, l: 62, c: 63 },
  { o: 63, h: 67, l: 59, c: 66 },
];
const CANDLES_B = [
  { o: 48, h: 54, l: 45, c: 50 },
  { o: 50, h: 56, l: 47, c: 53 },
  { o: 53, h: 58, l: 50, c: 52 },
  { o: 52, h: 55, l: 46, c: 48 },
  { o: 48, h: 52, l: 44, c: 51 },
  { o: 51, h: 57, l: 49, c: 55 },
  { o: 55, h: 60, l: 52, c: 57 },
  { o: 57, h: 62, l: 54, c: 56 },
  { o: 56, h: 61, l: 53, c: 59 },
  { o: 59, h: 64, l: 56, c: 62 },
];

function MiniCandlestick({ candles }: { candles: typeof CANDLES_A }) {
  const min = Math.min(...candles.map((c) => c.l));
  const max = Math.max(...candles.map((c) => c.h));
  const range = max - min || 1;
  const W = 180;
  const H = 72;
  const pad = 4;
  const candleW = 12;
  const gap = (W - pad * 2 - candleW * candles.length) / (candles.length - 1);

  const toY = (v: number) => H - pad - ((v - min) / range) * (H - pad * 2);

  // MA line
  const closes = candles.map((c) => c.c);
  const maPoints = closes
    .map((_, i) => {
      const slice = closes.slice(Math.max(0, i - 2), i + 1);
      return slice.reduce((a, b) => a + b, 0) / slice.length;
    })
    .map((v, i) => `${pad + i * (candleW + gap) + candleW / 2},${toY(v)}`)
    .join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full">
      {/* MA line */}
      <polyline
        points={maPoints}
        fill="none"
        stroke="rgba(255,255,255,0.5)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {candles.map((c, i) => {
        const x = pad + i * (candleW + gap);
        const bull = c.c >= c.o;
        const bodyTop = toY(Math.max(c.o, c.c));
        const bodyBot = toY(Math.min(c.o, c.c));
        const bodyH = Math.max(bodyBot - bodyTop, 2);
        const cx = x + candleW / 2;
        return (
          <g key={i}>
            <line
              x1={cx} y1={toY(c.h)}
              x2={cx} y2={toY(c.l)}
              stroke={bull ? "#4ade80" : "#f87171"}
              strokeWidth="1"
            />
            <rect
              x={x} y={bodyTop}
              width={candleW} height={bodyH}
              rx="1.5"
              fill={bull ? "#4ade80" : "#f87171"}
            />
          </g>
        );
      })}
    </svg>
  );
}

function CompanyCard({
  label,
  sector,
  candles,
  onSelect,
  selected,
}: {
  label: string;
  sector: string;
  candles: typeof CANDLES_A;
  onSelect: () => void;
  selected: boolean;
}) {
  return (
    <button
      onClick={onSelect}
      className="flex-1 rounded-2xl p-4 flex flex-col gap-3 transition-all duration-300 text-left"
      style={{
        background: selected
          ? "oklch(0.30 0.12 160)"
          : "oklch(0.20 0.08 160)",
        border: selected
          ? "2px solid oklch(0.58 0.16 155)"
          : "2px solid oklch(0.28 0.10 160)",
        boxShadow: selected
          ? "0 0 24px oklch(0.58 0.16 155 / 0.3)"
          : "none",
        transform: selected ? "scale(1.02)" : "scale(1)",
      }}
    >
      <div className="flex items-center justify-between">
        <span className="text-white font-bold text-sm">{label}</span>
        <span
          className="text-xs px-2 py-0.5 rounded-full font-semibold"
          style={{ background: "oklch(0.58 0.16 155 / 0.25)", color: "#4ade80" }}
        >
          {sector}
        </span>
      </div>
      <div className="h-[72px]">
        <MiniCandlestick candles={candles} />
      </div>
      <div
        className="w-full py-2 rounded-xl text-center text-sm font-bold transition-all duration-200"
        style={{
          background: selected ? "oklch(0.58 0.16 155)" : "oklch(0.35 0.12 160)",
          color: "white",
        }}
      >
        {selected ? "✓ Selected" : "Select"}
      </div>
    </button>
  );
}

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
  const { isAuthenticated } = useAuth();
  const { data: todayGame } = trpc.games.getToday.useQuery();
  const [activeCard, setActiveCard] = useState(0);
  const [selectedCompany, setSelectedCompany] = useState<"A" | "B" | null>(null);
  const touchStartX = useRef<number | null>(null);

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
                Daily Stock Market Training Game
              </div>

              {/* Hook */}
              <p
                className="font-display italic mb-2 animate-fade-up"
                style={{
                  color: "var(--color-muted)",
                  fontSize: "clamp(1.1rem, 2.5vw, 1.4rem)",
                  animationDelay: "40ms",
                }}
              >
                eeny meeny...
              </p>

              {/* Logo — large wordmark as the hero headline */}
              <div className="animate-fade-up mb-2" style={{ animationDelay: "80ms" }}>
                <p
                  className="text-sm font-semibold tracking-widest uppercase mb-3"
                  style={{ color: "var(--color-muted)" }}
                >
                  Introducing
                </p>
                <MunymoLogo height={64} className="mb-1" />
              </div>

              {/* Body copy — tight, punchy */}
              <div
                className="space-y-3 mb-8 animate-fade-up"
                style={{ animationDelay: "140ms" }}
              >
                <p
                  className="text-base leading-relaxed font-medium"
                  style={{ color: "var(--color-foreground)" }}
                >
                  Not a guessing game.
                </p>
                <p
                  className="text-base leading-relaxed"
                  style={{ color: "var(--color-muted)" }}
                >
                  A daily training game with one simple question: who will
                  perform better today — Company A or Company B?
                </p>
                <p
                  className="text-base leading-relaxed"
                  style={{ color: "var(--color-muted)" }}
                >
                  Study the research. Make your pick. Learn from the result.
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
                  <SignInButton mode="modal">
                    <button className="btn-gold text-sm px-7 py-3">
                      Start Playing — It's Free
                      <ArrowRight size={16} />
                    </button>
                  </SignInButton>
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
              {todayGame ? (
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
                /* Demo card mockup when no live game */
                <div className="w-full max-w-xs">
                  <p
                    className="text-xs font-bold uppercase tracking-widest mb-4 text-center"
                    style={{ color: "var(--color-subtle)" }}
                  >
                    Today's Matchup
                  </p>
                  <div
                    className="rounded-3xl p-5 flex flex-col gap-4"
                    style={{
                      background: "oklch(0.15 0.06 160)",
                      border: "1.5px solid oklch(0.28 0.10 160)",
                      boxShadow: "0 20px 60px oklch(0.10 0.08 160 / 0.5)",
                    }}
                  >
                    <div className="flex gap-3">
                      <CompanyCard
                        label="Company A"
                        sector="Tech"
                        candles={CANDLES_A}
                        selected={selectedCompany === "A"}
                        onSelect={() =>
                          setSelectedCompany((p) => (p === "A" ? null : "A"))
                        }
                      />
                      <CompanyCard
                        label="Company B"
                        sector="Tech"
                        candles={CANDLES_B}
                        selected={selectedCompany === "B"}
                        onSelect={() =>
                          setSelectedCompany((p) => (p === "B" ? null : "B"))
                        }
                      />
                    </div>
                    {selectedCompany && (
                      <div
                        className="text-center text-xs py-2 rounded-xl font-semibold animate-fade-up"
                        style={{ background: "oklch(0.58 0.16 155 / 0.15)", color: "#4ade80" }}
                      >
                        Good instinct. Now read the research →
                      </div>
                    )}
                  </div>
                  <p
                    className="text-xs text-center mt-4"
                    style={{ color: "var(--color-subtle)" }}
                  >
                    Try clicking a card ↑
                  </p>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Mobile hero card — shown below copy on small screens */}
        <div className="lg:hidden container pb-12">
          <div
            className="rounded-3xl p-5 flex flex-col gap-4 mx-auto max-w-sm"
            style={{
              background: "oklch(0.15 0.06 160)",
              border: "1.5px solid oklch(0.28 0.10 160)",
              boxShadow: "0 20px 60px oklch(0.10 0.08 160 / 0.5)",
            }}
          >
            <div className="flex gap-3">
              <CompanyCard
                label="Company A"
                sector="Tech"
                candles={CANDLES_A}
                selected={selectedCompany === "A"}
                onSelect={() =>
                  setSelectedCompany((p) => (p === "A" ? null : "A"))
                }
              />
              <CompanyCard
                label="Company B"
                sector="Tech"
                candles={CANDLES_B}
                selected={selectedCompany === "B"}
                onSelect={() =>
                  setSelectedCompany((p) => (p === "B" ? null : "B"))
                }
              />
            </div>
            {selectedCompany && (
              <div
                className="text-center text-xs py-2 rounded-xl font-semibold animate-fade-up"
                style={{ background: "oklch(0.58 0.16 155 / 0.15)", color: "#4ade80" }}
              >
                Good instinct. Now read the research →
              </div>
            )}
          </div>
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

            <div className="grid md:grid-cols-4 gap-8">
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
                  body: "Charts, financial metrics, and an AI-curated research brief.",
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
                  className="flex flex-col items-center text-center md:items-start md:text-left animate-fade-up"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  {/* Step circle */}
                  <div className="relative mb-5">
                    <div
                      className="w-[4.5rem] h-[4.5rem] rounded-full flex items-center justify-center"
                      style={{
                        background: "var(--color-brand-muted)",
                        border: "1px solid oklch(0.35 0.10 160 / 0.2)",
                      }}
                    >
                      <item.icon size={22} style={{ color: "var(--color-brand)" }} />
                    </div>
                    <span
                      className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                      style={{
                        background: "var(--color-gold)",
                        color: "white",
                      }}
                    >
                      {i + 1}
                    </span>
                  </div>
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
                    className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide"
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
          SECTION 6 — FINAL CTA
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
                <SignInButton mode="modal">
                  <button className="btn-gold text-sm px-8 py-3">
                    Start Playing Free
                    <ArrowRight size={16} />
                  </button>
                </SignInButton>
              </div>
            </div>
          </div>
        </section>
      )}

    </PublicLayout>
  );
}
