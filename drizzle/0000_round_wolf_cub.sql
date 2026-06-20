DROP TABLE `admin_audit_log`;--> statement-breakpoint
DROP TABLE `daily_games`;--> statement-breakpoint
DROP TABLE `daily_scores`;--> statement-breakpoint
DROP TABLE `game_community_stats`;--> statement-breakpoint
DROP TABLE `game_research`;--> statement-breakpoint
DROP TABLE `leaderboard_stats`;--> statement-breakpoint
DROP TABLE `metric_explanations`;--> statement-breakpoint
DROP TABLE `player_picks`;--> statement-breakpoint
DROP TABLE `push_subscriptions`;--> statement-breakpoint
DROP TABLE `streak_records`;--> statement-breakpoint
DROP TABLE `validation_questions`;--> statement-breakpoint
ALTER TABLE `users` DROP INDEX `users_clerkId_unique`;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `openId` varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `clerkId`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `displayName`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `tier`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `awayStatus`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `awayStatusUntil`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `deactivated`;