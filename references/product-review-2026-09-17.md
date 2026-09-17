# Munymo — Game Designer's Review and To-Do List

**Date:** 2026-09-17
**Reviewer:** Claude Fable 5.1, at Paul's request ("do we meet all the claims we make, does it flow as a game, what am I missing").
**Method:** Walked every public page on munymo.com signed out, on desktop and a phone-sized viewport. Read the full client and server source for the signed-in loop (game, result, practice, dashboard, profile, emails, push, scoring, streaks, curation prompt). Pulled the live public API: today's game, the qualified and provisional leaderboards, and the last 50 archived games with their prices. Cross-checked the landing page, FAQ, welcome email, legal pages and the handover document against what the code actually does.

Companion piece: `references/wsj-critic-article-2026-09-17.md` (the outside view).

---

## 1. Verdict in one paragraph

The daily loop is genuinely good: one decision, a real deadline, a real market grading you, an honest scoreboard, a strong debrief, and now practice, an archive and lessons so nobody hits a dead end. The product is far more finished than most betas. But three things would not survive contact with a sharp outsider: **the settlement rule is not being applied consistently (17 of the last 50 games, 3 winners would flip)**, **the public leaderboard and "crowd" are five test bots with human names plus the founder**, and **research written by an AI agent is sold as "expert-curated" with no disclosure**. Below that are a handful of stale or untrue claims in the copy, and a gamification ladder that stops abruptly at qualification. Nothing here is hard to fix. Most of it is a day's work.

---

## 2. Claims audit — does the site do what it says?

| # | Claim (where it is made) | Verdict | Evidence |
|---|---|---|---|
| 1 | Winner is "the company with the better performance by the close" (FAQ). Decision 6 in the handover: **open-to-close** % move. | **NOT CONSISTENTLY MET** | Of the last 50 archived games, 17 show a % change that does not match the open→close prices printed on the same result card. Example, 2026-07-06 NVDA vs AVGO: card says AVGO +3.55% on $371.34 → $373.28 (that is +0.52%) and NVDA +0.37% on $194.48 → $195.55 (that is +0.55%). Under the stated rule NVDA won; the published winner is AVGO. Same flip on 2026-08-07 NEM vs B and 2026-08-11 SPCX vs RKLB. The agent is sometimes using Yahoo's day-change (vs prior close) and sometimes open-to-close. Any reader who does the arithmetic on the card sees the contradiction. |
| 2 | "Qualify after 20 games" (landing page feature pill); "still working toward the 20-game qualification threshold" (leaderboard provisional caption) | **STALE** | Threshold changed to 10 on 2026-09-16. The leaderboard header says 10 and, two inches lower, the caption says 20. Both are hard-coded literals that missed the shared constant. |
| 3 | The validation question "is held for you to answer later, even after the next trading day has begun, so its 20 points aren't lost" (FAQ) | **NOT MET** | Results publish at ~4:15 pm ET the same day. The server refuses validation answers once a game is `result_published`, and an unanswered question scores 0 at that moment. The real window is 9:30 am to ~4:15 pm ET on game day. |
| 4 | "Comparing your gut picks with your final picks over time reveals whether research genuinely improves your judgment" (FAQ, and the reason the two-pick mechanic exists) | **NOT MET** | No aggregate gut-vs-final statistic exists anywhere. The dashboard shows Accuracy and Research Score only. A player can only see it one game at a time. This is the product's most distinctive claim and it is unfulfilled. |
| 5 | "An expert-curated research brief" (landing, step 2) | **MISLEADING** | The brief, metrics, question, result summary and Hindsight Spotlight are written by an AI agent (Claude Sonnet 5 with web search) and published without human review. No page, FAQ answer or legal page discloses this. The Disclaimer says only "curated for educational context". |
| 6 | "Away Status lets you protect your streak for a defined period" (FAQ) | **PARTIAL** | It is an open-ended on/off toggle. There is no period, and Decision 5 makes it unlimited. |
| 7 | "Rankings reflect sustained performance, not luck" (landing); "Compete" framing throughout | **WEAK IN PRACTICE** | The qualified board today: pauljkwa, Claire B, Adam A, Daniel D, Big B, Erica E. Five of six are the synthetic tester accounts (IDs 870002–870010), each on 44 games. The provisional board shows the erased bot as "Anonymous". Community stats ("6 players participated, 83.3% picked LEN") are the same five bots plus Paul. |
| 8 | Community stats show raw player count alongside % (Decision 7) | **MET** | "6 players participated" is shown above the bars. The handover Section 4 row saying "Not implemented" is stale. |
| 9 | Losing streak of 5 triggers a remedial learning intervention (Decision 2) | **MINIMAL** | One italic sentence on the result page ("even the best analysts hit rough patches"). No lesson link, no remedial anything. Handover says "Not implemented"; it is a stub. |
| 10 | Auto-submit at lockout; validation stays open after lockout (Decisions 1, 3) | **MET** | Lockout sweep at 9:35 ET, validation accepted on `locked` games, "Time Ran Out" state explains it well. |
| 11 | NASDAQ-only matchups (Decision 4) | **NOT MET, silently** | More than half of the last 50 matchups are NYSE names (BAC, GS, LEN, DHI, CVX, OXY, JNJ, MRK, V, AXP, UNP, CSX, GD, TXT, AAL, UAL, MO, PM, HD, LOW…). Every game is labelled NASDAQ in the database. Not player-facing, but the binding decision and the data are both wrong. Retire the decision formally ("US-listed large caps") or enforce it. |
| 12 | Server-side scoring and lockout, tamper-proof | **MET** | Verified in `scoring.ts` and the pick mutations. |
| 13 | Time-decayed validation score, 20 down to 12 | **MET** | Wired since 2026-07-06, tested. |
| 14 | Three streak types; Away preserves streak; weekends don't break it | **MET** | Verified. |
| 15 | MunyIQ tiers, certificates, head-to-head, native apps | **HONESTLY LABELLED** | All carry "Coming soon" / "Coming". The FAQ calls MunyIQ "upcoming". Fine. |
| 16 | Founding member status recorded | **MET** | Join date is `createdAt`; there is no badge yet and the copy says so. |
| 17 | "Five minutes a day" | **ROUGHLY MET** | Brief is 600–900 words plus 16 metrics, two charts, and a source article. Five minutes is a fast reader; the beginner summary toggle helps. |
| 18 | Legal pages "Last updated June 2025" | **WRONG YEAR** | All four legal pages. Product launched June 2026. |
| 19 | Source article credited and linked on the game page | **MET** | |
| 20 | Freshness rules (sector 7d, company 30d, pair 365d) | **MET** | Server-enforced before research. |

---

## 3. The flow, walked as a player

**Day 0, a visitor.** Landing page is strong: today's live matchup in the hero, four steps, the 80/20 split, feature pills, MunyIQ tease, roadmap, beta pitch, FAQ. The "eeny meeny…" wordmark line sits directly above "Not a guessing game", which reads as a contradiction until you realise it is a wink. "See How It Works" goes to a demo that has five steps (adds Validation and Result) while the real game has four. Sign-up is a Clerk modal with founding-beta framing; the welcome email is good.

**First game.** Four-step stepper, gut pick, then research. The research screen is the best page in the product: beginner summary by default with a full-analysis toggle, the pairing rationale with the credited article, a two-column metrics table with "What does this mean?" on every row, and a chart per company. The "I've Read the Research" declaration before a dedicated final-pick screen is a smart friction. The timed question modal warns clearly (one attempt, timed, don't close). Red/green feedback lands. Then "Picks Submitted" and three "While you wait" cards. No dead end. Good.

**What a first-timer does not get:** any orientation inside the live game. The demo's tooltips exist but are off the main path. A first-time player never learns why 15 seconds matters, what "beta" means as a metric, or that they can come back after lockout for the question. The push-notification prompt after the gut pick is well placed.

**Lockout to result.** Auto-submit works. The 8:30 ET streak-at-risk email and the first-timer reminder exist. Results at ~4:15 ET by email and push. The result page is a proper debrief: winner, price movement with $ and %, gut/final/score cards, streak row, question review with the right answer, crowd split, "What happened", Hindsight Spotlight, lesson of the day, while-you-wait. The date renders as a raw "2026-09-16". Confetti only at a perfect 100, which is the right call.

**Days 2–10.** The provisional board shows "3 / 10 games". A clear ladder. But the qualified board above it is the bots. A new player's first impression of "the community" is five fictional people who have each played 44 games.

**Day 10 and after.** Qualified. Then nothing. There is no next goal until MunyIQ, which is "coming soon" with no date. The lessons have a progress bar but completion earns nothing and connects to nothing. The practice projected rank is a good bridge for newcomers but does not help a qualified player.

**Missed day.** Redirect to practice with a good explanation. **Holiday / no game:** "No Game Today. Check back tomorrow." with none of the While-you-wait cards. A dead end that the rest of the product has already solved.

---

## 4. Gamification loop by loop

- **Core loop (daily):** Excellent. Stakes, deadline, decision, feedback, lesson. Scarcity is respected and not padded out.
- **Feedback loop over time:** Weak. Per-game feedback is rich; per-player trend is absent. No accuracy trend, no calibration, no gut-vs-research insight, no "you are better in Energy than in Tech". The game's signature promise ("watch your judgment improve") has no screen.
- **Progression / meta loop:** Streak, then qualification, then a cliff. No milestones between (first game, 5-day, 10-day, personal best average, first perfect game, longest streak beaten). Confetti is the only celebration in the product.
- **Social loop:** Absent. No share card, no friends, no invite loop beyond a referral cookie. Wordle's entire growth engine was the emoji grid; Munymo has a perfect one waiting (🧠✅ 🔬✅ ⏱️ 20 → 100).
- **Mastery loop:** 32 lessons in five levels is real substance, but the Learning Hub is a library, not a ladder. Lesson-of-the-day is the only bridge from play to study. Nothing in the score acknowledges study.
- **Integrity loop:** The market-grades-you promise is the foundation and it is cracked by the settlement drift (Section 2, row 1).
- **Exploit:** The leaderboard is an *average* of games played. Unplayed days do not count. Streak is the only cost of skipping, and Away Status removes it, without limit. So: set Away, play only the days you feel sure, and your average rises while your streak is safe. Decision 5 says revisit after observing behaviour; this is the observation.

---

## 5. Blind spots — things that are invisible from inside

1. **The bots are the community.** From inside they are "the testers". From outside they are a fake crowd with human names, and they are the only thing on the public leaderboard. This is the single most damaging thing a journalist could screenshot.
2. **AI-written content labelled expert-curated.** Not a legal problem today; a trust problem the first time a brief contains an error and someone asks who wrote it.
3. **Settlement drift.** Nobody inside checks the printed prices against the printed percentage. The card invites the reader to.
4. **Copy drift is structural.** The qualification threshold lived in five places; two were missed. The FAQ describes a validation window the server does not offer. There is no test that pins player-facing claims to the constants they describe.
5. **Every retention hook is an email.** Daily to every opted-in account. There is no unsubscribe link in the email body and no `List-Unsubscribe` header. Gmail's bulk-sender rules and spam placement will eventually bite, and it is a one-click expectation for US recipients.
6. **Locale.** Dashboard dates use Australian and British formats; the content standard is US English.
7. **Time-of-day framing.** "Morning calisthenics" is true in New York and false in Perth, Sydney and London, where the game locks at night. The copy should say "before the US open" rather than "morning".
8. **Handover table drift.** Two rows (Decision 7, Decision 2) say "not implemented" for things that are.

---

## 6. To-do list, in priority order

### P0 — integrity (do these before any more marketing)

1. **Settle results from open-to-close, computed on the server.** Derive `companyAPerf` / `companyBPerf` from the recorded start and end prices instead of trusting the agent's percentage; keep the agent's numbers only as a cross-check that must agree within tolerance or the run fails. Make the prompt explicit: "regular-session open to regular-session close; never the quoted daily change versus the prior close." Print the rule on the result card ("Open-to-close, regular session"). Add a test. Then decide the three flipped games (2026-07-06, 2026-08-07, 2026-08-11): recommend leaving history as published, adding a one-line note on those three archive pages, and recording the decision in the handover. Re-scoring would ripple into streaks and averages for the bots and Paul only, so it is also defensible to re-settle; Paul's call.
2. **Take the bots off the public surfaces.** Exclude tester IDs from both leaderboards and from community stats (they can keep playing for pipeline testing). If keeping them visible is preferred, rename them "Munymo Bot 1–5" and say so on the board. Restore or delete the erased "Anonymous" bot.
3. **Disclose AI curation.** Landing step 2: "a research brief curated daily by Munymo's research agent from live sources, with every pairing tied to a credited article." Add one FAQ answer ("Who writes the research?") and one Disclaimer paragraph. This is a strength when stated and a liability when discovered.

### P1 — claims and copy (an hour)

4. Fix "20 games" on the landing pill and the leaderboard provisional caption; use the shared constant. Also delete or update the unrouted Evolution page, which still argues for 20.
5. FAQ: the validation window is "until results are published after the close on game day", not "the next trading day".
6. FAQ: Away Status is a toggle with no set period (or add a period, see item 14).
7. Legal pages: "June 2025" to the correct date.
8. Handover Section 4: update the Decision 7 and Decision 2 rows; formally retire or enforce Decision 4 (NASDAQ only) and stop labelling every game NASDAQ.
9. Demo: align to the live four-step flow, or make the live game five steps. Pick one.

### P2 — the missing loops (a few days, highest upside)

10. **Share card after every result.** One tap, Web Share API with clipboard fallback: "Munymo 09-16 · LEN vs DHI · 🧠✅ 🔬✅ ⏱️20 · 100 · 🔥7". This is the growth loop the product is modelled on and does not have.
11. **Gut vs Research insight on the dashboard.** "Research changed your pick 9 times in 40 games. It helped 6, hurt 3." Plus accuracy trend by month and by sector. This is the claim in FAQ row 4 and it is the reason the two-pick mechanic exists.
12. **Milestones.** First game, 5-day and 10-day streaks, longest streak beaten, qualification day, first perfect game, new personal-best average. A toast on the result page and one line in the result email. Cheap, and it fills the empty space between day 1 and day 10.
13. **Real losing-streak intervention.** At 5 losses, surface a specific lesson (the lesson-of-the-day selector already exists) and a one-line reframe. At 3, a gentler nudge.
14. **Close the Away exploit.** Options, from lightest to heaviest: show "played 31 of 44 available games" beside every average; cap Away at N days per month; or count unplayed days at zero once qualified. Recommend the first now and the second when there are real players.
15. **A goal after qualification.** A monthly board that resets, a personal-best average, and a visible "MunyIQ progress: 12 of 20 games" bar on the dashboard even before MunyIQ exists.
16. **Holiday state.** Reuse the While-you-wait cards on "No Game Today".
17. **Email hygiene.** Unsubscribe link in every footer, `List-Unsubscribe` and `List-Unsubscribe-Post` headers, and a one-click landing page that flips `emailOptIn`.

### P3 — polish

18. Result page date as "Wednesday, September 16, 2026"; en-US formats on the dashboard and profile.
19. The sticky "Locks in" bar overlaps the footer and the sign-in button on phones; add bottom padding equal to the bar height.
20. Dashboard "Lose Streak" card: hide at zero. Nobody needs a zero in red on their home screen.
21. "Morning" framing on the landing page: say "before the US market opens".
22. Unverified: in the emulated phone viewport the game page header and both company cards stayed invisible (opacity 0, animation never advanced). It is probably an artifact of the hidden browser pane, but it takes ten seconds to confirm on a real iPhone.

---

## 7. What is right and should not be touched

- The gut-then-research-then-declare-then-pick sequence.
- The beginner summary with a full-analysis toggle, and "What does this mean?" on every metric.
- The timed question with a confirm step before the clock starts.
- The auto-submit and "Time Ran Out" state.
- The result debrief, Hindsight Spotlight and lesson of the day.
- The practice mode's honesty (hidden date, stated caveat, projected rank with the warning).
- The qualification explanation on the leaderboard, and golf-style ties.
- The 10-game threshold. Twenty was a wall.
- The push prompt placement, the streak-at-risk timing, and the first-timer reminder.
- The "While you wait" cards. The product now has no dead ends except the holiday state.
