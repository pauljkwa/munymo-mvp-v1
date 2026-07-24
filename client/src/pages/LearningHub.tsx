import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { usePageMeta } from "@/hooks/usePageMeta";
import PublicLayout from "@/components/PublicLayout";
import { Progress } from "@/components/ui/progress";
import { ALL_LEVELS } from "@/content/lessons";
import { Link } from "wouter";
import { useState } from "react";
import { GraduationCap, ChevronDown, CheckCircle2, Award } from "lucide-react";

export default function LearningHub() {
  usePageMeta({
    title: "Learn Stock Market Basics by Playing | Munymo Learning Hub",
    description:
      "Short lessons on stock market basics, analysis, and investing concepts — built to pair with Munymo's free daily stock market game.",
  });
  const { isAuthenticated } = useAuth();
  const { data: progress } = trpc.learn.getProgress.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const completedIds = new Set((progress ?? []).map((p) => p.lessonId));

  const [openLevel, setOpenLevel] = useState<number | null>(null);

  return (
    <PublicLayout>
      <div className="container py-10 max-w-3xl mx-auto">
        <div className="mb-8 animate-fade-up">
          <div className="flex items-center gap-3 mb-2">
            <GraduationCap size={28} style={{ color: "var(--color-brand)" }} />
            <h1 className="font-display text-3xl" style={{ color: "var(--color-foreground)" }}>
              Learning Hub
            </h1>
          </div>
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            Learn to read the market, one game day at a time — free for everyone.
          </p>
        </div>

        <div className="flex flex-col gap-3 animate-fade-up delay-75">
          {ALL_LEVELS.map((level) => {
            const hasLessons = level.lessons.length > 0;
            const completedInLevel = level.lessons.filter((l) => completedIds.has(l.id)).length;
            const isOpen = openLevel === level.level;

            return (
              <div
                key={level.level}
                className="card-glass overflow-hidden"
                style={!hasLessons ? { opacity: 0.6 } : undefined}
              >
                <button
                  type="button"
                  onClick={() => hasLessons && setOpenLevel(isOpen ? null : level.level)}
                  disabled={!hasLessons}
                  className="w-full p-5 flex items-center justify-between gap-4 text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                        style={{ background: "var(--color-brand-muted)", color: "var(--color-brand)" }}
                      >
                        Level {level.level}
                      </span>
                      {!hasLessons && (
                        <span className="text-xs" style={{ color: "var(--color-subtle)" }}>
                          Coming soon
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold leading-snug" style={{ color: "var(--color-foreground)" }}>
                      {level.title}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--color-subtle)" }}>
                      {level.goal}
                    </p>
                    {hasLessons && (
                      <div className="mt-3 max-w-[220px]">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs" style={{ color: "var(--color-muted)" }}>
                            {level.lessons.length} lesson{level.lessons.length === 1 ? "" : "s"}
                          </span>
                          {isAuthenticated && (
                            <span className="text-xs font-semibold" style={{ color: "var(--color-brand)" }}>
                              {completedInLevel} of {level.lessons.length}
                            </span>
                          )}
                        </div>
                        {isAuthenticated && (
                          <Progress value={(completedInLevel / level.lessons.length) * 100} />
                        )}
                      </div>
                    )}
                  </div>
                  {hasLessons && (
                    <ChevronDown
                      size={18}
                      className="shrink-0 transition-transform duration-200"
                      style={{
                        color: "var(--color-subtle)",
                        transform: isOpen ? "rotate(180deg)" : "none",
                      }}
                    />
                  )}
                </button>

                {isOpen && hasLessons && (
                  <div style={{ borderTop: "1px solid var(--color-border)" }}>
                    {level.lessons.map((lesson) => (
                      <Link
                        key={lesson.id}
                        href={`/learn/${lesson.id}`}
                        className="flex items-center justify-between gap-3 px-5 py-3 text-sm transition-colors hover:bg-[var(--color-surface-raised)]"
                        style={{ borderBottom: "1px solid var(--color-border)" }}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <span className="text-xs shrink-0" style={{ color: "var(--color-subtle)" }}>
                            {lesson.order}.
                          </span>
                          <span className="truncate" style={{ color: "var(--color-foreground)" }}>
                            {lesson.title}
                          </span>
                          {lesson.isCapstone && (
                            <span
                              className="inline-flex items-center gap-1 text-[0.625rem] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0"
                              style={{ background: "var(--color-brand)", color: "#fff" }}
                            >
                              <Award size={9} /> Capstone
                            </span>
                          )}
                        </span>
                        {completedIds.has(lesson.id) && (
                          <CheckCircle2 size={16} className="shrink-0" style={{ color: "var(--color-success)" }} />
                        )}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </PublicLayout>
  );
}
