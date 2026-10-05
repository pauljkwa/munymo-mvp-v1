/**
 * Guest play: a signed-out visitor's picks for today's game, kept in their
 * browser until they create an account (spec: references/guest-play-spec.md).
 *
 * Nothing here talks to the server. On sign-in, DailyGame replays the stored
 * picks through the normal protected mutations (submitGut → submitFinal →
 * submitValidation), so lockout and scoring stay server-enforced. Guests never
 * reach the database, which is why they can't appear in community stats or
 * on a leaderboard.
 *
 * Every function takes the storage as a parameter so the rules are testable
 * in node; callers use the default, which is localStorage or null when the
 * browser refuses access (private mode, blocked site data).
 */

export type Side = "A" | "B";

export interface GuestPick {
  gameId: number;
  gut: Side;
  final?: Side;
  validationAnswer?: string;
  answerTimeMs?: number;
  savedAt: number;
}

export type GuestStorage = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;

const KEY_PREFIX = "munymo-guest-pick-";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function browserStorage(): GuestStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

const isSide = (v: unknown): v is Side => v === "A" || v === "B";

export function readGuestPick(gameId: number, storage = browserStorage()): GuestPick | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(KEY_PREFIX + gameId);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (p?.gameId !== gameId || !isSide(p.gut)) return null;
    return {
      gameId,
      gut: p.gut,
      final: isSide(p.final) ? p.final : undefined,
      validationAnswer: typeof p.validationAnswer === "string" && p.validationAnswer ? p.validationAnswer : undefined,
      answerTimeMs: typeof p.answerTimeMs === "number" ? p.answerTimeMs : undefined,
      savedAt: typeof p.savedAt === "number" ? p.savedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

export function writeGuestPick(pick: GuestPick, storage = browserStorage()): void {
  try {
    storage?.setItem(KEY_PREFIX + pick.gameId, JSON.stringify(pick));
  } catch {
    /* storage full or blocked: the pick lives in page state for this visit */
  }
}

export function clearGuestPick(gameId: number, storage = browserStorage()): void {
  try {
    storage?.removeItem(KEY_PREFIX + gameId);
  } catch {
    /* nothing to clean up if storage is unavailable */
  }
}

/** Remove picks for other games once they're more than a week old. */
export function pruneGuestPicks(currentGameId: number, now = Date.now(), storage = browserStorage()): void {
  if (!storage) return;
  try {
    const stale: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (!key?.startsWith(KEY_PREFIX)) continue;
      const gameId = Number(key.slice(KEY_PREFIX.length));
      if (gameId === currentGameId) continue;
      const pick = readGuestPick(gameId, storage);
      if (!pick || now - pick.savedAt > MAX_AGE_MS) stale.push(key);
    }
    stale.forEach((k) => storage.removeItem(k));
  } catch {
    /* best effort */
  }
}

export type ReplayStep = "gut" | "final" | "validation";

/**
 * Which mutations to replay after sign-in. The account's own pick always
 * wins: an existing player who played as a guest on another device keeps
 * what the server already has, and the guest pick is discarded.
 */
export function planReplay(
  guest: GuestPick,
  serverPick: { gutSelection?: string | null } | null | undefined
): ReplayStep[] {
  if (serverPick?.gutSelection) return [];
  const steps: ReplayStep[] = ["gut"];
  if (guest.final) {
    steps.push("final");
    if (guest.validationAnswer) steps.push("validation");
  }
  return steps;
}
