import { describe, it, expect } from "vitest";

describe("Clerk API key validation", () => {
  it("should authenticate successfully with the Clerk secret key", async () => {
    const key =
      process.env.CLERK_SECRET_KEY ||
      "sk_test_IIZGRKrZyX7OUY9yoRtVWWarhRD3Aeu7yNRFuiwnQY";

    const res = await fetch("https://api.clerk.com/v1/users?limit=1", {
      headers: { Authorization: `Bearer ${key}` },
    });

    // 200 = valid key with users, or empty array — both mean auth succeeded
    // 401/403 = invalid key
    expect(res.status).toBe(200);
  });
});
