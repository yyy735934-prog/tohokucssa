CREATE TABLE `email_delivery_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`recipient_masked` text NOT NULL,
	`subject` text NOT NULL,
	`provider` text NOT NULL,
	`status` text DEFAULT 'sending' NOT NULL,
	`provider_message_id` text,
	`error` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `email_delivery_logs_created_idx` ON `email_delivery_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `email_delivery_logs_status_created_idx` ON `email_delivery_logs` (`status`,`created_at`);