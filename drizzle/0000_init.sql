CREATE TABLE `brands` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`industry` text NOT NULL,
	`target_countries` text DEFAULT '[]' NOT NULL,
	`target_age_min` integer DEFAULT 18 NOT NULL,
	`target_age_max` integer DEFAULT 44 NOT NULL,
	`avg_order_value` real NOT NULL,
	`margin_pct` real NOT NULL,
	`baseline_conversion_rate` real DEFAULT 0.02 NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `campaign_results` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`campaign_id` integer NOT NULL,
	`influencer_id` integer NOT NULL,
	`actual_clicks` integer NOT NULL,
	`actual_conversions` integer NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`influencer_id`) REFERENCES `influencers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `campaign_results_campaign_influencer` ON `campaign_results` (`campaign_id`,`influencer_id`);--> statement-breakpoint
CREATE TABLE `campaigns` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`brand_id` integer NOT NULL,
	`name` text NOT NULL,
	`budget` real NOT NULL,
	`posts_per_influencer` integer DEFAULT 1 NOT NULL,
	`target_niche` text,
	`target_countries` text,
	`target_age_min` integer,
	`target_age_max` integer,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `influencers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`handle` text NOT NULL,
	`platform` text NOT NULL,
	`niche` text NOT NULL,
	`country` text,
	`followers` integer,
	`avg_views_per_post` integer,
	`avg_likes` integer,
	`avg_comments` integer,
	`avg_shares` integer,
	`avg_saves` integer,
	`follower_growth_30d_pct` real,
	`audience_country_split` text,
	`audience_age_split` text,
	`fee_per_post` real,
	`fake_follower_signals` text,
	`source` text DEFAULT 'manual' NOT NULL,
	`external_id` text,
	`last_synced_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `influencers_platform_handle` ON `influencers` (`platform`,`handle`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
