import { ENV } from "./env";
import { sendEmail } from "../email";

export type NotificationPayload = {
  title: string;
  content: string;
};

/**
 * Sends a project-owner alert email via Resend. Returns `true` if the email was
 * accepted by Resend, `false` otherwise (missing config, missing content, or a
 * delivery failure). Never throws — callers rely on this to be a safe no-op
 * fallback, not a source of unhandled 500s.
 */
export async function notifyOwner(
  payload: NotificationPayload
): Promise<boolean> {
  const title = payload.title?.trim();
  const content = payload.content?.trim();

  if (!title || !content) {
    console.error("[Notification] notifyOwner called with empty title/content — skipping");
    return false;
  }

  if (!ENV.ownerAlertEmail) {
    console.error("[Notification] OWNER_ALERT_EMAIL is not configured — skipping owner alert");
    return false;
  }

  const result = await sendEmail({
    to: ENV.ownerAlertEmail,
    subject: title,
    html: `<pre style="font-family:inherit;white-space:pre-wrap;">${content}</pre>`,
  });

  if (!result.success) {
    console.error("[Notification] Failed to send owner alert email:", result.error);
    return false;
  }

  return true;
}
