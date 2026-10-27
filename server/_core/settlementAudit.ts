/**
 * Settlement audit — the safety net behind the submit-time cross-check.
 * Re-verifies every recently published game's four stored prices and winner
 * against Yahoo Finance's regular-session bars and emails the owner when
 * anything disagrees (or when the check could not run).
 *
 * Why both: the submit-time check in scheduledCuration.ts only helps when
 * Yahoo answers during the run. If it didn't, the agent's prices went in
 * unverified — this pass catches that the next morning, while the next
 * game is still open and a correction is cheap. It never changes data;
 * fixing a game is a deliberate act (see scripts/correct-game-2550001.ts
 * for the pattern).
 *
 * Timing: 06:30 ET Tuesday–Saturday, the morning after each game. It ran at
 * 20:30 ET from 2026-10-19 to 10-26 and reported the same-day game as
 * "unavailable" every night: Yahoo's daily chart has no bar for the day just
 * traded between ~20:00 ET and ~00:15 ET (see sessionPrices.ts). By morning
 * the finalised bar is there, and sessionPrices now falls back to the
 * 5-minute bars anyway.
 */
import { notifyOwner } from "./notification";
import { compareWithBars, fetchPairSessionBars } from "./sessionPrices";

export type AuditResult = { gameId: number; gameDate: string; tickers: string; status: "ok" | "mismatch" | "unavailable"; detail: string };

function etDateDaysAgo(days: number, now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date(now.getTime() - days * 86_400_000));
}

export async function runSettlementAudit(trigger: string): Promise<AuditResult[]> {
  const { getPublishedGamesSince } = await import("../db");
  const games = await getPublishedGamesSince(etDateDaysAgo(3));
  const results: AuditResult[] = [];
  for (const g of games) {
    const bars = await fetchPairSessionBars(g.companyATicker, g.companyBTicker, g.gameDate);
    const check = compareWithBars(bars, {
      companyAStartPrice: g.companyAStartPrice != null ? Number(g.companyAStartPrice) : null,
      companyAEndPrice: g.companyAEndPrice != null ? Number(g.companyAEndPrice) : null,
      companyBStartPrice: g.companyBStartPrice != null ? Number(g.companyBStartPrice) : null,
      companyBEndPrice: g.companyBEndPrice != null ? Number(g.companyBEndPrice) : null,
    });
    // A stored winner that disagrees with the server's bars is a mismatch even
    // if the stored prices happen to match (e.g. a hand-edited row).
    let status = check.status;
    let detail = check.detail;
    if (status === "ok" && check.serverWinner && g.winner && g.winner !== check.serverWinner) {
      status = "mismatch";
      detail = `Stored winner is ${g.winner} but the server's bars say ${check.serverWinner}. ${check.detail}`;
    }
    results.push({ gameId: g.id, gameDate: g.gameDate, tickers: `${g.companyATicker} vs ${g.companyBTicker}`, status, detail });
  }

  const bad = results.filter((r) => r.status !== "ok");
  const line = (r: AuditResult) => `• Game #${r.gameId} (${r.tickers}, ${r.gameDate}): ${r.status.toUpperCase()} — ${r.detail}`;
  console.log(`[settlement-audit] (${trigger}) ${results.length} game(s) checked, ${bad.length} flagged`);
  for (const r of results) console.log(`[settlement-audit] ${line(r)}`);

  if (bad.length) {
    const mismatches = bad.filter((r) => r.status === "mismatch");
    await notifyOwner({
      title: mismatches.length
        ? `⚠️ Settlement audit: ${mismatches.length} published result(s) disagree with exchange prices`
        : `ℹ️ Settlement audit: ${bad.length} result(s) could not be verified`,
      content:
        `Morning re-check of the last three days' published games against Yahoo Finance's regular-session bars (${trigger}).\n\n` +
        bad.map(line).join("\n") +
        `\n\n` +
        (mismatches.length
          ? `A MISMATCH means the archive shows the wrong prices or the wrong winner. Nothing has been changed automatically. ` +
            `Ask Claude Code to re-settle the game (pattern: scripts/correct-game-2550001.ts), or correct it in /admin.`
          : `UNAVAILABLE means Yahoo returned no bar for that date — usually a temporary data problem. No action unless it repeats tomorrow.`),
    });
  }
  return results;
}
