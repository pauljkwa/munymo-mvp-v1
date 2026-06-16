import { Resend } from "resend";
import { ENV } from "./_core/env";

// ─── Client ───────────────────────────────────────────────────────────────────

let _resend: Resend | null = null;

function getResend(): Resend | null {
  if (!ENV.resendApiKey) return null;
  if (!_resend) _resend = new Resend(ENV.resendApiKey);
  return _resend;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type EmailResult = { success: true } | { success: false; error: string };

export type GameAvailableData = {
  companyAName: string;
  companyATicker: string;
  companyBName: string;
  companyBTicker: string;
  sector?: string | null;
  gameDate: string;
  lockoutAt?: Date | null;
};

export type ResultPublishedData = {
  playerName: string | null;
  companyAName: string;
  companyATicker: string;
  companyBName: string;
  companyBTicker: string;
  winner: "A" | "B";
  predictionScore: number;
  validationScore: number;
  totalScore: number;
  resultCommentary?: string | null;
  gameDate: string;
};

export type StreakAtRiskData = {
  playerName: string | null;
  currentStreak: number;
  companyAName: string;
  companyATicker: string;
  companyBName: string;
  companyBTicker: string;
  lockoutAt: Date;
};

// ─── Shared Styles ────────────────────────────────────────────────────────────

const BASE_URL = "https://munymo.com";

const emailWrapper = (content: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Munymo</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0f;font-family:'Inter',Arial,sans-serif;color:#e8e6e0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0f;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="padding:0 0 32px 0;text-align:center;">
              <a href="${BASE_URL}" style="text-decoration:none;">
                <span style="font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:700;color:#c9a84c;letter-spacing:0.08em;">MUNYMO</span>
              </a>
            </td>
          </tr>
          <!-- Content card -->
          <tr>
            <td style="background-color:#12121a;border:1px solid #2a2a3a;border-radius:12px;padding:40px 36px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:28px 0 0 0;text-align:center;">
              <p style="margin:0;font-size:12px;color:#6b6b7a;line-height:1.6;">
                You are receiving this because you have a Munymo account.<br/>
                <a href="${BASE_URL}" style="color:#c9a84c;text-decoration:none;">munymo.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const goldButton = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;background-color:#c9a84c;color:#0a0a0f;font-weight:700;font-size:15px;padding:14px 32px;border-radius:8px;text-decoration:none;letter-spacing:0.04em;">${label}</a>`;

const divider = `<hr style="border:none;border-top:1px solid #2a2a3a;margin:28px 0;" />`;

const label = (text: string) =>
  `<span style="font-size:11px;font-weight:600;letter-spacing:0.1em;color:#6b6b7a;text-transform:uppercase;">${text}</span>`;

// ─── Template: Game Available ─────────────────────────────────────────────────

export function buildGameAvailableEmail(data: GameAvailableData): { subject: string; html: string } {
  const subject = `Today's Munymo matchup is live — ${data.companyATicker} vs ${data.companyBTicker}`;

  const lockoutLine = data.lockoutAt
    ? `<p style="margin:0 0 24px 0;font-size:14px;color:#a09e98;">
        Lockout: <strong style="color:#e8e6e0;">${data.lockoutAt.toUTCString()}</strong>
      </p>`
    : "";

  const sectorLine = data.sector
    ? `<p style="margin:0 0 8px 0;">${label("Sector")} <span style="font-size:14px;color:#a09e98;margin-left:8px;">${data.sector}</span></p>`
    : "";

  const html = emailWrapper(`
    <h1 style="margin:0 0 8px 0;font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:700;color:#e8e6e0;">
      Today's matchup is live
    </h1>
    <p style="margin:0 0 28px 0;font-size:14px;color:#a09e98;">${data.gameDate}</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;">
      <tr>
        <td width="45%" style="background-color:#1a1a26;border:1px solid #2a2a3a;border-radius:8px;padding:20px;text-align:center;">
          ${label("Company A")}
          <p style="margin:8px 0 4px 0;font-size:22px;font-weight:700;color:#c9a84c;font-family:Georgia,serif;">${data.companyATicker}</p>
          <p style="margin:0;font-size:13px;color:#a09e98;">${data.companyAName}</p>
        </td>
        <td width="10%" style="text-align:center;">
          <span style="font-size:18px;color:#6b6b7a;font-weight:700;">VS</span>
        </td>
        <td width="45%" style="background-color:#1a1a26;border:1px solid #2a2a3a;border-radius:8px;padding:20px;text-align:center;">
          ${label("Company B")}
          <p style="margin:8px 0 4px 0;font-size:22px;font-weight:700;color:#c9a84c;font-family:Georgia,serif;">${data.companyBTicker}</p>
          <p style="margin:0;font-size:13px;color:#a09e98;">${data.companyBName}</p>
        </td>
      </tr>
    </table>

    ${sectorLine}
    ${lockoutLine}
    ${divider}
    <p style="margin:0 0 24px 0;font-size:14px;color:#a09e98;line-height:1.6;">
      Make your Gut Selection, review the research, then lock in your Final Selection before the deadline.
    </p>
    <div style="text-align:center;">
      ${goldButton(`${BASE_URL}/game`, "Play Today's Game →")}
    </div>
  `);

  return { subject, html };
}

// ─── Template: Result Published ───────────────────────────────────────────────

export function buildResultPublishedEmail(data: ResultPublishedData): { subject: string; html: string } {
  const winnerName = data.winner === "A" ? data.companyAName : data.companyBName;
  const winnerTicker = data.winner === "A" ? data.companyATicker : data.companyBTicker;
  const playerCorrect =
    (data.winner === "A" && data.predictionScore > 0) ||
    (data.winner === "B" && data.predictionScore > 0);
  const greeting = data.playerName ? `Hi ${data.playerName},` : "Hi,";
  const scoreColour = data.totalScore >= 80 ? "#4ade80" : data.totalScore >= 50 ? "#c9a84c" : "#f87171";

  const subject = `Munymo result: ${winnerTicker} wins — your score is ${data.totalScore}`;

  const commentaryBlock = data.resultCommentary
    ? `${divider}
       <p style="margin:0 0 8px 0;">${label("Commentary")}</p>
       <p style="margin:0;font-size:14px;color:#a09e98;line-height:1.7;font-style:italic;">${data.resultCommentary}</p>`
    : "";

  const html = emailWrapper(`
    <p style="margin:0 0 20px 0;font-size:15px;color:#e8e6e0;">${greeting}</p>
    <h1 style="margin:0 0 8px 0;font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:700;color:#e8e6e0;">
      ${data.gameDate} result is in
    </h1>
    <p style="margin:0 0 28px 0;font-size:15px;color:#a09e98;">
      <strong style="color:#c9a84c;">${winnerTicker}</strong> (${winnerName}) outperformed today.
    </p>

    <!-- Score card -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#1a1a26;border:1px solid #2a2a3a;border-radius:8px;margin:0 0 24px 0;">
      <tr>
        <td style="padding:24px;text-align:center;border-right:1px solid #2a2a3a;" width="33%">
          ${label("Prediction")}
          <p style="margin:8px 0 0 0;font-size:28px;font-weight:700;color:#e8e6e0;font-family:Georgia,serif;">${data.predictionScore}</p>
          <p style="margin:4px 0 0 0;font-size:11px;color:#6b6b7a;">/ 80 pts</p>
        </td>
        <td style="padding:24px;text-align:center;border-right:1px solid #2a2a3a;" width="33%">
          ${label("Validation")}
          <p style="margin:8px 0 0 0;font-size:28px;font-weight:700;color:#e8e6e0;font-family:Georgia,serif;">${data.validationScore}</p>
          <p style="margin:4px 0 0 0;font-size:11px;color:#6b6b7a;">/ 20 pts</p>
        </td>
        <td style="padding:24px;text-align:center;" width="33%">
          ${label("Total Score")}
          <p style="margin:8px 0 0 0;font-size:28px;font-weight:700;color:${scoreColour};font-family:Georgia,serif;">${data.totalScore}</p>
          <p style="margin:4px 0 0 0;font-size:11px;color:#6b6b7a;">/ 100 pts</p>
        </td>
      </tr>
    </table>

    ${commentaryBlock}
    ${divider}
    <div style="text-align:center;">
      ${goldButton(`${BASE_URL}/results`, "View Full Results →")}
    </div>
  `);

  return { subject, html };
}

// ─── Template: Missed Game (re-engagement) ──────────────────────────────────

export type MissedGameData = {
  playerName: string | null;
  companyAName: string;
  companyATicker: string;
  companyBName: string;
  companyBTicker: string;
  winner: "A" | "B";
  resultCommentary?: string | null;
  gameDate: string;
  nextCompanyAName?: string | null;
  nextCompanyATicker?: string | null;
  nextCompanyBName?: string | null;
  nextCompanyBTicker?: string | null;
};

export function buildMissedGameEmail(data: MissedGameData): { subject: string; html: string } {
  const winnerName = data.winner === "A" ? data.companyAName : data.companyBName;
  const winnerTicker = data.winner === "A" ? data.companyATicker : data.companyBTicker;
  const loserTicker = data.winner === "A" ? data.companyBTicker : data.companyATicker;
  const greeting = data.playerName ? `Hi ${data.playerName},` : "Hi,";

  const subject = `You missed it — ${winnerTicker} beat ${loserTicker} on ${data.gameDate}`;

  const commentaryBlock = data.resultCommentary
    ? `${divider}
       <p style="margin:0 0 8px 0;">${label("What happened")}</p>
       <p style="margin:0;font-size:14px;color:#a09e98;line-height:1.7;font-style:italic;">${data.resultCommentary}</p>`
    : "";

  const nextGameBlock = (data.nextCompanyATicker && data.nextCompanyBTicker)
    ? `${divider}
       <p style="margin:0 0 12px 0;">${label("Up next")}</p>
       <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px 0;">
         <tr>
           <td width="45%" style="background-color:#1a1a26;border:1px solid #2a2a3a;border-radius:8px;padding:16px;text-align:center;">
             <p style="margin:0 0 4px 0;font-size:20px;font-weight:700;color:#c9a84c;font-family:Georgia,serif;">${data.nextCompanyATicker}</p>
             <p style="margin:0;font-size:12px;color:#6b6b7a;">${data.nextCompanyAName}</p>
           </td>
           <td width="10%" style="text-align:center;">
             <span style="font-size:16px;color:#6b6b7a;font-weight:700;">VS</span>
           </td>
           <td width="45%" style="background-color:#1a1a26;border:1px solid #2a2a3a;border-radius:8px;padding:16px;text-align:center;">
             <p style="margin:0 0 4px 0;font-size:20px;font-weight:700;color:#c9a84c;font-family:Georgia,serif;">${data.nextCompanyBTicker}</p>
             <p style="margin:0;font-size:12px;color:#6b6b7a;">${data.nextCompanyBName}</p>
           </td>
         </tr>
       </table>`
    : "";

  const html = emailWrapper(`
    <p style="margin:0 0 20px 0;font-size:15px;color:#e8e6e0;">${greeting}</p>
    <h1 style="margin:0 0 8px 0;font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:700;color:#e8e6e0;">
      You missed yesterday's game
    </h1>
    <p style="margin:0 0 28px 0;font-size:15px;color:#a09e98;">
      <strong style="color:#c9a84c;">${winnerTicker}</strong> (${winnerName}) outperformed on ${data.gameDate}.
      You didn't play — no worries, today's a fresh start.
    </p>

    <!-- Result card -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#1a1a26;border:1px solid #2a2a3a;border-radius:8px;margin:0 0 24px 0;">
      <tr>
        <td width="45%" style="padding:20px;text-align:center;border-right:1px solid #2a2a3a;">
          ${label("Winner")}
          <p style="margin:8px 0 4px 0;font-size:22px;font-weight:700;color:#4ade80;font-family:Georgia,serif;">${winnerTicker}</p>
          <p style="margin:0;font-size:12px;color:#6b6b7a;">${winnerName}</p>
        </td>
        <td width="45%" style="padding:20px;text-align:center;">
          ${label("Your score")}
          <p style="margin:8px 0 4px 0;font-size:22px;font-weight:700;color:#6b6b7a;font-family:Georgia,serif;">—</p>
          <p style="margin:0;font-size:12px;color:#6b6b7a;">Didn't play</p>
        </td>
      </tr>
    </table>

    ${commentaryBlock}
    ${nextGameBlock}
    ${divider}
    <p style="margin:0 0 20px 0;font-size:14px;color:#a09e98;line-height:1.6;">
      Don't miss today's matchup — make your pick before lockout.
    </p>
    <div style="text-align:center;">
      ${goldButton(`${BASE_URL}/game`, "Play Today's Game →")}
    </div>
  `);

  return { subject, html };
}

// ─── Template: Streak At Risk ─────────────────────────────────────────────────

export function buildStreakAtRiskEmail(data: StreakAtRiskData): { subject: string; html: string } {
  const greeting = data.playerName ? `Hi ${data.playerName},` : "Hi,";
  const lockoutStr = data.lockoutAt.toUTCString();
  const subject = `Your ${data.currentStreak}-day Munymo streak is at risk — play before lockout`;

  const html = emailWrapper(`
    <p style="margin:0 0 20px 0;font-size:15px;color:#e8e6e0;">${greeting}</p>
    <h1 style="margin:0 0 8px 0;font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:700;color:#c9a84c;">
      Your streak is at risk
    </h1>
    <p style="margin:0 0 28px 0;font-size:15px;color:#a09e98;line-height:1.6;">
      You have a <strong style="color:#e8e6e0;">${data.currentStreak}-day streak</strong> and today's game closes soon.
      Submit your pick before lockout to keep it alive.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#1a1a26;border:1px solid #2a2a3a;border-radius:8px;margin:0 0 24px 0;">
      <tr>
        <td width="45%" style="padding:20px;text-align:center;">
          <p style="margin:0 0 4px 0;font-size:22px;font-weight:700;color:#c9a84c;font-family:Georgia,serif;">${data.companyATicker}</p>
          <p style="margin:0;font-size:12px;color:#6b6b7a;">${data.companyAName}</p>
        </td>
        <td width="10%" style="text-align:center;">
          <span style="font-size:16px;color:#6b6b7a;font-weight:700;">VS</span>
        </td>
        <td width="45%" style="padding:20px;text-align:center;">
          <p style="margin:0 0 4px 0;font-size:22px;font-weight:700;color:#c9a84c;font-family:Georgia,serif;">${data.companyBTicker}</p>
          <p style="margin:0;font-size:12px;color:#6b6b7a;">${data.companyBName}</p>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 24px 0;font-size:13px;color:#6b6b7a;text-align:center;">
      Lockout: <strong style="color:#a09e98;">${lockoutStr}</strong>
    </p>
    <div style="text-align:center;">
      ${goldButton(`${BASE_URL}/game`, "Play Now — Keep Your Streak →")}
    </div>
  `);

  return { subject, html };
}

// ─── Send Helpers ─────────────────────────────────────────────────────────────

const FROM_ADDRESS = "Munymo <notifications@munymo.com>";

/**
 * Send a single transactional email. Returns { success: true } or { success: false, error }.
 * Never throws — callers can proceed even if email delivery fails.
 */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<EmailResult> {
  const resend = getResend();
  if (!resend) {
    console.warn("[Email] RESEND_API_KEY not configured — skipping email to", opts.to);
    return { success: false, error: "RESEND_API_KEY not configured" };
  }
  try {
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
    if (error) {
      console.warn("[Email] Resend error:", error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[Email] Unexpected error:", message);
    return { success: false, error: message };
  }
}

/**
 * Broadcast an email to multiple recipients. Failures are logged but do not
 * abort the loop — a single bad address will not block others.
 */
export async function broadcastEmail(opts: {
  recipients: Array<{ email: string | null; name: string | null }>;
  subject: string;
  html: string;
}): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  for (const recipient of opts.recipients) {
    if (!recipient.email) { failed++; continue; }
    const result = await sendEmail({ to: recipient.email, subject: opts.subject, html: opts.html });
    if (result.success) sent++;
    else failed++;
  }
  return { sent, failed };
}
