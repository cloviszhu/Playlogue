CREATE TABLE `request_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`window` integer NOT NULL,
	`count` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rate_window` ON `request_limits` (`window`);--> statement-breakpoint
ALTER TABLE `analysis_runs` ADD `revision` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `analysis_runs` ADD `request_key` text;--> statement-breakpoint
ALTER TABLE `analysis_runs` ADD `payload_hash` text;--> statement-breakpoint
ALTER TABLE `analysis_runs` ADD `operations_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `analysis_runs_request_key_unique` ON `analysis_runs` (`request_key`);--> statement-breakpoint
ALTER TABLE `analysis_sources` ADD `input_content_revision` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `analysis_sources` ADD `input_evidence_revision` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `studies` ADD `operations_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `studies` ADD `last_request_id` text;