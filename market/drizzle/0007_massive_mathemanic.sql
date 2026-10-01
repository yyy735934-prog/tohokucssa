ALTER TABLE `users` ADD `public_name_mode` text DEFAULT 'anonymous' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `public_nickname` text;