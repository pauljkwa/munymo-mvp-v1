CREATE TABLE `ai_usage_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`rowKind` varchar(8) NOT NULL,
	`runId` varchar(40) NOT NULL,
	`runKind` varchar(32) NOT NULL,
	`trigger` varchar(32) NOT NULL,
	`gameDate` varchar(10),
	`model` varchar(40),
	`turnIndex` int,
	`inputTokens` int,
	`cacheReadTokens` int,
	`cacheWrite5mTokens` int,
	`cacheWrite1hTokens` int,
	`outputTokens` int,
	`webSearchRequests` int,
	`stopReason` varchar(24),
	`retries` int,
	`failedOver` boolean NOT NULL DEFAULT false,
	`estimatedCostUsd` decimal(10,6),
	`pricingVersion` varchar(10),
	`outcome` varchar(16),
	`errorMessage` text,
	`submitAttempts` int,
	`durationMs` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_usage_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `vendor_costs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`month` varchar(7) NOT NULL,
	`vendor` varchar(40) NOT NULL,
	`category` varchar(8) NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'USD',
	`note` varchar(200),
	`enteredBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `vendor_costs_id` PRIMARY KEY(`id`),
	CONSTRAINT `vendor_costs_month_vendor_unique` UNIQUE(`month`,`vendor`)
);
--> statement-breakpoint
CREATE INDEX `ai_usage_log_createdAt_idx` ON `ai_usage_log` (`createdAt`);--> statement-breakpoint
CREATE INDEX `ai_usage_log_runId_idx` ON `ai_usage_log` (`runId`);--> statement-breakpoint
CREATE INDEX `ai_usage_log_gameDate_idx` ON `ai_usage_log` (`gameDate`);