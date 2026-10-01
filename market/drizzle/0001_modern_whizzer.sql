CREATE TABLE `contact_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`listing_id` text NOT NULL,
	`buyer_email` text NOT NULL,
	`buyer_name` text NOT NULL,
	`seller_email` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`buyer_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`seller_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `contact_listing_buyer_idx` ON `contact_requests` (`listing_id`,`buyer_email`);--> statement-breakpoint
CREATE INDEX `contact_seller_status_idx` ON `contact_requests` (`seller_email`,`status`);--> statement-breakpoint
CREATE INDEX `contact_buyer_idx` ON `contact_requests` (`buyer_email`,`created_at`);