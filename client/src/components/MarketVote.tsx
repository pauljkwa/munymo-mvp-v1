import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Check, Loader2, Vote } from "lucide-react";
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
  describeMarketVote,
  marketLabel,
  type MarketCode,
} from "@shared/markets";

/**
 * "Which market would you play?" — the survey inside the Road Ahead's
 * More Markets card.
 *
 * Two explicit questions, never an inferred ranking:
 *   1. Which market would you play FIRST?  (one answer)
 *   2. Any others you would also play?     (optional, up to two, unranked)
 * The first version ranked picks by tap order. Paul's own first vote showed
 * the flaw: he tapped the first country in the list without meaning it as his
 * preference, so tap order mostly measured list position.
 *
 * The first answer decides which country's game to launch next; the extras
 * measure the appetite for playing several markets at once.
 *
 * No sign-in needed. One vote per browser (a random id in localStorage) or
 * per account when signed in; voting again replaces the earlier answer.
 * Totals are deliberately NOT shown here — see the admin dashboard.
 */

const KEY_STORAGE = "munymo_market_voter_key";
const VOTE_STORAGE = "munymo_market_vote";
const MAX_EXTRAS = MAX_MARKET_PICKS - 1;

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

const chipBase =
  "flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

function chipStyle(selected: boolean) {
  return {
    background: selected ? "var(--color-gold-muted)" : "var(--color-surface-raised)",
    border: `1px solid ${selected ? "var(--color-gold)" : "var(--color-border)"}`,
    color: "var(--color-foreground)",
  };
}

export default function MarketVote() {
  const [open, setOpen] = useState(false);
  const [voted, setVoted] = useState<MarketCode[]>(readStoredVote);
  const [step, setStep] = useState<1 | 2>(1);
  const [first, setFirst] = useState<MarketCode | null>(null);
  const [extras, setExtras] = useState<MarketCode[]>([]);
  const [otherText, setOtherText] = useState("");

  const vote = trpc.markets.vote.useMutation({
    onSuccess: (res) => {
      const recorded = [...res.markets];
      setVoted(recorded);
      writeStored(VOTE_STORAGE, JSON.stringify(recorded));
      setOpen(false);
      toast.success(
        `Thanks. Your vote for ${describeMarketVote(recorded)} has been recorded and passed to the Munymo team.`
      );
    },
    onError: (err) => toast.error(err.message),
  });

  function openDialog() {
    // Always start from the first-choice question, even when changing a vote.
    setStep(1);
    setFirst(voted[0] ?? null);
    setExtras(voted.slice(1));
    setOtherText("");
    setOpen(true);
  }

  function chooseFirst(code: MarketCode) {
    setFirst(code);
    // A market can't be both the first choice and an extra.
    setExtras((prev) => prev.filter((c) => c !== code));
    setStep(2);
  }

  function toggleExtra(code: MarketCode) {
    setExtras((prev) => {
      if (prev.includes(code)) return prev.filter((c) => c !== code);
      if (prev.length >= MAX_EXTRAS) return prev;
      return [...prev, code];
    });
  }

  const extrasFull = extras.length >= MAX_EXTRAS;
  const picks: MarketCode[] = first ? [first, ...extras] : [];
  const needsOtherText = picks.includes("OTHER");

  return (
    <div className="mt-5">
      {voted.length > 0 ? (
        <div className="flex items-center gap-3 flex-wrap">
          <span
            className="inline-flex items-center gap-1.5 text-sm font-medium"
            style={{ color: "var(--color-foreground)" }}
          >
            <Check size={15} style={{ color: "var(--color-success)" }} />
            You voted: {describeMarketVote(voted)}
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
          {step === 1 ? (
            <>
              <DialogHeader>
                <DialogTitle>Which market would you play first?</DialogTitle>
                <DialogDescription>
                  Step 1 of 2. Pick the one country whose market you most want to play. The US
                  game is live now.
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-2">
                {MARKET_OPTIONS.map((m) => (
                  <button
                    key={m.code}
                    type="button"
                    onClick={() => chooseFirst(m.code)}
                    aria-pressed={first === m.code}
                    className={chipBase}
                    style={chipStyle(first === m.code)}
                  >
                    <span>{m.label}</span>
                    {first === m.code && <Check size={15} style={{ color: "var(--color-gold)" }} />}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Any others you would also play?</DialogTitle>
                <DialogDescription>
                  Step 2 of 2. Optional: pick up to {MAX_EXTRAS} more, or just send your vote.
                </DialogDescription>
              </DialogHeader>

              <div
                className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm"
                style={{ background: "var(--color-gold-muted)", border: "1px solid var(--color-gold)" }}
              >
                <span style={{ color: "var(--color-foreground)" }}>
                  Your first choice: <strong>{first ? marketLabel(first) : ""}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="inline-flex items-center gap-1 text-sm underline underline-offset-2 shrink-0"
                  style={{ color: "var(--color-muted)" }}
                >
                  <ArrowLeft size={13} />
                  Change
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {MARKET_OPTIONS.filter((m) => m.code !== first).map((m) => {
                  const selected = extras.includes(m.code);
                  return (
                    <button
                      key={m.code}
                      type="button"
                      onClick={() => toggleExtra(m.code)}
                      disabled={!selected && extrasFull}
                      aria-pressed={selected}
                      className={chipBase}
                      style={chipStyle(selected)}
                    >
                      <span>{m.label}</span>
                      {selected && <Check size={15} style={{ color: "var(--color-gold)" }} />}
                    </button>
                  );
                })}
              </div>

              {needsOtherText && (
                <input
                  type="text"
                  value={otherText}
                  onChange={(e) => setOtherText(e.target.value)}
                  maxLength={120}
                  placeholder="Other: which country?"
                  aria-label="Other: which country?"
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
                disabled={!first || vote.isPending}
                onClick={() =>
                  vote.mutate({
                    markets: picks,
                    otherText: needsOtherText ? otherText.trim() || undefined : undefined,
                    anonKey: getVoterKey(),
                  })
                }
              >
                {vote.isPending ? <Loader2 size={16} className="animate-spin" /> : null}
                Send my vote
              </button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
