CREATE TABLE `lesson_progress` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`lessonId` varchar(32) NOT NULL,
	`completedAt` timestamp NOT NULL DEFAULT (now()),
	`quizCorrect` boolean NOT NULL,
	CONSTRAINT `lesson_progress_id` PRIMARY KEY(`id`),
	CONSTRAINT `lesson_progress_user_lesson_unique` UNIQUE(`userId`,`lessonId`)
);
