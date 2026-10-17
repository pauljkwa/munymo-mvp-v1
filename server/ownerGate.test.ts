/**
 * Owner gate (references/owner-dashboard-spec.md §4): the dashboard belongs to
 * ONE account, named by OWNER_USER_ID, and the admin role never opens it.
 * createCaller style, no database (see testIsolation.test.ts): with no database
 * the owner procedures that pass the gate return their empty shapes.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ENV } from "./_core/env";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type TestUser = NonNullable<TrpcContext["user"]>;

function ctxFor(over: Partial<TestUser>): TrpcContext {
  const user: TestUser = {
    id: 14,
    clerkId: "user_test_owner",
    openId: null,
    email: "owner@example.com",
    name: "Owner",
    displayName: null,
    loginMethod: "clerk",
    role: "user",
    tier: "free",
    awayStatus: false,
    awayStatusUntil: null,
    deactivated: false,
    emailOptIn: true,
    pushOptIn: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...over,
  };
  return { user, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

const original = ENV.ownerUserId;
beforeEach(() => {
  ENV.ownerUserId = 14;
});
afterEach(() => {
  ENV.ownerUserId = original;
});

describe("owner gate", () => {
  it("lets the owner account through", async () => {
    const caller = appRouter.createCaller(ctxFor({ id: 14 }));
    const result = await caller.owner.dashboard();
    expect(result.today.game).toBeNull();
    expect(result.players.total).toBe(0);
    expect(result.growth.guestPicks30d).toBeNull();
    expect(Array.isArray(result.ledger)).toBe(true);
    await expect(caller.owner.costs.aiSummary()).resolves.toMatchObject({ unpricedTurns: 0 });
    await expect(caller.owner.costs.vendorList()).resolves.toEqual({ months: [] });
  });

  it("refuses an admin who is not the owner, on every owner procedure", async () => {
    const caller = appRouter.createCaller(ctxFor({ id: 99, role: "admin" }));
    await expect(caller.owner.dashboard()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.owner.costs.aiSummary()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.owner.costs.vendorList()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      caller.owner.costs.vendorUpsert({ month: "2026-10", vendor: "Railway", category: "run", amount: 5, currency: "USD" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.owner.costs.vendorDelete({ id: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("refuses an ordinary player", async () => {
    const caller = appRouter.createCaller(ctxFor({ id: 5 }));
    await expect(caller.owner.dashboard()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("refuses a signed-out caller as unauthorized", async () => {
    const caller = appRouter.createCaller({ ...ctxFor({}), user: null });
    await expect(caller.owner.dashboard()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("treats an unset OWNER_USER_ID as nobody is the owner, never everybody", async () => {
    ENV.ownerUserId = 0;
    for (const id of [0, 1, 14, 99]) {
      const caller = appRouter.createCaller(ctxFor({ id, role: "admin" }));
      await expect(caller.owner.dashboard()).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(caller.owner.costs.vendorList()).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
  });

  it("an owner who is also an admin is still just the owner for owner procedures", async () => {
    const caller = appRouter.createCaller(ctxFor({ id: 14, role: "user" }));
    await expect(caller.owner.dashboard()).resolves.toBeTruthy();
  });

  it("the old admin.costs procedures are gone and the owner ones exist", () => {
    const paths = Object.keys(appRouter._def.procedures);
    expect(paths.filter((p) => p.startsWith("admin.costs"))).toEqual([]);
    expect(paths).toEqual(
      expect.arrayContaining([
        "owner.whoami",
        "owner.dashboard",
        "owner.costs.aiSummary",
        "owner.costs.vendorList",
        "owner.costs.vendorUpsert",
        "owner.costs.vendorDelete",
      ])
    );
  });
});

describe("owner.whoami", () => {
  it("reports isOwner for the owner and returns their id", async () => {
    const result = await appRouter.createCaller(ctxFor({ id: 14 })).owner.whoami();
    expect(result).toEqual({ userId: 14, isOwner: true });
  });

  it("reports a non-owner their own id so the owner can read it off the refusal screen", async () => {
    const result = await appRouter.createCaller(ctxFor({ id: 27, role: "admin" })).owner.whoami();
    expect(result).toEqual({ userId: 27, isOwner: false });
  });

  it("never reports isOwner when OWNER_USER_ID is unset", async () => {
    ENV.ownerUserId = 0;
    const result = await appRouter.createCaller(ctxFor({ id: 0 })).owner.whoami();
    expect(result.isOwner).toBe(false);
  });

  it("needs a signed-in caller", async () => {
    const caller = appRouter.createCaller({ ...ctxFor({}), user: null });
    await expect(caller.owner.whoami()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
