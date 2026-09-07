ALTER TABLE `listings` ADD `sold_at` text;--> statement-breakpoint
UPDATE `listings`
SET `sold_at` = `updated_at`
WHERE `status` = 'sold' AND `sold_at` IS NULL;--> statement-breakpoint
CREATE INDEX `listings_status_sold_idx` ON `listings` (`status`,`sold_at`);
