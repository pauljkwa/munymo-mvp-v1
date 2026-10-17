import { useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import type { inferRouterOutputs } from "@trpc/server";
import { trpc } from "@/lib/trpc";
import type { AppRouter } from "../../../server/routers";
import { etDateString } from "@shared/ownerDashboard";
import {
  RUN_KIND_LABELS,
  currentUtcMonth,
  formatClock,
  formatCountdown,
  formatDuration,
  formatGameDate,
  formatNyClock,
  formatTotals,
  formatWhen,
  usd,
} from "./format";
import { Empty, Section, Tile, TileGrid, headingClass, headingStyle, tdClass, thClass } from "./ui";
import VendorLedger from "./VendorLedger";

// Owner dashboard: one scroll, no tabs (references/owner-dashboard-spec.md §7).
// Every number comes from the single owner.dashboard query.

type DashboardData = inferRouterOutputs<AppRouter>["owner"]["dashboard"];
type RunRow = DashboardData["money"]["runs"][number];

const REFRESH_MS = 5 * 60 * 1000;

/** Re-renders on an interval so countdowns stay honest between refetches. */
function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

const GAME_PILLS: Record<string, { label: string; color: string }> = {
  upcoming: { label: "Upcoming", color: "var(--color-info)" },
  active: { label: "Active", color: "var(--color-success)" },
  locked: { label: "Locked", color: "var(--color-warning)" },
  scored: { label: "Scored", color: "var(--color-subtle)" },
};

function gamePill(status: string, gameDate: string, todayEt: string): keyof typeof GAME_PILLS {
  if (status === "locked") return "locked";
  if (status === "result_published") return "scored";
  return gameDate > todayEt ? "upcoming" : "active";
}

function RunsTable({ runs }: { runs: RunRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr style={{ borderTop: "1px solid var(--color-border)", borderBottom: "1px solid var(--color-border)" }}>
            {["When", "Kind", "Trigger", "Outcome", "Time", "Cost"].map((h) => (
              <th key={h} className={thClass} style={headingStyle}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => {
            const bad = r.outcome === "failed";
            return (
              <tr key={`${r.runId}-${new Date(r.createdAt).getTime()}`} style={{ borderBottom: "1px solid var(--color-border)", color: "var(--color-foreground)" }}>
                <td className={tdClass}>{formatWhen(r.createdAt)}</td>
                <td className={tdClass}>{RUN_KIND_LABELS[r.runKind] ?? r.runKind}</td>
                <td className={`${tdClass} font-mono`}>{r.trigger}</td>
                <td className={tdClass} style={{ color: bad ? "var(--color-warning)" : undefined }}>
                  {bad && r.errorMessage ? (
                    <details>
                      <summary className="cursor-pointer">failed</summary>
                      <p className="whitespace-normal break-words max-w-[16rem] mt-1" style={{ color: "var(--color-muted)" }}>
                        {r.errorMessage}
                      </p>
                    </details>
                  ) : (
                    r.outcome ?? "—"
                  )}
                </td>
                <td className={tdClass}>{formatDuration(r.durationMs)}</td>
                <td className={tdClass}>{usd(r.costUsd)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TodaySection({ d, now }: { d: DashboardData["today"]; now: number }) {
  const todayEt = etDateString(new Date(now));
  const nextThree = d.nextRuns.slice(0, 3);
  const last = d.lastRun;
  return (
    <Section title="Today">
      <div className="flex flex-col gap-3 text-sm" style={{ color: "var(--color-foreground)" }}>
        {d.curationInFlight && (
          <div className="flex items-center gap-2" style={{ color: "var(--color-info)" }}>
            <Loader2 size={14} className="animate-spin" />
            Curation running now
          </div>
        )}

        <div>
          {d.game ? (
            (() => {
              const pill = GAME_PILLS[gamePill(d.game.status, d.game.gameDate, todayEt)];
              return (
                <>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-display text-xl">
                      {d.game.companyATicker} vs {d.game.companyBTicker}
                    </span>
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded"
                      style={{ color: pill.color, border: `1px solid ${pill.color}` }}
                    >
                      {pill.label}
                    </span>
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>
                    {formatGameDate(d.game.gameDate)}
                    {d.game.lockoutAt ? ` · locks ${formatNyClock(d.game.lockoutAt)} NY` : ""}
                  </div>
                </>
              );
            })()
          ) : (
            <span style={{ color: "var(--color-muted)" }}>No game is open right now.</span>
          )}
        </div>

        <Tile label="Picks so far" value={d.picksToday} hint="players only, bots excluded" />

        <div>
          {d.stagedDraft ? (
            <span>
              Staged: {d.stagedDraft.tickers[0]} vs {d.stagedDraft.tickers[1]}{" "}
              <span style={{ color: "var(--color-muted)" }}>for {formatGameDate(d.stagedDraft.gameDate)}</span>
            </span>
          ) : (
            <span style={{ color: "var(--color-muted)" }}>Not staged yet</span>
          )}
        </div>

        <div>
          <div className={`${headingClass} mb-1`} style={headingStyle}>Last run</div>
          {last ? (
            <div>
              <div>
                {RUN_KIND_LABELS[last.runKind] ?? last.runKind}{" "}
                <span className="font-mono text-xs" style={{ color: "var(--color-muted)" }}>{last.trigger}</span>
              </div>
              <div className="text-xs" style={{ color: last.outcome === "failed" ? "var(--color-warning)" : "var(--color-muted)" }}>
                {last.outcome ?? "—"} · {formatWhen(last.createdAt)} · {formatDuration(last.durationMs)} · {usd(last.costUsd)}
              </div>
              {last.outcome === "failed" && last.errorMessage && (
                <details className="text-xs mt-1">
                  <summary className="cursor-pointer" style={{ color: "var(--color-warning)" }}>Show the error</summary>
                  <p className="whitespace-normal break-words mt-1" style={{ color: "var(--color-muted)" }}>{last.errorMessage}</p>
                </details>
              )}
            </div>
          ) : (
            <span style={{ color: "var(--color-muted)" }}>No runs logged yet.</span>
          )}
        </div>

        <div>
          <div className={`${headingClass} mb-1`} style={headingStyle}>Next scheduled runs</div>
          <ul className="flex flex-col gap-0.5">
            {nextThree.map((r) => (
              <li key={r.label} className="text-sm">
                {r.label} {formatNyClock(r.atIso)} NY,{" "}
                <span style={{ color: "var(--color-muted)" }}>in {formatCountdown(new Date(r.atIso).getTime() - now)}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs mt-1" style={{ color: "var(--color-subtle)" }}>
            Weekday schedule; exchange holidays are not known here, and the watchdogs do nothing on a healthy night.
          </p>
        </div>
      </div>
    </Section>
  );
}

function MoneySection({ d, ledger }: { d: DashboardData["money"]; ledger: DashboardData["ledger"] }) {
  const month = ledger.find((m) => m.month === currentUtcMonth());
  return (
    <Section title="Money">
      <TileGrid>
        <Tile label="Month to date" value={usd(d.monthToDateUsd)} />
        <Tile label="Last 30 days" value={usd(d.last30DaysUsd)} />
        <Tile label="Cache hit rate" value={d.cacheHitRate === null ? "—" : `${(d.cacheHitRate * 100).toFixed(1)}%`} />
        {d.unpricedTurns > 0 && <Tile label="Unpriced turns" value={d.unpricedTurns} tone="warning" />}
      </TileGrid>
      <div className="text-xs mt-4 flex flex-col gap-0.5" style={{ color: "var(--color-muted)" }}>
        <span>This month, run costs: {month ? formatTotals(month.totals.run) : "—"}</span>
        <span>This month, build costs: {month ? formatTotals(month.totals.build) : "—"}</span>
        <span>
          Anthropic API: computed {month?.computedAnthropicUsd == null ? "—" : usd(month.computedAnthropicUsd)} · billed{" "}
          {month?.enteredAnthropicUsd == null ? "—" : usd(month.enteredAnthropicUsd)}
        </span>
      </div>
      <p className="text-xs mt-3" style={{ color: "var(--color-subtle)" }}>
        AI spend is estimated from logged token counts at the published rates. A falling cache hit rate means something crept into the cached prompt prefix. An unpriced turn means a model id is missing from the rate table.
      </p>
    </Section>
  );
}

function PipelineSection({ d, runs }: { d: DashboardData["pipeline"]; runs: RunRow[] }) {
  return (
    <section className="card-glass mb-4 overflow-hidden">
      <h2 className={`${headingClass} px-4 pt-4 pb-3`} style={headingStyle}>Pipeline, last 30 days</h2>
      <div className="px-4 pb-4">
        <TileGrid>
          <Tile label="Runs" value={d.runs30d} />
          <Tile label="Failed" value={d.failed30d} tone={d.failed30d > 0 ? "warning" : undefined} />
          <Tile label="Failover turns" value={d.failoverTurns30d} />
          <Tile label="Watchdog rescues" value={d.watchdogRescues30d} />
          <Tile label="Skipped" value={d.skipped30d} />
        </TileGrid>
      </div>
      {runs.length === 0 ? <Empty>No runs logged yet.</Empty> : <RunsTable runs={runs.slice(0, 10)} />}
    </section>
  );
}

function PlayersSection({ d }: { d: DashboardData["players"] }) {
  return (
    <Section title="Players">
      <TileGrid>
        <Tile label="Total" value={d.total} />
        <Tile label="New, 7 days" value={d.new7d} />
        <Tile label="New, 30 days" value={d.new30d} />
        <Tile label="Active, 7 days" value={d.active7d} hint="made a pick" />
        <Tile label="Active, 30 days" value={d.active30d} hint="made a pick" />
        <Tile label="Signed in, 7 days" value={d.signedIn7d} />
        <Tile label="Churned" value={d.churned} hint="no pick in 30 days" />
        <Tile label="Push users" value={d.pushUsers} hint={`${d.pushDevices} ${d.pushDevices === 1 ? "device" : "devices"}`} />
        <Tile label="Email opt-in" value={d.emailOptIn} />
        <Tile label="Push opt-in" value={d.pushOptIn} />
        <Tile label="Away / missing" value={`${d.away} / ${d.missing}`} />
      </TileGrid>
      <h3 className={`${headingClass} mt-5 mb-2`} style={headingStyle}>Longest current streaks</h3>
      {d.topStreaks.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--color-muted)" }}>No active streaks yet.</p>
      ) : (
        <ol className="flex flex-col" style={{ borderTop: "1px solid var(--color-border)" }}>
          {d.topStreaks.map((p, i) => (
            <li key={`${p.name}-${i}`} className="flex items-center gap-2 py-1.5 text-sm" style={{ borderBottom: "1px solid var(--color-border)" }}>
              <span className="w-5 tabular-nums text-xs" style={{ color: "var(--color-subtle)" }}>{i + 1}</span>
              <span className="flex-1 min-w-0 truncate" style={{ color: "var(--color-foreground)" }}>{p.name}</span>
              <span className="tabular-nums" style={{ color: "var(--color-foreground)" }}>{p.streak}</span>
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}

function GrowthSection({ d }: { d: DashboardData["growth"] }) {
  const { survey, outbound } = d;
  return (
    <Section title="Growth">
      <h3 className={`${headingClass} mb-2`} style={headingStyle}>Market survey</h3>
      {survey.totalVoters === 0 ? (
        <p className="text-sm" style={{ color: "var(--color-muted)" }}>No votes yet.</p>
      ) : (
        <>
          <p className="text-sm mb-2" style={{ color: "var(--color-foreground)" }}>
            {survey.totalVoters} {survey.totalVoters === 1 ? "voter" : "voters"} · {survey.multiPickVoters} ranked more than one market
          </p>
          <ul className="flex flex-col" style={{ borderTop: "1px solid var(--color-border)" }}>
            {survey.byMarket.map((m) => (
              <li key={m.code} className="flex items-center gap-2 py-1.5 text-sm" style={{ borderBottom: "1px solid var(--color-border)" }}>
                <span className="flex-1 min-w-0 truncate" style={{ color: "var(--color-foreground)" }}>{m.label}</span>
                <span className="tabular-nums text-xs" style={{ color: "var(--color-muted)" }}>{m.mentions} any rank</span>
                <span className="tabular-nums w-16 text-right" style={{ color: "var(--color-foreground)" }}>{m.first} first</span>
              </li>
            ))}
          </ul>
          {survey.byVisitorCountry.length > 0 && (
            <p className="text-xs mt-2" style={{ color: "var(--color-muted)" }}>
              Countries: {survey.byVisitorCountry.map((c) => `${c.country} ${c.voters}`).join(" · ")}
            </p>
          )}
        </>
      )}

      <h3 className={`${headingClass} mt-5 mb-2`} style={headingStyle}>Outbound article clicks</h3>
      {outbound.total === 0 ? (
        <p className="text-sm" style={{ color: "var(--color-muted)" }}>No clicks yet.</p>
      ) : (
        <>
          <p className="text-sm mb-2" style={{ color: "var(--color-foreground)" }}>{outbound.total} in total</p>
          <ul className="flex flex-col" style={{ borderTop: "1px solid var(--color-border)" }}>
            {outbound.byPublisher.map((p) => (
              <li key={p.publisher} className="flex items-center gap-2 py-1.5 text-sm" style={{ borderBottom: "1px solid var(--color-border)" }}>
                <span className="flex-1 min-w-0 truncate" style={{ color: "var(--color-foreground)" }}>{p.publisher}</span>
                <span className="tabular-nums" style={{ color: "var(--color-foreground)" }}>{p.clicks}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="mt-5">
        <TileGrid>
          <Tile label="Referral codes" value={d.referrals.codes} hint="enrolled by an owner" />
          <Tile label="Referral events" value={d.referrals.events30d} hint="scans and sign-ups, 30 days" />
          <Tile label="Lessons completed" value={d.lessonsCompleted30d} hint="30 days" />
          <Tile label="Practice picks" value={d.practicePicks30d} hint="30 days" />
          <Tile
            label="Guest picks"
            value={d.guestPicks30d === null ? "—" : d.guestPicks30d}
            hint={d.guestPicks30d === null ? "not measurable yet: guest picks live in the browser" : "30 days"}
          />
        </TileGrid>
      </div>
    </Section>
  );
}

function PerGameDaySection({ rows }: { rows: DashboardData["money"]["byGameDate"] }) {
  const failedDays = rows.filter((d) => d.failedRuns > 0).length;
  return (
    <section className="card-glass mb-4 overflow-hidden">
      <h2 className={`${headingClass} px-4 pt-4 pb-3`} style={headingStyle}>
        Cost per game day{failedDays > 0 ? ` (${failedDays} with a failed run)` : ""}
      </h2>
      {rows.length === 0 ? (
        <Empty>No AI usage logged yet. Rows appear after the next curation run.</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderTop: "1px solid var(--color-border)", borderBottom: "1px solid var(--color-border)" }}>
                {["Date", "Cost", "Turns", "Runs", "Failed", "Failover", "Searches"].map((h) => (
                  <th key={h} className={thClass} style={headingStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => {
                const failed = d.failedRuns > 0;
                return (
                  <tr
                    key={d.gameDate}
                    style={{
                      borderBottom: "1px solid var(--color-border)",
                      background: failed ? "var(--color-warning-muted)" : undefined,
                      color: failed ? "var(--color-warning)" : "var(--color-foreground)",
                    }}
                  >
                    <td className={tdClass}>{d.gameDate}</td>
                    <td className={tdClass}>{usd(d.costUsd)}</td>
                    <td className={tdClass}>{d.turns}</td>
                    <td className={tdClass}>{d.runs}</td>
                    <td className={tdClass}>{d.failedRuns}</td>
                    <td className={tdClass}>{d.failoverTurns}</td>
                    <td className={tdClass}>{d.webSearches}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function Dashboard({ onSignOut }: { onSignOut: () => void }) {
  const now = useNow(60_000);
  const query = trpc.owner.dashboard.useQuery(undefined, {
    refetchInterval: REFRESH_MS,
    refetchOnWindowFocus: true,
  });
  const data = query.data;

  return (
    <div className="min-h-dvh" style={{ background: "var(--color-background)" }}>
      <header
        className="sticky top-0 z-40 h-12 px-4 flex items-center justify-between border-b"
        style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
      >
        <h1 className="font-display text-base font-semibold" style={{ color: "var(--color-foreground)" }}>Munymo Dash</h1>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: "var(--color-muted)" }}>
            {data ? `updated ${formatClock(data.generatedAt)}` : query.isError ? "update failed" : "loading"}
          </span>
          <button
            type="button"
            aria-label="Refresh"
            onClick={() => query.refetch()}
            disabled={query.isFetching}
            className="btn-ghost p-2"
            style={{ color: "var(--color-brand)" }}
          >
            <RefreshCw size={16} className={query.isFetching ? "animate-spin" : undefined} />
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 pt-4" style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}>
        {!data ? (
          query.isError ? (
            <p className="text-sm" style={{ color: "var(--color-warning)" }}>
              Could not load the dashboard: {query.error.message}
            </p>
          ) : (
            <Loader2 size={20} className="animate-spin" style={{ color: "var(--color-brand)" }} />
          )
        ) : (
          <>
            <TodaySection d={data.today} now={now} />
            <MoneySection d={data.money} ledger={data.ledger} />
            <PipelineSection d={data.pipeline} runs={data.money.runs} />
            <PlayersSection d={data.players} />
            <GrowthSection d={data.growth} />
            <PerGameDaySection rows={data.money.byGameDate} />
            <VendorLedger months={data.ledger} />
          </>
        )}
        <div className="text-center py-4">
          <button type="button" onClick={onSignOut} className="text-xs underline" style={{ color: "var(--color-subtle)" }}>
            Sign out
          </button>
          <div className="text-xs mt-1" style={{ color: "var(--color-subtle)" }}>
            Scheduled run times are New York time (NY); every other time is in your own timezone.
          </div>
        </div>
      </main>
    </div>
  );
}
