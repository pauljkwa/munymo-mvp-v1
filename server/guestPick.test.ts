import { describe, expect, it } from "vitest";
import {
  clearGuestPick,
  planReplay,
  pruneGuestPicks,
  readGuestPick,
  writeGuestPick,
  type GuestStorage,
} from "@/lib/guestPick";

function memoryStorage(): GuestStorage {
  const data = new Map<string, string>();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
    key: (i) => [...data.keys()][i] ?? null,
    get length() {
      return data.size;
    },
  };
}

describe("guest pick storage", () => {
  it("round-trips a full pick", () => {
    const s = memoryStorage();
    writeGuestPick({ gameId: 7, gut: "A", final: "B", validationAnswer: "True", answerTimeMs: 4200, savedAt: 1 }, s);
    expect(readGuestPick(7, s)).toEqual({ gameId: 7, gut: "A", final: "B", validationAnswer: "True", answerTimeMs: 4200, savedAt: 1 });
  });

  it("ignores junk, a different game's pick, and missing storage", () => {
    const s = memoryStorage();
    s.setItem("munymo-guest-pick-7", "not json");
    expect(readGuestPick(7, s)).toBeNull();
    s.setItem("munymo-guest-pick-7", JSON.stringify({ gameId: 8, gut: "A" }));
    expect(readGuestPick(7, s)).toBeNull();
    s.setItem("munymo-guest-pick-7", JSON.stringify({ gameId: 7, gut: "C" }));
    expect(readGuestPick(7, s)).toBeNull();
    expect(readGuestPick(7, null)).toBeNull();
  });

  it("clears one game's pick", () => {
    const s = memoryStorage();
    writeGuestPick({ gameId: 7, gut: "A", savedAt: 1 }, s);
    clearGuestPick(7, s);
    expect(readGuestPick(7, s)).toBeNull();
  });

  it("prunes other games' picks older than a week, keeps today's and recent ones", () => {
    const s = memoryStorage();
    const now = 100 * 24 * 60 * 60 * 1000;
    const day = 24 * 60 * 60 * 1000;
    writeGuestPick({ gameId: 1, gut: "A", savedAt: now - 8 * day }, s);
    writeGuestPick({ gameId: 2, gut: "B", savedAt: now - 2 * day }, s);
    writeGuestPick({ gameId: 3, gut: "A", savedAt: now - 30 * day }, s);
    s.setItem("unrelated", "keep");
    pruneGuestPicks(3, now, s);
    expect(readGuestPick(1, s)).toBeNull();
    expect(readGuestPick(2, s)).not.toBeNull();
    expect(readGuestPick(3, s)).not.toBeNull();
    expect(s.getItem("unrelated")).toBe("keep");
  });
});

describe("planReplay — what to submit after sign-in", () => {
  const full = { gameId: 7, gut: "A" as const, final: "B" as const, validationAnswer: "No", answerTimeMs: 3000, savedAt: 1 };

  it("replays gut, final and the quiz answer in that order", () => {
    expect(planReplay(full, null)).toEqual(["gut", "final", "validation"]);
  });

  it("stops where the guest stopped", () => {
    expect(planReplay({ gameId: 7, gut: "A", savedAt: 1 }, null)).toEqual(["gut"]);
    expect(planReplay({ gameId: 7, gut: "A", final: "A", savedAt: 1 }, null)).toEqual(["gut", "final"]);
  });

  it("the account's existing pick always wins", () => {
    expect(planReplay(full, { gutSelection: "B" })).toEqual([]);
  });
});
