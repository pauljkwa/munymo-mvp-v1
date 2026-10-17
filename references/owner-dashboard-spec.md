# Owner dashboard at dash.munymo.com

**Date:** 2026-10-17. **Status: approach approved by Paul in chat 2026-10-17 (subdomain option); spec by Fable; built by Sonnet and reviewed by Fable the same day; shipped, awaiting Paul's DNS and OWNER_USER_ID steps (section 12).** Follows on from `references/running-costs-ledger-spec.md` (shipped the same day). No schema change.

## 1. What we are making

A private, owner-only page at **https://dash.munymo.com** that shows everything Paul wants to know about Munymo on one screen, top to bottom, with no tabs and nothing to hunt for. It installs on an iPhone home screen as its own tile, "Munymo Dash", beside the Munymo game tile. Other admins (there will be more) never see it: the gate is the owner's account, not the admin role.

The costs ledger built earlier today (`/admin/costs`) moves here and stops being an admin page.

Same codebase, same Railway service, same database. The server recognises the dashboard host and serves the same single-page bundle with a different manifest, icon, title and robots policy; the client renders the dashboard app instead of the game when it finds itself on that host.

## 2. Hosting and DNS (Paul does these in the dashboards; section 12 has the literal steps)

- Railway: add `dash.munymo.com` as a custom domain on the existing service. Railway issues the certificate.
- Cloudflare: one CNAME record, `dash` pointing at the target Railway shows, proxy setting matching the existing `munymo.com` record.
- Railway variable: `OWNER_USER_ID` = Paul's numeric `users.id` (section 4 explains how he finds it).

Nothing else changes in Cloudflare. The www redirect rule is untouched.

## 3. Server: recognising the dashboard host

New `server/_core/dashHost.ts`:

```ts
export const DASH_HOSTS = ["dash.munymo.com", "dash.localhost"];
export function isDashHost(hostname: string): boolean;   // exact match, case-insensitive; pure, tested
export function isDashRequest(req: Request): boolean;    // uses req.hostname (Express trusts Railway's proxy headers already; check app.set("trust proxy") is in effect, add it if not)
```

Behaviour on a dash request, all in `server/_core/vite.ts` / `seo.ts` where the shell is served:

1. **Robots.** `GET /robots.txt` returns `User-agent: *\nDisallow: /` (text/plain). `GET /sitemap.xml` returns 404. Every response on the dash host carries `X-Robots-Tag: noindex, nofollow` (one small middleware registered before static serving).
2. **Shell.** `decorateShell` is skipped on the dash host. Instead the server serves `index.html` with these string substitutions, done once and cached in memory:
   - `<title>` becomes `Munymo Dash`; the meta description becomes `Owner dashboard.`; every `og:` / `twitter:` / JSON-LD / canonical tag is removed (the page must carry no public metadata).
   - `<link rel="manifest" href="/manifest.webmanifest">` becomes `/dash/manifest.webmanifest`.
   - `<link rel="apple-touch-icon" ...>` points at `/dash/apple-touch-icon.png`.
   - `<meta name="theme-color">` becomes the dash colour (section 8).
   - A `<meta name="munymo-app" content="dash">` tag is added so the client does not have to guess from `location.hostname` alone (it still falls back to the hostname check for local dev).
   - Any unknown path on the dash host serves this same shell with status 200 (the dash app has one route and redirects everything to `/`).
3. **Legacy redirects** (`resolveLegacyRedirect`) and the IndexNow ping are skipped on the dash host.
4. **Static files** are shared: `/assets/*`, `/dash/*` (new folder in `client/public/dash/`) and the existing icons are served the same way on both hosts.

Local dev: add `"dash.localhost"` to `allowedHosts` in `vite.config.ts` (Chrome and Safari resolve `*.localhost` to the machine without a hosts-file entry) and make the dev middleware apply the same shell substitutions so `http://dash.localhost:5173` shows the dash app.

## 4. The owner gate

`server/_core/env.ts` gains `ownerUserId: Number(process.env.OWNER_USER_ID ?? 0)`.

In `server/routers.ts`, beside `adminProcedure`:

```ts
const ownerProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!ENV.ownerUserId || ctx.user.id !== ENV.ownerUserId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Owner access required" });
  }
  return next({ ctx });
});
```

Unset variable means nobody is the owner, never "everyone is". The admin role is not consulted: an admin who is not the owner gets FORBIDDEN like anyone else.

New `owner` router:

- `owner.whoami` (**protectedProcedure**, not owner): returns `{ userId, isOwner }`. The dash app uses it to show the refusal screen "This dashboard belongs to the site owner. Your account id is 14." so Paul can read his own id off the screen the first time, set `OWNER_USER_ID` in Railway, and reload. It leaks only the caller's own id.
- `owner.dashboard` (ownerProcedure): the one query that feeds every section (section 6).
- `owner.costs.aiSummary`, `owner.costs.vendorList`, `owner.costs.vendorUpsert`, `owner.costs.vendorDelete`: the four procedures from the ledger spec, moved verbatim from `admin.costs.*` to `ownerProcedure`. `admin.costs` is deleted; `/admin/costs`, its route, its `AdminLayout` nav item, the dashboard "Costs" card and `AdminCosts.tsx` are all removed. The audit log actions keep their names.

Tests (`server/ownerGate.test.ts`, `createCaller` style like the existing `admin.endOfDay` CONFLICT test): admin-but-not-owner gets FORBIDDEN; owner passes; unset `OWNER_USER_ID` rejects everyone; `whoami` reports `isOwner` correctly for both.

## 5. Client: the dash app

`client/src/App.tsx`: at the top, `const isDash = document.querySelector('meta[name="munymo-app"]')?.content === "dash" || /^dash\./i.test(location.hostname)`. When true, render `<DashApp />` and nothing else: no game router, no tab bar, no marketing pages, no push-notification hook, no analytics, no service worker registration.

`client/src/dash/DashApp.tsx`:

- Signed out: Clerk's `<SignIn />` component centred on the dash colour, with the Munymo Dash icon above it. `afterSignInUrl="/"`. (Clerk's production instance is on the `munymo.com` root, so a subdomain is covered without satellite setup; whether the munymo.com session carries over automatically is unverified and does not matter on a phone, where the home-screen app always signs in on its own.)
- Signed in, not owner: the refusal screen from section 4, with a sign-out link.
- Owner: `<Dashboard />` (section 7).
- Every path other than `/` redirects to `/` (Wouter `<Redirect />`).

`useAuth` is reused unchanged.

## 6. Data: `owner.dashboard`

One query, one round trip, so the page appears at once. Shape (all counts exclude `TESTER_BOT_IDS` from `shared/const.ts` wherever a user id is involved):

```ts
{
  generatedAt: string;                 // ISO
  today: {
    game: { id, companyATicker, companyBTicker, gameDate, status, lockoutAt } | null;  // getActiveOrUpcomingGame
    picksToday: number;                // player_picks rows for that game, bots excluded
    stagedDraft: { tickers, gameDate } | null;   // getStagedDraftGameAfter(todayEt)
    curationInFlight: boolean;         // isCurationRunInFlight()
    lastRun: RunSummary | null;        // newest ai_usage_log run row
    nextRuns: Array<{ label: string; atIso: string }>;  // next occurrence of each weekday cron in America/New_York: 08:30 streak-at-risk, 09:35 lockout sweep, 14:45 staging, 15:30 staging watchdog, 16:15 post-close, 17:15/18:15/19:15 watchdogs, 18:00 tester. Pure helper nextCronOccurrences(now) in shared/ownerDashboard.ts, tested across a weekend and DST.
  };
  money: AiSummary;                    // summarizeTurns, days 30 (unchanged from the ledger spec)
  ledger: VendorMonth[];               // groupVendorCosts, last 12 months
  pipeline: {
    runs30d: number; failed30d: number; failoverTurns30d: number;
    watchdogRescues30d: number;        // successful run rows whose trigger starts with "watchdog-" or equals "boot-sweep"
    skipped30d: number;
  };
  players: {
    total: number;
    new7d: number; new30d: number;             // users.createdAt
    active7d: number; active30d: number;       // distinct userId in player_picks by createdAt (a pick, not a sign-in, is "active")
    signedIn7d: number;                        // users.lastSignedIn
    pushUsers: number; pushDevices: number;    // push_subscriptions: distinct users, total rows
    emailOptIn: number; pushOptIn: number;     // users flags
    away: number; missing: number;             // streak_records.awayStatus
    topStreaks: Array<{ name: string; streak: number }>;  // top 5 currentStreak, publicPlayerName, bots excluded
    churned: number;                           // users with ≥1 pick and no pick in 30 days
  };
  growth: {
    survey: MarketVoteTally;                   // getMarketVoteStats
    outbound: { total: number; byPublisher: Array<{ publisher: string; clicks: number }> };  // getOutboundClickStats, top 8
    referrals: { codes: number; events30d: number };
    lessonsCompleted30d: number;               // lesson_progress
    practicePicks30d: number;                  // practice_picks
    guestPicks30d: number | null;              // null for now: guest picks live in the browser, nothing to count (note on the tile)
  };
}
```

Aggregation lives in `shared/ownerDashboard.ts` as pure functions over plain rows (`nextCronOccurrences`, `summarizePipeline(runRows)`, `summarizePlayers(rows...)`) with tests in `server/ownerDashboard.test.ts`, no database. `server/db.ts` gains the few count helpers that do not exist yet (new users since, distinct pickers since, push counts, opt-in counts, away counts, top streaks, churned, referral counts, lesson and practice counts since). Each helper is one query; the procedure runs them with `Promise.all`.

## 7. Layout: one scroll

`client/src/dash/Dashboard.tsx`, phone-first, same design tokens as the rest of the site, dark by default. No charts in this version; numbers and short tables only. Sections in this order, each a `card-glass` block with the small uppercase heading used on /admin:

1. **Header bar** (sticky, thin): "Munymo Dash", "updated 2:03 pm" from `generatedAt`, a refresh button. The query refetches every 5 minutes while the page is open and on window focus.
2. **Today.** Game tickers and date with a status pill (upcoming / active / locked / scored), picks so far, "Tomorrow staged: X vs Y" or "Not staged yet", last run (kind, trigger, outcome, when, cost) with the error on tap if failed, and the next three scheduled runs as "Staging 2:45 pm NY, in 3 h 12 m". A "curation running now" line when in flight.
3. **Money.** Four tiles: month to date, last 30 days, cache hit rate, unpriced turns (hidden at zero). Below: this month's ledger totals, run and build, per currency, and "Anthropic computed vs billed".
4. **Pipeline.** Five tiles for the 30-day counts, then the last ten runs table from the ledger page.
5. **Players.** Tiles: total, new 7 / 30, active 7 / 30, signed in 7, churned, push users (devices), email opt-in, push opt-in, away / missing. Then "Longest current streaks", five rows.
6. **Growth.** Survey tally (voters, first-choice per market, countries), outbound clicks by publisher, referral codes and 30-day events, lessons completed and practice picks in 30 days, guest picks tile showing "not measurable yet".
7. **Cost per game day.** The 30-row table from the ledger page.
8. **Vendor ledger** and the entry form, moved from `AdminCosts.tsx` as-is.

Tiles: a 2-column grid on phones, 4 on wider screens; value in `font-display text-2xl tabular-nums`, label in muted small text. Tables as on the ledger page (`overflow-x-auto`, `table-fixed` where a column could overflow at 375 px). Nothing is collapsed by default.

## 8. Manifest and icon

`client/public/dash/manifest.webmanifest`:

```json
{ "name": "Munymo Dash", "short_name": "Dash", "start_url": "/", "scope": "/",
  "display": "standalone", "background_color": "#0b1f3a", "theme_color": "#0b1f3a",
  "icons": [ {"src": "/dash/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
             {"src": "/dash/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
             {"src": "/dash/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"} ] }
```

Icon: the Mo avatar used for the existing icons, on a navy background (`#0b1f3a`) instead of the game's dark green, with a small white three-bar chart glyph in the lower-right quarter so the two tiles read differently at a glance. Produce `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` (safe zone respected) and `apple-touch-icon.png` (180×180) with a `scripts/make-dash-icons.mjs` using `sharp` (already a dependency; if it is not, use the same tool the 2026-10 favicon commit `ff95981` used). Commit the script and the PNGs. Fable checks the icon visually before the commit.

Because `start_url` and `scope` are `/` on a different origin, iOS treats it as a separate app from the Munymo tile. The dash app registers no service worker.

## 9. What is deliberately not here

- Search Console numbers (the connector lives on Paul's Mac; the server has no API access yet).
- Email bounce and complaint counts (needs Resend webhooks; separate job).
- Charts and sparklines. Once a month of ledger data exists, the per-game-day table can grow one.
- Alerts. The dashboard is pull; the curation emails remain the push channel.
- Any write action other than the vendor ledger. "Run Curation Now" and the other admin buttons stay on /admin.

## 10. Tests

- `server/dashHost.test.ts`: `isDashHost` for the two hosts, case, and near-misses (`dashboard.munymo.com`, `munymo.com`).
- `server/ownerGate.test.ts`: section 4.
- `server/ownerDashboard.test.ts`: `nextCronOccurrences` (Friday evening rolls to Monday 08:30; the DST change weekends in March and November; a Saturday), `summarizePipeline`, `summarizePlayers` with bots in the input.
- Robots and shell substitution: a supertest-free unit test of the substitution function on a sample `index.html` string (no server start).
- Existing suite green; `npx tsc --noEmit` and `pnpm test` before the commit.

## 11. Handover

Same commit: Section 4 row; Section 7 routes (`/admin/costs` removed, dash host added with its single route); Section 8 procedures (`admin.costs.*` removed, `owner.*` added); Section 24 environment variables (`OWNER_USER_ID`); Section 25 key files (`dashHost.ts`, `client/src/dash/`, `shared/ownerDashboard.ts`, `client/public/dash/`); Section 5 deployment (the second custom domain).

## 12. Paul's steps, in order

Do 1 and 2 any time; the code can ship before or after. Do 3 after the first deploy that contains this feature.

1. **Railway.** Open the Munymo project → the web service → **Settings** → **Networking** → **Custom Domain** → **Add** → type `dash.munymo.com` → Add. Railway shows a CNAME target like `xxxx.up.railway.app`. Copy it.
2. **Cloudflare.** munymo.com → **DNS** → **Records** → **Add record**: Type `CNAME`, Name `dash`, Target (paste the Railway value), Proxy status the same as the existing `munymo.com` record, TTL Auto → Save. Railway's domain row turns green within a few minutes once it sees the record.
3. **Owner id.** On the iPhone, open Safari → `dash.munymo.com` → sign in. The screen says "Your account id is N". In Railway → the web service → **Variables** → **New Variable**: name `OWNER_USER_ID`, value `N` → Add. Railway redeploys. Reload the page.
4. **Home screen.** Safari share button → **Add to Home Screen** → the tile is "Dash". Tap it; sign in once more (home-screen apps keep their own sign-in).

## 13. Build notes for the builder

- Read `references/running-costs-ledger-spec.md` first; this spec moves that page.
- Reuse `summarizeTurns`, `groupVendorCosts`, `AdminCosts.tsx` sections, `publicPlayerName`, `getMarketVoteStats`, `getOutboundClickStats`, `getActiveOrUpcomingGame`, `getStagedDraftGameAfter`, `isCurationRunInFlight`. Do not duplicate them.
- Never call anything that writes to the database from the dashboard query.
- US spelling throughout. Phone-first. No new dependencies.
- No `db:push`, no migration: there is no schema change.
