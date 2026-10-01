ALTER TABLE `contact_requests` ADD `buyer_notified_at` text;
--> statement-breakpoint
ALTER TABLE `contact_requests` ADD `buyer_notification_attempts` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `contact_requests` ADD `buyer_notification_error` text;
