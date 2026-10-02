import { useState } from "react";
import { toast } from "sonner";
import { Check, Loader2, Vote } from "lucide-react";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  MARKET_OPTIONS,
  MAX_MARKET_PICKS,
  joinMarketLabels,
  type MarketCode,
} from "@shared/markets";

/**
 * "Which market would you play?" — the survey inside the Road Ahead's
 * More Markets card. A visitor ranks up to three countries; the first pick
 * tells us which game to launch next, the extra picks tell us how much
 * appetite there is for playing several markets at once.
 *
 * No sign-in needed. One vote per browser (a random id in localStorage) or
 * per account when signed in; voting again replaces the earlier answer.
 * Totals are deliberately NOT shown here — see the admin dashboard.
 */

const KEY_STORAGE = "munymo_market_voter_key";
const VOTE_STORAGE = "munymo_market_vote";

function readStored<T>(key: string, parse: (raw: string) => T | null): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode / storage blocked — the vote still records server-side */
  }
}

/** Stable random id for this browser, so one browser counts once. */
function getVoterKey(): string {
  const existing = readStored(KEY_STORAGE, (raw) =>
    /^[A-Za-z0-9_-]{16,64}$/.test(raw) ? raw : null
  );
  if (existing) return existing;
  const fresh =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  writeStored(KEY_STORAGE, fresh);
  return fresh;
}

const VALID_CODES = new Set<string>(MARKET_OPTIONS.map((m) => m.code));

function readStoredVote(): MarketCode[] {
  return (
    readStored(VOTE_STORAGE, (raw) => {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return null;
      return parsed.filter((c): c is MarketCode => typeof c === "string" && VALID_CODES.has(c));
    }) ?? []
  );
}

export default function MarketVote() {
  const [open, setOpen] = useState(false);
  const [voted, setVoted] = useState<MarketCode[]>(readStoredVote);
  const [picks, setPicks] = useState<MarketCode[]>([]);
  const [otherText, setOtherText] = useState("");

  const vote = trpc.markets.vote.useMutation({
    onSuccess: (res) => {
      const recorded = [...res.markets];
      setVoted(recorded);
      writeStored(VOTE_STORAGE, JSON.stringify(recorded));
      setOpen(false);
      toast.success(
        `Thanks. Your vote for ${joinMarketLabels(recorded)} has been recorded and passed to the Munymo team.`
      );
    },
    onError: (err) => toast.error(err.message),
  });

  function openDialog() {
    setPicks(voted);
    setOtherText("");
    setOpen(true);
  }

  function toggle(code: MarketCode) {
    setPicks((prev) => {
      if (prev.includes(code)) return prev.filter((c) => c !== code);
      if (prev.length >= MAX_MARKET_PICKS) return prev;
      return [...prev, code];
    });
  }

  const full = picks.length >= MAX_MARKET_PICKS;

  return (
    <div className="mt-5">
      {voted.length > 0 ? (
        <div className="flex items-center gap-3 flex-wrap">
          <span
            className="inline-flex items-center gap-1.5 text-sm font-medium"
            style={{ color: "var(--color-foreground)" }}
          >
            <Check size={15} style={{ color: "var(--color-success)" }} />
            You voted: {joinMarketLabels(voted)}
          </span>
          <button
            type="button"
            onClick={openDialog}
            className="text-sm underline underline-offset-2"
            style={{ color: "var(--color-muted)" }}
          >
            Change vote
          </button>
        </div>
      ) : (
        <button type="button" onClick={openDialog} className="btn-gold text-sm">
          <Vote size={16} />
          Vote for your market
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Which markets would you play?</DialogTitle>
            <DialogDescription>
              The US game is live now. Pick up to {MAX_MARKET_PICKS} countries, in order of
              preference. Your first pick counts most.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-2">
            {MARKET_OPTIONS.map((m) => {
              const rank = picks.indexOf(m.code);
              const selected = rank !== -1;
              return (
                <button
                  key={m.code}
                  type="button"
                  onClick={() => toggle(m.code)}
                  disabled={!selected && full}
                  aria-pressed={selected}
                  className="flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: selected ? "var(--color-gold-muted)" : "var(--color-surface-raised)",
                    border: `1px solid ${selected ? "var(--color-gold)" : "var(--color-border)"}`,
                    color: "var(--color-foreground)",
                  }}
                >
                  <span>{m.label}</span>
                  {selected && (
                    <span
                      className="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold shrink-0"
                      style={{ background: "var(--color-gold)", color: "var(--color-gold-foreground)" }}
                      aria-label={`Choice ${rank + 1}`}
                    >
                      {rank + 1}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {picks.includes("OTHER") && (
            <input
              type="text"
              value={otherText}
              onChange={(e) => setOtherText(e.target.value)}
              maxLength={120}
              placeholder="Which country?"
              aria-label="Which country?"
              className="w-full rounded-lg px-3 py-2.5 text-sm"
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border-strong)",
                color: "var(--color-foreground)",
              }}
            />
          )}

          <button
            type="button"
            className="btn-gold text-sm justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={picks.length === 0 || vote.isPending}
            onClick={() =>
              vote.mutate({
                markets: picks,
                otherText: picks.includes("OTHER") ? otherText.trim() || undefined : undefined,
                anonKey: getVoterKey(),
              })
            }
          >
            {vote.isPending ? <Loader2 size={16} className="animate-spin" /> : null}
            Send my vote
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
