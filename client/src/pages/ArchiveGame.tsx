import { trpc } from "@/lib/trpc";
import { withReferralParams } from "@/lib/utils";
import { useParams } from "wouter";
import PublicLayout from "@/components/PublicLayout";
import { Link } from "wouter";
import { ArrowLeft, Trophy, BookOpen, Users, Loader2, HelpCircle, Lightbulb, ExternalLink } from "lucide-react";
import { MetricExplanationSheet } from "@/components/MetricExplanationSheet";

export default function ArchiveGame() {
  const { id } = useParams<{ id: string }>();
  const gameId = parseInt(id ?? "0", 10);

  const { data: game, isLoading } = trpc.games.getById.useQuery({ id: gameId });
  const { data: research } = trpc.games.getResearch.useQuery(
    { gameId },
    { enabled: !!gameId }
  );
  const { data: communityStats } = trpc.games.getCommunityStats.useQuery({ gameId });
  const { data: validationQ } = trpc.games.getValidationQuestion.useQuery({ gameId });
  // Fire-and-forget: log clicks on the source-article link for referral reporting.
  const recordOutboundClick = trpc.games.recordOutboundClick.useMutation();

  if (isLoading) {
    return (
      <PublicLayout>
        <div className="container py-24 flex justify-center">
          <Loader2 size={28} className="animate-spin" style={{ color: "var(--color-brand)" }} />
        </div>
      </PublicLayout>
    );
  }

  if (!game) {
    return (
      <PublicLayout>
        <div className="container py-24 text-center">
          <p style={{ color: "var(--color-muted)" }}>Game not found.</p>
          <Link href="/research" className="btn-ghost mt-4 inline-flex">
            <ArrowLeft size={14} /> Back to Research Hub
          </Link>
        </div>
      </PublicLayout>
    );
  }

  const winnerName = game.winner === "A" ? game.companyAName : game.companyBName;
  const winnerTicker = game.winner === "A" ? game.companyATicker : game.companyBTicker;

  return (
    <PublicLayout>
      <div className="container py-10 max-w-3xl mx-auto">
        <Link href="/research" className="btn-ghost text-sm mb-6 inline-flex">
          <ArrowLeft size={14} /> Research Hub
        </Link>

        {/* Game header */}
        <div className="mb-6 animate-fade-up">
          <div className="flex items-center gap-2 mb-3">
            <span className="ticker-chip">{game.companyATicker}</span>
            <span className="text-sm" style={{ color: "var(--color-subtle)" }}>vs</span>
            <span className="ticker-chip">{game.companyBTicker}</span>
            <span className="ml-auto text-xs" style={{ color: "var(--color-subtle)" }}>
              {game.gameDate}
            </span>
          </div>
          <h1 className="font-display text-2xl mb-1" style={{ color: "var(--color-foreground)" }}>
            {game.companyAName} vs {game.companyBName}
          </h1>
          {game.sector && (
            <p className="text-sm" style={{ color: "var(--color-subtle)" }}>
              {game.sector}
            </p>
          )}
        </div>

        {/* Result */}
        {game.winner && (
          <div
            className="card-glass p-5 mb-5 flex items-center gap-4 animate-fade-up delay-75"
            style={{
              borderColor: "var(--color-brand)",
              background: "var(--color-success-muted)",
            }}
          >
            <Trophy size={24} style={{ color: "var(--color-brand)" }} />
            <div>
              <p className="text-xs uppercase tracking-wider mb-0.5" style={{ color: "var(--color-brand)" }}>
                Winner
              </p>
              <p className="font-semibold" style={{ color: "var(--color-foreground)" }}>
                {winnerTicker} — {winnerName}
              </p>
            </div>
          </div>
        )}

        {/* Research snapshot */}
        {research?.content && (
          <div className="card-glass p-6 mb-5 animate-fade-up delay-100">
            <div className="flex items-center gap-2 mb-4">
              <BookOpen size={16} style={{ color: "var(--color-brand)" }} />
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-brand)" }}>
                Research Snapshot
                {research.isSnapshot && (
                  <span className="ml-2 text-xs font-normal" style={{ color: "var(--color-subtle)" }}>
                    (archived at close)
                  </span>
                )}
              </p>
            </div>
            {game.pairingRationale && (
              <div className="mb-4">
                <p className="text-xs font-semibold mb-1" style={{ color: "var(--color-subtle)" }}>
                  Pairing Rationale
                </p>
                <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                  {game.pairingRationale}
                </p>
                {game.sourceUrl && (
                  <a
                    href={withReferralParams(game.sourceUrl)}
                    target="_blank"
                    onClick={() =>
                      recordOutboundClick.mutate({
                        gameId: game.id,
                        publisher: game.sourcePublisher ?? undefined,
                        sourceUrl: game.sourceUrl ?? undefined,
                      })
                    }
                    // Only "noopener" — deliberately NOT "noreferrer": we WANT
                    // the publisher to see munymo.com as the referrer so our
                    // outbound traffic shows up in their analytics.
                    rel="noopener"
                    className="inline-flex items-center gap-1 text-xs mt-2 hover:underline"
                    style={{ color: "var(--color-subtle)" }}
                  >
                    <ExternalLink size={12} />
                    Source: {game.sourcePublisher ?? "Read the article"}
                    {game.sourceTitle ? ` — "${game.sourceTitle}"` : ""}
                  </a>
                )}
              </div>
            )}
            <div className="prose-munymo text-sm whitespace-pre-wrap">
              {research.content}
            </div>
          </div>
        )}

        {/* Key Metrics with explanations */}
        {research?.metrics && Object.keys(research.metrics as Record<string, string>).length > 0 && (
          <div className="card-glass p-6 mb-5 animate-fade-up delay-125">
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--color-brand)" }}>
              Key Metrics
            </p>
            <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--color-border)" }}>
              <table className="w-full text-sm">
                <tbody>
                  {Object.entries(research.metrics as Record<string, string>).map(([label, value], i, arr) => (
                    <tr
                      key={label}
                      style={{
                        borderBottom: i < arr.length - 1 ? "1px solid var(--color-border)" : undefined,
                        background: i % 2 === 0 ? "var(--color-surface)" : "transparent",
                      }}
                    >
                      <td className="px-4 py-2.5 font-medium" style={{ color: "var(--color-muted)" }}>
                        <div>{label}</div>
                        <MetricExplanationSheet metricLabel={label} />
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold" style={{ color: "var(--color-foreground)" }}>{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Validation question + answer */}
        {validationQ && (
          <div className="card-glass p-5 mb-5 animate-fade-up delay-150">
            <div className="flex items-center gap-2 mb-3">
              <HelpCircle size={16} style={{ color: "var(--color-brand)" }} />
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-brand)" }}>
                Validation Question
              </p>
            </div>
            <p className="text-sm font-medium mb-2" style={{ color: "var(--color-foreground)" }}>
              {validationQ.questionText}
            </p>
            <p className="text-sm" style={{ color: "var(--color-muted)" }}>
              Correct answer:{" "}
              <strong style={{ color: "var(--color-success)" }}>
                {validationQ.correctAnswer}
              </strong>
            </p>
          </div>
        )}

        {/* Hindsight Spotlight */}
        {research?.hindsightSpotlight && (
          <div
            className="card-glass p-6 mb-5 animate-fade-up delay-175"
            style={{ borderColor: "oklch(0.65 0.18 145)", background: "oklch(0.97 0.02 145 / 0.4)" }}
          >
            <div className="flex items-center gap-3 mb-4">
              <Lightbulb size={18} style={{ color: "oklch(0.55 0.18 145)" }} />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "oklch(0.55 0.18 145)" }}>
                  Hindsight Spotlight
                </p>
                <p className="text-xs" style={{ color: "var(--color-subtle)" }}>
                  20/20 hindsight — the full picture after the result
                </p>
              </div>
            </div>
            <div className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--color-muted)" }}>
              {research.hindsightSpotlight}
            </div>
          </div>
        )}

        {/* Commentary */}
        {game.resultCommentary && (
          <div className="card-glass p-6 mb-5 animate-fade-up delay-200">
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--color-brand)" }}>
              Educational Commentary
            </p>
            <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--color-muted)" }}>
              {game.resultCommentary}
            </p>
          </div>
        )}

        {/* Community stats */}
        {communityStats && (
          <div className="card-glass p-6 animate-fade-up delay-200">
            <div className="flex items-center gap-2 mb-4">
              <Users size={16} style={{ color: "var(--color-brand)" }} />
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-brand)" }}>
                Community Statistics
              </p>
              <span className="ml-auto text-xs" style={{ color: "var(--color-subtle)" }}>
                {communityStats.totalParticipants} participants
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-xs mb-2" style={{ color: "var(--color-subtle)" }}>
                  Gut picks — {game.companyATicker}
                </p>
                <div className="h-2 rounded-full overflow-hidden mb-1" style={{ background: "var(--color-surface-raised)" }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${parseFloat(communityStats.gutPctA)}%`, background: "var(--color-brand)" }}
                  />
                </div>
                <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                  {parseFloat(communityStats.gutPctA).toFixed(1)}% / {parseFloat(communityStats.gutPctB).toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-xs mb-2" style={{ color: "var(--color-subtle)" }}>
                  Final picks — {game.companyATicker}
                </p>
                <div className="h-2 rounded-full overflow-hidden mb-1" style={{ background: "var(--color-surface-raised)" }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${parseFloat(communityStats.finalPctA)}%`, background: "var(--color-brand)" }}
                  />
                </div>
                <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                  {parseFloat(communityStats.finalPctA).toFixed(1)}% / {parseFloat(communityStats.finalPctB).toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-xs mb-2" style={{ color: "var(--color-subtle)" }}>
                  Validation correct
                </p>
                <div className="h-2 rounded-full overflow-hidden mb-1" style={{ background: "var(--color-surface-raised)" }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${parseFloat(communityStats.validationCorrectPct)}%`, background: "var(--color-success)" }}
                  />
                </div>
                <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                  {parseFloat(communityStats.validationCorrectPct).toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
