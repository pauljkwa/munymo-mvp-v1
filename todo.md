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
- [ ] Push all code to GitHub repository — pending GitHub auth from user
- [ ] Save checkpoint
- [ ] Deliver preview URL and document summary to user
