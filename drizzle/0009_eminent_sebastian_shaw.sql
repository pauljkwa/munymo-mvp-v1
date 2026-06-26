ALTER TABLE `users` ADD `emailOptIn` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `pushOptIn` boolean DEFAULT true NOT NULL;