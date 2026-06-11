import { trpc } from "@/lib/trpc";
import PublicLayout from "@/components/PublicLayout";
import { Link } from "wouter";
import { BookOpen, ArrowRight, Loader2, Calendar } from "lucide-react";

export default function ResearchHub() {
  const { data: games, isLoading } = trpc.games.listArchive.useQuery({ limit: 30, offset: 0 });

  return (
    <PublicLayout>
      <div className="container py-10 max-w-3xl mx-auto">
        <div className="mb-8 animate-fade-up">
          <div className="flex items-center gap-3 mb-2">
            <BookOpen size={28} style={{ color: "var(--color-brand)" }} />
            <h1 className="font-display text-3xl" style={{ color: "var(--color-foreground)" }}>
              Research Hub
            </h1>
          </div>
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            Completed games with original research snapshots, results, and community statistics.
            A permanent archive for ongoing learning.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={28} className="animate-spin" style={{ color: "var(--color-brand)" }} />
          </div>
        ) : !games || games.length === 0 ? (
          <div className="card-glass p-12 text-center">
            <BookOpen size={40} className="mx-auto mb-4" style={{ color: "var(--color-subtle)" }} />
            <p className="font-medium mb-2" style={{ color: "var(--color-foreground)" }}>
              No archived games yet
            </p>
            <p className="text-sm" style={{ color: "var(--color-muted)" }}>
              Completed games will appear here after results are published.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 animate-fade-up delay-75">
            {games.map((game) => (
              <Link
                key={game.id}
                href={`/research/${game.id}`}
                className="card-glass p-5 flex items-center justify-between gap-4 hover:border-[var(--color-brand)] transition-all duration-200 group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="ticker-chip">{game.companyATicker}</span>
                    <span className="text-xs" style={{ color: "var(--color-subtle)" }}>vs</span>
                    <span className="ticker-chip">{game.companyBTicker}</span>
                  </div>
                  <p className="text-sm font-medium truncate" style={{ color: "var(--color-foreground)" }}>
                    {game.companyAName} vs {game.companyBName}
                  </p>
                  {game.sector && (
                    <p className="text-xs mt-0.5" style={{ color: "var(--color-subtle)" }}>
                      {game.sector}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  <div className="text-right hidden sm:block">
                    <p className="text-xs" style={{ color: "var(--color-subtle)" }}>
                      Winner
                    </p>
                    <p className="text-sm font-semibold" style={{ color: "var(--color-brand)" }}>
                      {game.winner === "A" ? game.companyATicker : game.companyBTicker}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-xs" style={{ color: "var(--color-subtle)" }}>
                    <Calendar size={12} />
                    {game.gameDate}
                  </div>
                  <ArrowRight
                    size={16}
                    className="group-hover:translate-x-1 transition-transform"
                    style={{ color: "var(--color-subtle)" }}
                  />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
