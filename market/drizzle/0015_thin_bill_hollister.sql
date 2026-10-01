CREATE TABLE `chat_conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_group_id` text NOT NULL,
	`listing_id` text NOT NULL,
	`buyer_email` text NOT NULL,
	`seller_email` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`buyer_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`seller_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chat_conversations_provider_group_idx` ON `chat_conversations` (`provider_group_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `chat_conversations_listing_buyer_seller_idx` ON `chat_conversations` (`listing_id`,`buyer_email`,`seller_email`);--> statement-breakpoint
CREATE INDEX `chat_conversations_buyer_idx` ON `chat_conversations` (`buyer_email`,`updated_at`);--> statement-breakpoint
CREATE INDEX `chat_conversations_seller_idx` ON `chat_conversations` (`seller_email`,`updated_at`);--> statement-breakpoint
CREATE TABLE `chat_identities` (
	`user_email` text PRIMARY KEY NOT NULL,
	`provider_uid` text NOT NULL,
	`public_alias` text NOT NULL,
	`auth_token` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chat_identities_provider_uid_idx` ON `chat_identities` (`provider_uid`);--> statement-breakpoint
CREATE UNIQUE INDEX `chat_identities_public_alias_idx` ON `chat_identities` (`public_alias`);--> statement-breakpoint
CREATE TABLE `chat_push_events` (
	`provider_message_id` text PRIMARY KEY NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `chat_push_events_created_idx` ON `chat_push_events` (`created_at`);