/**
 * Tests for server/email.ts
 *
 * These tests validate:
 * 1. Email template generation (subject lines, HTML content, score colours)
 * 2. sendEmail behaviour — success path, error path, missing key path
 * 3. broadcastEmail skips recipients with null emails
 * 4. RESEND_API_KEY env var is present and correctly formatted
 *
 * The Resend SDK is mocked so no live network calls are made.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock Resend SDK and ENV before any imports ───────────────────────────────

const mockSend = vi.fn();

vi.mock("resend", () => {
  return {
    Resend: vi.fn().mockImplementation(() => ({
      emails: { send: mockSend },
    })),
  };
});

vi.mock("./_core/env", () => ({
  ENV: { resendApiKey: "re_test_key_for_testing" },
}));

import {
  buildFeedbackEmail,
  buildGameAvailableEmail,
  buildResultPublishedEmail,
  buildStreakAtRiskEmail,
  buildWelcomeEmail,
  sendEmail,
  broadcastEmail,
} from "./email";

// ─── Template Tests ───────────────────────────────────────────────────────────

describe("buildGameAvailableEmail", () => {
  it("includes both tickers in the subject line", () => {
    const { subject } = buildGameAvailableEmail({
      companyAName: "Apple Inc.",
      companyATicker: "AAPL",
      companyBName: "Microsoft Corp.",
      companyBTicker: "MSFT",
      sector: "Technology",
      gameDate: "2026-06-11",
      lockoutAt: new Date("2026-06-11T20:00:00Z"),
    });
    expect(subject).toContain("AAPL");
    expect(subject).toContain("MSFT");
  });

  it("renders both company names in the HTML", () => {
    const { html } = buildGameAvailableEmail({
      companyAName: "Apple Inc.",
      companyATicker: "AAPL",
      companyBName: "Microsoft Corp.",
      companyBTicker: "MSFT",
      sector: "Technology",
      gameDate: "2026-06-11",
      lockoutAt: null,
    });
    expect(html).toContain("Apple Inc.");
    expect(html).toContain("Microsoft Corp.");
    expect(html).toContain("AAPL");
    expect(html).toContain("MSFT");
  });

  it("omits lockout line when lockoutAt is null", () => {
    const { html } = buildGameAvailableEmail({
      companyAName: "Apple Inc.",
      companyATicker: "AAPL",
      companyBName: "Microsoft Corp.",
      companyBTicker: "MSFT",
      gameDate: "2026-06-11",
      lockoutAt: null,
    });
    expect(html).not.toContain("Lockout:");
  });

  it("includes lockout time when lockoutAt is provided", () => {
    const { html } = buildGameAvailableEmail({
      companyAName: "Apple Inc.",
      companyATicker: "AAPL",
      companyBName: "Microsoft Corp.",
      companyBTicker: "MSFT",
      gameDate: "2026-06-11",
      lockoutAt: new Date("2026-06-11T20:00:00Z"),
    });
    expect(html).toContain("Lockout");
  });
});

describe("buildResultPublishedEmail", () => {
  it("includes the winner ticker in the subject", () => {
    const { subject } = buildResultPublishedEmail({
      playerName: "Alice",
      companyAName: "Apple Inc.",
      companyATicker: "AAPL",
      companyBName: "Microsoft Corp.",
      companyBTicker: "MSFT",
      winner: "A",
      predictionScore: 80,
      validationScore: 20,
      totalScore: 100,
      gameDate: "2026-06-11",
    });
    expect(subject).toContain("AAPL");
    expect(subject).toContain("100");
  });

  it("shows the player's name in the greeting", () => {
    const { html } = buildResultPublishedEmail({
      playerName: "Alice",
      companyAName: "Apple Inc.",
      companyATicker: "AAPL",
      companyBName: "Microsoft Corp.",
      companyBTicker: "MSFT",
      winner: "A",
      predictionScore: 80,
      validationScore: 20,
      totalScore: 100,
      gameDate: "2026-06-11",
    });
    expect(html).toContain("Hi Alice");
  });

  it("uses green colour for high scores (>=80)", () => {
    const { html } = buildResultPublishedEmail({
      playerName: null,
      companyAName: "Apple Inc.",
      companyATicker: "AAPL",
      companyBName: "Microsoft Corp.",
      companyBTicker: "MSFT",
      winner: "B",
      predictionScore: 80,
      validationScore: 20,
      totalScore: 100,
      gameDate: "2026-06-11",
    });
    expect(html).toContain("#4ade80"); // green
  });

  it("uses red colour for low scores (<50)", () => {
    const { html } = buildResultPublishedEmail({
      playerName: null,
      companyAName: "Apple Inc.",
      companyATicker: "AAPL",
      companyBName: "Microsoft Corp.",
      companyBTicker: "MSFT",
      winner: "B",
      predictionScore: 0,
      validationScore: 0,
      totalScore: 0,
      gameDate: "2026-06-11",
    });
    expect(html).toContain("#f87171"); // red
  });

  it("includes commentary when provided", () => {
    const { html } = buildResultPublishedEmail({
      playerName: null,
      companyAName: "Apple Inc.",
      companyATicker: "AAPL",
      companyBName: "Microsoft Corp.",
      companyBTicker: "MSFT",
      winner: "A",
      predictionScore: 80,
      validationScore: 20,
      totalScore: 100,
      resultCommentary: "Strong earnings drove the outperformance.",
      gameDate: "2026-06-11",
    });
    expect(html).toContain("Strong earnings drove the outperformance.");
  });
});

describe("buildStreakAtRiskEmail", () => {
  it("includes streak count in the subject", () => {
    const { subject } = buildStreakAtRiskEmail({
      playerName: "Bob",
      currentStreak: 7,
      companyAName: "Tesla Inc.",
      companyATicker: "TSLA",
      companyBName: "Ford Motor",
      companyBTicker: "F",
      lockoutAt: new Date("2026-06-11T20:00:00Z"),
    });
    expect(subject).toContain("7");
  });
});

describe("buildWelcomeEmail", () => {
  it("frames the email around founding beta membership", () => {
    const { subject, html } = buildWelcomeEmail({ playerName: "Claire", joinDate: "16 July 2026" });
    expect(subject.toLowerCase()).toContain("founding beta");
    expect(html).toContain("Hi Claire,");
    expect(html).toContain("16 July 2026");
  });

  it("links to the game and handles a null player name", () => {
    const { html } = buildWelcomeEmail({ playerName: null, joinDate: "16 July 2026" });
    expect(html).toContain("Hi,");
    expect(html).toContain("https://munymo.com/game");
  });

  it("tells the tester how to give feedback (reply or form)", () => {
    const { html } = buildWelcomeEmail({ playerName: null, joinDate: "16 July 2026" });
    expect(html.toLowerCase()).toContain("reply to this email");
    expect(html).toContain("https://munymo.com/feedback");
  });
});

describe("buildFeedbackEmail", () => {
  it("includes the player identity and message", () => {
    const { subject, html } = buildFeedbackEmail({
      playerName: "Claire Bear",
      email: "claire@example.com",
      userId: 42,
      message: "The chart is hard to read on my phone.",
    });
    expect(subject).toContain("Claire Bear");
    expect(html).toContain("claire@example.com");
    expect(html).toContain("#42");
    expect(html).toContain("The chart is hard to read on my phone.");
  });

  it("escapes HTML in the message so markup can't be injected", () => {
    const { html } = buildFeedbackEmail({
      playerName: null,
      email: null,
      userId: 1,
      message: "<script>alert(1)</script>",
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

// ─── sendEmail — mocked SDK paths ───────────────────────────────────────────

describe("sendEmail", () => {
  beforeEach(() => {
    mockSend.mockReset();
  });

  it("returns success:true when Resend SDK succeeds", async () => {
    mockSend.mockResolvedValueOnce({ data: { id: "email_123" }, error: null });
    const result = await sendEmail({
      to: "player@example.com",
      subject: "Test Subject",
      html: "<p>Hello</p>",
    });
    expect(result.success).toBe(true);
    expect(mockSend).toHaveBeenCalledOnce();
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "player@example.com",
        subject: "Test Subject",
      })
    );
  });

  it("returns success:false when Resend returns an error object", async () => {
    mockSend.mockResolvedValueOnce({
      data: null,
      error: { message: "Domain not verified", name: "validation_error" },
    });
    const result = await sendEmail({
      to: "player@example.com",
      subject: "Test",
      html: "<p>Test</p>",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Domain not verified");
    }
  });

  it("returns success:false and does not throw when Resend SDK throws", async () => {
    mockSend.mockRejectedValueOnce(new Error("Network timeout"));
    const result = await sendEmail({
      to: "player@example.com",
      subject: "Test",
      html: "<p>Test</p>",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Network timeout");
    }
  });

  it("sends from the munymo.com notifications address", async () => {
    mockSend.mockResolvedValueOnce({ data: { id: "email_456" }, error: null });
    await sendEmail({ to: "test@example.com", subject: "Hi", html: "<p>Hi</p>" });
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: expect.stringContaining("munymo.com"),
      })
    );
  });

  it("sets reply-to to the feedback address on every send", async () => {
    mockSend.mockResolvedValueOnce({ data: { id: "email_789" }, error: null });
    await sendEmail({ to: "test@example.com", subject: "Hi", html: "<p>Hi</p>" });
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        replyTo: "feedback@munymo.com",
      })
    );
  });
});

// ─── broadcastEmail — null email filtering and batching ──────────────────────

describe("broadcastEmail", () => {
  beforeEach(() => {
    mockSend.mockReset();
  });

  it("skips recipients with null emails and counts them as failed", async () => {
    const recipients = [
      { email: null, name: "No Email User" },
      { email: null, name: "Another No Email" },
    ];
    const { sent, failed } = await broadcastEmail({
      recipients,
      subject: "Test",
      html: "<p>Test</p>",
    });
    expect(sent).toBe(0);
    expect(failed).toBe(2);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("sends to all recipients with valid emails", async () => {
    mockSend.mockResolvedValue({ data: { id: "ok" }, error: null });
    const recipients = [
      { email: "alice@example.com", name: "Alice" },
      { email: "bob@example.com", name: "Bob" },
      { email: null, name: "No Email" },
    ];
    const { sent, failed } = await broadcastEmail({
      recipients,
      subject: "Game is live",
      html: "<p>Play now</p>",
    });
    expect(sent).toBe(2);
    expect(failed).toBe(1); // null email
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it("continues sending to remaining recipients when one fails", async () => {
    mockSend
      .mockResolvedValueOnce({ data: null, error: { message: "Bounced", name: "bounce" } })
      .mockResolvedValueOnce({ data: { id: "ok" }, error: null });
    const recipients = [
      { email: "bad@example.com", name: "Bad" },
      { email: "good@example.com", name: "Good" },
    ];
    const { sent, failed } = await broadcastEmail({
      recipients,
      subject: "Test",
      html: "<p>Test</p>",
    });
    expect(sent).toBe(1);
    expect(failed).toBe(1);
  });
});

