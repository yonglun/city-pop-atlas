CREATE TABLE `catalog_operations` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`decision_id` text,
	`applied_order` integer,
	`after_token` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_catalog_operations_status_order` ON `catalog_operations` (`status`,`applied_order`);--> statement-breakpoint
CREATE TABLE `catalog_state` (
	`id` text PRIMARY KEY NOT NULL,
	`epoch` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `operation_events` (
	`id` text PRIMARY KEY NOT NULL,
	`operation_id` text NOT NULL,
	`action` text NOT NULL,
	`note` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_operation_events_operation` ON `operation_events` (`operation_id`);