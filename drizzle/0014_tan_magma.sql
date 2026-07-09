CREATE TABLE `outbound_clicks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`gameId` int,
	`userId` int,
	`publisher` varchar(128),
	`sourceUrl` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `outbound_clicks_id` PRIMARY KEY(`id`)
);
