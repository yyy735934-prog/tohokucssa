CREATE TABLE `listings` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_email` text NOT NULL,
	`owner_name` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`price` integer DEFAULT 0 NOT NULL,
	`category` text NOT NULL,
	`place` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`icon` text DEFAULT '📦' NOT NULL,
	`tone` text DEFAULT 'sage' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`owner_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `listings_status_created_idx` ON `listings` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `listings_owner_idx` ON `listings` (`owner_email`,`created_at`);--> statement-breakpoint
CREATE TABLE `moderation_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`actor_email` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`action` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `moderation_target_idx` ON `moderation_log` (`target_type`,`target_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`email` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`academic_status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_seen_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
INSERT INTO `users` (`email`, `display_name`, `role`, `academic_status`)
VALUES ('demo@tohoku-market.local', '平台示例账号', 'member', 'verified');
--> statement-breakpoint
INSERT INTO `listings` (`id`, `owner_email`, `owner_name`, `title`, `description`, `price`, `category`, `place`, `status`, `icon`, `tone`)
VALUES
	('demo-1', 'demo@tohoku-market.local', '林同学', '宜家 NORDEN 折叠餐桌', '八成新，可折叠。适合小户型，需要自取。', 3500, '家具', '川内', 'active', '🪑', 'sage'),
	('demo-2', 'demo@tohoku-market.local', 'Yuki', '象印 3合电饭煲', '功能正常，内胆有轻微使用痕迹。', 1800, '家电', '北仙台', 'active', '🍚', 'cream'),
	('demo-3', 'demo@tohoku-market.local', '张同学', '通学自行车 27寸', '带车锁和车灯，轮胎上月刚换。', 6500, '交通', '青叶山', 'active', '🚲', 'blue'),
	('demo-4', 'demo@tohoku-market.local', 'Mori', '日语能力考试 N1 教材', '共四本，有少量笔记，希望送给认真备考的同学。', 0, '书籍', '片平', 'active', '📚', 'lilac'),
	('demo-5', 'demo@tohoku-market.local', '陈同学', 'IRIS OHYAMA 除湿机', '2024年购买，运行正常，附说明书。', 4200, '家电', '八幡', 'active', '💧', 'aqua'),
	('demo-6', 'demo@tohoku-market.local', '小王', '露营折叠桌椅 3件套', '一张桌子、两把椅子，适合广濑川野餐。', 2500, '户外', '三条町', 'active', '⛺', 'orange');
