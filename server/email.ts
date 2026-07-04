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
  magicLink?: string | null;
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
  /** Token for "See Full Result" CTA → /game/:id/result */
  resultMagicLink?: string | null;
  /** Token for "Play Today's Game" CTA → /game */
  magicLink?: string | null;
};

export type MissedGameData = {
  playerName: string | null;
  companyAName: string;
  companyATicker: string;
  companyBName: string;
  companyBTicker: string;
  winner: "A" | "B";
  gameDate: string;
  nextCompanyAName?: string | null;
  nextCompanyATicker?: string | null;
  nextCompanyBName?: string | null;
  nextCompanyBTicker?: string | null;
  /** Token for "See Yesterday's Result" CTA → /game/:id/result */
  resultMagicLink?: string | null;
  /** Token for "Play Today's Game" CTA → /game */
  magicLink?: string | null;
};

export type StreakAtRiskData = {
  playerName: string | null;
  currentStreak: number;
  companyAName: string;
  companyATicker: string;
  companyBName: string;
  companyBTicker: string;
  lockoutAt: Date;
  magicLink?: string | null;
};

// ─── Shared Styles ────────────────────────────────────────────────────────────

const BASE_URL = "https://munymo.com";

// Brand colours (light mode, matching the site)
const BRAND_GREEN = "#009050";       // emerald CTA green
const DEEP_GREEN  = "#1a3a2a";       // dark heading / logo green
const BG_PAGE     = "#f5f7f5";       // near-white page background
const BG_CARD     = "#ffffff";       // white card
const BG_SUBTLE   = "#f0f4f1";       // subtle section background
const BORDER      = "#d8e4dc";       // light green-tinted border
const TEXT_MAIN   = "#111c16";       // near-black body text
const TEXT_MUTED  = "#4a6358";       // muted green-grey text
const TEXT_LABEL  = "#7a9e8a";       // uppercase label colour

const emailWrapper = (content: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Munymo</title>
</head>
<body style="margin:0;padding:0;background-color:${BG_PAGE};font-family:'Plus Jakarta Sans',Arial,sans-serif;color:${TEXT_MAIN};">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:${BG_PAGE};padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <!-- Logo header -->
          <tr>
            <td style="padding:0 0 28px 0;text-align:center;">
              <a href="${BASE_URL}" style="text-decoration:none;">
                <img src="${BASE_URL}/munymo-logo-cropped_e625fcf7.png" alt="Munymo" width="180" height="39" style="display:inline-block;border:0;" />
              </a>
              <p style="margin:8px 0 0 0;font-size:11px;font-weight:600;letter-spacing:0.18em;color:${TEXT_LABEL};text-transform:uppercase;">Daily Stock Prediction Game</p>
            </td>
          </tr>
          <!-- Content card -->
          <tr>
            <td style="background-color:${BG_CARD};border:1px solid ${BORDER};border-radius:12px;padding:40px 36px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 0 0 0;text-align:center;">
              <p style="margin:0;font-size:12px;color:${TEXT_LABEL};line-height:1.6;">
                You're receiving this because you have a Munymo account.<br/>
                <a href="${BASE_URL}" style="color:${BRAND_GREEN};text-decoration:none;">munymo.com</a>
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

const greenButton = (href: string, lbl: string) =>
  `<a href="${href}" style="display:inline-block;background-color:${BRAND_GREEN};color:#ffffff;font-weight:700;font-size:15px;padding:14px 32px;border-radius:8px;text-decoration:none;letter-spacing:0.03em;font-family:'Plus Jakarta Sans',Arial,sans-serif;">${lbl}</a>`;

const divider = `<hr style="border:none;border-top:1px solid ${BORDER};margin:28px 0;" />`;

const label = (text: string) =>
  `<span style="font-size:11px;font-weight:700;letter-spacing:0.12em;color:${TEXT_LABEL};text-transform:uppercase;">${text}</span>`;

const tickerBadge = (ticker: string, name: string) =>
  `<div style="background-color:${BG_SUBTLE};border:1px solid ${BORDER};border-radius:8px;padding:16px 12px;text-align:center;">
    <p style="margin:0 0 4px 0;font-size:22px;font-weight:700;color:${DEEP_GREEN};font-family:Georgia,serif;">${ticker}</p>
    <p style="margin:0;font-size:12px;color:${TEXT_MUTED};">${name}</p>
  </div>`;

// ─── Template: Game Available ─────────────────────────────────────────────────

export function buildGameAvailableEmail(data: GameAvailableData): { subject: string; html: string } {
  const subject = `Today's Munymo matchup is live — ${data.companyATicker} vs ${data.companyBTicker}`;
  const ctaUrl = data.magicLink ?? `${BASE_URL}/game`;

  const lockoutLine = data.lockoutAt
    ? `<p style="margin:0 0 24px 0;font-size:14px;color:${TEXT_MUTED};">
        ${label("Lockout")} <strong style="color:${TEXT_MAIN};margin-left:8px;">${data.lockoutAt.toUTCString()}</strong>
      </p>`
    : "";

  const sectorLine = data.sector
    ? `<p style="margin:0 0 20px 0;font-size:13px;color:${TEXT_MUTED};">${label("Sector")} <span style="margin-left:8px;">${data.sector}</span></p>`
    : "";

  const html = emailWrapper(`
    <h1 style="margin:0 0 6px 0;font-size:24px;font-weight:700;color:${DEEP_GREEN};">
      Today's matchup is live
    </h1>
    <p style="margin:0 0 28px 0;font-size:14px;color:${TEXT_MUTED};">${data.gameDate}</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px 0;">
      <tr>
        <td width="45%">${tickerBadge(data.companyATicker, data.companyAName)}</td>
        <td width="10%" style="text-align:center;vertical-align:middle;">
          <span style="font-size:14px;color:${TEXT_LABEL};font-weight:700;">VS</span>
        </td>
        <td width="45%">${tickerBadge(data.companyBTicker, data.companyBName)}</td>
      </tr>
    </table>

    ${sectorLine}
    ${lockoutLine}
    ${divider}
    <p style="margin:0 0 24px 0;font-size:14px;color:${TEXT_MUTED};line-height:1.6;">
      Make your Gut Selection, review the research, then lock in your Final Selection before the deadline.
    </p>
    <div style="text-align:center;">
      ${greenButton(ctaUrl, "Play Today's Game →")}
    </div>
  `);

  return { subject, html };
}

// ─── Template: Result Published ───────────────────────────────────────────────

export function buildResultPublishedEmail(data: ResultPublishedData): { subject: string; html: string } {
  const winnerName   = data.winner === "A" ? data.companyAName   : data.companyBName;
  const winnerTicker = data.winner === "A" ? data.companyATicker : data.companyBTicker;
  const greeting     = data.playerName ? `Hi ${data.playerName},` : "Hi,";
  const scoreColour  = data.totalScore >= 80 ? "#4ade80" : data.totalScore >= 50 ? "#b07d00" : "#f87171";
  const resultUrl = data.resultMagicLink ?? `${BASE_URL}/game`;
  const playUrl   = data.magicLink        ?? `${BASE_URL}/game`;

  const subject = `Munymo result: ${winnerTicker} wins — your score is ${data.totalScore}`;

  const commentaryBlock = data.resultCommentary
    ? `${divider}
       <p style="margin:0 0 8px 0;">${label("Commentary")}</p>
       <p style="margin:0 0 20px 0;font-size:14px;color:${TEXT_MUTED};line-height:1.6;">${data.resultCommentary}</p>`
    : "";

  const html = emailWrapper(`
    <p style="margin:0 0 20px 0;font-size:15px;color:${TEXT_MAIN};">${greeting}</p>
    <h1 style="margin:0 0 6px 0;font-size:24px;font-weight:700;color:${DEEP_GREEN};">
      ${data.gameDate} result is in
    </h1>
    <p style="margin:0 0 28px 0;font-size:15px;color:${TEXT_MUTED};">
      <strong style="color:${BRAND_GREEN};">${winnerTicker}</strong> (${winnerName}) outperformed today.
    </p>

    <!-- Score card -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:${BG_SUBTLE};border:1px solid ${BORDER};border-radius:8px;margin:0 0 24px 0;">
      <tr>
        <td style="padding:20px;text-align:center;border-right:1px solid ${BORDER};" width="33%">
          ${label("Prediction")}
          <p style="margin:8px 0 0 0;font-size:28px;font-weight:700;color:${DEEP_GREEN};font-family:Georgia,serif;">${data.predictionScore}</p>
          <p style="margin:4px 0 0 0;font-size:11px;color:${TEXT_LABEL};">/ 80 pts</p>
        </td>
        <td style="padding:20px;text-align:center;border-right:1px solid ${BORDER};" width="33%">
          ${label("Validation")}
          <p style="margin:8px 0 0 0;font-size:28px;font-weight:700;color:${DEEP_GREEN};font-family:Georgia,serif;">${data.validationScore}</p>
          <p style="margin:4px 0 0 0;font-size:11px;color:${TEXT_LABEL};">/ 20 pts</p>
        </td>
        <td style="padding:20px;text-align:center;" width="33%">
          ${label("Total Score")}
          <p style="margin:8px 0 0 0;font-size:28px;font-weight:700;color:${scoreColour};font-family:Georgia,serif;">${data.totalScore}</p>
          <p style="margin:4px 0 0 0;font-size:11px;color:${TEXT_LABEL};">/ 100 pts</p>
        </td>
      </tr>
    </table>

    ${commentaryBlock}
    ${divider}
    <p style="margin:0 0 20px 0;font-size:14px;color:${TEXT_MUTED};line-height:1.6;">
      See the full result breakdown, Hindsight Spotlight, and how the crowd voted — all on the site.
    </p>
    <div style="text-align:center;margin-bottom:12px;">
      ${greenButton(resultUrl, "View Full Results →")}
    </div>
    <div style="text-align:center;">
      ${greenButton(playUrl, "Play Today's Game →")}
    </div>
  `);

  return { subject, html };
}

// ─── Template: Missed Game (re-engagement) ────────────────────────────────────

export function buildMissedGameEmail(data: MissedGameData): { subject: string; html: string } {
  const winnerName   = data.winner === "A" ? data.companyAName   : data.companyBName;
  const winnerTicker = data.winner === "A" ? data.companyATicker : data.companyBTicker;
  const loserTicker  = data.winner === "A" ? data.companyBTicker : data.companyATicker;
  const greeting     = data.playerName ? `Hi ${data.playerName},` : "Hi,";
  const resultUrl = data.resultMagicLink ?? `${BASE_URL}/game`;
  const playUrl   = data.magicLink        ?? `${BASE_URL}/game`;

  const subject = `You missed it — ${winnerTicker} beat ${loserTicker} on ${data.gameDate}`;

  const nextGameBlock = (data.nextCompanyATicker && data.nextCompanyBTicker)
    ? `${divider}
       <p style="margin:0 0 12px 0;">${label("Up next — play today")}</p>
       <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px 0;">
         <tr>
           <td width="45%">${tickerBadge(data.nextCompanyATicker, data.nextCompanyAName ?? "")}</td>
           <td width="10%" style="text-align:center;vertical-align:middle;">
             <span style="font-size:14px;color:${TEXT_LABEL};font-weight:700;">VS</span>
           </td>
           <td width="45%">${tickerBadge(data.nextCompanyBTicker, data.nextCompanyBName ?? "")}</td>
         </tr>
       </table>`
    : "";

  const html = emailWrapper(`
    <p style="margin:0 0 20px 0;font-size:15px;color:${TEXT_MAIN};">${greeting}</p>
    <h1 style="margin:0 0 6px 0;font-size:24px;font-weight:700;color:${DEEP_GREEN};">
      You missed yesterday's game
    </h1>
    <p style="margin:0 0 28px 0;font-size:15px;color:${TEXT_MUTED};">
      <strong style="color:${BRAND_GREEN};">${winnerTicker}</strong> (${winnerName}) outperformed on ${data.gameDate}.
      No worries — today's a fresh start.
    </p>

    <!-- Result teaser -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:${BG_SUBTLE};border:1px solid ${BORDER};border-radius:8px;margin:0 0 24px 0;">
      <tr>
        <td width="50%" style="padding:20px;text-align:center;border-right:1px solid ${BORDER};">
          ${label("Winner")}
          <p style="margin:8px 0 4px 0;font-size:22px;font-weight:700;color:${BRAND_GREEN};font-family:Georgia,serif;">${winnerTicker}</p>
          <p style="margin:0;font-size:12px;color:${TEXT_MUTED};">${winnerName}</p>
        </td>
        <td width="50%" style="padding:20px;text-align:center;">
          ${label("Your score")}
          <p style="margin:8px 0 4px 0;font-size:22px;font-weight:700;color:${TEXT_LABEL};font-family:Georgia,serif;">—</p>
          <p style="margin:0;font-size:12px;color:${TEXT_LABEL};">Didn't play</p>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 20px 0;font-size:14px;color:${TEXT_MUTED};line-height:1.6;">
      See the full result, Hindsight Spotlight, and crowd vote breakdown on the site.
    </p>
    <div style="text-align:center;margin-bottom:8px;">
      ${greenButton(resultUrl, "See Yesterday's Result →")}
    </div>

    ${nextGameBlock}

    ${divider}
    <p style="margin:0 0 20px 0;font-size:14px;color:${TEXT_MUTED};line-height:1.6;">
      Don't miss today's matchup — make your pick before lockout.
    </p>
    <div style="text-align:center;">
      ${greenButton(playUrl, "Play Today's Game →")}
    </div>
  `);

  return { subject, html };
}

// ─── Template: Streak At Risk ─────────────────────────────────────────────────

export function buildStreakAtRiskEmail(data: StreakAtRiskData): { subject: string; html: string } {
  const greeting = data.playerName ? `Hi ${data.playerName},` : "Hi,";
  const lockoutStr = data.lockoutAt.toUTCString();
  const ctaUrl = data.magicLink ?? `${BASE_URL}/game`;
  const subject = `Your ${data.currentStreak}-day Munymo streak is at risk — play before lockout`;

  const html = emailWrapper(`
    <p style="margin:0 0 20px 0;font-size:15px;color:${TEXT_MAIN};">${greeting}</p>
    <h1 style="margin:0 0 6px 0;font-size:24px;font-weight:700;color:${DEEP_GREEN};">
      Your streak is at risk
    </h1>
    <p style="margin:0 0 28px 0;font-size:15px;color:${TEXT_MUTED};line-height:1.6;">
      You have a <strong style="color:${TEXT_MAIN};">${data.currentStreak}-day streak</strong> and today's game closes soon.
      Submit your pick before lockout to keep it alive.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:${BG_SUBTLE};border:1px solid ${BORDER};border-radius:8px;margin:0 0 24px 0;">
      <tr>
        <td width="45%" style="padding:20px;text-align:center;border-right:1px solid ${BORDER};">
          ${tickerBadge(data.companyATicker, data.companyAName)}
        </td>
        <td width="10%" style="text-align:center;vertical-align:middle;">
          <span style="font-size:14px;color:${TEXT_LABEL};font-weight:700;">VS</span>
        </td>
        <td width="45%" style="padding:20px;text-align:center;">
          ${tickerBadge(data.companyBTicker, data.companyBName)}
        </td>
      </tr>
    </table>

    <p style="margin:0 0 24px 0;font-size:13px;color:${TEXT_LABEL};text-align:center;">
      Lockout: <strong style="color:${TEXT_MUTED};">${lockoutStr}</strong>
    </p>
    <div style="text-align:center;">
      ${greenButton(ctaUrl, "Play Now — Keep Your Streak →")}
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
