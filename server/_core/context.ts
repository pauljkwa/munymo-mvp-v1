import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { createClerkClient, verifyToken } from "@clerk/express";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

// Guards the founding-beta welcome email against double-sends when a brand-new
// user's first page load fires several requests concurrently (each would see
// "no user row yet" and take the first-sign-in branch). Per-process is enough:
// Railway runs a single instance, and a rare duplicate is harmless.
const welcomeEmailSent = new Set<string>();

// Lazy-initialised Clerk client for user lookups and deletion.
// Returns null when Clerk isn't configured — callers must handle that.
let _clerk: ReturnType<typeof createClerkClient> | null = null;
export function getClerkClient() {
  if (!_clerk && ENV.clerkSecretKey) {
    _clerk = createClerkClient({ secretKey: ENV.clerkSecretKey });
  }
  return _clerk;
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    if (!ENV.clerkSecretKey) throw new Error("Clerk not configured");

    // Extract the session token from the Authorization header or __session cookie
    const authHeader = opts.req.headers.authorization;
    const cookieHeader = opts.req.headers.cookie ?? "";
    const sessionCookie = cookieHeader
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith("__session="))
      ?.slice("__session=".length);

    const sessionToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : sessionCookie ?? null;

    if (!sessionToken) throw new Error("No session token");

    // Verify the token with Clerk
    const payload = await verifyToken(sessionToken, {
      secretKey: ENV.clerkSecretKey,
    });
    const clerkUserId = payload.sub;

    if (!clerkUserId) throw new Error("No Clerk user ID in token");

    // Look up or create the user in our database
    user = (await db.getUserByClerkId(clerkUserId)) ?? null;

    if (!user) {
      // First sign-in: fetch user details from Clerk and upsert into our DB
      const clerk = getClerkClient();
      if (clerk) {
        const clerkUser = await clerk.users.getUser(clerkUserId);
        const email = clerkUser.emailAddresses[0]?.emailAddress ?? null;
        const name =
          [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
          clerkUser.username ||
          email ||
          "Player";
        const loginMethod =
          clerkUser.externalAccounts[0]?.provider ?? "email";

        await db.upsertUserByClerkId({
          clerkId: clerkUserId,
          name,
          email,
          loginMethod,
          lastSignedIn: new Date(),
        });
        user = (await db.getUserByClerkId(clerkUserId)) ?? null;

        // First sign-in = joining the founding beta. Send the welcome email
        // fire-and-forget: a delivery failure must never block authentication.
        if (user?.email && !welcomeEmailSent.has(clerkUserId)) {
          welcomeEmailSent.add(clerkUserId);
          const to = user.email;
          const playerName = user.name;
          import("../email")
            .then(({ buildWelcomeEmail, sendEmail }) => {
              const joinDate = new Date().toLocaleDateString("en-AU", {
                day: "numeric",
                month: "long",
                year: "numeric",
              });
              const { subject, html } = buildWelcomeEmail({ playerName, joinDate });
              return sendEmail({ to, subject, html });
            })
            .then((result) => {
              if (result && !result.success) {
                console.warn("[Welcome email] send failed:", result.error);
              }
            })
            .catch((err) => console.warn("[Welcome email] unexpected error:", err));
        }
      }
    } else {
      // Update last signed in timestamp
      await db.upsertUserByClerkId({
        clerkId: clerkUserId,
        lastSignedIn: new Date(),
      });
    }

    // Block deactivated users
    if (user?.deactivated) {
      user = null;
    }
  } catch {
    // Authentication is optional for public procedures.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
