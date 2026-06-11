CREATE TABLE `admin_audit_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`adminId` int NOT NULL,
	`action` varchar(64) NOT NULL,
	`targetType` varchar(64),
	`targetId` int,
	`detail` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `admin_audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `daily_games` (
	`id` int AUTO_INCREMENT NOT NULL,
	`gameDate` varchar(10) NOT NULL,
	`companyAName` varchar(128) NOT NULL,
	`companyATicker` varchar(16) NOT NULL,
	`companyBName` varchar(128) NOT NULL,
	`companyBTicker` varchar(16) NOT NULL,
	`sector` varchar(128),
	`pairingRationale` text,
	`status` enum('draft','active','locked','result_published','cancelled') NOT NULL DEFAULT 'draft',
	`winner` enum('A','B'),
	`resultCommentary` text,
	`lockoutAt` timestamp,
	`publishedAt` timestamp,
	`cancelledAt` timestamp,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `daily_games_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `daily_scores` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`gameId` int NOT NULL,
	`predictionScore` int NOT NULL DEFAULT 0,
	`validationScore` int NOT NULL DEFAULT 0,
	`totalScore` int NOT NULL DEFAULT 0,
	`calculatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `daily_scores_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `game_community_stats` (
	`id` int AUTO_INCREMENT NOT NULL,
	`gameId` int NOT NULL,
	`totalParticipants` int NOT NULL DEFAULT 0,
	`gutPctA` decimal(5,2) NOT NULL DEFAULT '0.00',
	`gutPctB` decimal(5,2) NOT NULL DEFAULT '0.00',
	`finalPctA` decimal(5,2) NOT NULL DEFAULT '0.00',
	`finalPctB` decimal(5,2) NOT NULL DEFAULT '0.00',
	`validationCorrectPct` decimal(5,2) NOT NULL DEFAULT '0.00',
	`computedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `game_community_stats_id` PRIMARY KEY(`id`),
	CONSTRAINT `game_community_stats_gameId_unique` UNIQUE(`gameId`)
);
--> statement-breakpoint
CREATE TABLE `game_research` (
	`id` int AUTO_INCREMENT NOT NULL,
	`gameId` int NOT NULL,
	`content` text NOT NULL,
	`researchSnapshot` text,
	`snapshotTakenAt` timestamp,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `game_research_id` PRIMARY KEY(`id`),
	CONSTRAINT `game_research_gameId_unique` UNIQUE(`gameId`)
);
--> statement-breakpoint
CREATE TABLE `leaderboard_stats` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`gamesPlayed` int NOT NULL DEFAULT 0,
	`totalScore` bigint NOT NULL DEFAULT 0,
	`averageDailyScore` decimal(6,2) NOT NULL DEFAULT '0.00',
	`qualificationStatus` enum('pending','qualified') NOT NULL DEFAULT 'pending',
	`lastUpdatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `leaderboard_stats_id` PRIMARY KEY(`id`),
	CONSTRAINT `leaderboard_stats_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `player_picks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`gameId` int NOT NULL,
	`gutSelection` enum('A','B'),
	`gutSubmittedAt` timestamp,
	`finalSelection` enum('A','B'),
	`finalSubmittedAt` timestamp,
	`validationAnswer` varchar(256),
	`validationSubmittedAt` timestamp,
	`isLocked` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `player_picks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `streak_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`currentStreak` int NOT NULL DEFAULT 0,
	`longestStreak` int NOT NULL DEFAULT 0,
	`lastParticipationDate` varchar(10),
	`awayStatus` enum('active','away','missing') NOT NULL DEFAULT 'active',
	`awayStatusSetAt` timestamp,
	`awayStatusSetBy` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `streak_records_id` PRIMARY KEY(`id`),
	CONSTRAINT `streak_records_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `validation_questions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`gameId` int NOT NULL,
	`questionType` enum('multiple_choice','yes_no','true_false') NOT NULL,
	`questionText` text NOT NULL,
	`options` json,
	`correctAnswer` varchar(256) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `validation_questions_id` PRIMARY KEY(`id`),
	CONSTRAINT `validation_questions_gameId_unique` UNIQUE(`gameId`)
);
