/**
 * Tests for push notification helpers.
 * These tests verify the utility functions without requiring a live database
 * or actual VAPID keys.
 */
import { describe, it, expect } from "vitest";
import { hashEndpoint } from "./push";

describe("hashEndpoint", () => {
  it("returns a 64-character hex string (SHA-256)", () => {
    const hash = hashEndpoint("https://fcm.googleapis.com/fcm/send/abc123");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic — same input always produces same hash", () => {
    const endpoint = "https://fcm.googleapis.com/fcm/send/test-endpoint";
    expect(hashEndpoint(endpoint)).toBe(hashEndpoint(endpoint));
  });

  it("produces different hashes for different endpoints", () => {
    const h1 = hashEndpoint("https://fcm.googleapis.com/fcm/send/device-1");
    const h2 = hashEndpoint("https://fcm.googleapis.com/fcm/send/device-2");
    expect(h1).not.toBe(h2);
  });

  it("handles long endpoint URLs without truncation", () => {
    const longUrl = "https://updates.push.services.mozilla.com/wpush/v2/" + "a".repeat(200);
    const hash = hashEndpoint(longUrl);
    expect(hash).toHaveLength(64);
  });
});
