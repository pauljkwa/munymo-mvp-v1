import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
const BASE_URL = "https://munymo.com";
const LOGO_URL = `${BASE_URL}/manus-storage/munymo-logo-cropped_75fe3c86.png`;

// Brand colours matching the site
const BRAND_GREEN = "#009050";
const DEEP_GREEN  = "#1a3a2a";
const BG_PAGE     = "#f5f7f5";
const BG_CARD     = "#ffffff";
const BG_SUBTLE   = "#f0f4f1";
const BORDER      = "#d8e4dc";
const TEXT_MAIN   = "#111c16";
const TEXT_MUTED  = "#4a6358";
const TEXT_LABEL  = "#7a9e8a";

const emailWrapper = (content) => `
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
          <tr>
            <td style="padding:0 0 28px 0;text-align:center;">
              <a href="${BASE_URL}" style="text-decoration:none;">
                <img src="${LOGO_URL}" alt="Munymo" width="180" height="39" style="display:inline-block;border:0;" />
              </a>
              <p style="margin:8px 0 0 0;font-size:11px;font-weight:600;letter-spacing:0.18em;color:${TEXT_LABEL};text-transform:uppercase;">Daily Stock Prediction Game</p>
            </td>
          </tr>
          <tr>
            <td style="background-color:${BG_CARD};border:1px solid ${BORDER};border-radius:12px;padding:40px 36px;">
              ${content}
            </td>
          </tr>
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

const greenButton = (href, lbl) =>
  `<a href="${href}" style="display:inline-block;background-color:${BRAND_GREEN};color:#ffffff;font-weight:700;font-size:15px;padding:14px 32px;border-radius:8px;text-decoration:none;letter-spacing:0.03em;font-family:'Plus Jakarta Sans',Arial,sans-serif;">${lbl}</a>`;

const divider = `<hr style="border:none;border-top:1px solid ${BORDER};margin:28px 0;" />`;

const lbl = (text) =>
  `<span style="font-size:11px;font-weight:700;letter-spacing:0.12em;color:${TEXT_LABEL};text-transform:uppercase;">${text}</span>`;

const tickerBadge = (ticker, name) =>
  `<div style="background-color:${BG_SUBTLE};border:1px solid ${BORDER};border-radius:8px;padding:16px 12px;text-align:center;">
    <p style="margin:0 0 4px 0;font-size:22px;font-weight:700;color:${DEEP_GREEN};font-family:Georgia,serif;">${ticker}</p>
    <p style="margin:0;font-size:12px;color:${TEXT_MUTED};">${name}</p>
  </div>`;

// Step 1: Generate magic link via Clerk sign-in tokens API
const tokenRes = await fetch("https://api.clerk.com/v1/sign_in_tokens", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${CLERK_SECRET_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    user_id: "user_3FBAkGF3n0W720K6qR27IUuta0h",
    expires_in_seconds: 86400, // 24 hours
  }),
});
const tokenData = await tokenRes.json();
const clerkTicketUrl = tokenData.url;

// Append redirect to game page after sign-in
const magicLink = clerkTicketUrl
  ? `${clerkTicketUrl}&redirect_url=${encodeURIComponent(BASE_URL + "/game")}`
  : `${BASE_URL}/game`;

// Separate link for yesterday's result
const resultLink = clerkTicketUrl
  ? `${clerkTicketUrl}&redirect_url=${encodeURIComponent(BASE_URL + "/game/1/result")}`
  : `${BASE_URL}/game/1/result`;

console.log("Magic link:", magicLink);

// Step 2: Build the missed-game email (teaser only, no full commentary)
const html = emailWrapper(`
  <p style="margin:0 0 20px 0;font-size:15px;color:${TEXT_MAIN};">Hi Paul,</p>
  <h1 style="margin:0 0 6px 0;font-size:24px;font-weight:700;color:${DEEP_GREEN};">
    You missed yesterday's game
  </h1>
  <p style="margin:0 0 28px 0;font-size:15px;color:${TEXT_MUTED};">
    <strong style="color:${BRAND_GREEN};">AMD</strong> (Advanced Micro Devices, Inc.) outperformed on 2026-06-15.
    No worries — today's a fresh start.
  </p>

  <!-- Result teaser -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:${BG_SUBTLE};border:1px solid ${BORDER};border-radius:8px;margin:0 0 24px 0;">
    <tr>
      <td width="50%" style="padding:20px;text-align:center;border-right:1px solid ${BORDER};">
        ${lbl("Winner")}
        <p style="margin:8px 0 4px 0;font-size:22px;font-weight:700;color:${BRAND_GREEN};font-family:Georgia,serif;">AMD</p>
        <p style="margin:0;font-size:12px;color:${TEXT_MUTED};">Advanced Micro Devices, Inc.</p>
      </td>
      <td width="50%" style="padding:20px;text-align:center;">
        ${lbl("Your score")}
        <p style="margin:8px 0 4px 0;font-size:22px;font-weight:700;color:${TEXT_LABEL};font-family:Georgia,serif;">—</p>
        <p style="margin:0;font-size:12px;color:${TEXT_LABEL};">Didn't play</p>
      </td>
    </tr>
  </table>

  <p style="margin:0 0 20px 0;font-size:14px;color:${TEXT_MUTED};line-height:1.6;">
    See the full result, Hindsight Spotlight, and how the crowd voted — all on the site.
  </p>
  <div style="text-align:center;margin-bottom:8px;">
    ${greenButton(resultLink, "See Yesterday's Result →")}
  </div>

  ${divider}
  <p style="margin:0 0 12px 0;">${lbl("Up next — play today")}</p>
  <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px 0;">
    <tr>
      <td width="45%">${tickerBadge("LLY", "Eli Lilly and Company")}</td>
      <td width="10%" style="text-align:center;vertical-align:middle;">
        <span style="font-size:14px;color:${TEXT_LABEL};font-weight:700;">VS</span>
      </td>
      <td width="45%">${tickerBadge("AMGN", "Amgen Inc.")}</td>
    </tr>
  </table>

  ${divider}
  <p style="margin:0 0 20px 0;font-size:14px;color:${TEXT_MUTED};line-height:1.6;">
    Don't miss today's matchup — make your pick before lockout.
  </p>
  <div style="text-align:center;">
    ${greenButton(magicLink, "Play Today's Game →")}
  </div>
`);

// Step 3: Send
const { data, error } = await resend.emails.send({
  from: "Munymo <notifications@munymo.com>",
  to: "pauljkwa@gmail.com",
  subject: "You missed it — AMD beat INTC on 2026-06-15",
  html,
});

if (error) {
  console.error("Failed:", error);
} else {
  console.log("Sent! Email ID:", data.id);
}
