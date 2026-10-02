CREATE TABLE `approval_snapshots` (
	`event_id` text PRIMARY KEY NOT NULL,
	`candidate_id` text NOT NULL,
	`entity_id` text NOT NULL,
	`field` text NOT NULL,
	`before_override` text,
	`after_override` text NOT NULL,
	`base_payload` text NOT NULL,
	`reverted_by` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_approval_snapshots_candidate` ON `approval_snapshots` (`candidate_id`);