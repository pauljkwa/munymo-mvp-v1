# Munymo MVP — Build Todo

## Phase 1: Setup
- [ ] Create GitHub repository (munymo-mvp) — pending GitHub auth from user
- [x] Write todo.md (this file)

## Phase 2: Database Schema
- [x] users table (role: admin | user, streak fields)
- [x] daily_games table (matchup, sector, rationale, lockout_at, status, result, commentary)
- [x] game_research table (research content attached to a game, immutable snapshot on close)
- [x] validation_questions table (question, type, options, correct_answer, per game)
- [x] player_picks table (user_id, game_id, gut_selection, final_selection, validation_answer, submitted_at, is_locked)
- [x] daily_scores table (user_id, game_id, prediction_score, validation_score, total_score — server-side only)
- [x] leaderboard_stats table (user_id, games_played, average_daily_score, qualification_status)
- [x] streak_records table (user_id, current_streak, longest_streak, last_game_date, away_status)
- [x] game_community_stats table (game_id, gut_pct_a, gut_pct_b, final_pct_a, final_pct_b — computed post-close)
- [x] admin_audit_log table (admin_id, action, target_id, detail, created_at)
- [x] Run pnpm db:push and verify migrations

## Phase 3: Server-Side Routers
- [x] games.getToday — fetch today's active game (public)
- [x] games.getById — fetch single game with research (public)
- [x] games.list — paginated list for archive (public)
- [x] picks.submitGut — store Gut Selection (protected, pre-lockout)
- [x] picks.submitFinal — store Final Selection + validation answer (protected, pre-lockout)
- [x] picks.getMyPick — fetch current player's pick for a game (protected)
- [x] scoring.calculateAndStore — server-side 80/20 score calculation (admin-triggered)
- [x] leaderboard.get — ranked list, qualification threshold = 20 games (public)
- [x] streaks.getMyStreak — fetch current player streak (protected)
- [x] admin.createGame — create new daily game (admin only)
- [x] admin.updateResearch — set/update active-game research (admin only)
- [x] admin.setValidationQuestion — attach validation question to game (admin only)
- [x] admin.publishResult — publish outcome, trigger scoring, compute community stats, archive (admin only)
- [x] admin.cancelGame — cancel a game (neutral, no streak penalty) (admin only)
- [x] admin.setPlayerAwayStatus — set player Away/Missing status (admin only)
- [x] admin.getAuditLog — paginated audit log (admin only)
- [x] Lockout enforcement middleware (server-side deadline check on all pick mutations)

## Phase 4: Design System
- [x] Choose and apply colour palette (dark, premium, financial aesthetic)
- [x] Set global typography (Google Fonts — Playfair Display + Inter + JetBrains Mono)
- [x] Configure Tailwind CSS variables and theme tokens in index.css
- [x] Build reusable layout shells: PublicLayout (top nav) and AdminLayout (sidebar)
- [x] Implement micro-interactions and animation tokens

## Phase 5: Player-Facing Pages
- [x] Home / Landing page (hero, how-it-works, CTA, live game teaser)
- [x] Daily Game page (matchup display, research panel, Gut Selection, Final Selection, validation question, lockout countdown)
- [x] Results page (player's picks, scores, commentary, community stats)
- [x] Leaderboard page (ranked table, qualification status, streak column)
- [x] Research Hub page (archive of completed games, research snapshot, community stats, commentary)
- [x] Player Profile page (streak, score history, qualification status)
- [x] 404 / Not Found page

## Phase 6: Admin Console
- [x] Admin dashboard overview (today's game status, pending actions)
- [x] Create Daily Game form (companies, sector, rationale, lockout time)
- [x] Edit Daily Game form (research editor, validation question builder, activate/cancel)
- [x] Publish Result form (winner selection, educational commentary)
- [x] Cancel Game action (with audit log entry)
- [x] Player Away Status management (list players, set Away/Missing/Active)
- [x] Audit log viewer (paginated)

## Phase 7: Lockout & Scoring
- [x] Server-side lockout: reject mutations after lockout_at timestamp
- [x] Score calculation: 80% prediction accuracy + 20% validation accuracy
- [x] Leaderboard recalculation on each result publish
- [x] Streak update logic: Away preserves streak, Missing breaks it, cancelled/market-closed = neutral
- [x] Community stats computation (post-close pick percentages)

## Phase 8: Tests
- [x] Test: lockout enforcement rejects picks after deadline
- [x] Test: score calculation produces correct 80/20 result
- [x] Test: leaderboard excludes players with fewer than 20 games
- [x] Test: Away Status preserves streak
- [x] Test: streak resets on gap of 2+ days
- [x] Test: auth.logout clears session cookie correctly
- [x] 33 tests passing across 2 test files — all import real production functions from scoring.ts

## Phase 9: GitHub & Delivery
- [x] Push all code to GitHub repository — pushed to pauljkwa/munymo-mvp-v1
- [ ] Save checkpoint
- [ ] Deliver preview URL and document summary to user

## Phase 10: Transactional Email Notifications (Resend)
- [x] Install resend npm package
- [x] Create server/email.ts — Resend SDK wrapper with RESEND_API_KEY env var
- [x] Build HTML email template: daily game available notification
- [x] Build HTML email template: result published (with player score breakdown)
- [x] Build HTML email template: streak at risk reminder
- [x] Wire email trigger into admin.activateGame → notify all registered players
- [x] Wire email trigger into admin.publishResult → notify all participating players with scores
- [x] Add RESEND_API_KEY via webdev_request_secrets
- [x] Write Vitest tests for email helper (mock Resend SDK)
- [ ] Provide DNS records guidance for Cloudflare (SPF/DKIM/DMARC from Resend dashboard)
- [ ] Push updated code to GitHub (requires gh auth login — user action needed)
- [x] Save checkpoint after email integration verified

## Phase 11: Landing Page Rebuild — Positioning & Roadmap Teasers
- [x] Generate MunyIQ gemstone card visuals: Sapphire, Emerald, Ruby, Diamond (faceted interior view)
- [x] Upload card images to webdev static assets
- [x] Rewrite hero sub-headline with corrected novice/professional positioning
- [x] Add "Road Ahead" teaser section with MunyIQ card showcase
- [x] Add Certificates of Achievement teaser card
- [x] Add Head-to-Head Challenges teaser card
- [x] Add Native Mobile Apps teaser card
- [x] Save checkpoint after landing page rebuild

## Phase 12: Light-First Premium Financial Redesign
- [x] Redesign index.css — light-first colour tokens, clean typography, component primitives
- [x] Update ThemeProvider to default light, add proper dark mode CSS variables
- [x] Rebuild PublicLayout.tsx — clean white nav, light/dark states
- [x] Redesign Home.tsx — finance-publication layout, asymmetric hero, clean sections
- [x] Update AdminLayout.tsx — light sidebar, clean borders
- [x] Add dark mode toggle to nav (sun/moon icon)
- [x] Verify both light and dark themes render correctly
- [x] Save checkpoint after redesign

## Phase 13: Logo & Typography Integration
- [x] Analyse logo PNG — extract exact brand colours (#002000 wordmark, #009050 accent)
- [x] Create MunymoLogo React component — full wordmark + icon variants, CSS filter dark mode adaptation
- [x] Upload logo PNG to webdev static storage
- [x] Update fonts: Plus Jakarta Sans (body) + Syne (headings) via Google Fonts
- [x] Place logo in PublicLayout nav and footer
- [x] Place logo in AdminLayout sidebar (desktop + mobile)
- [x] Generate favicon (32px) and Apple touch icon (180px) from logo icon mark
- [x] Update index.html with favicon links
- [x] Save checkpoint after logo integration

## Phase 14: Unified Admin Form, Timed Validation, Candlestick Charts

- [ ] Extend drizzle/schema.ts — add exchange field, result fields (companyAPerf, companyBPerf, summary, hindsightSpotlight), researchMetrics JSON column, validationQuestionFormat, validationAnswerTime to picks table
- [ ] Run pnpm db:push to migrate schema
- [ ] Add server-side Yahoo Finance OHLCV proxy endpoint in routers.ts
- [ ] Add atomic admin.endOfDay tRPC procedure — closes today's game + creates tomorrow's game in one transaction
- [ ] Build unified admin end-of-day page (AdminEndOfDay.tsx) with JSON paste-to-populate and two-section form
- [ ] Register /admin/end-of-day route in App.tsx and AdminLayout nav
- [ ] Build timed Research Validation Question popup component (ValidationQuestionModal.tsx)
- [ ] Wire popup into game page — opens after company pick submission, two-step CTA flow
- [ ] Implement time-decay scoring modifier for validation question (20% max, scales to 12% at 60s+)
- [ ] Update server-side score calculation to include timed validation component
- [ ] Install lightweight-charts npm package
- [ ] Build CandlestickChart component using TradingView Lightweight Charts
- [ ] Add candlestick charts with range selector (1D, 5D, 1M, 3M, 6M, 1Y) to game page research section
- [ ] Update game page to display result fields (performance %, summary, hindsight spotlight) when published
- [ ] Rewrite daily Manus curation prompt in new JSON format
- [ ] Write/update Vitest tests for new procedures
- [ ] Save checkpoint after full feature set verified

## Phase 15: Analyst Consensus Relocation & Housekeeping

- [x] Remove analyst consensus from pre-game research metrics in AdminEndOfDay.tsx form
- [x] Update Hindsight Spotlight field description in AdminEndOfDay.tsx to explicitly include analyst consensus
- [x] Update daily curation prompt v2 (MD) — move analyst consensus from researchMetrics block to hindsightSpotlight block
- [x] Regenerate daily curation prompt v2 PDF from updated MD
- [x] Fix hero headline accent colour from amber/gold to brand green (#009050) in Home.tsx
- [x] Save checkpoint
- [x] Push to GitHub (pauljkwa/munymo-mvp-v1) — pushed successfully (faa8ad0..99e31a0)

## Phase 16: Layout Consistency — Header/Footer/Nav on All Pages

- [x] Wrap AdminEndOfDay.tsx in AdminLayout (currently has no layout — no header, footer, or nav)
- [x] Wrap NotFound.tsx in PublicLayout (currently standalone with no nav)
- [x] Verify all other public pages use PublicLayout
- [x] Verify all other admin pages use AdminLayout
- [x] Save checkpoint
- [x] Push to GitHub (99e31a0..b98e815)

## Phase 17: Navigation, Legal Pages & Evolution of Munymo

- [x] PublicLayout: hamburger in header on ALL screen sizes (not just mobile), one-click nav to all role-appropriate pages, logo links to home, footer has internal links to all pages including legal
- [x] AdminLayout: hamburger on mobile header opens full admin nav drawer with all admin links
- [x] Create /terms page (Terms of Use)
- [x] Create /privacy page (Privacy Policy)
- [x] Create /disclaimer page (Disclaimer)
- [x] Create /responsible-gaming page (Responsible Gaming)
- [x] Wire all four legal routes in App.tsx
- [x] Create /evolution page (Evolution of Munymo — detailed, conversational tone)
- [x] Wire /evolution route in App.tsx
- [x] Add legal and evolution links to footer
- [x] Save checkpoint (3d262360)
- [x] Push to GitHub (b98e815..3d26236)

## Phase 18: My Dashboard

- [ ] Schema: add displayName, awayStatus (boolean), awayStatusUntil (timestamp), deactivated (boolean), tier (enum: free/premium) to users table
- [ ] Run pnpm db:push to apply migration
- [ ] tRPC: dashboard.getStats procedure (games played, accuracy, streak, best streak, total score, leaderboard rank, gut agreement rate, validation accuracy)
- [ ] tRPC: dashboard.getHistory procedure (paginated game history with result and score)
- [ ] tRPC: dashboard.updateDisplayName procedure
- [ ] tRPC: dashboard.toggleAwayStatus procedure
- [ ] tRPC: dashboard.softDeleteAccount procedure (sets deactivated=true, signs out)
- [ ] Block deactivated users from signing in (check in auth context)
- [ ] Build My Dashboard page at /profile — Stats section
- [ ] Build My Dashboard page — Game History section
- [ ] Build My Dashboard page — Away Status section
- [ ] Build My Dashboard page — Account Settings section (display name, Manus password note)
- [ ] Build My Dashboard page — Tier & Upgrade section (free/premium UI, Coming Soon for premium)
- [ ] Build My Dashboard page — MunyIQ placeholder (locked, premium-only)
- [ ] Build My Dashboard page — Danger Zone (soft delete with confirmation dialog)
- [ ] Rename nav link from "Profile" to "My Dashboard" in PublicLayout
- [ ] Write vitest tests for new procedures
- [ ] Save checkpoint
- [ ] Push to GitHub

## Phase 19: Clerk Auth Migration + My Dashboard

### Auth Migration
- [x] Install @clerk/clerk-react and @clerk/express packages
- [x] Add VITE_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY secrets
- [x] Replace Manus OAuth context/hooks with Clerk provider and useUser hook
- [x] Replace server-side JWT/session auth with Clerk Express middleware
- [x] Update tRPC context to use Clerk session for ctx.user
- [x] Update useAuth hook to use Clerk
- [x] Remove Manus OAuth login URL references, replace with Clerk SignIn
- [x] Update PublicLayout sign-in button to use Clerk modal/redirect
- [x] Test auth flow end to end

### Dashboard Schema & Backend
- [x] Schema: add displayName, awayStatus, awayStatusUntil, deactivated, tier fields to users table
- [x] Run pnpm db:push
- [x] tRPC dashboard.getStats procedure
- [x] tRPC dashboard.getHistory procedure (paginated)
- [x] tRPC dashboard.updateDisplayName procedure
- [x] tRPC dashboard.toggleAwayStatus procedure
- [x] tRPC dashboard.softDeleteAccount procedure
- [x] Block deactivated users in auth middleware

### Dashboard UI
- [x] Build /dashboard page — Stats cards section
- [x] Build /dashboard page — Game History section
- [x] Build /dashboard page — Away Status toggle section
- [x] Build /dashboard page — Account Settings section (display name, Clerk password note)
- [x] Build /dashboard page — Tier & Upgrade section
- [x] Build /dashboard page — MunyIQ locked placeholder
- [x] Build /dashboard page — Danger Zone (soft delete with confirmation)
- [x] Rename nav "Profile" → "My Dashboard" (links to /dashboard)
- [x] Update vitest tests for Clerk-based logout
- [ ] Save checkpoint
- [ ] Push to GitHub

## Phase 21: AI Metric Explanation System

- [ ] Add metricExplanations table to drizzle/schema.ts (id, metricName normalised key, explanation text, createdAt, updatedAt)
- [ ] Run pnpm db:push to migrate
- [ ] Add getMetricExplanation and upsertMetricExplanation helpers to server/db.ts
- [ ] Add metrics.getExplanation tRPC public procedure: check cache → if missing, call LLM to generate → store → return
- [ ] Build MetricExplanationSheet component (bottom sheet on mobile, dialog on desktop)
- [ ] Wire MetricExplanationSheet into research metrics display on DailyGame page
- [ ] Wire MetricExplanationSheet into research metrics display on ArchiveGame page
- [ ] Write vitest test for metrics.getExplanation procedure (mock LLM call)
- [ ] Save checkpoint
- [ ] Push to GitHub

## Phase 22: UX Fixes from First Live Playthrough (Game 1 — 15 Jun 2026)

- [x] Metrics layout: replace single vertical list with two company cards side-by-side in a grid, each card containing that company's metrics and its candlestick chart at the bottom
- [x] CandlestickChart: replaced window.resize listener with ResizeObserver so charts render correctly in CSS grid layouts (fixes zero-width chart on mobile)
- [x] AdminDashboard: added Testing section with Reset My Pick button for the active game directly on the dashboard
- [x] Metric explanation modal: strip markdown syntax (** bold markers etc) and render as plain readable text
- [x] Metric explanation modal: remove "Explanation generated by AI and reviewed for accuracy" attribution line
- [x] Chart period selector: replace the overflowing horizontal button row (1D 5D 1M 3M 6M…) with a compact dropdown so it does not get clipped on mobile
- [x] Validation answer feedback: after submitting the answer, show a full-screen green (correct) or red (incorrect) result screen as originally designed

## Phase 23: Automated Daily Curation CRON

- [x] Build /api/scheduled/recent-games endpoint (returns last 30 days of games for agent to query)
- [x] Build /api/scheduled/daily-curation endpoint (validates freshness rules, runs End of Day logic autonomously)
- [x] Write AGENT cron prompt (freshness rules, API integration, autonomous JSON generation)
- [ ] Save checkpoint and ask user to publish
- [ ] Register AGENT cron at 0 15 20 * * 1-5 UTC (4:15 AM Perth Mon-Fri)
