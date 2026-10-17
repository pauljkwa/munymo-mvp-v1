import { z } from "zod";
import { VENDOR_CATEGORIES } from "./aiUsage";

/**
 * Input for admin.costs.vendorUpsert. Kept apart from shared/aiUsage.ts so the
 * browser bundle (which imports the vendor list from there) does not pull in zod.
 */
export const vendorCostInputSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Month must look like 2026-10"),
  vendor: z.string().trim().min(1).max(40),
  category: z.enum(VENDOR_CATEGORIES),
  amount: z.number().finite().min(0).max(10_000_000),
  currency: z.string().regex(/^[A-Z]{3}$/, "Currency must be three upper-case letters"),
  note: z.string().trim().max(200).optional(),
});

export type VendorCostInput = z.infer<typeof vendorCostInputSchema>;
