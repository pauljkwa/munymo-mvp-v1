# Guest Play: Today's Game Without an Account

> **Revision 2026-10-05 (later): the guest game is now COMPLETE.** Paul chose to stop holding anything back from guests: the quiz verdict shows at once (public `games.checkGuestAnswer`, returns only isCorrect; the answer-probing trade-off is accepted), "Remind me at the close" downloads a calendar file (5pm New York on the game day, `client/src/lib/calendar.ts`), an open tab re-checks every 2 minutes, and a "Your last pick" card on /game shows a returning guest's previous result, because /game moves on to the next matchup once a result publishes. The account is pitched on what it adds ("Make it count with a free account": result sent to you, score and streak, monthly leaderboard, gut vs research over time) with the same no-catch small print, and the guest path is never offered as a choice. Paul: "that doesn't mean we should hold off on the selling points." The quiz-withholding and "lock in your pick" sections below are superseded. IP-address tracking was considered and rejected: shared school, office and home IPs collide, mobile IPs change, and an IP is personal data.

**Date:** 2026-10-05. **Status: decisions 1 and 2 settled 2026-10-05 (quiz option A, with plain no-trap wording); the ask-card wording is awaiting Paul's sign-off.** Decided in principle 2026-10-02 (see memory `guest-play-plan`). Written by Fable as the spec. Small enough that Fable can build it directly once approved.

## Why

Today's game is hidden behind a "Sign in to Play" button on the very first step. Munymo's only real signup so far churned after one session. Asking for an account before someone has played asks them to commit to something they haven't tried. The ask lands best straight after they've made a prediction, because the one thing they want then (finding out if they were right) is the thing an account gives them.

It also makes Munymo eligible for the daily-game directories Dle Hunt and The Dles. Both require play without an account (Links 3 on the to-do list, currently blocked).

## What the visitor experiences

1. **Gut pick.** A signed-out visitor taps a company and taps **Confirm Gut Selection**, exactly like a signed-in player. The "Sign in to Play" button is gone.
2. **Research.** Same as today. Every query on this step is already public.
3. **Final pick.** Same as today.
4. **Research quiz (the timed validation question).** Same modal and timer. Their answer and time are kept, but the right/wrong verdict is **not** shown yet (see "The quiz" below).
5. **The ask.** In place of the "Picks Submitted" card, a guest sees:
   > **Your pick: Company B**
   > Create a free account to lock in your pick, and we'll let you know at the close if you were right.
   > Your quiz answer is saved too. You'll see if you got it right as soon as you're in.
   > [Create a free account] (primary)
   > Free, with no card and no catch. The account is where the game keeps your picks and your score. You can turn notifications off or delete the account anytime from your profile.
   > Already have an account? Sign in (small link)

   The second line is Paul's 2026-10-02 line with his approved 2026-10-05 tweak ("we'll let you know" instead of "find out"). It's true for everyone because the results email is on by default and push takes over once enabled. Never name a channel there. The reassurance line was approved on 2026-10-05 after Paul rejected an earlier draft, which said the pick "stays on this device only and isn't scored or ranked". That read as an invitation to skip the account. The rule: say what the account is for and that it's free and reversible, and never offer the guest path as a choice. "Delete it anytime" is true: the "Delete Account Permanently" option on /profile has existed since 2026-07-16.
6. **They create an account** (Clerk modal, as now). The page then submits their picks automatically, shows the quiz verdict and the normal "Picks Submitted" card, and from there they're an ordinary player.
7. **They don't create an account.** If they come back on the same device later that day, they're returned to step 5 with their pick shown. Once the result is published, they see the normal result panel plus one line: "You picked Company B, and Company B won. Create a free account to keep score from tomorrow." No points, no rank, no streak.

## How it works

**No schema change. No new server endpoints.** The guest's choices live only in their browser (localStorage), under one key per game: `munymo-guest-pick-<gameId>` = `{ gut, final, validationAnswer, answerTimeMs, savedAt }`.

**On sign-in or sign-up** (the moment `isAuthenticated` becomes true on `/game` with a stored guest pick for today's game):

1. Fetch `picks.getMyPick`. **If the account already has a pick for this game, the server's pick wins.** Discard the guest pick silently. This covers an existing player who played as a guest on a different device.
2. Otherwise replay, in order, through the existing protected mutations: `submitGut` → `submitFinal` → `submitValidation` (with the stored answer and time). Lockout, "game is active" and the no-second-chances rule all stay enforced on the server, unchanged.
3. On success: delete the local key, show the quiz verdict, land on "Picks Submitted".
4. **If the game locked while they were deciding** (the server returns FORBIDDEN): delete the key and say: "Today's game locked before your pick could be saved. Your account is ready, so tomorrow's game counts." Then hand over to the existing missed-game redirect to `/practice`.
5. If a later step fails (gut saved, final rejected), whatever the server accepted stands, and the player continues the normal flow from that step. No silent loss.

**Community stats and leaderboards** read only from the database, so guests can never appear in them. Nothing to change there.

**Cleanup:** on load, delete guest keys whose game is no longer today's game and is more than 7 days old.

## The quiz

`submitValidation` returns right/wrong immediately, but a guest can't call it. The options:

- **A (recommended): guests answer now, and the verdict comes after they create an account.** The timer and the "answer under pressure" moment stay intact. Seeing whether they got it right becomes one more reason to create the account.
- B: guests stop before the quiz and must create an account to take it. That's simpler, but the ask then interrupts the game before the end instead of closing it.

We must **not** add a public "check my answer" endpoint. A guest could use it to find the right answer, then create an account and submit it.

**On trust:** the question text is already public (`games.getValidationQuestion`), and `answerTimeMs` is already reported by the browser for signed-in players. Replaying a stored time trusts the browser no more than today does. The server's existing under-300ms clamp still applies.

## Edge cases

| Case | Behavior |
|---|---|
| Guest picks, then creates an account via Google (page redirect) | Google sign-in returns to the same browser, so localStorage survives and the replay runs on return. |
| Guest picks on an iPhone, then confirms sign-up from an email in a different app or browser | The other browser has no stored pick, so it's lost. Accepted for v1: Clerk's sign-up modal uses an in-page code, not a link, so this is rare. |
| Guest arrives after lockout | Same "Game Locked" card as now, plus a "Create a free account so tomorrow's game counts" button. They aren't redirected (the current redirect to /practice only applies to signed-in players, and /practice requires an account). |
| Guest arrives after the result is published | Result panel as now. If there's no stored pick, just the call to action. |
| Signed-in player | Completely unchanged. |
| Guest clears browser data | Pick is gone. Not mentioned in the copy on purpose (see step 5). |

## Setup asks: one at a time, when each one matters

**History:** Paul first asked for a "little housekeeping" screen straight after sign-up (name, notifications, home screen). On 2026-10-05 he asked whether that made things complicated for a new player, and agreed to replace it with asks timed to the moment each one matters. Reasoning: the result isn't available for hours, the results email is on by default (so nobody misses their result), and a leaderboard name only matters once they're on the leaderboard. **No extra screen at sign-up.**

| When | What they see |
|---|---|
| Straight after creating the account | Back in the game: "✓ Your pick is locked in. Quiz: correct! Results at 4pm New York time. We'll email you." On Android or a computer, one optional small button: "Or get a notification instead" (browser permission box). On iPhone: "Or get a notification instead" opens the **home screen sheet** (below). |
| Their first published result | On the result panel: "You scored 72 and you're on this month's leaderboard as **Paul K**." Buttons [Keep it] [Change name] (inline box). Either choice saves `users.displayName`, so it never asks again. |
| Second visit, iPhone in Safari, no subscription | One dismissible card: "Want results as a notification instead of email?" Tapping it opens the **home screen sheet**. Shown once; dismissal remembered. |
| First open of the installed app on iPhone | Notification card at the top of `/game` whatever the step ("Turn on notifications" / "No thanks"). Today's `ResultReminderPrompt` only shows on the research step, so it must also show here in standalone mode. |

### The home screen sheet (one component, used everywhere on iPhone)

Paul, 2026-10-05: the profile has a push toggle, and an iPhone user who turns it on in Safari "should be informed and prompted to do the homescreen install or it won't work and they will wonder why and think it's a fault".

**Today** the profile shows no toggle at all in iPhone Safari. It shows an amber paragraph, "Add to Home Screen first", with no button. That reads as broken or blocked. **Change:** in iPhone Safari the profile shows the same **Enable** button as everywhere else. Tapping it, or any "get a notification instead" link, slides up one bottom sheet:

> **One step first: add Munymo to your home screen**
> Apple only lets iPhone apps send notifications once they're on your home screen. It's a shortcut, not an App Store download, and you can delete it like any other icon.
>
> **1** Tap [Share icon] at the bottom of Safari
> **2** Tap **Add to Home Screen**, then **Add**
> **3** Open Munymo from your home screen and sign in once more
> **4** Tap **Turn on notifications** when we ask
>
> Until then, we'll keep emailing your results.
> [Got it]

- The Share icon is drawn inline (the real square-with-arrow glyph). Step 2 says "you may need to scroll down", because iOS hides the option below the fold on some versions.
- Step 3's "sign in once more" was confirmed on Paul's iPhone on 2026-10-05: Safari and the home-screen app don't share sign-ins.
- If the account already has push on a home-screen device, keep today's green "Push notifications are on… delivered to the Munymo app on your Home Screen" message instead of the sheet. It already handles that case correctly.
- Android and computers never see the sheet. Enable goes straight to the browser's permission box.
- The sheet is a pure presentational component (`IosInstallSheet`), opened from the profile, the post-sign-up line and the second-visit card.

**Related fix (ship with this or before it):** `server/_core/context.ts` falls back to the player's **email address** as `users.name` when Clerk has no first or last name. `abbreviatePlayerName` then leaves a one-word value unchanged, so the leaderboard can show an email address. Change the fallback to "Player", never the email.

## Copy changes

- `DailyGame.tsx` gut step: "Sign in to Play" → normal **Confirm Gut Selection** for everyone.
- Header "Sign in" stays as it is (it's for returning players).
- New player-facing copy uses "Create a free account", never "Sign up" (Paul, 2026-10-02).
- `Practice.tsx` (archive play) still requires an account. Its "Sign in to play completed games…" line changes to "Create a free account to play completed games…". Guest archive play is out of scope (see below).

## Measuring it

There are no custom analytics events yet. Add four Google Analytics events (`gtag`, already loaded): `guest_gut_pick`, `guest_final_pick`, `guest_ask_shown`, `guest_converted`. These tell us how many visitors play, and how many of those create an account, which is the number that decides whether this worked. No personal data goes in the events.

## Files touched (estimate)

- `client/src/pages/DailyGame.tsx`: guest branch for each step, replay effect, the ask card, guest result line.
- `client/src/lib/guestPick.ts` (new): read, write and clean up the stored pick (pure functions, unit-tested).
- `client/src/pages/Practice.tsx`: one line of copy.
- `server/munymo.test.ts`: no server change. The test for the "server pick wins" and replay-ordering rules goes on the pure helper.
- `references/munymo-handover-v2.md`: Section 4 row plus the Section 26 to-do table.

## Not in this change

- Guest play in the archive (`/practice`). Its procedures are protected and its scoring is per-user. Possible later, but today's game is what directories and first-time visitors see.
- Keeping guest picks on the server (would survive a device switch). Needs a new table, which means schema approval. Revisit only if analytics show picks being lost.
- Showing guests a points score. Deliberately withheld: the score is what the account is for.

## Decisions for Paul

1. **Quiz: A**, decided 2026-10-05 (answer now, verdict after creating an account; plainly no trap).
2. **Ask card wording:** step 5, settled 2026-10-05 (Paul chose the "we'll let you know at the close" tweak).
3. **Setup asks replace the housekeeping screen** (decided 2026-10-05), including the iPhone home screen sheet.
4. **Go-ahead to build.** No schema change and no new secrets.
