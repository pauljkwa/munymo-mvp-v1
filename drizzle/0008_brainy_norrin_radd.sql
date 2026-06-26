ALTER TABLE `streak_records` ADD `currentWinStreak` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `streak_records` ADD `longestWinStreak` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `streak_records` ADD `currentLoseStreak` int DEFAULT 0 NOT NULL;