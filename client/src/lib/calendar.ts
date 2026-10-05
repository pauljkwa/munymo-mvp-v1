/**
 * "Remind me at the close": a calendar file a guest can add without an
 * account, so they come back for a result that lands hours after they play.
 *
 * Results are published by the post-close run that starts at 16:15 New York
 * time (see the cadence spec), so the reminder is set for 17:00 New York time
 * on the game's trading day, comfortably after it.
 */

const REMINDER_HOUR_NY = 17;

/** UTC instant of `hour`:00 New York time on `gameDate` (YYYY-MM-DD), DST-safe. */
export function newYorkTimeToUtc(gameDate: string, hour: number): Date {
  const [y, m, d] = gameDate.split("-").map(Number);
  // Start from the same wall-clock time in UTC, then correct by New York's
  // offset on that date (EDT −4h or EST −5h).
  const guess = new Date(Date.UTC(y, m - 1, d, hour, 0, 0));
  const nyWall = new Date(guess.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const utcWall = new Date(guess.toLocaleString("en-US", { timeZone: "UTC" }));
  return new Date(guess.getTime() + (utcWall.getTime() - nyWall.getTime()));
}

const icsStamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export function buildResultReminderIcs(gameDate: string, matchup: string, now = new Date()): string {
  const start = newYorkTimeToUtc(gameDate, REMINDER_HOUR_NY);
  const end = new Date(start.getTime() + 15 * 60 * 1000);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Munymo//Result reminder//EN",
    "BEGIN:VEVENT",
    `UID:munymo-result-${gameDate}@munymo.com`,
    `DTSTAMP:${icsStamp(now)}`,
    `DTSTART:${icsStamp(start)}`,
    `DTEND:${icsStamp(end)}`,
    `SUMMARY:Munymo: see if your pick was right`,
    `DESCRIPTION:${matchup.replace(/[,;\\]/g, (c) => `\\${c}`)}. Results are in: https://munymo.com/game`,
    "URL:https://munymo.com/game",
    "BEGIN:VALARM",
    "TRIGGER:PT0M",
    "ACTION:DISPLAY",
    "DESCRIPTION:Your Munymo result is in",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export function downloadResultReminder(gameDate: string, matchup: string): void {
  const blob = new Blob([buildResultReminderIcs(gameDate, matchup)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "munymo-result-reminder.ics";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
