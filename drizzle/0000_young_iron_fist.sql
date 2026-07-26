CREATE TABLE `bridge_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_email` text NOT NULL,
	`token_hash` text NOT NULL,
	`token_prefix` text NOT NULL,
	`created_at` text NOT NULL,
	`last_used_at` text,
	`revoked_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bridge_tokens_hash_unique` ON `bridge_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `bridge_tokens_owner_idx` ON `bridge_tokens` (`owner_email`);--> statement-breakpoint
CREATE TABLE `skill_libraries` (
	`owner_email` text PRIMARY KEY NOT NULL,
	`skills_json` text NOT NULL,
	`stack_json` text DEFAULT '[]' NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL
);
