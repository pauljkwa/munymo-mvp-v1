import { useAuth } from "@/_core/hooks/useAuth";
import MoByline from "@/components/MoByline";
import { SignInButton, SignUpButton } from "@clerk/clerk-react";
import { trpc } from "@/lib/trpc";
import { withReferralParams } from "@/lib/utils";
import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import PublicLayout from "@/components/PublicLayout";
import { usePageMeta } from "@/hooks/usePageMeta";
import { ChartSheet } from "@/components/ChartSheet";
import { MetricExplanationSheet } from "@/components/MetricExplanationSheet";
import { metricGroupInfo } from "@/lib/metricGroups";
import { selectLessonOfTheDay } from "@/lib/lessonOfTheDay";
import { ALL_LEVELS } from "@/content/lessons";
import { toast } from "sonner";
import { ValidationModal } from "@/components/ValidationModal";
import ResultReminderPrompt from "@/components/ResultReminderPrompt";
import MoreToPlay from "@/components/MoreToPlay";
import LeaderboardNamePrompt from "@/components/LeaderboardNamePrompt";
import { isStandalone } from "@/hooks/usePushNotifications";
import { trackEvent } from "@/lib/analytics";
import {
  type GuestPick,
  type ReplayStep,
  clearGuestPick,
  listGuestPicks,
  planReplay,
  pruneGuestPicks,
  readGuestPick,
  writeGuestPick,
} from "@/lib/guestPick";
import {
  Brain,
  BookOpen,
  CheckCircle2,
  Lock,
  ArrowRight,
  Clock,
  AlertCircle,
  TrendingUp,
  Loader2,
  Timer,
  Lightbulb,
  Trophy,
  BarChart2,
  X as XIcon,
  ExternalLink,
  GraduationCap,
  CalendarPlus,
} from "lucide-react";
import { downloadResultReminder } from "@/lib/calendar";

const ALL_LESSONS_FLAT = ALL_LEVELS.flatMap((level) => level.lessons);

type GameStep = "gut" | "research" | "final" | "submitted";

// ─── Timed Validation Modal ───────────────────────────────────────────────────


// ─── Main DailyGame Component ─────────────────────────────────────────────────

export default function DailyGame() {
  usePageMeta({ title: "Today's Game | Munymo" });
  const { isAuthenticated, likelyAuthenticated } = useAuth();
  // Guest play (references/guest-play-spec.md): a signed-out visitor plays
  // today's game with picks held in their browser. likelyAuthenticated uses
  // the stored sign-in hint until Clerk loads, so a returning player never
  // flashes the guest branch, and a new visitor can play at once even if
  // Clerk is slow or blocked.
  const isGuest = !isAuthenticated && !likelyAuthenticated;
  // A guest who keeps the tab open after picking gets the result without
  // reloading: once the result publishes, getToday moves on to the next game
  // and the "Your last pick" card shows how they did.
  const [guestWaiting, setGuestWaiting] = useState(false);
  const { data: game, isLoading } = trpc.games.getToday.useQuery(undefined, {
    refetchInterval: guestWaiting ? 2 * 60 * 1000 : false,
  });
  const { data: recentPublished } = trpc.games.listArchive.useQuery(
    { limit: 1, offset: 0 },
    { staleTime: 5 * 60 * 1000 }
  );
  const previousGame = recentPublished?.[0] ?? null;

  const { data: myPick, isLoading: isLoadingPick } = trpc.picks.getMyPick.useQuery(
    { gameId: game?.id ?? 0 },
    { enabled: !!game?.id && isAuthenticated }
  );

  const { data: research } = trpc.games.getResearch.useQuery(
    { gameId: game?.id ?? 0 },
    { enabled: !!game?.id }
  );

  const { data: validationQ } = trpc.games.getValidationQuestion.useQuery(
    { gameId: game?.id ?? 0 },
    { enabled: !!game?.id }
  );

  const { data: learnProgress } = trpc.learn.getProgress.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const [lessonCardDismissed, setLessonCardDismissed] = useState(false);
  useEffect(() => {
    if (!game?.gameDate) return;
    setLessonCardDismissed(localStorage.getItem(`learn-lod-dismissed-${game.gameDate}`) === "1");
  }, [game?.gameDate]);

  const lessonOfTheDay =
    game && research
      ? selectLessonOfTheDay({
          gameId: game.id,
          gameDate: game.gameDate,
          metrics: (research.metrics as Record<string, string>) ?? {},
          pairingRationale: game.pairingRationale ?? null,
          completedLessonIds: (learnProgress ?? []).map((p) => p.lessonId),
          lessons: ALL_LESSONS_FLAT,
        })
      : null;

  const dismissLessonCard = () => {
    if (!game?.gameDate) return;
    localStorage.setItem(`learn-lod-dismissed-${game.gameDate}`, "1");
    setLessonCardDismissed(true);
  };

  // Fire-and-forget: log clicks on the source-article link for referral reporting.
  const recordOutboundClick = trpc.games.recordOutboundClick.useMutation();

  const [step, setStep] = useState<GameStep>("gut");
  const [showFullResearch, setShowFullResearch] = useState(false);
  const researchNotesRef = useRef<HTMLDivElement>(null);

  const toggleFullResearch = (next: boolean) => {
    setShowFullResearch(next);
    requestAnimationFrame(() =>
      researchNotesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    );
  };

  const goToFinalStep = () => {
    setStep("final");
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  };

  const [gutSelection, setGutSelection] = useState<"A" | "B" | null>(null);
  const [finalSelection, setFinalSelection] = useState<"A" | "B" | null>(null);

  // Chart panel state (hoisted here because hooks can't be inside IIFEs)
  const [chartTicker, setChartTicker] = useState<string | null>(null);
  const [chartName, setChartName] = useState("");
  const [chartColor, setChartColor] = useState("#009050");

  // Validation modal state
  const [modalPhase, setModalPhase] = useState<"confirm" | "question" | "reveal" | "result" | null>(null);
  const [validationResult, setValidationResult] = useState<{ isCorrect: boolean; correctAnswer?: string } | null>(null);

  // Sync step with existing pick on load
  useEffect(() => {
    if (myPick?.finalSelection) setStep("submitted");
    else if (myPick?.gutSelection) setStep("research");
  }, [myPick]);

  // ── Guest play ──
  const [guestPick, setGuestPick] = useState<GuestPick | null>(null);
  const [lastGuestPick, setLastGuestPick] = useState<GuestPick | null>(null);
  useEffect(() => {
    setGuestWaiting(isGuest && Boolean(guestPick?.final));
  }, [isGuest, guestPick?.final]);
  const saveGuestPick = (next: GuestPick) => {
    writeGuestPick(next);
    setGuestPick(next);
  };

  // Restore a returning guest to where they left off.
  useEffect(() => {
    if (!game?.id) return;
    pruneGuestPicks(game.id);
    const stored = readGuestPick(game.id);
    setGuestPick(stored);
    setLastGuestPick(listGuestPicks().find((p) => p.gameId !== game.id && p.final) ?? null);
    if (!isGuest) return;
    if (!stored) {
      // A new game arrived while the tab was open (the old one published):
      // start the guest fresh on it.
      setStep("gut");
      setGutSelection(null);
      setFinalSelection(null);
      return;
    }
    setGutSelection(stored.gut);
    if (stored.final) {
      setFinalSelection(stored.final);
      setStep("submitted");
    } else {
      setStep("research");
    }
  }, [game?.id, isGuest]);

  // On sign-in, submit the guest's stored picks through the normal protected
  // mutations, so lockout and scoring stay server-enforced. The account's own
  // pick always wins (planReplay).
  const utils = trpc.useUtils();
  const replayGut = trpc.picks.submitGut.useMutation();
  const replayFinal = trpc.picks.submitFinal.useMutation();
  const replayValidation = trpc.picks.submitValidation.useMutation();
  const replayStarted = useRef(false);
  const [justConverted, setJustConverted] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || isLoadingPick || !game?.id || replayStarted.current) return;
    const stored = readGuestPick(game.id);
    if (!stored) return;
    replayStarted.current = true;
    const gameId = game.id;
    const steps = planReplay(stored, myPick);
    if (steps.length === 0) {
      clearGuestPick(gameId);
      setGuestPick(null);
      return;
    }
    (async () => {
      const done: ReplayStep[] = [];
      let quizCorrect: boolean | undefined;
      let failure: { message: string } | undefined;
      try {
        for (const stepName of steps) {
          if (stepName === "gut") await replayGut.mutateAsync({ gameId, selection: stored.gut });
          if (stepName === "final" && stored.final) await replayFinal.mutateAsync({ gameId, selection: stored.final });
          if (stepName === "validation" && stored.validationAnswer) {
            const r = await replayValidation.mutateAsync({
              gameId,
              answer: stored.validationAnswer,
              answerTimeMs: stored.answerTimeMs ?? 0,
            });
            quizCorrect = r.isCorrect;
          }
          done.push(stepName);
        }
      } catch (e) {
        failure = e as { message: string };
      }
      clearGuestPick(gameId);
      setGuestPick(null);
      await utils.picks.getMyPick.invalidate({ gameId });
      if (done.length === 0) {
        // Locked while they were deciding. A locked game with no pick sends
        // them on to /practice via the existing missed-game redirect.
        toast.error("Today's game locked before your pick could be saved. Your account is ready, so tomorrow's game counts.", { duration: 10000 });
        return;
      }
      trackEvent("guest_converted");
      setJustConverted(true);
      if (quizCorrect !== undefined && stored.quizCorrect === undefined) {
        // Answered before guests were shown the verdict: pause, then reveal.
        setValidationResult({ isCorrect: quizCorrect });
        setModalPhase("reveal");
      } else if (failure) {
        toast.error(failure.message);
      } else {
        toast.success("You're in! Your pick is locked in and will be scored at the close.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isLoadingPick, game?.id, myPick]);

  /**
   * Someone who arrives after lockout with no pick can't play today at all —
   * the old dead end was a locked game and "come back tomorrow", which is how
   * the first real signup was lost. Send them to the archive instead, where
   * there is something they CAN play right now.
   *
   * Deliberately only when they have NO gut selection: a player who already
   * picked is coming back to see their own game, and must not be hijacked.
   * Signed-out visitors are left alone too — they get the sign-in prompt, and
   * /practice would only bounce them to the same place.
   */
  const [, navigate] = useLocation();
  const cannotPlayToday =
    isAuthenticated &&
    !isLoadingPick &&
    Boolean(game) &&
    (game?.status === "locked" || game?.status === "result_published") &&
    !myPick?.gutSelection;

  useEffect(() => {
    if (cannotPlayToday) navigate("/practice?missed=1", { replace: true });
  }, [cannotPlayToday, navigate]);

  const submitGut = trpc.picks.submitGut.useMutation({
    onSuccess: () => {
      setStep("research");
      toast.success("Gut selection saved — now read the research.");
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const submitFinal = trpc.picks.submitFinal.useMutation({
    onSuccess: () => {
      // Open the validation confirmation modal
      if (validationQ) {
        setModalPhase("confirm");
      } else {
        setStep("submitted");
        toast.success("Final selection submitted. Good luck!");
      }
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const submitValidation = trpc.picks.submitValidation.useMutation({
    onSuccess: (data) => {
      setValidationResult({ isCorrect: data.isCorrect });
      setModalPhase("result");
    },
    onError: (e: { message: string }) => {
      toast.error(e.message);
      setModalPhase(null);
      setStep("submitted");
    },
  });

  const checkGuestAnswer = trpc.games.checkGuestAnswer.useMutation();

  const handleCloseModal = () => {
    setModalPhase(null);
    setStep("submitted");
    toast.success(isGuest ? "All done! Come back after the close to see if you were right." : "All done — your picks are locked in!");
  };

  if (isLoading) {
    return (
      <PublicLayout>
        <div className="container py-24 flex justify-center">
          <Loader2 size={32} className="animate-spin" style={{ color: "var(--color-brand)" }} />
        </div>
      </PublicLayout>
    );
  }

  // Wait for myPick to resolve before rendering the game UI so the step
  // doesn't flicker from "gut" to the correct step on navigation back
  if (isAuthenticated && isLoadingPick) {
    return (
      <PublicLayout>
        <div className="container py-24 flex justify-center">
          <Loader2 size={32} className="animate-spin" style={{ color: "var(--color-brand)" }} />
        </div>
      </PublicLayout>
    );
  }

  if (!game) {
    return (
      <PublicLayout>
        <div className="container py-24 text-center">
          <AlertCircle size={48} className="mx-auto mb-6" style={{ color: "var(--color-muted)" }} />
          <h2 className="font-display mb-3" style={{ color: "var(--color-foreground)" }}>
            No Game Today
          </h2>
          <p style={{ color: "var(--color-muted)" }}>
            There is no active game scheduled for today — usually a US market holiday. The next
            matchup goes live after the next trading session.
          </p>
          {/* Same alternatives as every other "nothing live" state; this was
              the one dead end left in the product. */}
          <div className="max-w-3xl mx-auto text-left mt-8">
            <MoreToPlay />
          </div>
        </div>
      </PublicLayout>
    );
  }

  const isLocked = game.status === "locked" || game.status === "result_published";
  const lockoutTime = game.lockoutAt ? new Date(game.lockoutAt) : null;
  // True only when the cron auto-submitted at lockout (finalSubmittedAt >= lockoutAt).
  // Using timing avoids false positives for players who rationally pick the same gut+final.
  const wasAutoSubmitted = (() => {
    if (!myPick?.finalSubmittedAt || !lockoutTime) return false;
    return new Date(myPick.finalSubmittedAt) >= lockoutTime;
  })();

  const stepLabels: GameStep[] = ["gut", "research", "final", "submitted"];
  const stepDisplayLabels = ["Gut Pick", "Research", "Final Pick", "Done"];
  const stepIndex = (s: GameStep) => stepLabels.indexOf(s);
  const currentIndex = stepIndex(step);

  return (
    <PublicLayout>
      {/* Chart Sheet — rendered at top level so fixed positioning covers full viewport on iOS */}
      {chartTicker && (
        <ChartSheet
          ticker={chartTicker}
          companyName={chartName}
          accentColor={chartColor}
          onClose={() => setChartTicker(null)}
        />
      )}

      {/* Timed Validation Modal — rendered outside normal flow */}
      {modalPhase && (
        <ValidationModal
          phase={modalPhase}
          question={validationQ ?? null}
          onOpenQuestion={() => setModalPhase("question")}
          onSubmitAnswer={(answer, timeMs) => {
            if (!game.id) return;
            if (isGuest && guestPick) {
              // Guests get the verdict straight away (2026-10-05); the answer
              // and time are kept so they count if the guest creates an account.
              const withAnswer = { ...guestPick, validationAnswer: answer, answerTimeMs: timeMs };
              checkGuestAnswer.mutate(
                { gameId: game.id, answer },
                {
                  onSuccess: ({ isCorrect }) => {
                    saveGuestPick({ ...withAnswer, quizCorrect: isCorrect });
                    setValidationResult({ isCorrect });
                    setModalPhase("result");
                  },
                  onError: () => {
                    saveGuestPick(withAnswer);
                    setModalPhase(null);
                    setStep("submitted");
                  },
                }
              );
              return;
            }
            submitValidation.mutate({ gameId: game.id, answer, answerTimeMs: timeMs });
          }}
          isSubmitting={submitValidation.isPending || checkGuestAnswer.isPending}
          result={validationResult}
          onClose={handleCloseModal}
          guest={isGuest}
          onReveal={() => setModalPhase("result")}
        />
      )}

      <div className="container py-10 max-w-3xl mx-auto">
        {isGuest && lastGuestPick && <LastGuestPickCard pick={lastGuestPick} />}

        {/* Header */}
        <div className="mb-8 animate-fade-up">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
            <h1 className="font-display text-3xl" style={{ color: "var(--color-foreground)" }}>
              Today's Matchup
            </h1>
            {isLocked ? (
              <span className="status-pill status-locked">
                <Lock size={11} /> Locked
              </span>
            ) : (
              <span className="status-pill status-active">
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                Live
              </span>
            )}
          </div>
          {lockoutTime && !isLocked && (
            <p className="text-sm" style={{ color: "var(--color-muted)" }}>
              <Clock size={13} className="inline -mt-0.5 mr-1.5" />
              {/* Weekend games lock days away — name the day whenever the lockout isn't today */}
              Locks {lockoutTime.toDateString() !== new Date().toDateString()
                ? `${lockoutTime.toLocaleDateString([], { weekday: "long" })} at`
                : "at"}{" "}
              {lockoutTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} your time{" "}
              <span className="whitespace-nowrap" style={{ color: "var(--color-subtle)" }}>
                ({lockoutTime.toLocaleString("en-US", {
                  ...(lockoutTime.toDateString() !== new Date().toDateString() ? { weekday: "short" } : {}),
                  hour: "numeric",
                  minute: "2-digit",
                  timeZone: "America/New_York",
                })} New York)
              </span>
            </p>
          )}
          {game.sector && (
            <p className="text-sm mt-1" style={{ color: "var(--color-subtle)" }}>
              Sector: {game.sector}
            </p>
          )}
        </div>

        {/* Installed iPhone/Android app: offer notifications on open, whatever
            the step. Someone who finished their picks in Safari and then
            installed would otherwise never be asked inside the app. */}
        {isAuthenticated && step !== "research" && isStandalone() && <ResultReminderPrompt />}

        {/* Progress steps */}
        <div className="flex items-center gap-2 mb-8 animate-fade-up delay-75">
          {stepLabels.map((s, i) => {
            const isDone = currentIndex > i;
            const isCurrent = currentIndex === i;
            return (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div className="flex flex-col items-center gap-1 flex-1">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                    style={{
                      background: isDone || isCurrent ? "var(--color-brand)" : "var(--color-surface-raised)",
                      color: isDone || isCurrent ? "var(--color-brand-foreground)" : "var(--color-subtle)",
                    }}
                  >
                    {isDone ? <CheckCircle2 size={14} /> : i + 1}
                  </div>
                  <span
                    className="text-xs hidden sm:block"
                    style={{ color: isCurrent ? "var(--color-brand)" : "var(--color-subtle)" }}
                  >
                    {stepDisplayLabels[i]}
                  </span>
                </div>
                {i < 3 && (
                  <div
                    className="h-px flex-1 mb-4"
                    style={{ background: isDone ? "var(--color-brand)" : "var(--color-border)" }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Company cards */}
        <div className="grid grid-cols-2 gap-4 mb-8 animate-fade-up delay-150">
          {(["A", "B"] as const).map((side) => {
            const name = side === "A" ? game.companyAName : game.companyBName;
            const ticker = side === "A" ? game.companyATicker : game.companyBTicker;
            const isGutSelected = gutSelection === side || myPick?.gutSelection === side;
            const isFinalSelected = finalSelection === side || myPick?.finalSelection === side;
            const showSelected =
              step === "submitted"
                ? isFinalSelected
                : step === "gut"
                ? isGutSelected
                : step === "final"
                ? isFinalSelected
                : isGutSelected;
            const canSelect = !isLocked && step !== "submitted" && step !== "research";

            return (
              <button
                key={side}
                disabled={!canSelect}
                onClick={() => {
                  if (step === "gut") setGutSelection(side);
                  if (step === "final") setFinalSelection(side);
                }}
                className="card-glass p-6 text-center transition-all duration-200"
                style={{
                  borderColor: showSelected ? "var(--color-brand)" : undefined,
                  boxShadow: showSelected
                    ? "0 0 0 2px var(--color-brand), 0 8px 32px oklch(0.78 0.14 75 / 0.2)"
                    : undefined,
                  cursor: canSelect ? "pointer" : "default",
                }}
              >
                <div className="ticker-chip mx-auto mb-3">{ticker}</div>
                <p className="font-semibold text-sm" style={{ color: "var(--color-foreground)" }}>
                  {name}
                </p>
                {showSelected && (
                  <div
                    className="mt-3 flex items-center justify-center gap-1 text-xs font-semibold"
                    style={{ color: "var(--color-brand)" }}
                  >
                    <CheckCircle2 size={13} /> Selected
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Step: Gut ── */}
        {step === "gut" && !isLocked && (
          <div className="card-glass p-6 animate-scale-in">
            <div className="flex items-center gap-3 mb-4">
              <Brain size={20} style={{ color: "var(--color-brand)" }} />
              <h3 style={{ color: "var(--color-foreground)" }}>Gut Selection</h3>
            </div>
            <p className="text-sm mb-6" style={{ color: "var(--color-muted)" }}>
              Before reading any research, pick the company you instinctively believe will
              outperform today. Your raw, unfiltered intuition.
            </p>
            <button
              className="btn-brand w-full justify-center"
              disabled={!gutSelection || submitGut.isPending || (!isAuthenticated && !isGuest)}
              onClick={() => {
                if (!gutSelection || !game.id) return;
                if (isGuest) {
                  saveGuestPick({ gameId: game.id, gut: gutSelection, savedAt: Date.now() });
                  trackEvent("guest_gut_pick");
                  setStep("research");
                  toast.success("Gut selection saved — now read the research.");
                  return;
                }
                submitGut.mutate({ gameId: game.id, selection: gutSelection });
              }}
            >
              {submitGut.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>Confirm Gut Selection <ArrowRight size={16} /></>
              )}
            </button>
          </div>
        )}

        {/* ── Step: Research ── */}
        {step === "research" && (
          <div className="animate-scale-in">
            {/* Asked here, right after the gut pick, because that is when the
                player has something riding on the result and is most likely to
                say yes — not on a settings page they may never open. */}
            {isAuthenticated && <ResultReminderPrompt />}
            <div className="card-glass p-6 mb-4">
              <div className="flex items-center gap-3 mb-4">
                <BookOpen size={20} style={{ color: "var(--color-brand)" }} />
                <div>
                  <h3 style={{ color: "var(--color-foreground)" }}>Research</h3>
                  <MoByline />
                </div>
              </div>
              {game.pairingRationale && (
                <div className="mb-5">
                  <p
                    className="text-xs font-semibold uppercase tracking-wider mb-2"
                    style={{ color: "var(--color-brand)" }}
                  >
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
              {research?.content ? (
                <div ref={researchNotesRef} className="scroll-mt-20">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-brand)" }}>
                      {research.researchSummary && !showFullResearch ? "Summary" : "Research Notes"}
                    </p>
                    {research.researchSummary && (
                      <button
                        type="button"
                        onClick={() => toggleFullResearch(!showFullResearch)}
                        className="text-xs font-semibold"
                        style={{ color: "var(--color-brand)" }}
                      >
                        {showFullResearch ? "← Show summary" : "Show full analysis →"}
                      </button>
                    )}
                  </div>
                  {research.researchSummary && !showFullResearch ? (
                    <div>
                      <div className="prose-munymo text-sm whitespace-pre-wrap">
                        {research.researchSummary}
                      </div>
                      <div
                        className="mt-4 rounded-xl p-3 flex items-start gap-2"
                        style={{ background: "var(--color-brand)0d", border: "1px solid var(--color-brand)30" }}
                      >
                        <Lightbulb size={14} className="mt-0.5 shrink-0" style={{ color: "var(--color-brand)" }} />
                        <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                          This is the beginner summary. Tap{" "}
                          <button
                            type="button"
                            onClick={() => toggleFullResearch(true)}
                            className="font-semibold underline"
                            style={{ color: "var(--color-brand)" }}
                          >
                            Show full analysis
                          </button>{" "}
                          for the complete research breakdown.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="prose-munymo text-sm whitespace-pre-wrap">
                      {research.content}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm" style={{ color: "var(--color-subtle)" }}>
                  No additional research notes provided for today's game.
                </p>
              )}

              {/* Company Cards: metrics + chart side by side */}
              {research?.metrics && (() => {
                // Split flat metrics array into per-company groups by ticker prefix
                const allMetrics = Object.entries(research.metrics as Record<string, string>);
                const tickerA = (game.companyATicker ?? "").toUpperCase();
                const tickerB = (game.companyBTicker ?? "").toUpperCase();

                // Match labels that start with the ticker followed by a space, dash, or em-dash
                const matchesTicker = (label: string, ticker: string) => {
                  const upper = label.toUpperCase();
                  return (
                    upper.startsWith(ticker + " ") ||
                    upper.startsWith(ticker + "—") ||
                    upper.startsWith(ticker + "-") ||
                    upper.startsWith(ticker + ":") ||
                    upper === ticker
                  );
                };

                let metricsA = allMetrics.filter(([label]) => matchesTicker(label, tickerA));
                let metricsB = allMetrics.filter(([label]) => matchesTicker(label, tickerB));

                // Fallback: if ticker matching fails (e.g. labels don't include ticker prefix),
                // split the list in half — first half to A, second half to B
                if (metricsA.length === 0 && metricsB.length === 0 && allMetrics.length > 0) {
                  const mid = Math.ceil(allMetrics.length / 2);
                  metricsA = allMetrics.slice(0, mid);
                  metricsB = allMetrics.slice(mid);
                }

                // Order both columns by metric group (The Long Game → Game-Day Setup)
                // so the rows pair up and group header bands can be inserted
                metricsA = [...metricsA].sort((a, b) => metricGroupInfo(a[0]).rank - metricGroupInfo(b[0]).rank);
                metricsB = [...metricsB].sort((a, b) => metricGroupInfo(a[0]).rank - metricGroupInfo(b[0]).rank);

                // Normalise metric labels to strip ticker prefix for display
                const shortLabel = (label: string, ticker: string) =>
                  label.replace(new RegExp(`^${ticker}\\s*[—\\-:]\\s*`, "i"), "");

                // Build a unified row list: [{label, valueA, valueB}]
                const metricLabelsA = metricsA.map(([l]) => shortLabel(l, tickerA));
                const metricLabelsB = metricsB.map(([l]) => shortLabel(l, tickerB));
                // Use the longer list as the row driver
                const rowCount = Math.max(metricLabelsA.length, metricLabelsB.length);
                const rows = Array.from({ length: rowCount }, (_, i) => ({
                  labelA: metricLabelsA[i] ?? "",
                  valueA: metricsA[i]?.[1] ?? "—",
                  rawLabelA: metricsA[i]?.[0] ?? "",
                  labelB: metricLabelsB[i] ?? "",
                  valueB: metricsB[i]?.[1] ?? "—",
                  rawLabelB: metricsB[i]?.[0] ?? "",
                  group: metricGroupInfo(metricsA[i]?.[0] ?? metricsB[i]?.[0] ?? ""),
                }));
                // Only show group header bands when the game actually spans
                // multiple groups (legacy games render exactly as before)
                const showGroupHeaders = new Set(rows.map((r) => r.group.id)).size > 1;

                return (
                  <>
                    <div className="mt-5">
                      <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--color-brand)" }}>
                        Key Metrics
                      </p>

                      {/* Two-column comparison table */}
                      <div
                        className="rounded-xl overflow-hidden"
                        style={{ border: "1px solid var(--color-border)", background: "var(--color-surface)" }}
                      >
                        {/* Column headers */}
                        <div
                          className="grid grid-cols-2"
                          style={{ borderBottom: "2px solid var(--color-border)", background: "var(--color-surface-raised)" }}
                        >
                          {[{ ticker: tickerA, name: game.companyAName ?? "", color: "#009050" }, { ticker: tickerB, name: game.companyBName ?? "", color: "#1d4ed8" }].map((co) => (
                            <div
                              key={co.ticker}
                              className="px-3 py-3 flex items-center gap-2"
                              style={{ borderRight: co.ticker === tickerA ? "1px solid var(--color-border)" : undefined }}
                            >
                              <span
                                className="ticker-chip shrink-0"
                                style={{ fontSize: "0.6rem", background: co.color, color: "#fff", borderColor: co.color }}
                              >
                                {co.ticker}
                              </span>
                              <span className="text-xs font-semibold leading-tight" style={{ color: "var(--color-foreground)" }}>
                                {co.name}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Metric rows, banded by group (The Long Game / Game-Day Setup) */}
                        {rows.map((row, i) => (
                          <div key={i}>
                          {showGroupHeaders && (i === 0 || rows[i - 1].group.id !== row.group.id) && (
                            <div
                              className="px-3 py-1.5 text-[0.625rem] font-bold uppercase tracking-widest"
                              style={{
                                color: "var(--color-brand)",
                                background: "var(--color-surface-raised)",
                                borderBottom: "1px solid var(--color-border)",
                                borderTop: i > 0 ? "2px solid var(--color-border)" : undefined,
                              }}
                            >
                              {row.group.title}
                            </div>
                          )}
                          <div
                            className="grid grid-cols-2"
                            style={{
                              borderBottom: i < rows.length - 1 ? "1px solid var(--color-border)" : undefined,
                              background: i % 2 === 0 ? "var(--color-surface)" : "var(--color-surface-raised)",
                            }}
                          >
                            {/* Company A cell */}
                            <div
                              className="px-3 py-2.5 flex flex-col gap-0.5"
                              style={{ borderRight: "1px solid var(--color-border)" }}
                            >
                              <p className="text-[0.625rem] font-semibold uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>
                                {row.labelA}
                              </p>
                              <p className="text-sm font-bold font-display" style={{ color: "var(--color-foreground)" }}>
                                {row.valueA}
                              </p>
                              {row.rawLabelA && <MetricExplanationSheet metricLabel={row.rawLabelA} />}
                            </div>
                            {/* Company B cell */}
                            <div className="px-3 py-2.5 flex flex-col gap-0.5">
                              <p className="text-[0.625rem] font-semibold uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>
                                {row.labelB}
                              </p>
                              <p className="text-sm font-bold font-display" style={{ color: "var(--color-foreground)" }}>
                                {row.valueB}
                              </p>
                              {row.rawLabelB && <MetricExplanationSheet metricLabel={row.rawLabelB} />}
                            </div>
                          </div>
                          </div>
                        ))}

                        {/* Chart CTAs */}
                        <div
                          className="grid grid-cols-2"
                          style={{ borderTop: "2px solid var(--color-border)", background: "var(--color-surface-raised)" }}
                        >
                          {[{ ticker: tickerA, name: game.companyAName ?? "", color: "#009050" }, { ticker: tickerB, name: game.companyBName ?? "", color: "#1d4ed8" }].map((co) => (
                            <div
                              key={co.ticker}
                              style={{ borderRight: co.ticker === tickerA ? "1px solid var(--color-border)" : undefined }}
                              className="p-2"
                            >
                              <button
                                onClick={() => { setChartTicker(co.ticker); setChartName(co.name); setChartColor(co.color); }}
                                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all active:scale-95"
                                style={{
                                  background: co.color + "18",
                                  color: co.color,
                                  border: `1px solid ${co.color}40`,
                                }}
                              >
                                <BarChart2 size={13} />
                                View Chart
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Validation question hint */}
            {validationQ && (
              <div
                className="card-glass p-4 mb-4 flex items-start gap-3"
                style={{ borderColor: "var(--color-warning)" }}
              >
                <Timer size={16} className="mt-0.5 shrink-0" style={{ color: "var(--color-warning)" }} />
                <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                  After submitting your final selection, a{" "}
                  <strong style={{ color: "var(--color-foreground)" }}>timed Research Validation Question</strong>{" "}
                  will open worth <strong style={{ color: "var(--color-foreground)" }}>20% of your score</strong>.
                  Study the research carefully.
                </p>
              </div>
            )}

            <button
              className="btn-brand w-full justify-center"
              onClick={goToFinalStep}
            >
              I've Read the Research — Make Final Pick
              <ArrowRight size={16} />
            </button>
          </div>
        )}

        {/* ── Step: Final ── */}
        {step === "final" && !isLocked && (
          <div className="card-glass p-6 animate-scale-in">
            <div className="flex items-center gap-3 mb-4">
              <TrendingUp size={20} style={{ color: "var(--color-brand)" }} />
              <h3 style={{ color: "var(--color-foreground)" }}>Final Selection</h3>
            </div>
            <p className="text-sm mb-6" style={{ color: "var(--color-muted)" }}>
              Having reviewed the research, confirm your official prediction. This is the pick
              that will be scored.
            </p>
            <button
              className="btn-brand w-full justify-center"
              disabled={!finalSelection || submitFinal.isPending}
              onClick={() => {
                if (!finalSelection || !game.id) return;
                if (isGuest) {
                  saveGuestPick({
                    ...(guestPick ?? { gameId: game.id, gut: gutSelection ?? finalSelection, savedAt: Date.now() }),
                    final: finalSelection,
                    savedAt: Date.now(),
                  });
                  trackEvent("guest_final_pick");
                  if (validationQ) setModalPhase("confirm");
                  else setStep("submitted");
                  return;
                }
                submitFinal.mutate({ gameId: game.id, selection: finalSelection });
              }}
            >
              {submitFinal.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>Submit Final Selection <Lock size={15} /></>
              )}
            </button>
          </div>
        )}

        {/* ── Submitted ── */}
        {step === "submitted" && isGuest && (
          <GuestAskCard
            pickName={(guestPick?.final ?? finalSelection) === "A" ? game.companyAName : game.companyBName}
            pickSide={guestPick?.final ?? finalSelection}
            quizCorrect={guestPick?.quizCorrect}
            onRemind={() => downloadResultReminder(game.gameDate, `${game.companyATicker} vs ${game.companyBTicker}`)}
            canAnswerQuiz={Boolean(validationQ) && !guestPick?.validationAnswer && !isLocked}
            onAnswerQuiz={() => setModalPhase("confirm")}
            status={game.status}
            winner={game.winner ?? null}
          />
        )}

        {step === "submitted" && !isGuest && !wasAutoSubmitted && (
          <div
            className="card-glass p-6 text-center animate-scale-in"
            style={{
              borderColor: "var(--color-success)",
              boxShadow: "0 0 0 1px var(--color-success)",
            }}
          >
            <CheckCircle2
              size={36}
              className="mx-auto mb-3"
              style={{ color: "var(--color-success)" }}
            />
            <h3 className="mb-2" style={{ color: "var(--color-foreground)" }}>
              Picks Submitted
            </h3>
            <p className="text-sm mb-5" style={{ color: "var(--color-muted)" }}>
              Your final selection is locked in. Results will be published after the game closes.
              {justConverted && " We'll email you when they're in."}
            </p>
            {validationQ && !myPick?.validationAnswer ? (
              <button
                className="btn-brand w-full justify-center mb-3"
                onClick={() => setModalPhase("confirm")}
              >
                Answer Validation Question
                <ArrowRight size={16} />
              </button>
            ) : null}
            <Link href="/leaderboard" className="btn-ghost text-sm">
              View Leaderboard
            </Link>
          </div>
        )}

        {/* Nothing live left to play today. Previously this screen ended at
            "results will be published after the game closes" — accurate, and a
            dead end for the seven hours between lockout and the close. */}
        {justConverted && step === "submitted" && (
          <div className="mt-4">
            <ResultReminderPrompt />
          </div>
        )}

        {(step === "submitted" || isLocked) && <MoreToPlay />}

        {/* ── Auto-submitted (gut pick was submitted by cron at lockout) ── */}
        {(step === "submitted" && !isGuest && wasAutoSubmitted) && (
          <div
            className="card-glass p-6 animate-scale-in"
            style={{ borderColor: "var(--color-warning)", boxShadow: "0 0 0 1px var(--color-warning)" }}
          >
            <div className="flex items-center gap-3 mb-3">
              <Timer size={24} style={{ color: "var(--color-warning)", flexShrink: 0 }} />
              <div>
                <h3 style={{ color: "var(--color-foreground)" }}>Time Ran Out</h3>
                <p className="text-xs" style={{ color: "var(--color-muted)" }}>Your gut pick was automatically submitted</p>
              </div>
            </div>
            <p className="text-sm mb-5" style={{ color: "var(--color-muted)" }}>
              The submission window closed while you were away. Your gut pick —{" "}
              <strong style={{ color: "var(--color-foreground)" }}>
                {myPick?.finalSelection === "A" ? game.companyAName : game.companyBName}
              </strong>{" "}
              — was automatically locked in as your final selection.
            </p>
            {validationQ && (
              <div
                className="p-4 rounded-xl mb-4"
                style={{ background: "var(--color-warning)18", border: "1px solid var(--color-warning)40" }}
              >
                <p className="text-sm font-semibold mb-1" style={{ color: "var(--color-foreground)" }}>
                  You can still earn bonus points
                </p>
                <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                  Answer the Research Validation Question to earn{" "}
                  <strong style={{ color: "var(--color-foreground)" }}>20% of your score</strong> as a bonus.
                </p>
              </div>
            )}
            {validationQ ? (
              <button
                className="btn-brand w-full justify-center"
                onClick={() => setModalPhase("confirm")}
              >
                Answer Validation Question
                <ArrowRight size={16} />
              </button>
            ) : (
              <Link href="/leaderboard" className="btn-ghost text-sm">
                View Leaderboard
              </Link>
            )}
          </div>
        )}

        {/* ── Locked without pick ── */}
        {isLocked && step !== "submitted" && !myPick?.finalSelection && (
          <div
            className="card-glass p-6 text-center"
            style={{ borderColor: "var(--color-warning)" }}
          >
            <Lock
              size={36}
              className="mx-auto mb-3"
              style={{ color: "var(--color-warning)" }}
            />
            <h3 className="mb-2" style={{ color: "var(--color-foreground)" }}>
              Game Locked
            </h3>
            <p className="text-sm" style={{ color: "var(--color-muted)" }}>
              The submission window has closed. You did not submit a pick for today's game.
            </p>
            {isGuest && (
              <SignUpButton mode="modal">
                <button className="btn-brand w-full justify-center mt-5">
                  Create a free account so tomorrow's game counts
                  <ArrowRight size={16} />
                </button>
              </SignUpButton>
            )}
          </div>
        )}

        {/* ── Result + Hindsight Spotlight (shown when result_published) ── */}
        {game.status === "result_published" && (
          <div className="space-y-4 mt-4 animate-fade-up">
            <LeaderboardNamePrompt gameId={game.id} />
            {/* Winner announcement + performance */}
            {game.winner && (() => {
              const perfA = game.companyAPerf != null ? parseFloat(String(game.companyAPerf)) : null;
              const perfB = game.companyBPerf != null ? parseFloat(String(game.companyBPerf)) : null;
              const fmt = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
              return (
                <div className="card-glass p-5" style={{ borderColor: "var(--color-brand)", boxShadow: "0 0 0 1px var(--color-brand)" }}>
                  <div className="flex items-center gap-4 mb-4">
                    <Trophy size={28} style={{ color: "var(--color-brand)", flexShrink: 0 }} />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color: "var(--color-brand)" }}>
                        Result
                      </p>
                      <p className="font-semibold" style={{ color: "var(--color-foreground)" }}>
                        {game.winner === "A" ? game.companyAName : game.companyBName} outperformed
                      </p>
                      {myPick?.finalSelection && (
                        <p className="text-sm mt-0.5" style={{ color: myPick.finalSelection === game.winner ? "var(--color-success)" : "var(--color-error)" }}>
                          {myPick.finalSelection === game.winner ? "✓ Your prediction was correct" : "✗ Your prediction was incorrect"}
                        </p>
                      )}
                    </div>
                  </div>
                  {(perfA != null || perfB != null) && (
                    <div className="grid grid-cols-2 gap-2">
                      {(["A", "B"] as const).map((side) => {
                        const ticker = side === "A" ? game.companyATicker : game.companyBTicker;
                        const name = side === "A" ? game.companyAName : game.companyBName;
                        const perf = side === "A" ? perfA : perfB;
                        const isWinner = game.winner === side;
                        const perfColor = perf == null ? "var(--color-subtle)" : perf >= 0 ? "var(--color-success)" : "var(--color-danger)";
                        return (
                          <div
                            key={side}
                            className="rounded-xl p-3"
                            style={{
                              background: isWinner ? "var(--color-brand)10" : "var(--color-surface-raised)",
                              border: `1px solid ${isWinner ? "var(--color-brand)40" : "var(--color-border)"}`,
                            }}
                          >
                            <div className="flex items-center gap-1.5 mb-1">
                              {isWinner && <Trophy size={11} style={{ color: "var(--color-brand)" }} />}
                              <span className="text-xs font-bold" style={{ color: isWinner ? "var(--color-brand)" : "var(--color-foreground)" }}>
                                {ticker}
                              </span>
                            </div>
                            <p className="text-[0.625rem] mb-1" style={{ color: "var(--color-subtle)" }}>{name}</p>
                            {perf != null && (
                              <span className="text-lg font-bold font-mono" style={{ color: perfColor }}>
                                {fmt(perf)}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Hindsight Spotlight */}
            {research?.hindsightSpotlight && (
              <div
                className="card-glass p-6"
                style={{ borderColor: "oklch(0.65 0.18 145)", background: "oklch(0.97 0.02 145 / 0.4)" }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <Lightbulb size={20} style={{ color: "oklch(0.55 0.18 145)" }} />
                  <div>
                    <h3 className="text-base font-semibold" style={{ color: "var(--color-foreground)" }}>
                      Hindsight Spotlight
                    </h3>
                    <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                      20/20 hindsight — what we know now that the result is in
                    </p>
                  </div>
                </div>
                <div
                  className="text-sm leading-relaxed whitespace-pre-wrap"
                  style={{ color: "var(--color-muted)" }}
                >
                  {research.hindsightSpotlight}
                </div>
                <MoByline className="mt-3" />
              </div>
            )}

            {/* Lesson of the day — slim, dismissable card */}
            {lessonOfTheDay && !lessonCardDismissed && (
              <div
                className="card-glass p-4 flex items-center gap-3"
                style={{ borderColor: "var(--color-brand)" }}
              >
                <GraduationCap size={20} className="shrink-0" style={{ color: "var(--color-brand)" }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm" style={{ color: "var(--color-foreground)" }}>
                    📚 Lesson for this matchup: <strong>{lessonOfTheDay.title}</strong>
                    {" — "}
                    {ALL_LEVELS.find((lv) => lv.level === lessonOfTheDay.level)?.goal}
                  </p>
                  <Link
                    href={`/learn/${lessonOfTheDay.id}`}
                    className="text-xs font-semibold inline-flex items-center gap-1 mt-1"
                    style={{ color: "var(--color-brand)" }}
                  >
                    Start (3 min) <ArrowRight size={12} />
                  </Link>
                </div>
                <button
                  type="button"
                  onClick={dismissLessonCard}
                  aria-label="Dismiss"
                  className="shrink-0 p-1 rounded-lg"
                  style={{ color: "var(--color-subtle)" }}
                >
                  <XIcon size={16} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Yesterday's result card — shown after today's game elements, not between them */}
        {previousGame && (() => {
          const perfA = previousGame.companyAPerf != null ? parseFloat(String(previousGame.companyAPerf)) : null;
          const perfB = previousGame.companyBPerf != null ? parseFloat(String(previousGame.companyBPerf)) : null;
          const fmt = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
          const winnerTicker = previousGame.winner === "A" ? previousGame.companyATicker : previousGame.companyBTicker;
          return (
            <a
              href={`/game/${previousGame.id}/result`}
              className="block mt-6 animate-fade-up"
              style={{ textDecoration: "none" }}
            >
              <div
                className="card-glass p-4 transition-all hover:shadow-md"
                style={{ borderColor: "var(--color-border)" }}
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-subtle)" }}>
                    Yesterday's Result
                  </p>
                  <span className="text-xs font-semibold" style={{ color: "var(--color-brand)" }}>
                    View full result →
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(["A", "B"] as const).map((side) => {
                    const ticker = side === "A" ? previousGame.companyATicker : previousGame.companyBTicker;
                    const perf = side === "A" ? perfA : perfB;
                    const isWinner = previousGame.winner === side;
                    const perfColor = perf == null ? "var(--color-subtle)" : perf >= 0 ? "var(--color-success)" : "var(--color-danger)";
                    return (
                      <div
                        key={side}
                        className="rounded-xl p-3 flex items-center justify-between gap-2"
                        style={{
                          background: isWinner ? "var(--color-brand)10" : "var(--color-surface-raised)",
                          border: `1px solid ${isWinner ? "var(--color-brand)40" : "var(--color-border)"}`,
                        }}
                      >
                        <div className="flex items-center gap-2">
                          {isWinner && <Trophy size={12} style={{ color: "var(--color-brand)", flexShrink: 0 }} />}
                          <span className="text-sm font-bold" style={{ color: isWinner ? "var(--color-brand)" : "var(--color-foreground)" }}>
                            {ticker}
                          </span>
                        </div>
                        {perf != null && (
                          <span className="text-sm font-bold font-mono" style={{ color: perfColor }}>
                            {fmt(perf)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                {winnerTicker && (
                  <p className="text-xs mt-2 text-center" style={{ color: "var(--color-muted)" }}>
                    <span style={{ color: "var(--color-brand)", fontWeight: 600 }}>{winnerTicker}</span> outperformed
                  </p>
                )}
              </div>
            </a>
          );
        })()}
      </div>

      {/* Floating Lockout Countdown Footer */}
      {lockoutTime && !isLocked && step !== "submitted" && (
        <LockoutCountdown lockoutTime={lockoutTime} />
      )}
    </PublicLayout>
  );
}

// ─── Lockout Countdown Footer ─────────────────────────────────────────────────

function LockoutCountdown({ lockoutTime }: { lockoutTime: Date }) {
  // The bottom tab bar only exists for signed-in players. For a visitor the
  // bar used to float 56px above the bottom of the screen over the footer,
  // with an empty strip beneath it.
  const { likelyAuthenticated } = useAuth();
  const [timeLeft, setTimeLeft] = useState(() => lockoutTime.getTime() - Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = lockoutTime.getTime() - Date.now();
      setTimeLeft(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutTime]);

  if (timeLeft <= 0) return null;

  const totalSeconds = Math.floor(timeLeft / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");

  const isUrgent = timeLeft < 30 * 60 * 1000;    // under 30 min → amber
  const isCritical = timeLeft < 5 * 60 * 1000;   // under 5 min → red
  const isFlashing = timeLeft < 60 * 1000;        // under 1 min → flash

  const bgColor = isCritical
    ? "oklch(0.45 0.2 25)"
    : isUrgent
    ? "oklch(0.45 0.15 60)"
    : "var(--color-primary)";

  return (
    <>
      {/* Spacer so page content isn't hidden behind this bar + bottom nav */}
      <div className="h-[48px]" />
      <div
        className={[
          "fixed left-0 right-0 z-40 flex items-center justify-center gap-3 px-4 py-3 shadow-[0_-2px_16px_rgba(0,0,0,0.15)]",
          // On mobile dock on top of the BottomNav tab bar (56px + iOS
          // safe-area inset — keep in sync with BottomNav.tsx); desktop has no
          // tab bar, so sit at bottom-0.
          likelyAuthenticated ? "bottom-[calc(56px+env(safe-area-inset-bottom))] md:bottom-0" : "bottom-0",
          isFlashing ? "animate-pulse" : "",
        ].join(" ")}
        style={{ background: bgColor, transition: "background 1s ease" }}
      >
        <Timer size={15} className="shrink-0" style={{ color: "rgba(255,255,255,0.8)" }} />
        <span className="text-white text-sm font-medium" style={{ opacity: 0.9 }}>
          Locks in
        </span>
        <span
          className="text-white font-mono font-bold text-base tabular-nums"
          style={{ letterSpacing: "0.1em" }}
        >
          {hours > 0 ? `${pad(hours)}:` : ""}{pad(minutes)}:{pad(seconds)}
        </span>
        {isCritical && (
          <span className="text-white text-xs font-semibold" style={{ opacity: 0.9 }}>
            — Make your pick now!
          </span>
        )}
      </div>
    </>
  );
}

// ─── Guest Ask Card ───────────────────────────────────────────────────────────

/** Why a free account is worth having. Every item is live today. */
function AccountBenefits() {
  const items = [
    "Get your result sent to you the moment it lands",
    "Keep your score and build a daily streak",
    "Climb the monthly leaderboard",
    "See how your gut compares with your research over time",
  ];
  return (
    <ul className="text-sm text-left space-y-1.5 mb-5 mx-auto max-w-sm" style={{ color: "var(--color-foreground)" }}>
      {items.map((t) => (
        <li key={t} className="flex items-start gap-2">
          <CheckCircle2 size={15} className="shrink-0 mt-0.5" style={{ color: "var(--color-success)" }} />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

function CreateAccountButton({ label }: { label: string }) {
  return (
    <SignUpButton mode="modal">
      <button className="btn-brand w-full justify-center">
        {label}
        <ArrowRight size={16} />
      </button>
    </SignUpButton>
  );
}

const NO_CATCH =
  "Free, with no card and no catch. You can turn notifications off or delete the account anytime from your profile.";

/**
 * What a signed-out visitor sees once their picks are made. The guest game is
 * complete (2026-10-05): quiz verdict at once, result on return. The account
 * is pitched on what it adds, never as a gate, and skipping it is never
 * offered as an option (Paul's rule).
 */
function GuestAskCard({
  pickName,
  pickSide,
  quizCorrect,
  canAnswerQuiz,
  onAnswerQuiz,
  onRemind,
  status,
  winner,
}: {
  pickName: string;
  pickSide: "A" | "B" | null;
  quizCorrect?: boolean;
  canAnswerQuiz: boolean;
  onAnswerQuiz: () => void;
  onRemind: () => void;
  status: string;
  winner: "A" | "B" | null;
}) {
  const isOpen = status === "active" || status === "locked";
  useEffect(() => {
    trackEvent("guest_ask_shown");
  }, []);

  const published = status === "result_published" && winner && pickSide;

  return (
    <div
      className="card-glass p-6 text-center animate-scale-in"
      style={{ borderColor: "var(--color-brand)", boxShadow: "0 0 0 1px var(--color-brand)" }}
    >
      <p className="text-sm mb-1" style={{ color: "var(--color-muted)" }}>Your pick</p>
      <h3 className="mb-2" style={{ color: "var(--color-foreground)" }}>{pickName}</h3>
      {quizCorrect !== undefined && (
        <p className="text-sm mb-3" style={{ color: quizCorrect ? "var(--color-success)" : "var(--color-error)" }}>
          {quizCorrect ? "✓ Research question: correct" : "✗ Research question: incorrect"}
        </p>
      )}

      {published ? (
        <p className="mb-5" style={{ color: "var(--color-foreground)" }}>
          {pickSide === winner ? `You were right: ${pickName} came out ahead.` : `Not this time: the other company came out ahead.`}
        </p>
      ) : (
        <>
          <p className="text-sm mb-4" style={{ color: "var(--color-muted)" }}>
            Results usually land within an hour of the US market close (4pm New York time). Come back then to see if you were right.
          </p>
          {isOpen && (
            <button className="btn-ghost text-sm w-full justify-center mb-5" onClick={onRemind}>
              <CalendarPlus size={15} /> Remind me at the close
            </button>
          )}
        </>
      )}

      <div className="pt-5 border-t" style={{ borderColor: "var(--color-border)" }}>
        <p className="font-semibold mb-3" style={{ color: "var(--color-foreground)" }}>
          Make it count with a free account
        </p>
        <AccountBenefits />
        <div className="mb-3">
          <CreateAccountButton label={isOpen ? "Create a free account" : "Create a free account for tomorrow's game"} />
        </div>
        <p className="text-xs mb-4" style={{ color: "var(--color-subtle)" }}>{NO_CATCH}</p>
        {canAnswerQuiz && (
          <button className="btn-ghost text-sm w-full justify-center mb-2" onClick={onAnswerQuiz}>
            Answer the research question first
          </button>
        )}
        <p className="text-sm" style={{ color: "var(--color-muted)" }}>
          Already have an account?{" "}
          <SignInButton mode="modal">
            <button className="underline font-semibold" style={{ color: "var(--color-brand)" }}>
              Sign in
            </button>
          </SignInButton>
        </p>
      </div>
    </div>
  );
}

// ─── Last Guest Pick ──────────────────────────────────────────────────────────

/**
 * Once a result publishes, /game moves on to the next matchup, so a guest
 * returning after the close would otherwise never see how they did. This
 * card shows their most recent previous pick once that game has a result.
 */
function LastGuestPickCard({ pick }: { pick: GuestPick }) {
  const { data: game } = trpc.games.getById.useQuery({ id: pick.gameId });
  if (!game || game.status !== "result_published" || !game.winner || !pick.final) return null;
  const pickName = pick.final === "A" ? game.companyAName : game.companyBName;
  const right = pick.final === game.winner;
  return (
    <div
      className="card-glass p-5 mb-6 animate-fade-up"
      style={{ borderColor: right ? "var(--color-success)" : "var(--color-border)" }}
    >
      <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--color-brand)" }}>
        Your last pick: {game.companyATicker} vs {game.companyBTicker}
      </p>
      <p className="font-semibold mb-1" style={{ color: "var(--color-foreground)" }}>
        {right ? `✓ You were right: ${pickName} came out ahead.` : `✗ Not this time: you picked ${pickName}.`}
      </p>
      {pick.quizCorrect !== undefined && (
        <p className="text-sm mb-2" style={{ color: "var(--color-muted)" }}>
          Research question: {pick.quizCorrect ? "correct" : "incorrect"}.
        </p>
      )}
      <Link href={`/game/${game.id}/result`} className="text-sm font-semibold inline-flex items-center gap-1 mb-4" style={{ color: "var(--color-brand)" }}>
        See the full result and Hindsight Spotlight <ArrowRight size={13} />
      </Link>
      <p className="text-sm mb-3" style={{ color: "var(--color-muted)" }}>
        With a free account, today's game counts toward your score and streak, and we'll send you the result.
      </p>
      <CreateAccountButton label="Create a free account" />
    </div>
  );
}
