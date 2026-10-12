ALTER TABLE `practice_picks` ADD `reasonMetric` varchar(64);--> statement-breakpoint
ALTER TABLE `practice_picks` ADD `reasonSide` enum('A','B');--> statement-breakpoint
ALTER TABLE `practice_picks` ADD `confidence` enum('tossup','leaning','confident');--> statement-breakpoint
ALTER TABLE `practice_picks` ADD `reasonScore` int;--> statement-breakpoint
ALTER TABLE `practice_picks` ADD `confidenceScore` int;