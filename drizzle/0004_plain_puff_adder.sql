CREATE TABLE `metric_explanations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`metricKey` varchar(256) NOT NULL,
	`metricLabel` varchar(256) NOT NULL,
	`explanation` text NOT NULL,
	`aiGenerated` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `metric_explanations_id` PRIMARY KEY(`id`),
	CONSTRAINT `metric_explanations_metricKey_unique` UNIQUE(`metricKey`)
);
