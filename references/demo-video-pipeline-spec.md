# Demo Video Pipeline + Clip 1 "Play today's game"

**Date:** 2026-10-17. **Status: APPROVED by Paul in chat 2026-10-17 (voice Heart at 0.92, both exports, keep the full-analysis tap). Build handed to a cheaper model the same day.** Builder: a cheaper model (Sonnet) implements from this spec; Fable reviews the first rendered clip frame by frame. Decided in chat 2026-10-17 (see memory `demo-video-plan`).

## 1. What we are making

A set of short phone-sized tutorial videos that show someone using munymo.com on an iPhone, with a tap indicator at every touch, a voice explaining what they are doing as they do it, and small burned-in subtitles. Clip 1 is "Play today's game". Later clips (not in this spec, same pipeline): review a past game, learn, notifications + home screen install, profile + dashboard, and last of all "sign up", recorded after guest play has settled.

The method is a **scripted screen recording**, not generated footage. A headless Chromium emulating an iPhone walks the live site from a script. The same script also produces the narration audio and the subtitle file, so voice, taps and captions stay in sync by construction, and when the UI changes we re-run the script instead of re-shooting.

### Why a pipeline and not a hand recording

- Re-recordable for free when copy or layout changes (which is often).
- Perfect sync: each narration line's measured duration paces the on-screen actions.
- The same beats produce the `.srt`, so captions are never retyped.
- Output doubles as Shorts/Reels content for the social plan (`references/social-page-kit.md`).

## 2. Where the code lives

**Not in this repository.** The pipeline pulls in Playwright (~150 MB of browser) and ffmpeg and must never reach Railway's build. It lives in its own folder beside the other tools:

```
~/WorkSpace/tools/munymo-demo-videos/
  package.json            # private, pnpm, node 22
  clips/
    play.ts               # the beats for clip 1 (section 6)
  src/
    record.ts             # drives Playwright, writes screen.webm + timeline.json
    overlay.ts            # the tap-indicator script injected into the page
    tts.ts                # narration: provider adapter (say | elevenlabs)
    assemble.ts           # ffmpeg: audio track, subtitles, phone frame, exports
    review.ts             # extracts one frame per beat for a cheap visual check
    frame.ts              # generates the phone bezel PNG from an SVG
  out/<clip>/             # all outputs, git-ignored
```

Only this spec, and later a one-line pointer in the handover (Section 4), live in the app repo. Rendered videos are never committed to the app repo (size). Paul uploads finished files to YouTube/Instagram by hand.

### Prerequisites Paul installs once

```bash
brew install ffmpeg
```

Playwright downloads its own Chromium on `pnpm install` (the builder runs `pnpm exec playwright install chromium`).

Voice (free, installed 2026-10-17): **Kokoro**, an open-source neural TTS, in `~/WorkSpace/tools/munymo-demo-videos/tts/` (uv venv, Python 3.12, `speak.py <voice> <out.wav> "<text>"`; American voices `af_heart`, `af_bella`, `am_michael`). Runs offline on the Mac, 24 kHz output, clearly better than the built-in Mac voices. Fallback: the Mac `say` command (Samantha, or Ava (Premium) if downloaded by hand in System Settings, which has no terminal install path). Paid upgrade: ElevenLabs (about US$5/month). The code keeps the provider behind one adapter (`kokoro | say | elevenlabs`) so switching is an env var, not a rewrite.

## 3. Recording model

### Device

Playwright Chromium with the built-in `iPhone 14` descriptor: viewport 390×844 CSS px, deviceScaleFactor 3, mobile + touch, Safari-like user agent. Video is recorded at **1170×2532** (the device's native pixels) so text is crisp after composition. If Playwright's `recordVideo` output turns out fuzzy at that size (it comes from Chromium's screencast and can be), fall back to Chrome DevTools Protocol `Page.startScreencast` frames at 1170 wide reassembled with ffmpeg at 30 fps. The quality gate is in section 8.

### Fresh guest every run

A new browser context per run: no cookies, no localStorage. The site then treats the visitor as a guest (`isGuest` in `DailyGame.tsx`), so clip 1 needs **no sign-in at all** and never writes to the database. Guest picks live in the browser only. The only side effect is a handful of `guest_*` analytics events, which is acceptable.

### Beats

A clip is an ordered list of beats. Each beat is one narration line plus the actions performed while it is spoken:

```ts
type Beat = {
  id: string;             // "gut-pick"
  say: string;            // narration line, also the subtitle text
  actions: Action[];      // performed in order while the line plays
  holdAfter?: number;     // seconds of quiet after both finish (default 0.4)
};
type Action =
  | { tap: Locator; after?: number }        // move the dot, ripple, real tap
  | { scrollTo: Locator | "top"; after?: number }
  | { wait: number }
  | { closeSheet: true };                    // Escape / tap the sheet's close
```

Timing rule: each beat lasts `max(audioDuration, actionsDuration) + holdAfter`. Actions start together with the audio. If the audio is longer, the page holds still on the last action's result until the line ends. If the actions are longer (a long scroll), the audio ends and the actions finish in quiet. Never let a tap land after its sentence has ended by more than a second; split the beat instead.

### Timeline

`record.ts` writes `timeline.json`: for every beat, the wall-clock start and end relative to the first recorded frame, plus the measured audio duration. Alignment to the video's first frame: the recorder shows a plain black page for 1.0 s before navigating, and `assemble.ts` finds the first non-black frame with ffmpeg's `blackdetect`. Everything downstream (audio placement, subtitle times, review frames) uses this timeline, so there is exactly one source of truth for sync.

## 4. Tap indicator (overlay.ts)

Injected with `page.addInitScript` so it exists on every navigation. It draws two things, both `position: fixed; pointer-events: none; z-index: 2147483647`:

- **A finger dot:** a 44 px circle, brand green at 55 % opacity with a 2 px white ring, that glides from its last position to the next target over 350 ms (`transition: transform`) before the tap happens. First appearance fades in.
- **A ripple on tap:** on `pointerdown` the dot pulses: a second circle expands from 44 px to 110 px and fades over 450 ms.

API on `window.__demo`: `moveTo(x, y)`, `pulse()`, `hide()`. The recorder resolves the Playwright locator to its bounding box center, calls `moveTo`, waits 400 ms, then performs the **real** `locator.tap()` so the page receives genuine touch events. Scrolls use `window.scrollTo({ top, behavior: "smooth" })` via `page.evaluate` for smoothness, with the dot hidden; the dot reappears for the next tap.

Element targeting: `getByRole` and `getByText` only, never CSS classes (Tailwind classes change). If a target has no accessible name, the fix is an `aria-label` in the app (an accessibility improvement in its own right), never a `data-demo` attribute.

## 5. Narration, subtitles, assembly

### Narration (tts.ts)

One audio file per beat, generated before recording so durations are known. Default provider `kokoro`, voice **af_heart (Heart)** at speed **0.92**, both chosen by Paul after listening tests on 2026-10-17 (Bella's rising inflections and the flat Michael/Puck reads were rejected; Fenrir was the runner-up):

```bash
tts/.venv/bin/python tts/speak.py af_heart out/play/audio/03.wav "<line>" 0.92
```

Load the Kokoro pipeline once per run, not once per line (model load is the slow part). Then `ffprobe` for the duration. Provider `say`: `say -v Samantha -r 175 -o 03.aiff --data-format=LEF32@44100 "<line>"`. Provider `elevenlabs` (later): same interface, `ELEVENLABS_API_KEY` from the shell, never committed. Pronunciation: `speak.py` carries a `PRONOUNCE` map applied to the spoken text only, never to the subtitle text. Settled 2026-10-17 after listening tests: "Munymo" is spoken as **"Money-mo"** (with the hyphen; "Moneymo" still had the voices saying the y as an i). Add any other mangled word there.

Voice persona: a neutral US-English narrator speaking in first person plural ("let's play"). Mo is the AI analyst inside the product and is referred to in the third person, by name. US spelling throughout (memory `us-english-content-standard`).

### Audio track

Each beat's audio is padded with silence to the beat's measured duration (`apad=whole_dur=`), the padded clips are concatenated, and the result is laid under the video from the first non-black frame. Because padding equals the timeline, no manual offsets exist anywhere. Loudness normalized to -16 LUFS (`loudnorm`), which is the YouTube/Instagram target.

### Subtitles

`play.srt` is generated from the beats: one cue per beat, start = beat start + 0.1 s, end = audio end. Lines wrapped to at most 2 lines of 38 characters. Burned in with ffmpeg's `subtitles` filter, styled: Plus Jakarta Sans (the site's font, bundled via `@fontsource/plus-jakarta-sans` already in the app's deps; copy the TTF into the tool), 30 px at 1080 width, white on a 55 % black rounded box, bottom margin that keeps the caption inside the phone screen and clear of the page's bottom controls. The `.srt` is also written beside the mp4 for upload as a proper caption track.

### Phone frame and exports

`frame.ts` generates an iPhone-style bezel as SVG (black rounded rectangle, 55 px corner radius at 1170 wide, a Dynamic Island pill, no logos or trademarks) and rasterizes it with `@resvg/resvg-js`. No third-party mockup assets.

Exports per clip:

| File | Size | Use |
|---|---|---|
| `play-vertical.mp4` | 1080×1920, H.264, 30 fps, AAC | Shorts, Reels, TikTok |
| `play-landscape.mp4` | 1920×1080, same codecs | YouTube main channel |
| `play.srt` | | caption upload |

Vertical: the framed phone fills the height on a brand-green gradient. Landscape: the framed phone sits center-left; the right third shows a static title card ("Play today's game", "munymo.com", "Free · no sign-up to play") in the site's typography. Both begin with 0.8 s of the title card alone and end with 2.5 s of an end card: Mo avatar, "munymo.com", "One matchup a day. Free."

## 6. Clip 1: "Play today's game"

Target length 75 to 90 seconds. Recorded on the production site while a game is open (from about 16:30 to 09:30 New York time; picks lock at the 9:30 ET open). The matchup and research text are whatever that day's game is, so pick a recording day whose two companies are household names.

Beats. Labels in quotes are the real button texts from `DailyGame.tsx` and `ValidationModal.tsx`; the builder confirms each against the page at build time.

| # | id | Narration (subtitle text) | Actions |
|---|---|---|---|
| 1 | home | This is Munymo. One question a day: which of two stocks will do better today? About five minutes, and you can play without signing up. | open `https://munymo.com/`, hold 1 s, tap the hero **Play** link to `/game` |
| 2 | matchup | Today's matchup. Step one is your gut: before reading anything, which company do you think wins today? | wait for the two company cards; scroll so both cards and the step bar are visible |
| 3 | gut-pick | We'll go with the first one. Lock it in. | tap company A's card, wait 0.6 s, tap **"Confirm Gut Selection"** |
| 4 | research-intro | Now the research. Mo, Munymo's AI analyst, explains why these two are paired today, in a beginner summary first. | scroll slowly to "Pairing Rationale", pause, continue to the Summary |
| 5 | full-analysis | Want the whole picture? Tap "Show full analysis". | tap **"Show full analysis →"**, hold 1 s, scroll a little |
| 6 | metrics | Mo has highlighted the four metrics where the two companies differ most today. | scroll to "Key Metrics", hold on the highlighted rows |
| 7 | metric-explain | Not sure what a metric means? Tap it for a plain-English explanation. | tap the info trigger on the first highlighted metric (`MetricExplanationSheet`), hold 1.5 s, close the sheet |
| 8 | chart | Each company's price chart is one tap away. | tap company A's chart button, hold 1.5 s, close (`ChartSheet`) |
| 9 | to-reason | Done reading. On to your reason. | scroll to the bottom, tap **"I've Read the Research — Choose My Reason"** |
| 10 | reason | Pick the one metric that drives your decision, and which company it favors. Twenty-five points if your final pick agrees with what you say here. | tap the first metric option, wait 0.6 s, tap company A's name, tap **"Continue to Final Pick"** |
| 11 | final | Now the final pick, and how sure you are. Toss-up never loses points. Confident wins big, or loses big. | tap company A's card, tap **"Leaning"**, hold 0.5 s, tap **"Submit Final Selection"** |
| 12 | check-intro | Last step: a reading check. One question about what you just read, no timer, one attempt. | the confirm phase of the modal appears ("Selection Confirmed"); hold while the text is readable, tap the modal's continue button |
| 13 | check-answer | Read it, pick your answer, submit. | wait 1.5 s on the question, tap the first answer option, tap **"Submit Answer"** |
| 14 | check-result | And you find out straight away. | hold on the reveal 1.5 s, close the modal if it needs closing |
| 15 | your-day | That's your day: your pick, your reason, your confidence and your reading check, all on one card. The result comes in after the market closes at four, New York time. | scroll to the "Your day" card, hold |
| 16 | account-ask | Want the result sent to you, with a score, a streak and a leaderboard spot? That's what the free account adds. Nothing else. | scroll to the "Create a free account" card, hold 2 s. **Do not tap it** (sign-up is clip 6) |
| 17 | end | Munymo dot com. One matchup a day. Free. | end card |

Notes for the builder:

- Beats 7 and 8 depend on the sheets' close controls having accessible names. If not, add `aria-label="Close"` in `MetricExplanationSheet.tsx` and `ChartSheet.tsx` in the app repo in a separate small commit (tsc + vitest first, handover untouched since no feature status changes).
- Beat 13 picks the first answer without knowing if it is right. If the reveal says wrong, that is honest and stays in. Do not re-record to get a right answer.
- Beat 11 uses **Leaning**, not Confident, so the clip does not model overconfidence.
- If the day's game is not v2 (`highlightedMetrics` null), the Reason step does not exist. Abort with a clear message; do not record a legacy-flow clip.
- Company A is chosen throughout for determinism. The narration never names a company, so the words stay true on any day.

## 7. Commands

```bash
pnpm record play     # narration → recording → timeline (needs an open game)
pnpm assemble play   # audio track, subtitles, frame, both exports
pnpm review play     # out/play/frames/NN-<id>.png, one per beat start
pnpm all play        # the three in order
```

`review` is how Fable checks a render cheaply: 17 small frames instead of watching video. Each frame is labeled with the beat id and the subtitle text that should be on screen at that moment.

## 8. Acceptance

The clip passes when:

1. Every tap in the review frames lands on the element its beat names, with the ripple visible.
2. No subtitle appears before its sentence starts or after it ends by more than 0.2 s (check two beats by ear against the frames).
3. Text in the exported vertical mp4 is readable at phone size: the metric values in beat 6 can be read on a 6-inch screen. If not, the fallback recorder in section 3 is used.
4. Total length 75 to 95 s. Over 95 s means cut narration, not speed it up.
5. Audio has no clipping and no silence longer than 2.5 s.
6. `pnpm all play` runs from a clean `out/` with no manual step other than a game being open.

## 9. What this does not do

- No generated video, hands or fingers. A tap indicator is the industry norm and does not hide the screen.
- No sign-in. Clip 1 is guest-only by design. Signed-in clips (dashboard, profile, past-game review) will reuse a session Paul signs into once in a headed browser, saved as Playwright `storageState`; Fable never enters credentials.
- No home screen install step. That is iOS Safari only and is recorded in the iOS Simulator in a later clip.

## 10. Decisions (settled by Paul, 2026-10-17)

1. **Voice:** Kokoro `af_heart` at speed 0.92. Pronunciation "Money-mo" via the `PRONOUNCE` map.
2. **Exports:** both vertical (1080×1920) and landscape (1920×1080).
3. **Beat 5:** keep the "Show full analysis" tap.
