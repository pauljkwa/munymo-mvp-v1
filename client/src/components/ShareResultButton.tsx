import { useState } from "react";
import { Share2, Check } from "lucide-react";
import { toast } from "sonner";
import { archivePath } from "@shared/slugs";
import { shareQuery, type ShareParams } from "@shared/shareParams";

/**
 * Share a result in words anyone understands, plus a link whose preview
 * image tells the story: both stocks, the winner, the moves, and the
 * sharer's score (server/_core/shareCard.ts). Replaced the emoji grid on
 * 2026-10-12: "🧠❌ 🔬✅ → 100/100" meant nothing to someone outside the game,
 * and the old link pointed at a sign-in-only page whose preview was the
 * generic site card.
 *
 * Uses the native share sheet where there is one (phones) and the clipboard
 * everywhere else. Deliberately no player name: the person sharing is the
 * person sending it.
 */
export interface ShareResultInput {
  gameId: number;
  gameDate: string; // YYYY-MM-DD
  tickerA: string;
  tickerB: string;
  gutCorrect: boolean | null; // null = no gut pick recorded
  finalCorrect: boolean;
  validationScore: number;
  validationAnswered: boolean;
  totalScore: number;
  currentStreak: number;
  /** Scoring v2 result (0–100 scale). */
  v2?: boolean;
  /** "Toss-up" / "Leaning" / "Confident"; null when none was recorded. */
  confidenceLabel?: string | null;
}

const CONFIDENCE_LABELS = ["Toss-up", "Leaning", "Confident"] as const;

/** The public archive page, carrying the sharer's result for the preview card. */
export function buildShareUrl(r: ShareResultInput): string {
  const params: ShareParams = {
    // Pre-v2 scores aren't out of 100; leave the number off rather than mislead.
    score: r.v2 ? Math.max(0, Math.min(100, Math.round(r.totalScore))) : null,
    streak: r.currentStreak > 1 ? r.currentStreak : null,
    called: r.finalCorrect,
    confidence: (CONFIDENCE_LABELS as readonly string[]).includes(r.confidenceLabel ?? "")
      ? (r.confidenceLabel as ShareParams["confidence"])
      : null,
  };
  const path = archivePath({ companyATicker: r.tickerA, companyBTicker: r.tickerB, gameDate: r.gameDate });
  return `https://munymo.com${path}${shareQuery(params)}`;
}

export function buildShareText(r: ShareResultInput): string {
  const vs = `${r.tickerA} vs ${r.tickerB}`;
  const score = r.v2 ? ` and scored ${r.totalScore}/100` : "";
  const streak = r.currentStreak > 1 ? ` 🔥 ${r.currentStreak}-day streak.` : "";
  const line = r.finalCorrect
    ? `I called ${vs} on Munymo${score}.${streak} Can you beat me?`
    : `I missed ${vs} on Munymo${score}. Think you can do better?`;
  return `${line}\nTwo real stocks, one call, every trading day. Free, no sign-up.`;
}

export default function ShareResultButton(props: ShareResultInput) {
  const [done, setDone] = useState(false);
  const text = buildShareText(props);
  const url = buildShareUrl(props);
  const clipboardText = `${text}\n${url}`;

  async function share() {
    try {
      if (typeof navigator !== "undefined" && "share" in navigator && typeof navigator.share === "function") {
        // Separate url so chat apps unfurl it into the preview card.
        await navigator.share({ text, url });
        setDone(true);
        return;
      }
      await navigator.clipboard.writeText(clipboardText);
      setDone(true);
      toast.success("Copied — paste it anywhere.");
    } catch (err) {
      // A dismissed share sheet throws AbortError; that is not a failure.
      if ((err as { name?: string })?.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(clipboardText);
        setDone(true);
        toast.success("Copied — paste it anywhere.");
      } catch {
        toast.error("Couldn't share from this browser.");
      }
    }
  }

  return (
    <button type="button" onClick={share} className="btn-ghost text-sm inline-flex items-center gap-2">
      {done ? <Check size={15} /> : <Share2 size={15} />}
      {done ? "Shared" : "Share result"}
    </button>
  );
}
