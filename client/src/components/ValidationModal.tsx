import { useState, useEffect, useRef } from "react";
import { CheckCircle2, XCircle, Timer, Loader2, ArrowRight } from "lucide-react";

/**
 * The timed Research Validation Question modal.
 *
 * Moved here VERBATIM from DailyGame so the live game and practice share one
 * implementation. Practice previously opened the question with no confirmation
 * step and no timer, which made the two flows behave differently — exactly the
 * drift that a second copy of this component would guarantee. The scoring
 * consequences (one attempt, timed, worth 20%) make divergence here worse than
 * a duplicated layout.
 */
export interface ValidationModalProps {
  phase: "confirm" | "question" | "result";
  question: {
    questionType: string;
    questionText: string;
    options?: string[] | null | undefined;
  } | null;
  onOpenQuestion: () => void;
  onSubmitAnswer: (answer: string, timeMs: number) => void;
  isSubmitting: boolean;
  result: { isCorrect: boolean; correctAnswer?: string } | null;
  onClose: () => void;
}

export function ValidationModal({
  phase,
  question,
  onOpenQuestion,
  onSubmitAnswer,
  isSubmitting,
  result,
  onClose,
}: ValidationModalProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<string>("");
  const [elapsedMs, setElapsedMs] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start timer when question phase begins
  useEffect(() => {
    if (phase === "question") {
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setElapsedMs(Date.now() - (startTimeRef.current ?? Date.now()));
      }, 100);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase]);

  const handleSubmit = () => {
    if (!selectedAnswer) return;
    const timeMs = startTimeRef.current ? Date.now() - startTimeRef.current : 0;
    if (timerRef.current) clearInterval(timerRef.current);
    onSubmitAnswer(selectedAnswer, timeMs);
  };

  const bgColor =
    phase === "result"
      ? result?.isCorrect
        ? "oklch(0.35 0.12 145)"
        : "oklch(0.35 0.12 25)"
      : "var(--color-surface)";

  const textColor =
    phase === "result" ? "#fff" : "var(--color-foreground)";

  const options: string[] =
    question?.questionType === "multiple_choice"
      ? (question.options ?? [])
      : question?.questionType === "yes_no"
      ? ["Yes", "No"]
      : ["True", "False"];

  // Result phase: full-screen takeover so it can't be missed or accidentally dismissed
  if (phase === "result" && result) {
    const isCorrect = result.isCorrect;
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center p-8"
        style={{
          background: isCorrect ? "oklch(0.28 0.12 145)" : "oklch(0.28 0.12 25)",
          color: "#fff",
        }}
      >
        <div className="text-center max-w-sm">
          {isCorrect ? (
            <CheckCircle2 size={80} className="mx-auto mb-6" style={{ color: "oklch(0.85 0.18 145)" }} />
          ) : (
            <XCircle size={80} className="mx-auto mb-6" style={{ color: "oklch(0.85 0.18 25)" }} />
          )}
          <h2 className="font-display text-4xl font-bold mb-4">
            {isCorrect ? "Correct!" : "Incorrect"}
          </h2>
          {isCorrect ? (
            <p className="text-lg mb-8" style={{ color: "oklch(0.9 0.06 145)" }}>
              Well done — your research paid off. Your validation bonus has been added to your score.
            </p>
          ) : (
            <div className="mb-8">
              <p className="text-base mb-4" style={{ color: "oklch(0.9 0.06 25)" }}>
                {result.correctAnswer
                  ? "Not quite. The correct answer was:"
                  : "Not quite. The correct answer will be revealed when results are published."}
              </p>
              {result.correctAnswer && (
                <div
                  className="inline-block px-6 py-3 rounded-xl font-bold text-lg"
                  style={{ background: "oklch(0.2 0.1 25)", color: "#fff", border: "1px solid oklch(0.5 0.15 25)" }}
                >
                  {result.correctAnswer}
                </div>
              )}
            </div>
          )}
          <button
            className="w-full py-4 rounded-2xl font-bold text-lg transition-all active:scale-95"
            style={{
              background: "oklch(1 0 0 / 0.2)",
              color: "#fff",
              border: "2px solid oklch(1 0 0 / 0.4)",
            }}
            onClick={onClose}
          >
            Continue →
          </button>
        </div>
      </div>
    );
  }

  return (
    // Overlay — pointer-events blocked to prevent navigation
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "oklch(0 0 0 / 0.7)" }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div
        className="w-full max-w-md rounded-2xl p-8 shadow-2xl transition-colors duration-500"
        style={{ background: bgColor, color: textColor }}
      >
        {/* ── Phase: Confirm ── */}
        {phase === "confirm" && (
          <>
            <div className="flex items-center gap-3 mb-5">
              <CheckCircle2 size={28} style={{ color: "var(--color-success)" }} />
              <h3 className="font-display text-xl" style={{ color: "var(--color-foreground)" }}>
                Selection Confirmed
              </h3>
            </div>
            <p className="text-sm mb-2" style={{ color: "var(--color-muted)" }}>
              Your final company selection has been locked in.
            </p>
            <div
              className="rounded-xl p-4 mb-6"
              style={{
                background: "var(--color-surface-raised)",
                border: "1px solid var(--color-warning)",
              }}
            >
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "var(--color-warning)" }}>
                ⚠ Important — Read Before Continuing
              </p>
              <p className="text-sm" style={{ color: "var(--color-foreground)" }}>
                A <strong>Research Validation Question</strong> worth{" "}
                <strong>20% of your daily score</strong> will open when you press the button below.
              </p>
              <ul className="mt-3 text-sm space-y-1.5" style={{ color: "var(--color-muted)" }}>
                <li>• You have <strong>one attempt only</strong> — no second chances</li>
                <li>• Your answer will be <strong>timed</strong> — faster correct answers score higher</li>
                <li>• <strong>Do not close this window</strong> or navigate away once the question opens</li>
              </ul>
            </div>
            <button
              className="btn-brand w-full justify-center"
              onClick={onOpenQuestion}
            >
              I Understand — Open the Question
              <ArrowRight size={16} />
            </button>
          </>
        )}

        {/* ── Phase: Question ── */}
        {phase === "question" && question && (
          <>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Timer size={18} style={{ color: "var(--color-brand)" }} />
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-brand)" }}>
                  Research Validation
                </span>
              </div>
              <span
                className="font-mono text-sm font-bold tabular-nums"
                style={{ color: elapsedMs > 30000 ? "var(--color-warning)" : "var(--color-muted)" }}
              >
                {(elapsedMs / 1000).toFixed(1)}s
              </span>
            </div>

            <p className="font-semibold mb-6" style={{ color: "var(--color-foreground)" }}>
              {question.questionText}
            </p>

            <div className={`flex flex-col gap-2 mb-6 ${question.questionType !== "multiple_choice" ? "flex-row" : ""}`}>
              {options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setSelectedAnswer(opt)}
                  className="px-4 py-3 rounded-xl text-sm font-semibold text-left transition-all"
                  style={{
                    background:
                      selectedAnswer === opt
                        ? "var(--color-brand)"
                        : "var(--color-surface-raised)",
                    color:
                      selectedAnswer === opt
                        ? "var(--color-brand-foreground)"
                        : "var(--color-foreground)",
                    border: `1px solid ${selectedAnswer === opt ? "var(--color-brand)" : "var(--color-border)"}`,
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>

            <div
              className="rounded-lg px-3 py-2 mb-5 text-xs"
              style={{ background: "var(--color-surface-raised)", color: "var(--color-muted)" }}
            >
              ⚠ Do not close this window or navigate away — your answer will be lost
            </div>

            <button
              className="btn-brand w-full justify-center"
              disabled={!selectedAnswer || isSubmitting}
              onClick={handleSubmit}
            >
              {isSubmitting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>Submit Answer</>
              )}
            </button>
          </>
        )}

        {/* Result phase is now handled as a full-screen early return above */}
      </div>
    </div>
  );
}
