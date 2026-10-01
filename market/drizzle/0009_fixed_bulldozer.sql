CREATE TABLE `academic_email_challenges` (
	`user_email` text PRIMARY KEY NOT NULL,
	`academic_email` text NOT NULL,
	`code_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_sent_at` integer NOT NULL,
	FOREIGN KEY (`user_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `email_change_challenges` (
	`user_email` text PRIMARY KEY NOT NULL,
	`new_email` text NOT NULL,
	`code_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_sent_at` integer NOT NULL,
	FOREIGN KEY (`user_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `verification_appeals` (
	`id` text PRIMARY KEY NOT NULL,
	`user_email` text NOT NULL,
	`method` text DEFAULT 'student_card' NOT NULL,
	`image_key` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `verification_appeals_user_idx` ON `verification_appeals` (`user_email`,`created_at`);--> statement-breakpoint
CREATE INDEX `verification_appeals_status_idx` ON `verification_appeals` (`status`,`created_at`);--> statement-breakpoint
ALTER TABLE `users` ADD `academic_email` text;--> statement-breakpoint
ALTER TABLE `users` ADD `notification_email` text;