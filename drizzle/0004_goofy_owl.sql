CREATE TABLE `worker_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`trigger` text DEFAULT 'manual' NOT NULL,
	`started_at` integer DEFAULT (unixepoch()) NOT NULL,
	`finished_at` integer,
	`sent` integer DEFAULT 0 NOT NULL,
	`failed` integer DEFAULT 0 NOT NULL,
	`inbound_matched` integer DEFAULT 0 NOT NULL,
	`inbound_unmatched` integer DEFAULT 0 NOT NULL,
	`reminders_sent` integer DEFAULT 0 NOT NULL,
	`auto_actions` integer DEFAULT 0 NOT NULL,
	`overdue_marked` integer DEFAULT 0 NOT NULL,
	`errors` text DEFAULT '[]' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `worker_runs_started_idx` ON `worker_runs` (`started_at`);--> statement-breakpoint
ALTER TABLE `mail_accounts` ADD `imap_sent_mailbox` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `mail_accounts` ADD `auto_followup` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `mail_accounts` ADD `auto_confirm_links` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `mail_accounts` ADD `auto_resend` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `requests` ADD `auto_followup_at` integer;--> statement-breakpoint
ALTER TABLE `requests` ADD `form_submitted_at` integer;--> statement-breakpoint
ALTER TABLE `requests` ADD `resend_count` integer DEFAULT 0 NOT NULL;