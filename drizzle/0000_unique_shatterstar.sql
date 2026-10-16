CREATE TABLE `activity_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`request_id` integer,
	`level` text DEFAULT 'info' NOT NULL,
	`event` text NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`request_id`) REFERENCES `requests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `activity_user_idx` ON `activity_log` (`user_id`);--> statement-breakpoint
CREATE INDEX `activity_created_idx` ON `activity_log` (`created_at`);--> statement-breakpoint
CREATE TABLE `brokers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`website` text DEFAULT '' NOT NULL,
	`privacy_email` text DEFAULT '' NOT NULL,
	`privacy_url` text DEFAULT '' NOT NULL,
	`opt_out_url` text DEFAULT '' NOT NULL,
	`country` text DEFAULT '' NOT NULL,
	`jurisdiction` text DEFAULT 'gdpr' NOT NULL,
	`category` text DEFAULT 'other' NOT NULL,
	`language` text DEFAULT 'en' NOT NULL,
	`requires_id_verification` integer DEFAULT false NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`data_urls` text DEFAULT '' NOT NULL,
	`is_curated` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `brokers_user_idx` ON `brokers` (`user_id`);--> statement-breakpoint
CREATE INDEX `brokers_slug_idx` ON `brokers` (`slug`);--> statement-breakpoint
CREATE TABLE `mail_accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`from_name` text DEFAULT '' NOT NULL,
	`from_email` text NOT NULL,
	`smtp_host` text NOT NULL,
	`smtp_port` integer DEFAULT 587 NOT NULL,
	`smtp_secure` integer DEFAULT false NOT NULL,
	`smtp_user` text NOT NULL,
	`smtp_pass_enc` text NOT NULL,
	`imap_enabled` integer DEFAULT true NOT NULL,
	`imap_host` text DEFAULT '' NOT NULL,
	`imap_port` integer DEFAULT 993 NOT NULL,
	`imap_secure` integer DEFAULT true NOT NULL,
	`imap_user` text DEFAULT '' NOT NULL,
	`imap_pass_enc` text DEFAULT '' NOT NULL,
	`imap_mailbox` text DEFAULT 'INBOX' NOT NULL,
	`imap_last_uid` integer DEFAULT 0 NOT NULL,
	`imap_last_poll_at` integer,
	`imap_last_error` text,
	`smtp_last_error` text,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mail_accounts_user_id_unique` ON `mail_accounts` (`user_id`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`request_id` integer NOT NULL,
	`direction` text NOT NULL,
	`kind` text DEFAULT 'request' NOT NULL,
	`from_addr` text DEFAULT '' NOT NULL,
	`to_addr` text DEFAULT '' NOT NULL,
	`subject` text DEFAULT '' NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`message_id` text,
	`in_reply_to` text,
	`classification` text,
	`occurred_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `requests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `messages_request_idx` ON `messages` (`request_id`);--> statement-breakpoint
CREATE INDEX `messages_mid_idx` ON `messages` (`message_id`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`full_name` text DEFAULT '' NOT NULL,
	`aliases` text DEFAULT '' NOT NULL,
	`birth_date` text DEFAULT '' NOT NULL,
	`addresses` text DEFAULT '' NOT NULL,
	`emails` text DEFAULT '' NOT NULL,
	`phones` text DEFAULT '' NOT NULL,
	`country` text DEFAULT 'CH' NOT NULL,
	`signature` text DEFAULT '' NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profiles_user_id_unique` ON `profiles` (`user_id`);--> statement-breakpoint
CREATE TABLE `requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`broker_id` integer NOT NULL,
	`reference` text NOT NULL,
	`type` text DEFAULT 'erasure' NOT NULL,
	`jurisdiction` text NOT NULL,
	`language` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`to_email` text NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`sent_at` integer,
	`deadline_at` integer,
	`reminder_sent_at` integer,
	`escalation_deadline_at` integer,
	`last_response_at` integer,
	`closed_at` integer,
	`auto_remind` integer DEFAULT true NOT NULL,
	`last_error` text,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`broker_id`) REFERENCES `brokers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `requests_reference_unique` ON `requests` (`reference`);--> statement-breakpoint
CREATE INDEX `requests_user_idx` ON `requests` (`user_id`);--> statement-breakpoint
CREATE INDEX `requests_status_idx` ON `requests` (`status`);--> statement-breakpoint
CREATE INDEX `requests_broker_idx` ON `requests` (`broker_id`);--> statement-breakpoint
CREATE TABLE `templates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`key` text NOT NULL,
	`jurisdiction` text NOT NULL,
	`kind` text NOT NULL,
	`request_type` text,
	`language` text NOT NULL,
	`name` text NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`is_system` integer DEFAULT false NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `templates_user_key_idx` ON `templates` (`user_id`,`key`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`name` text NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`locale` text DEFAULT 'de' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);