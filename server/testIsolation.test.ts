import { describe, expect, it } from "vitest";
import { ENV } from "./_core/env";
import { getDb } from "./db";

/**
 * The test suite must never be able to reach a real database, whatever the
 * shell it is launched from has in its environment. Tests such as
 * dashboard.deleteAccount depend on "no database" to exercise their failure
 * path; with a live connection they would run real erasure against user 1.
 * vitest.config.ts blanks the connection strings — this fails if that guard
 * is ever removed or stops working.
 */
describe("test isolation — no database is reachable from the suite", () => {
  it("has no connection string, even if the launching shell exported one", () => {
    expect(process.env.DATABASE_URL ?? "").toBe("");
    expect(process.env.MUNYMO_DATABASE_URL ?? "").toBe("");
    expect(ENV.databaseUrl).toBe("");
  });

  it("getDb() resolves to null", async () => {
    expect(await getDb()).toBeNull();
  });
});
