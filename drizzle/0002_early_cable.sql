CREATE TABLE `beta_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text,
	`auth_provider` text DEFAULT 'chatgpt' NOT NULL,
	`plan` text DEFAULT 'beta' NOT NULL,
	`locale` text DEFAULT 'en' NOT NULL,
	`created_at` text NOT NULL,
	`last_seen_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `beta_accounts_email_unique` ON `beta_accounts` (`email`);--> statement-breakpoint
CREATE INDEX `beta_accounts_last_seen_idx` ON `beta_accounts` (`last_seen_at`);