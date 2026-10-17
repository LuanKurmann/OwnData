CREATE TABLE `inbox` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`request_id` integer,
	`status` text DEFAULT 'unmatched' NOT NULL,
	`imap_uid` integer,
	`message_id` text,
	`in_reply_to` text,
	`from_addr` text DEFAULT '' NOT NULL,
	`from_name` text DEFAULT '' NOT NULL,
	`to_addr` text DEFAULT '' NOT NULL,
	`subject` text DEFAULT '' NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`links` text DEFAULT '[]' NOT NULL,
	`classification` text DEFAULT 'unknown' NOT NULL,
	`hints` text DEFAULT '[]' NOT NULL,
	`handled_at` integer,
	`received_at` integer DEFAULT (unixepoch()) NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`request_id`) REFERENCES `requests`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `inbox_user_idx` ON `inbox` (`user_id`);--> statement-breakpoint
CREATE INDEX `inbox_request_idx` ON `inbox` (`request_id`);--> statement-breakpoint
CREATE INDEX `inbox_mid_idx` ON `inbox` (`message_id`);--> statement-breakpoint
CREATE TABLE `sender_rules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`broker_id` integer NOT NULL,
	`pattern` text NOT NULL,
	`kind` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`broker_id`) REFERENCES `brokers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sender_rules_user_idx` ON `sender_rules` (`user_id`,`pattern`);