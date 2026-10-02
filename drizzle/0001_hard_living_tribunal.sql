CREATE TABLE `attribute_overrides` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_id` text NOT NULL,
	`field` text NOT NULL,
	`payload` text NOT NULL,
	`candidate_id` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_attribute_overrides_entity` ON `attribute_overrides` (`entity_id`);--> statement-breakpoint
CREATE TABLE `candidates` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_id` text NOT NULL,
	`field` text NOT NULL,
	`payload` text NOT NULL,
	`base_value` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`decision_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_candidates_status` ON `candidates` (`status`);--> statement-breakpoint
CREATE INDEX `idx_candidates_entity` ON `candidates` (`entity_id`);--> statement-breakpoint
CREATE TABLE `review_events` (
	`id` text PRIMARY KEY NOT NULL,
	`candidate_id` text NOT NULL,
	`action` text NOT NULL,
	`note` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_review_events_candidate` ON `review_events` (`candidate_id`);