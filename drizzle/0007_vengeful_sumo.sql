CREATE TABLE `referral_codes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(16) NOT NULL,
	`merchType` enum('mug','tshirt','other') NOT NULL DEFAULT 'other',
	`batchId` varchar(64),
	`ownerId` int,
	`status` enum('unassigned','active','suspended') NOT NULL DEFAULT 'unassigned',
	`enrolledAt` timestamp,
	`totalScans` int NOT NULL DEFAULT 0,
	`totalSignups` int NOT NULL DEFAULT 0,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `referral_codes_id` PRIMARY KEY(`id`),
	CONSTRAINT `referral_codes_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `referral_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`referralCodeId` int NOT NULL,
	`eventType` enum('scan','signup') NOT NULL,
	`referredUserId` int,
	`ownerIdAtEvent` int,
	`deviceFingerprint` varchar(64),
	`referralCookie` varchar(64),
	`attributed` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `referral_events_id` PRIMARY KEY(`id`)
);
