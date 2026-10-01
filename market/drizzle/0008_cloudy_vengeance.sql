CREATE TABLE `listing_analyses` (
	`image_key` text PRIMARY KEY NOT NULL,
	`owner_email` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`category` text NOT NULL,
	`risk_level` text DEFAULT 'review' NOT NULL,
	`risk_reason` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`owner_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `listing_analyses_owner_idx` ON `listing_analyses` (`owner_email`,`created_at`);--> statement-breakpoint
CREATE TABLE `listing_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`public_id` text NOT NULL,
	`owner_email` text NOT NULL,
	`title` text NOT NULL,
	`place` text NOT NULL,
	`latitude` integer,
	`longitude` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`owner_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `listing_batches_public_id_idx` ON `listing_batches` (`public_id`);--> statement-breakpoint
CREATE INDEX `listing_batches_owner_idx` ON `listing_batches` (`owner_email`,`created_at`);--> statement-breakpoint
ALTER TABLE `listings` ADD `batch_id` text REFERENCES listing_batches(id);--> statement-breakpoint
ALTER TABLE `listings` ADD `batch_position` integer;--> statement-breakpoint
CREATE INDEX `listings_batch_idx` ON `listings` (`batch_id`,`batch_position`);