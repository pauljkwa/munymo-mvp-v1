# Guest Play: Today's Game Without an Account

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
   > Create a free account to lock in your pick and find out at the close if you were right.
   > [Create a free account] (primary)
   > Free, with no card and no catch. The account is simply where the game keeps your picks and your score, and you can delete it anytime from your profile.
   > Already have an account? Sign in (small link)

   The second line is Paul's, verbatim (2026-10-02). The reassurance line was approved on 2026-10-05 after Paul rejected an earlier draft, which said the pick "stays on this device only and isn't scored or ranked". That read as an invitation to skip the account. The rule: say what the account is for and that it's free and reversible, and never offer the guest path as a choice. "Delete it anytime" is true: the "Delete Account Permanently" option on /profile has existed since 2026-07-16.
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

## The housekeeping screen (every new account)

Paul, 2026-10-05: "immediately after creating the account, the user should be shown a screen that announces 'there's just a little more housekeeping we need to do'... choose a username, accept or deny push notifications and instructions regarding homescreen installation. Keeping it all as simple to understand and follow as humanly possible."

This applies to **every** new account, not only converted guests. Today nobody is ever asked for a name (the leaderboard shows an abbreviated real name, "Paul K"), and push is only offered by a card on the game page or on /profile.

**Route:** `/welcome`. A new account lands here straight after sign-up. A converted guest's picks are replayed first (lockout is the deadline that matters), then the guest lands here. One screen, three numbered cards, one button at the bottom.

> **Just a little housekeeping**
> Three quick things, then you're back to your game.
>
> ✓ *Your pick is locked in: Company B. Quiz: correct.* (converted guests only)
>
> **1. Your name on the leaderboard**
> [ Paul K ] (prefilled, editable)
> This is what other players see. You can change it anytime.
>
> **2. Get your result the moment it lands** (the card changes by device, see below)
>
> **3. Add Munymo to your home screen, if you want notifications** (iPhone and iPad only)
>
> [ All done, back to my game ]

**Card 2 by device**

- **Android, computer, or an iPhone with Munymo already on the home screen:** buttons [Turn on notifications] and [No thanks]. The first opens the browser's own permission box. After either choice the card collapses to a single line ("Notifications on" or "No notifications. We'll email your results instead").
- **iPhone or iPad in Safari, not installed:** "On iPhone, notifications need step 3 first. Until then, we'll email your results." No button.

**Card 3: iPhone and iPad in Safari only**

Paul, 2026-10-05: the step must say why, "so they know it isn't just attempting to get some real estate on their screen". So card 3 appears **only where installing is required for notifications** (iPhone and iPad not yet installed) and leads with the reason:

> **3. Add Munymo to your home screen, if you want notifications**
> Apple only allows notifications on iPhone from apps saved to the home screen. It's not an app store download, just a shortcut, and you can remove it like any other icon.
> (1) Tap the Share button [square-with-arrow icon] at the bottom of Safari. (2) Tap **Add to Home Screen**. (3) Open Munymo from your home screen. We'll ask about notifications there.

**Open check before building:** whether iOS keeps the player signed in when opening the home-screen app. Our own 2026-09-20 finding was that Safari and the home-screen app don't share storage. If that holds, step 3 must say "and sign in once more". Verify on Paul's iPhone first.

**Android and computers never see card 3.** They get notifications without installing, so asking would be exactly the "real estate" grab Paul wants to avoid. The heading then says "Two quick things".

**Rules**

- Nothing on this screen is required. "All done" works with every card untouched, and the name box keeps its prefilled value.
- **How we know it's done, without a schema change:** pressing "All done" saves the name box to `users.displayName` (even unchanged). A player with a `displayName` is never sent to `/welcome` again. Existing players without a displayName will see it once on their next visit, which is a reasonable moment to pick a name.
- The push choice goes through the existing `usePushNotifications` hook. "No thanks" sets the existing dismissal flag, so the game-page reminder card doesn't ask again.
- Name: 1-32 characters, trimmed. Profanity or impersonation filtering isn't in scope at our size. The admin player list can already edit names.

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

1. **Quiz: A, decided 2026-10-05.** Condition: it must be plainly obvious that the account isn't a trap. On the ask card, under the quiz result placeholder: "Your quiz answer is saved. Create a free account to see if you got it right."
2. **Ask card wording:** revised in step 5. Awaiting approval.
3. **Housekeeping screen:** added 2026-10-05 at Paul's request (section above). Approve the layout and wording.
4. **Go-ahead to build.** No schema change and no new secrets. The iPhone sign-in check happens first.
