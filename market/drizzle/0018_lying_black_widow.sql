ALTER TABLE `listings` ADD `original_price` integer;--> statement-breakpoint
ALTER TABLE `listings` ADD `price_reduced_at` text;--> statement-breakpoint
CREATE INDEX `listings_status_price_reduced_idx` ON `listings` (`status`,`price_reduced_at`);