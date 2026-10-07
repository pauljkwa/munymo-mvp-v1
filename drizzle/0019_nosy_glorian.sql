ALTER TABLE `daily_games` ADD `highlightedMetrics` json;--> statement-breakpoint
ALTER TABLE `daily_games` ADD `dayKind` enum('coin_toss','clear','decisive');--> statement-breakpoint
ALTER TABLE `daily_scores` ADD `reasonScore` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `daily_scores` ADD `confidenceScore` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `player_picks` ADD `reasonMetric` varchar(64);--> statement-breakpoint
ALTER TABLE `player_picks` ADD `reasonSide` enum('A','B');--> statement-breakpoint
ALTER TABLE `player_picks` ADD `confidence` enum('tossup','leaning','confident');