-- Custom SQL migration file, put your code below! --
DELETE FROM `contact_requests`
WHERE `listing_id` LIKE 'demo-%'
	OR `buyer_email` = 'demo@tohoku-market.local'
	OR `seller_email` = 'demo@tohoku-market.local';
--> statement-breakpoint
DELETE FROM `favorites`
WHERE `listing_id` LIKE 'demo-%'
	OR `user_email` = 'demo@tohoku-market.local';
--> statement-breakpoint
DELETE FROM `moderation_log`
WHERE (`target_type` = 'listing' AND `target_id` LIKE 'demo-%')
	OR `actor_email` = 'demo@tohoku-market.local';
--> statement-breakpoint
DELETE FROM `listings`
WHERE `id` LIKE 'demo-%' OR `owner_email` = 'demo@tohoku-market.local';
--> statement-breakpoint
DELETE FROM `users` WHERE `email` = 'demo@tohoku-market.local';
