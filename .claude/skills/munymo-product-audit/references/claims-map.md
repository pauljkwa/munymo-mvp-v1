# Where Munymo's player-facing claims live, and the code that backs each one

Update this file whenever a claim moves or a new one appears. A claim listed here with the wrong location wastes the next audit's time.

| Claim | Copy locations | Code that must agree |
|---|---|---|
| Leaderboard qualification threshold (games) | `Home.tsx` feature pill "Leaderboard"; `Leaderboard.tsx` header, "Why N?" paragraph, provisional caption; `MyDashboard.tsx` "x / N"; FAQ "What is MunyIQ?" indirectly; `EvolutionOfMunymo.tsx` (unrouted, still argues for 20) | `shared/const.ts` `LEADERBOARD_QUALIFICATION_GAMES`; `server/scoring.ts` `isQualified` |
| 80 / 20 score split, 20→12 time decay, 15 s full credit | `Home.tsx` score section and FAQ "How does scoring work?"; `DailyGame.tsx` validation hint; `ValidationModal.tsx`; `Demo.tsx` | `server/scoring.ts` constants |
| Lockout at 9:30 ET, auto-submit of gut pick, validation open after lockout | FAQ "Why do I pick twice?"; `DailyGame.tsx` "Time Ran Out" card; welcome email | `server/autoSubmitHandler.ts` (9:35 ET sweep); `picks.submitValidation` blocks only `result_published` / `cancelled` |
| When results publish (and therefore when the validation window ends) | FAQ (currently wrong: says next trading day) | Curation cron ~16:15 ET in `server/_core/scheduledCuration.ts` / `curationAgent.ts`; `closeAndScoreGame` in `routers.ts` |
| Winner rule (open-to-close % move, Decision 6) | FAQ "What exactly is Munymo?" ("by the close"); result card "day's change" | `curationAgent.ts` DETERMINE_WINNER_SECTION; `server/scoring.ts` `resolveWinner`; stored `companyA/BStartPrice`, `EndPrice`, `Perf` |
| Streaks: playing, win, lose; Away preserves; weekends neutral | `Home.tsx` pill "Participation Streaks"; FAQ "Why is it daily?"; `GameResult.tsx` streak row; `MyDashboard.tsx` | `server/scoring.ts` `computeNewStreak`; `updateStreakForPlayer` in `routers.ts` |
| Away Status "for a defined period" | FAQ | `dashboard.setAwayStatus` (boolean toggle, no period) |
| Losing streak of 5 intervention (Decision 2) | handover | `GameResult.tsx` one-line message only |
| Community stats show raw count (Decision 7) | handover | `GameResult.tsx` "N players participated" |
| Gut-vs-final insight over time | FAQ "Why do I pick twice?" | Nothing aggregates it (`dashboard.getStats` has no gut field) |
| Research is "expert-curated" | `Home.tsx` step 2 | `curationAgent.ts` (Claude Sonnet 5 + web search, no human review); no disclosure in `Disclaimer.tsx` or FAQ |
| Matchup freshness rules, article attribution | FAQ "How are the two companies chosen?" | `scheduledCuration.ts` check-freshness; `sourceUrl` fields |
| NASDAQ only (Decision 4) | handover only | Archive is mostly NYSE; `exchange` column defaults to NASDAQ |
| Practice does not count, hides date and result | `Practice.tsx` caveat | `practice_picks` table separate from `player_picks` |
| MunyIQ, certificates, challenges, native apps | `Home.tsx` (labelled Coming Soon); FAQ; `MyDashboard.tsx` locked card | Not implemented, and say so |
| Founding member status recorded | `Home.tsx` beta section; welcome email | `users.createdAt` only |
| Free during beta; premium "full access to all current and future features" | FAQ; `PlayerProfile.tsx` tier card | `users.tier` enum free/premium, nothing gated |
| Legal "Last updated" dates | all four `client/src/pages/legal/*.tsx` | none; check the year |
| Emails: opt-out honoured, unsubscribe available | `server/email.ts` footers | `emailOptIn` filters in `routers.ts`; no unsubscribe link or header as of 2026-09-17 |
| Data sources for prices | `Disclaimer.tsx` "publicly available market data" | `resultSourceNote` in the curation payload |

## Public API endpoints used by the audit

tRPC GET with `?input=%7B%22json%22%3Anull%7D` for no-input queries:

- `/api/trpc/games.getToday`
- `/api/trpc/leaderboard.get`, `/api/trpc/leaderboard.getProvisional`
- `/api/trpc/games.listArchive?input=%7B%22json%22%3A%7B%22limit%22%3A50%7D%7D` (limit max 50)
- `/api/trpc/games.getById?input=%7B%22json%22%3A%7B%22id%22%3A<id>%7D%7D`

Tester bot ids: 870002, 870004, 870006, 870008, 870010, 870012 (870012 was erased and appears as "Anonymous").
