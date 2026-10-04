CREATE TABLE `analysis_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`requester_id` text NOT NULL,
	`input_manifest_json` text NOT NULL,
	`status` text NOT NULL,
	`result_json` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `analysis_sources` (
	`analysis_id` text NOT NULL,
	`session_id` text NOT NULL,
	FOREIGN KEY (`analysis_id`) REFERENCES `analysis_runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `analysis_source_pair` ON `analysis_sources` (`analysis_id`,`session_id`);--> statement-breakpoint
CREATE INDEX `source_session` ON `analysis_sources` (`session_id`);--> statement-breakpoint
CREATE TABLE `provider_calls` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`operation` text NOT NULL,
	`model` text NOT NULL,
	`status` text NOT NULL,
	`usage_json` text,
	`started_at` text NOT NULL,
	`ended_at` text
);
--> statement-breakpoint
CREATE TABLE `guide_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`study_id` text NOT NULL,
	`version` integer NOT NULL,
	`guide_json` text NOT NULL,
	`published_at` text NOT NULL,
	FOREIGN KEY (`study_id`) REFERENCES `studies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `guide_study_version` ON `guide_versions` (`study_id`,`version`);--> statement-breakpoint
CREATE TABLE `service_control` (
	`id` text PRIMARY KEY NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`control_json` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`study_id` text NOT NULL,
	`guide_id` text NOT NULL,
	`origin` text NOT NULL,
	`token_hash` text NOT NULL,
	`create_request_id` text NOT NULL,
	`create_payload_hash` text NOT NULL,
	`state_version` integer NOT NULL,
	`content_revision` integer NOT NULL,
	`evidence_revision` integer NOT NULL,
	`status` text NOT NULL,
	`expires_at` text NOT NULL,
	`aggregate_json` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_create_request_id_unique` ON `sessions` (`create_request_id`);--> statement-breakpoint
CREATE INDEX `sessions_guide_origin` ON `sessions` (`guide_id`,`origin`);--> statement-breakpoint
CREATE INDEX `sessions_expiry` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `studies` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_site_user_id` text NOT NULL,
	`title` text NOT NULL,
	`draft_json` text NOT NULL,
	`draft_revision` integer DEFAULT 0 NOT NULL,
	`current_published_guide_id` text,
	`created_at` text NOT NULL
);
