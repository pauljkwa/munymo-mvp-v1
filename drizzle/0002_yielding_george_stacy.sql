ALTER TABLE `daily_games` ADD `exchange` varchar(16) DEFAULT 'NASDAQ' NOT NULL;--> statement-breakpoint
ALTER TABLE `daily_games` ADD `companyAPerf` decimal(7,3);--> statement-breakpoint
ALTER TABLE `daily_games` ADD `companyBPerf` decimal(7,3);--> statement-breakpoint
ALTER TABLE `daily_games` ADD `resultSummary` text;--> statement-breakpoint
ALTER TABLE `daily_games` ADD `hindsightSpotlight` text;--> statement-breakpoint
ALTER TABLE `game_research` ADD `researchMetrics` json;--> statement-breakpoint
ALTER TABLE `game_research` ADD `metricsSnapshot` json;--> statement-breakpoint
ALTER TABLE `player_picks` ADD `validationAnswerTimeMs` int;