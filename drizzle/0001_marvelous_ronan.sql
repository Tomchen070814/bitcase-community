CREATE TABLE `product_events` (
	`id` text PRIMARY KEY NOT NULL,
	`event_name` text NOT NULL,
	`session_id` text NOT NULL,
	`locale` text NOT NULL,
	`acquisition_source` text DEFAULT 'direct' NOT NULL,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `product_events_created_idx` ON `product_events` (`created_at`);--> statement-breakpoint
CREATE INDEX `product_events_event_idx` ON `product_events` (`event_name`);--> statement-breakpoint
CREATE INDEX `product_events_session_idx` ON `product_events` (`session_id`);