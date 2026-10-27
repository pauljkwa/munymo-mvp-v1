# Incident: 2026-10-19 curation — "market closed" false alarm, then a wrong result

Written 2026-10-20 by Claude Fable 5.1 for Paul. Plain-English record of what went wrong, what was learned, and the contingencies now in place.

## What happened (New York time, Monday 2026-10-19)

| Time | Event |
|------|-------|
| 14:45 | Phase A staged Tuesday's game (MMM vs HON) as a draft. Worked normally. |
| 16:15 | Phase B (results-only) started for EIX vs DUK. The agent searched the web for the day's prices and found none indexed for either stock. Told "never invent a result", it answered `marketClosed: true`. The server refused ("concluded game not scored") and emailed Paul (05:01 Perth). |
| 19:16 | Second attempt in the same run: same answer, same refusal, second email (07:16 Perth). |
| 19:27 | Third attempt submitted a result — but with the wrong Edison International prices (open $55.90, close $54.85, −1.88%). Duke (−1.42%) was declared the winner. The staged Tuesday game was activated. Paul received the ✅ email. |
| 19:27 | Claude's root-cause fix deployed 28 seconds later and found nothing outstanding. |
| ~19:45 | Yahoo Finance's minute bars showed EIX actually opened $55.38 and closed $55.68 (+0.54%). The true winner is EIX, by 1.96 points — a decisive day. The published result, summary and Hindsight Spotlight were wrong. |

Only the Coin Flip bot had a stored pick (scored 94 under the wrong winner; 54 under the right one). Paul reports that he also played, but no pick for his account exists for this game in `player_picks`, `practice_picks` or anywhere else server-side — see "Open question" below.

The market was open all day: the Nasdaq rose about 1.1%, the S&P 500 about 0.4%.

## Why it happened

1. **One price source, and the wrong kind.** The agent's only way to learn the open and close was web search. Search indexes lag by hours for small-cap and utility names; EIX and DUK had nothing same-day. Nothing in the pipeline fetched prices from an actual market-data feed.
2. **Two different situations shared one flag.** "I could not find the prices" and "the exchange was shut" both came out as `marketClosed: true`. The server trusted the flag enough to reject, but had no way to tell the agent it was wrong.
3. **The retry message was about the wrong problem.** After any 422 the agent was told "choose a different matchup" — a freshness message — so the retries were not steered toward the real fault.
4. **No independent check at the moment of publication.** When a price finally appeared on the third attempt, the server recomputed percentages from it (good) but never asked a second source whether the price itself was right.
5. **No check after publication either.** The ✅ email reported the agent's own figures back, so a wrong result looked exactly like a right one.

## Lessons

- An AI agent's refusal path must be *specific*. "Can't verify" and "verified absent" are different facts and must travel as different signals.
- Settlement numbers must come from data, not from reading. The narrative can be written by the model; the four prices cannot.
- Every automated publish needs an independent cross-check at publish time **and** a later audit, because the cross-check's own data source can be down.
- A success email that only echoes the system's inputs is not verification. It should say what was independently checked and whether it agreed.
- After any night with multiple attempts, treat the final ✅ with suspicion until the audit confirms it.
- The harness does not let Claude write to production; corrections ship as a committed, dry-run-first script that Paul runs. That is the right division of labour and should stay.

## Contingencies now in place (shipped 2026-10-20)

| Layer | What it does | Where |
|-------|--------------|-------|
| 1. Server-fetched prices | Before the agent starts, the server pulls both tickers' regular-session open and close for the game date from Yahoo Finance's chart API and hands them to the agent as canonical. The agent writes the story; it no longer hunts for the numbers. | `server/_core/sessionPrices.ts`, `curationAgent.ts` |
| 2. Honest "market closed" rule | The prompt now requires positive evidence of a holiday or closure. A missing quote is explicitly *not* evidence. If the server has bars for the date, the market was open, full stop. | `curationAgent.ts` system prompt |
| 3. Smarter rejection feedback | A 422 now tells the agent exactly what was wrong (freshness / unscored game / price mismatch) and, for price problems, quotes the server's own prices so the retry can use them. | `curationAgent.ts`, `scheduledCuration.ts` |
| 4. Submit-time cross-check | Before closing a game the server compares the agent's four prices with Yahoo's bars. Any price more than 0.5% off, or a different winner, is rejected with the correct prices quoted. Email subject: "⚠️ Curation rejected — prices disagree with exchange data (auto-retrying)". If Yahoo is unreachable the run proceeds but the ✅ email says "UNAVAILABLE — prices NOT independently verified". | `scheduledCuration.ts` → `crossCheckSettlement` |
| 5. Settlement audit | 06:30 ET Tuesday–Saturday (the morning after each game; was 20:30 ET until 2026-10-27): re-verifies every game published in the last three days against Yahoo and emails only when something disagrees or could not be checked. Read-only. | `server/_core/settlementAudit.ts`, cron in `index.ts` |
| 6. Verification line in the ✅ email | "Price cross-check vs Yahoo: OK" or "UNAVAILABLE". | `scheduledCuration.ts` |
| 7. Correction pattern | A committed one-off script, dry run by default, `--apply` to write, re-scoring through the real scoring path. | `scripts/correct-game-2550001.ts` |

## What Paul does when each email arrives

| Email subject | Meaning | Action |
|---------------|---------|--------|
| ✅ Daily curation complete … "Price cross-check vs Yahoo: OK" | Scored and independently verified. | None. |
| ✅ … "Price cross-check vs Yahoo: UNAVAILABLE" | Scored on the agent's prices only. | None yet; the 06:30 ET audit the next morning will re-check and email if wrong. |
| ⚠️ Curation rejected — prices disagree with exchange data (auto-retrying) | Layer 4 caught a bad price. The agent retries with the right ones. | None unless a ❌ email follows. |
| ⚠️ Curation rejected — concluded game not scored | Agent claimed market closed on a trading day. The detail now quotes the real prices; the retry should score. | None unless a ❌ email follows. Never cancel or re-date the game on a weekday without checking Yahoo first. |
| ⚠️ Settlement audit: N published result(s) disagree | A published game has wrong prices or the wrong winner. Nothing changed automatically. | Tell Claude Code which game; it prepares a correction script; Paul runs it with `--apply`. |
| ℹ️ Settlement audit: N result(s) could not be verified | Yahoo had no bar for that date. | None unless it repeats the next day. |
| ❌ Daily curation FAILED | All automatic retries exhausted. | Click "Run Curation Now" on /admin (unchanged). |

## Still open

- **Paul's Monday pick.** No server-side record exists. Guest-mode picks are stored only in the browser (`client/src/lib/guestPick.ts`), so playing while signed out — e.g. in the iPhone home-screen app, which keeps its own sign-in — would leave exactly this trace: none. If Paul was signed in on the web and still has no pick, that is a save bug and needs its own investigation (device, browser, approximate time).
- **Correction of game 2550001** is prepared but not applied until Paul runs `npx tsx scripts/correct-game-2550001.ts --apply`. Until then the morning audit flags it (as the 20:30 ET audit did every night from 10-20 to 10-23 — layer 5 works). **Still unapplied on 2026-10-27**: the live archive shows EIX $55.90→$54.85 and DUK as the winner.
- **Data source concentration.** All three new layers lean on Yahoo's unofficial chart API. It has been reliable and needs no key, but if it ever blocks server traffic the layers degrade to "unverified", not to "wrong". A keyed provider (Twelve Data was proposed earlier for charts) would be the upgrade.

## Postscript 2026-10-27 — the evening audit's false "unavailable"

Every 20:30 ET audit from 10-20 to 10-26 reported the same-day game as UNAVAILABLE ("no bar available" for both tickers) while the 16:15 ET cross-check on the same game had said OK. Cause: Yahoo's `interval=1d` chart carries the current day as a live-quote element during and just after the session, but between the end of post-market (~20:00 ET) and the finalised daily bar being written (present again by 00:15 ET) the day has no entry at all. Two fixes shipped together: `fetchSessionBar` now falls back to the day's 5-minute bars (first open, last close, regular session only) when the daily bar is missing, and the audit cron moved to 06:30 ET Tuesday–Saturday, when the finalised bar is always there. The ℹ️ "could not be verified" email should now be rare and mean what it says.
