CREATE TABLE `mind_map` (
	`book_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`graph` text NOT NULL,
	`updated_at` integer NOT NULL
);
