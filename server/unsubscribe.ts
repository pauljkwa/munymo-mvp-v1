/**
 * One-click email unsubscribe.
 *
 * Every retention hook Munymo has is an email, sent daily to every opted-in
 * account. Until 2026-09-17 there was no way out of them except finding the
 * toggle on /profile — no footer link, no List-Unsubscribe header. Gmail and
 * Yahoo now require both for bulk senders, and their absence is a spam-placement
 * signal long before the volume thresholds apply. Recipients also expect a
 * one-click link; a missing one is what gets a sender reported as spam, which
 * is the only kind of unsubscribe that hurts.
 *
 * The link carries the user id and an HMAC over it, so it needs no session and
 * cannot be forged for someone else. Clicking it (or a mail client POSTing to
 * it, per RFC 8058) flips `users.emailOptIn` to false. The toggle on /profile
 * turns it back on.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Express, Request, Response } from "express";
import { ENV } from "./_core/env";

const BASE_URL = "https://munymo.com";

function secret(): string {
  // Any long-lived server secret works; it only needs to be stable and private.
  return ENV.curationAgentSecret || ENV.clerkSecretKey || ENV.cookieSecret || "munymo-unsubscribe-dev";
}

export function unsubscribeToken(userId: number, key: string = secret()): string {
  return createHmac("sha256", key).update(`unsubscribe:${userId}`).digest("hex").slice(0, 32);
}

export function verifyUnsubscribeToken(userId: number, token: string, key: string = secret()): boolean {
  if (!Number.isInteger(userId) || userId <= 0) return false;
  if (typeof token !== "string" || token.length !== 32) return false;
  const expected = Buffer.from(unsubscribeToken(userId, key), "utf8");
  const given = Buffer.from(token, "utf8");
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function buildUnsubscribeUrl(userId: number): string {
  return `${BASE_URL}/api/unsubscribe?u=${userId}&t=${unsubscribeToken(userId)}`;
}

function page(title: string, body: string, status = 200): [number, string] {
  return [
    status,
    `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · Munymo</title>
<style>body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f6f7f6;color:#1a2a1f;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px}
.card{background:#fff;border:1px solid #e3e8e4;border-radius:16px;padding:32px;max-width:440px;text-align:center}h1{font-size:20px;margin:0 0 12px}p{font-size:15px;line-height:1.6;color:#4a5a4f;margin:0 0 16px}a{color:#009050;font-weight:600;text-decoration:none}</style></head>
<body><div class="card"><h1>${title}</h1>${body}</div></body></html>`,
  ];
}

async function handle(req: Request, res: Response) {
  const userId = Number.parseInt(String(req.query.u ?? ""), 10);
  const token = String(req.query.t ?? "");
  if (!verifyUnsubscribeToken(userId, token)) {
    const [status, html] = page(
      "That link didn't work",
      `<p>This unsubscribe link is invalid or incomplete. You can turn emails off any time from your <a href="${BASE_URL}/profile">profile</a>.</p>`,
      400
    );
    return res.status(status).type("html").send(html);
  }
  const { updateUserProfile } = await import("./db");
  await updateUserProfile(userId, { emailOptIn: false });
  console.log(`[unsubscribe] user ${userId} opted out of email`);
  const [status, html] = page(
    "You're unsubscribed",
    `<p>Munymo won't email you again. Your account and your game record are untouched.</p>
     <p>Changed your mind? Notifications can be turned back on from your <a href="${BASE_URL}/profile">profile</a>.</p>
     <p><a href="${BASE_URL}/game">Back to today's game →</a></p>`
  );
  return res.status(status).type("html").send(html);
}

export function registerUnsubscribe(app: Express) {
  // GET for the footer link; POST for RFC 8058 one-click from mail clients.
  app.get("/api/unsubscribe", handle);
  app.post("/api/unsubscribe", handle);
}
