CREATE TABLE `chat_conversation_reads` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`user_email` text NOT NULL,
	`last_read_at` integer DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `chat_conversations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chat_conversation_reads_conversation_user_idx` ON `chat_conversation_reads` (`conversation_id`,`user_email`);--> statement-breakpoint
CREATE INDEX `chat_conversation_reads_user_idx` ON `chat_conversation_reads` (`user_email`,`last_read_at`);--> statement-breakpoint
CREATE TABLE `chat_message_events` (
	`provider_message_id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`recipient_email` text NOT NULL,
	`sent_at` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `chat_conversations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recipient_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `chat_message_events_recipient_sent_idx` ON `chat_message_events` (`recipient_email`,`sent_at`);--> statement-breakpoint
CREATE INDEX `chat_message_events_conversation_sent_idx` ON `chat_message_events` (`conversation_id`,`sent_at`);--> statement-breakpoint
CREATE TABLE `chat_unread_reminder_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_email` text NOT NULL,
	`window_start` integer NOT NULL,
	`window_end` integer NOT NULL,
	`message_count` integer NOT NULL,
	`status` text DEFAULT 'sending' NOT NULL,
	`error` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chat_unread_reminder_runs_user_window_idx` ON `chat_unread_reminder_runs` (`user_email`,`window_end`);--> statement-breakpoint
CREATE INDEX `chat_unread_reminder_runs_created_idx` ON `chat_unread_reminder_runs` (`created_at`);