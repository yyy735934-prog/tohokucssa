CREATE TABLE `favorites` (
	`user_email` text NOT NULL,
	`listing_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `favorites_user_listing_idx` ON `favorites` (`user_email`,`listing_id`);--> statement-breakpoint
CREATE INDEX `favorites_user_created_idx` ON `favorites` (`user_email`,`created_at`);--> statement-breakpoint
ALTER TABLE `listings` ADD `latitude` integer;--> statement-breakpoint
ALTER TABLE `listings` ADD `longitude` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `phone` text;--> statement-breakpoint
ALTER TABLE `users` ADD `wechat` text;--> statement-breakpoint
ALTER TABLE `users` ADD `qq` text;--> statement-breakpoint
ALTER TABLE `users` ADD `wechat_qr_key` text;--> statement-breakpoint
ALTER TABLE `users` ADD `profile_completed` integer DEFAULT false NOT NULL;