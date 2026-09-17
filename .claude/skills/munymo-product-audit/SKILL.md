---
name: munymo-product-audit
description: Full "do we meet our claims, does it flow as a game, what am I missing" sweep of Munymo, producing a game-designer review with a prioritized to-do list plus an outside-view critic's article. Use this whenever Paul asks for a review, appraisal, audit, health check, sweep, "where are we at", "fresh eyes", "what am I missing", "does everything still hold up", or wants to re-run the review after a batch of fixes, even if he doesn't say the word review. Also use it before any launch, marketing push, or press outreach, because it finds the things an outsider would screenshot.
---

# Munymo product audit

This is the sweep first run on 2026-09-17 (`references/product-review-2026-09-17.md` in the repo). Its job is to catch the things the founder cannot see from inside: claims the copy makes that the code no longer honours, places where the gamified loop dead-ends, and anything a journalist would lead with. Paul is not a coder, so the report is judged on whether a non-technical reader can act on it.

Two deliverables every run, both saved in the repo under `references/` with today's date, then sent to Paul with SendUserFile:

1. `references/product-review-YYYY-MM-DD.md`: the designer's review and to-do list (template below).
2. `references/wsj-critic-article-YYYY-MM-DD.md`: a newspaper critic's piece about the product as a reader would meet it.

The chat reply is a short summary: the three or four findings that matter most, and the question of what to start on. Everything else lives in the files. Paul has asked for succinct replies; the detail is in the documents.

## Why the method is what it is

The copy drifts from the code because the same fact (a threshold, a deadline, a rule) is written in many places: landing pills, FAQ, leaderboard captions, emails, legal pages, the handover table. Every previous drift was found by reading the claim and then reading the code that implements it, never by reading either alone. So the audit is a claim-by-claim cross-examination, not a code review and not a copy edit.

The live data matters as much as the source. Bots on the leaderboard, a settlement percentage that disagrees with the printed prices, an archive page that 404s: none of these are visible in the code. Pull the public API and open the pages.

## Procedure

Work through all six passes before writing anything. Findings from a later pass change the priority of earlier ones.

### Pass 1: what do we claim?

Collect every player-facing claim. Sources, in order:

- `client/src/pages/Home.tsx` (hero, four steps, score section, feature pills, MunyIQ, roadmap, beta pitch, FAQ array)
- `client/src/pages/Leaderboard.tsx` captions, `client/src/pages/Practice.tsx` caveats, `client/src/pages/DailyGame.tsx` hints
- `server/email.ts` subjects and bodies, `server/push.ts` and the push calls in `server/routers.ts`
- `client/src/pages/legal/*.tsx` (dates, promises about data, disclosures)
- `references/munymo-handover-v2.md` Section 3 (binding founder decisions) and Section 4 (status table)

Read `references/claims-map.md` in this skill for the known claim locations and the rules each one describes. Add any new claims you find to that file.

### Pass 2: what does the code do?

For each claim, find the code that implements it and read it. The loop lives in: `server/scoring.ts`, the picks/scores/practice/leaderboard/dashboard routers in `server/routers.ts`, `server/autoSubmitHandler.ts`, `server/_core/curationAgent.ts` (the prompt is the settlement rule), `server/db.ts` for leaderboard and community queries, `shared/const.ts`. Grep for literals that should be constants (a number of games, a time window, a percentage). A literal that appears in copy and in code separately will drift.

### Pass 3: what does the live site do?

Run `scripts/live_checks.py` from this skill. It pulls the public API and reports: today's game, leaderboard composition (which rows are tester accounts 870002 to 870012), the last 50 archived games with perf-versus-open-to-close mismatches and winner flips, and the archive page ids to spot-check. Then open in the built-in browser, signed out, desktop and phone preset: `/`, `/game`, `/leaderboard`, `/research`, one `/research/:id`, one `/game/:id/result`, `/learn`, one lesson, `/practice`, `/demo`. Read page text rather than screenshots for claims; screenshot for layout. Signed-in flows are verified from code (there is no test sign-in); say so in the report.

### Pass 4: walk the flow as a player

Narrate day 0 (visitor), first game, lockout to result, days 2 to 10, qualification and after, a missed day, a holiday. At each step ask: what does the player see, what are they told, what can they do next, and is there a dead end. Then judge each loop separately: core daily loop, feedback over time, progression, social, mastery, integrity, and any exploit (a rule that lets a player gain without playing).

### Pass 5: compare with the previous review

Read the most recent `references/product-review-*.md`. For every item on its to-do list, record whether it is closed, still open, or changed. This is the point of making the audit repeatable: the second run should show what moved. Put the comparison in its own section.

### Pass 6: write, prioritise, deliver

Priorities mean: P0 is integrity, anything that makes the game's result, ranking or research untrustworthy or that an outsider would screenshot. P1 is copy that is untrue or stale. P2 is missing loops with high upside. P3 is polish. Within each, order by damage, not by effort.

## Report structure

Use this template for the review. Keep the claims table; it is the part Paul reads twice.

```
# Munymo — Game Designer's Review and To-Do List
Date, reviewer, method (what was read, what was opened, what was pulled).
## 1. Verdict in one paragraph
## 2. Claims audit — table: # | Claim (where) | Verdict (MET / NOT MET / STALE / PARTIAL / MISLEADING / HONESTLY LABELLED) | Evidence
## 3. The flow, walked as a player
## 4. Gamification loop by loop
## 5. Blind spots — things invisible from inside
## 6. Since the last review — closed / open / changed
## 7. To-do list, P0 to P3, numbered continuously, each item saying what to change and why
## 8. What is right and should not be touched
```

The critic's article is written as a national newspaper technology critic reviewing the product for readers who have never heard of it. It is honest in both directions: it must contain only facts verified in passes 1 to 3 (no invented quotes, users, funding or history), it names the strengths as concretely as the flaws, and it ends with a verdict a reader could act on. Refer to the founder by name or role, not by pronoun. 900 to 1300 words.

## Things learned on previous runs

- The settlement rule (open-to-close, Decision 6) is only as real as the curation prompt and whatever the server derives. Always recompute perf from the stored start and end prices; the agent has used the prior-close change on some days.
- Tester bots have human display names. From the API you identify them only by id.
- Page text from the browser arrives before tRPC data loads; wait four seconds and read again before calling something empty.
- The handover Section 4 table lags reality in both directions (things marked missing that exist, and vice versa). Trust the code.
- Paul's US-English standard applies to copy; watch for en-AU and en-GB date formats.
- Do not commit the reports; leave them for Paul to read first. Do add a memory pointer (`product-review-YYYY-MM-DD` in the memory directory) so the next session knows what is open.
