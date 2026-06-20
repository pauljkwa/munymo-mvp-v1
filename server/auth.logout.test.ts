/**
 * auth.logout — Clerk migration
 *
 * Since switching to Clerk, logout is handled entirely client-side by
 * Clerk's signOut() function. The server-side logout procedure is a
 * no-op stub that returns { success: true } for API compatibility.
 * No session cookie is cleared server-side.
 */
import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    clerkId: "user_test_123",
    openId: null,
    email: "sample@example.com",
    name: "Sample User",
    displayName: null,
    loginMethod: "clerk",
    role: "user",
    tier: "free",
    awayStatus: false,
    awayStatusUntil: null,
    deactivated: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };

  return { ctx };
}

describe("auth.logout", () => {
  it("returns success (logout is handled client-side by Clerk)", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
  });
});
