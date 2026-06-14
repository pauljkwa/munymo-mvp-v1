ALTER TABLE `users` MODIFY COLUMN `openId` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `clerkId` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `displayName` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `tier` enum('free','premium') DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `awayStatus` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `awayStatusUntil` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `deactivated` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_clerkId_unique` UNIQUE(`clerkId`);