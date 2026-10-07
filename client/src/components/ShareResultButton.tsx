import { useState } from "react";
import { Share2, Check } from "lucide-react";
import { toast } from "sonner";

/**
 * The Wordle grid, for Munymo. One tap produces a short, spoiler-light block
 * a player can drop into a chat: what happened to them today, not the
 * research. Uses the native share sheet where there is one (phones) and the
 * clipboard everywhere else.
 *
 * Deliberately no player name: the person sharing is the person sending it.
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
  /** Scoring v2 result: share text drops the timed-quiz marker. */
  v2?: boolean;
  /** "Toss-up" / "Leaning" / "Confident"; null when none was recorded. */
  confidenceLabel?: string | null;
}

export function buildShareText(r: ShareResultInput): string {
  const d = new Date(`${r.gameDate}T12:00:00Z`);
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const gut = r.gutCorrect === null ? "🧠➖" : r.gutCorrect ? "🧠✅" : "🧠❌";
  const fin = r.finalCorrect ? "🔬✅" : "🔬❌";
  const streak = r.currentStreak > 1 ? `\n🔥 ${r.currentStreak}-day streak` : "";
  if (r.v2) {
    const verdict = r.finalCorrect ? "called it" : "missed it";
    const conf = r.confidenceLabel ? ` · ${r.confidenceLabel}` : "";
    return (
      `Munymo · ${date} · ${r.tickerA} vs ${r.tickerB}\n` +
      `${gut} ${fin} → ${r.totalScore}/100 · ${verdict}${conf}${streak}\n` +
      `https://munymo.com/game/${r.gameId}/result`
    );
  }
  const val = r.validationAnswered ? `⏱${r.validationScore}` : "⏱➖";
  return (
    `Munymo · ${date} · ${r.tickerA} vs ${r.tickerB}\n` +
    `${gut} ${fin} ${val} → ${r.totalScore} pts${streak}\n` +
    `https://munymo.com/game/${r.gameId}/result`
  );
}

export default function ShareResultButton(props: ShareResultInput) {
  const [done, setDone] = useState(false);
  const text = buildShareText(props);

  async function share() {
    try {
      if (typeof navigator !== "undefined" && "share" in navigator && typeof navigator.share === "function") {
        await navigator.share({ text });
        setDone(true);
        return;
      }
      await navigator.clipboard.writeText(text);
      setDone(true);
      toast.success("Copied — paste it anywhere.");
    } catch (err) {
      // A dismissed share sheet throws AbortError; that is not a failure.
      if ((err as { name?: string })?.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(text);
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
