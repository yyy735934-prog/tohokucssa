CREATE TABLE `listing_poster_items` (
	`poster_id` text NOT NULL,
	`listing_id` text NOT NULL,
	`position` integer NOT NULL,
	FOREIGN KEY (`poster_id`) REFERENCES `listing_posters`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `listing_poster_items_unique_idx` ON `listing_poster_items` (`poster_id`,`listing_id`);--> statement-breakpoint
CREATE INDEX `listing_poster_items_poster_idx` ON `listing_poster_items` (`poster_id`,`position`);--> statement-breakpoint
CREATE INDEX `listing_poster_items_listing_idx` ON `listing_poster_items` (`listing_id`);--> statement-breakpoint
CREATE TABLE `listing_posters` (
	`id` text PRIMARY KEY NOT NULL,
	`public_id` text NOT NULL,
	`creator_email` text NOT NULL,
	`kind` text DEFAULT 'seller' NOT NULL,
	`title` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`creator_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `listing_posters_public_id_idx` ON `listing_posters` (`public_id`);--> statement-breakpoint
CREATE INDEX `listing_posters_creator_idx` ON `listing_posters` (`creator_email`,`created_at`);