CREATE TABLE `market_votes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`voterKey` varchar(80) NOT NULL,
	`userId` int,
	`firstChoice` varchar(16) NOT NULL,
	`secondChoice` varchar(16),
	`thirdChoice` varchar(16),
	`otherText` varchar(120),
	`visitorCountry` varchar(2),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `market_votes_id` PRIMARY KEY(`id`),
	CONSTRAINT `market_votes_voter_unique` UNIQUE(`voterKey`)
);
