import { useAuth } from "@/_core/hooks/useAuth";
import { SignInButton } from "@clerk/clerk-react";
import { trpc } from "@/lib/trpc";
import PublicLayout from "@/components/PublicLayout";
import { ALL_LEVELS } from "@/content/lessons";
import { Link, useParams } from "wouter";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Clock,
  Lightbulb,
  Award,
} from "lucide-react";

const ALL_LESSONS = ALL_LEVELS.flatMap((level) => level.lessons);

export default function LessonPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  // Keyed by lessonId so quiz state (answered/selected/result) resets when
  // navigating between lessons — the route param change alone doesn't remount.
  return <LessonView key={lessonId} lessonId={lessonId} />;
}

function LessonView({ lessonId }: { lessonId: string }) {
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();

  const lesson = ALL_LESSONS.find((l) => l.id === lessonId);
  const level = lesson ? ALL_LEVELS.find((lv) => lv.level === lesson.level) : undefined;

  const { data: progress } = trpc.learn.getProgress.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const alreadyCompleted = !!progress?.some((p) => p.lessonId === lessonId);

  const markComplete = trpc.learn.markComplete.useMutation({
    onSuccess: () => utils.learn.getProgress.invalidate(),
  });

  const [selectedAnswer, setSelectedAnswer] = useState<string>("");
  const [answered, setAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [markedComplete, setMarkedComplete] = useState(false);

  if (!lesson || !level) {
    return (
      <PublicLayout>
        <div className="container py-24 text-center max-w-3xl mx-auto">
          <h2 className="font-display mb-3" style={{ color: "var(--color-foreground)" }}>
            Lesson Not Found
          </h2>
          <Link href="/learn" className="text-sm font-semibold" style={{ color: "var(--color-brand)" }}>
            ← Back to Learning Hub
          </Link>
        </div>
      </PublicLayout>
    );
  }

  const options: string[] =
    lesson.quiz.questionType === "multiple_choice"
      ? lesson.quiz.options ?? []
      : ["True", "False"];

  const handleAnswer = (opt: string) => {
    if (answered) return;
    setSelectedAnswer(opt);
    const correct = opt === lesson.quiz.correctAnswer;
    setIsCorrect(correct);
    setAnswered(true);
    if (correct && isAuthenticated) {
      markComplete.mutate({ lessonId: lesson.id, quizCorrect: true });
      setMarkedComplete(true);
    }
  };

  const handleMarkComplete = () => {
    if (!isAuthenticated) return;
    markComplete.mutate({ lessonId: lesson.id, quizCorrect: isCorrect });
    setMarkedComplete(true);
  };

  const sortedLessons = [...level.lessons].sort((a, b) => a.order - b.order);
  const idx = sortedLessons.findIndex((l) => l.id === lesson.id);
  const prevLesson = idx > 0 ? sortedLessons[idx - 1] : null;
  const nextLesson = idx < sortedLessons.length - 1 ? sortedLessons[idx + 1] : null;

  return (
    <PublicLayout>
      <div className="container py-10 max-w-3xl mx-auto">
        <Link
          href="/learn"
          className="inline-flex items-center gap-1 text-xs font-semibold mb-6"
          style={{ color: "var(--color-brand)" }}
        >
          <ArrowLeft size={12} /> Back to Learning Hub
        </Link>

        <div className="mb-6 animate-fade-up">
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <span
              className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{ background: "var(--color-brand-muted)", color: "var(--color-brand)" }}
            >
              Level {lesson.level}
            </span>
            <span
              className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: "var(--color-surface-raised)", color: "var(--color-muted)" }}
            >
              <Clock size={11} /> ~3 min
            </span>
            {lesson.jargonTerm && (
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: "var(--color-surface-raised)", color: "var(--color-muted)" }}
              >
                New term: {lesson.jargonTerm}
              </span>
            )}
            {lesson.isCapstone && (
              <span
                className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                style={{ background: "var(--color-brand)", color: "#fff" }}
              >
                <Award size={11} /> Capstone
              </span>
            )}
            {(alreadyCompleted || markedComplete) && (
              <span
                className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: "oklch(0.9 0.06 145)", color: "oklch(0.35 0.12 145)" }}
              >
                <CheckCircle2 size={11} /> Completed
              </span>
            )}
          </div>
          <h1 className="font-display text-2xl" style={{ color: "var(--color-foreground)" }}>
            {lesson.title}
          </h1>
        </div>

        <div className="card-glass p-6 mb-6 animate-fade-up delay-75">
          <div className="prose-munymo text-sm whitespace-pre-wrap">{lesson.body}</div>
        </div>

        <div
          className="rounded-xl p-4 mb-6 flex items-start gap-3 animate-fade-up delay-75"
          style={{ background: "var(--color-brand)0d", border: "1px solid var(--color-brand)30" }}
        >
          <Lightbulb size={18} className="mt-0.5 shrink-0" style={{ color: "var(--color-brand)" }} />
          <div className="min-w-0">
            <p className="text-sm mb-2" style={{ color: "var(--color-foreground)" }}>
              {lesson.matchupHook}
            </p>
            <Link href="/game" className="text-xs font-semibold" style={{ color: "var(--color-brand)" }}>
              See it in today's matchup →
            </Link>
          </div>
        </div>

        {/* Quiz */}
        <div className="card-glass p-6 animate-fade-up delay-75">
          <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--color-brand)" }}>
            Quick Check
          </p>
          <p className="font-semibold mb-4" style={{ color: "var(--color-foreground)" }}>
            {lesson.quiz.questionText}
          </p>

          <div className="flex flex-col gap-2 mb-4">
            {options.map((opt) => {
              const isSelected = selectedAnswer === opt;
              const showAsCorrect = answered && opt === lesson.quiz.correctAnswer;
              const showAsWrong = answered && isSelected && opt !== lesson.quiz.correctAnswer;
              return (
                <button
                  key={opt}
                  type="button"
                  disabled={answered}
                  onClick={() => handleAnswer(opt)}
                  className="px-4 py-3 rounded-xl text-sm font-semibold text-left transition-all"
                  style={{
                    background: showAsCorrect
                      ? "oklch(0.9 0.06 145)"
                      : showAsWrong
                      ? "oklch(0.9 0.06 25)"
                      : isSelected
                      ? "var(--color-brand)"
                      : "var(--color-surface-raised)",
                    color: showAsCorrect
                      ? "oklch(0.3 0.1 145)"
                      : showAsWrong
                      ? "oklch(0.3 0.1 25)"
                      : isSelected
                      ? "var(--color-brand-foreground)"
                      : "var(--color-foreground)",
                    border: `1px solid ${
                      showAsCorrect
                        ? "oklch(0.6 0.15 145)"
                        : showAsWrong
                        ? "oklch(0.6 0.15 25)"
                        : "var(--color-border)"
                    }`,
                  }}
                >
                  {opt}
                </button>
              );
            })}
          </div>

          {answered && (
            <div
              className="rounded-lg p-4 mb-4 flex items-start gap-2"
              style={{
                background: isCorrect ? "oklch(0.95 0.03 145)" : "oklch(0.95 0.03 25)",
              }}
            >
              {isCorrect ? (
                <CheckCircle2 size={16} className="mt-0.5 shrink-0" style={{ color: "oklch(0.5 0.15 145)" }} />
              ) : (
                <XCircle size={16} className="mt-0.5 shrink-0" style={{ color: "oklch(0.5 0.15 25)" }} />
              )}
              <div>
                <p className="text-sm font-semibold mb-1" style={{ color: "var(--color-foreground)" }}>
                  {isCorrect ? "Correct!" : "Not quite."}
                </p>
                <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                  {lesson.quiz.explanation}
                </p>
              </div>
            </div>
          )}

          {answered && !isAuthenticated && (
            <div className="text-center">
              <SignInButton mode="modal">
                <button className="btn-brand" type="button">
                  Sign in to save your progress
                </button>
              </SignInButton>
            </div>
          )}

          {answered && isAuthenticated && !markedComplete && !alreadyCompleted && (
            <button className="btn-brand" type="button" onClick={handleMarkComplete}>
              Mark complete <ArrowRight size={16} />
            </button>
          )}

          {answered && isAuthenticated && (markedComplete || alreadyCompleted) && (
            <p className="text-sm font-semibold flex items-center gap-1.5" style={{ color: "var(--color-success)" }}>
              <CheckCircle2 size={16} /> Lesson complete
            </p>
          )}
        </div>

        {/* Prev / Next */}
        <div className="flex items-center justify-between mt-6 animate-fade-up delay-75">
          {prevLesson ? (
            <Link
              href={`/learn/${prevLesson.id}`}
              className="text-sm font-semibold inline-flex items-center gap-1"
              style={{ color: "var(--color-brand)" }}
            >
              <ArrowLeft size={14} /> {prevLesson.title}
            </Link>
          ) : (
            <span />
          )}
          {nextLesson && (
            <Link
              href={`/learn/${nextLesson.id}`}
              className="text-sm font-semibold inline-flex items-center gap-1"
              style={{ color: "var(--color-brand)" }}
            >
              {nextLesson.title} <ArrowRight size={14} />
            </Link>
          )}
        </div>
      </div>
    </PublicLayout>
  );
}
