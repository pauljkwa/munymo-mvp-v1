/**
 * Referral tRPC Router
 * ====================
 * Exposes tRPC procedures for the merch QR referral scheme.
 *
 * Public:
 *   referral.claim       — enrol a code (link it to the authenticated user's account)
 *
 * Protected (authenticated users):
 *   referral.myStats     — get the user's referral dashboard data
 *   referral.myCodes     — list all codes owned by the user
 *   referral.attributeSignup — attribute this signup to the referral cookie that
 *                              got them here (called once, client-side, after first sign-in)
 *
 * Admin:
 *   referral.generate    — generate N new unassigned codes for a merch batch
 *   referral.listAll     — list all codes with owner info
 *   referral.suspend     — suspend a code
 *   referral.unsuspend   — reactivate a suspended code
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, desc, sql, gte } from "drizzle-orm";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { referralCodes, referralEvents, users } from "../drizzle/schema";
import { generateReferralCode, REFERRAL_ATTRIBUTION_DAYS } from "./referral";

// ─── Admin guard (inline — mirrors routers.ts pattern) ────────────────────────
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

// ─── Router ───────────────────────────────────────────────────────────────────

export const referralRouter = router({

  /**
   * Enrol a referral code — links it to the authenticated user's account.
   * Can only be claimed once. The owner can re-claim their own code to
   * confirm ownership (idempotent).
   */
  claim: protectedProcedure
    .input(z.object({ code: z.string().min(4).max(16).toUpperCase() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [referral] = await db
        .select()
        .from(referralCodes)
        .where(eq(referralCodes.code, input.code))
        .limit(1);

      if (!referral) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Code not found. Check the code on your item and try again." });
      }

      if (referral.status === "suspended") {
        throw new TRPCError({ code: "FORBIDDEN", message: "This code has been suspended. Please contact support." });
      }

      // Already claimed by this user — idempotent success
      if (referral.ownerId === ctx.user.id) {
        return { ok: true, alreadyOwned: true };
      }

      // Already claimed by someone else
      if (referral.ownerId !== null) {
        throw new TRPCError({ code: "CONFLICT", message: "This code has already been enrolled by another user." });
      }

      // Claim it
      await db
        .update(referralCodes)
        .set({
          ownerId: ctx.user.id,
          status: "active",
          enrolledAt: new Date(),
        })
        .where(eq(referralCodes.id, referral.id));

      return { ok: true, alreadyOwned: false };
    }),

  /**
   * Attribute this signup to the referral cookie that got them here. Called
   * once, client-side, after first sign-in when the munymo_ref cookie is
   * present. Replaces the old POST /api/referral/attribute Express route,
   * which required a Manus cron session nothing could present.
   */
  attributeSignup: protectedProcedure
    .input(z.object({ referralCookieValue: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const newUserId = ctx.user.id;

      // Dedup: a given referredUserId may only ever produce one signup attribution
      const [existing] = await db
        .select({ id: referralEvents.id })
        .from(referralEvents)
        .where(
          and(
            eq(referralEvents.eventType, "signup"),
            eq(referralEvents.referredUserId, newUserId)
          )
        )
        .limit(1);

      if (existing) {
        return { ok: false, reason: "Already attributed" };
      }

      // Parse code from cookie value (format: "CODE:timestamp")
      const codeStr = String(input.referralCookieValue).split(":")[0].toUpperCase();

      const [referral] = await db
        .select()
        .from(referralCodes)
        .where(eq(referralCodes.code, codeStr))
        .limit(1);

      if (!referral || referral.status !== "active") {
        return { ok: false, reason: "Code not active" };
      }

      // Find the most recent scan event for this cookie within the attribution window
      const windowStart = new Date(
        Date.now() - REFERRAL_ATTRIBUTION_DAYS * 24 * 60 * 60 * 1000
      );
      const [scanEvent] = await db
        .select()
        .from(referralEvents)
        .where(
          and(
            eq(referralEvents.referralCodeId, referral.id),
            eq(referralEvents.eventType, "scan"),
            eq(referralEvents.referralCookie, input.referralCookieValue),
            gte(referralEvents.createdAt, windowStart)
          )
        )
        .limit(1);

      if (!scanEvent) {
        return { ok: false, reason: "No matching scan within attribution window" };
      }

      // Create signup attribution event
      await db.insert(referralEvents).values({
        referralCodeId: referral.id,
        eventType: "signup",
        referredUserId: newUserId,
        ownerIdAtEvent: referral.ownerId ?? undefined,
        deviceFingerprint: scanEvent.deviceFingerprint ?? undefined,
        referralCookie: input.referralCookieValue,
        attributed: true,
      });

      // Increment signup counter
      await db
        .update(referralCodes)
        .set({ totalSignups: (referral.totalSignups ?? 0) + 1 })
        .where(eq(referralCodes.id, referral.id));

      return { ok: true, ownerId: referral.ownerId };
    }),

  /**
   * Get the authenticated user's referral stats summary.
   */
  myStats: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

    const codes = await db
      .select({
        id: referralCodes.id,
        code: referralCodes.code,
        merchType: referralCodes.merchType,
        status: referralCodes.status,
        enrolledAt: referralCodes.enrolledAt,
        totalScans: referralCodes.totalScans,
        totalSignups: referralCodes.totalSignups,
      })
      .from(referralCodes)
      .where(eq(referralCodes.ownerId, ctx.user.id))
      .orderBy(desc(referralCodes.enrolledAt));

    const totalScans = codes.reduce((sum, c) => sum + (c.totalScans ?? 0), 0);
    const totalSignups = codes.reduce((sum, c) => sum + (c.totalSignups ?? 0), 0);

    return {
      codes,
      totalScans,
      totalSignups,
      activeCodes: codes.filter((c) => c.status === "active").length,
    };
  }),

  /**
   * Admin: generate N new unassigned codes for a merch batch.
   */
  generate: adminProcedure
    .input(
      z.object({
        count: z.number().int().min(1).max(500),
        merchType: z.enum(["mug", "tshirt", "other"]).default("other"),
        batchId: z.string().max(64).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Generate unique codes — retry on collision
      const generated: string[] = [];
      let attempts = 0;
      while (generated.length < input.count && attempts < input.count * 3) {
        attempts++;
        const code = generateReferralCode();
        if (generated.includes(code)) continue;

        // Check DB for collision
        const [existing] = await db
          .select({ id: referralCodes.id })
          .from(referralCodes)
          .where(eq(referralCodes.code, code))
          .limit(1);

        if (!existing) generated.push(code);
      }

      if (generated.length < input.count) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not generate enough unique codes" });
      }

      // Bulk insert
      await db.insert(referralCodes).values(
        generated.map((code) => ({
          code,
          merchType: input.merchType,
          batchId: input.batchId ?? null,
          status: "unassigned" as const,
        }))
      );

      return { ok: true, codes: generated, count: generated.length };
    }),

  /**
   * Admin: list all referral codes with owner display name.
   */
  listAll: adminProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(200).default(100),
        offset: z.number().int().min(0).default(0),
        status: z.enum(["unassigned", "active", "suspended", "all"]).default("all"),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const rows = await db
        .select({
          id: referralCodes.id,
          code: referralCodes.code,
          merchType: referralCodes.merchType,
          batchId: referralCodes.batchId,
          status: referralCodes.status,
          enrolledAt: referralCodes.enrolledAt,
          totalScans: referralCodes.totalScans,
          totalSignups: referralCodes.totalSignups,
          ownerId: referralCodes.ownerId,
          ownerName: users.displayName,
          ownerEmail: users.email,
          createdAt: referralCodes.createdAt,
        })
        .from(referralCodes)
        .leftJoin(users, eq(referralCodes.ownerId, users.id))
        .where(
          input.status === "all"
            ? undefined
            : eq(referralCodes.status, input.status)
        )
        .orderBy(desc(referralCodes.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return rows;
    }),

  /**
   * Admin: suspend a code (stops it generating referral events).
   */
  suspend: adminProcedure
    .input(z.object({ code: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      await db
        .update(referralCodes)
        .set({ status: "suspended" })
        .where(eq(referralCodes.code, input.code.toUpperCase()));

      return { ok: true };
    }),

  /**
   * Admin: reactivate a suspended code.
   */
  unsuspend: adminProcedure
    .input(z.object({ code: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [referral] = await db
        .select({ ownerId: referralCodes.ownerId })
        .from(referralCodes)
        .where(eq(referralCodes.code, input.code.toUpperCase()))
        .limit(1);

      if (!referral) throw new TRPCError({ code: "NOT_FOUND" });

      // Only reactivate to 'active' if it has an owner; otherwise back to 'unassigned'
      const newStatus = referral.ownerId ? "active" : "unassigned";

      await db
        .update(referralCodes)
        .set({ status: newStatus })
        .where(eq(referralCodes.code, input.code.toUpperCase()));

      return { ok: true, newStatus };
    }),
});
