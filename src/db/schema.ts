import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const JURISDICTIONS = ["gdpr", "dsg", "ccpa"] as const;
export type Jurisdiction = (typeof JURISDICTIONS)[number];

export const REQUEST_TYPES = ["erasure", "access", "optout"] as const;
export type RequestType = (typeof REQUEST_TYPES)[number];

export const REQUEST_STATUSES = [
  "draft",
  "queued",
  "sent",
  "acknowledged",
  "needs_info",
  "completed",
  "rejected",
  "overdue",
  "reminded",
  "escalation_ready",
  "escalated",
  "failed",
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const BROKER_CATEGORIES = [
  "people_search",
  "marketing",
  "credit",
  "b2b",
  "adtech",
  "directory",
  "background_check",
  "other",
] as const;
export type BrokerCategory = (typeof BROKER_CATEGORIES)[number];

const now = sql`(unixepoch())`;

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role", { enum: ["admin", "user"] }).notNull().default("user"),
  locale: text("locale", { enum: ["de", "en"] }).notNull().default("de"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(now),
});

/** Personal data used to fill templates. One profile per user. */
export const profiles = sqliteTable("profiles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  fullName: text("full_name").notNull().default(""),
  aliases: text("aliases").notNull().default(""), // newline separated
  birthDate: text("birth_date").notNull().default(""), // ISO date or free text
  addresses: text("addresses").notNull().default(""), // newline separated (current + previous)
  emails: text("emails").notNull().default(""), // newline separated
  phones: text("phones").notNull().default(""), // newline separated
  country: text("country").notNull().default("CH"),
  signature: text("signature").notNull().default(""),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(now),
});

export const mailAccounts = sqliteTable("mail_accounts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  fromName: text("from_name").notNull().default(""),
  fromEmail: text("from_email").notNull(),
  smtpHost: text("smtp_host").notNull(),
  smtpPort: integer("smtp_port").notNull().default(587),
  smtpSecure: integer("smtp_secure", { mode: "boolean" }).notNull().default(false),
  smtpUser: text("smtp_user").notNull(),
  smtpPassEnc: text("smtp_pass_enc").notNull(),
  imapEnabled: integer("imap_enabled", { mode: "boolean" }).notNull().default(true),
  imapHost: text("imap_host").notNull().default(""),
  imapPort: integer("imap_port").notNull().default(993),
  imapSecure: integer("imap_secure", { mode: "boolean" }).notNull().default(true),
  imapUser: text("imap_user").notNull().default(""),
  imapPassEnc: text("imap_pass_enc").notNull().default(""),
  imapMailbox: text("imap_mailbox").notNull().default("INBOX"),
  imapLastUid: integer("imap_last_uid").notNull().default(0),
  imapLastPollAt: integer("imap_last_poll_at", { mode: "timestamp" }),
  imapLastError: text("imap_last_error"),
  smtpLastError: text("smtp_last_error"),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(now),
});

export const brokers = sqliteTable(
  "brokers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    /** null = curated/system broker visible to all users; otherwise a custom entry of that user */
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    website: text("website").notNull().default(""),
    privacyEmail: text("privacy_email").notNull().default(""),
    privacyUrl: text("privacy_url").notNull().default(""),
    optOutUrl: text("opt_out_url").notNull().default(""),
    country: text("country").notNull().default(""),
    jurisdiction: text("jurisdiction", { enum: JURISDICTIONS }).notNull().default("gdpr"),
    category: text("category", { enum: BROKER_CATEGORIES }).notNull().default("other"),
    language: text("language", { enum: ["de", "en"] }).notNull().default("en"),
    requiresIdVerification: integer("requires_id_verification", { mode: "boolean" }).notNull().default(false),
    notes: text("notes").notNull().default(""),
    /** For custom removals: where the user's data was found */
    dataUrls: text("data_urls").notNull().default(""),
    isCurated: integer("is_curated", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(now),
  },
  (t) => [index("brokers_user_idx").on(t.userId), index("brokers_slug_idx").on(t.slug)],
);

export const templates = sqliteTable(
  "templates",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    /** null = system template; otherwise user override */
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
    key: text("key").notNull(), // e.g. gdpr_erasure_de
    jurisdiction: text("jurisdiction", { enum: JURISDICTIONS }).notNull(),
    kind: text("kind", { enum: ["request", "reminder", "escalation"] }).notNull(),
    requestType: text("request_type", { enum: REQUEST_TYPES }), // null for reminder/escalation
    language: text("language", { enum: ["de", "en"] }).notNull(),
    name: text("name").notNull(),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    isSystem: integer("is_system", { mode: "boolean" }).notNull().default(false),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(now),
  },
  (t) => [index("templates_user_key_idx").on(t.userId, t.key)],
);

export const requests = sqliteTable(
  "requests",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    brokerId: integer("broker_id").notNull().references(() => brokers.id, { onDelete: "cascade" }),
    reference: text("reference").notNull().unique(), // OD-XXXXXX in subject lines
    type: text("type", { enum: REQUEST_TYPES }).notNull().default("erasure"),
    jurisdiction: text("jurisdiction", { enum: JURISDICTIONS }).notNull(),
    language: text("language", { enum: ["de", "en"] }).notNull(),
    status: text("status", { enum: REQUEST_STATUSES }).notNull().default("draft"),
    toEmail: text("to_email").notNull(),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    sentAt: integer("sent_at", { mode: "timestamp" }),
    deadlineAt: integer("deadline_at", { mode: "timestamp" }),
    reminderSentAt: integer("reminder_sent_at", { mode: "timestamp" }),
    escalationDeadlineAt: integer("escalation_deadline_at", { mode: "timestamp" }),
    lastResponseAt: integer("last_response_at", { mode: "timestamp" }),
    closedAt: integer("closed_at", { mode: "timestamp" }),
    autoRemind: integer("auto_remind", { mode: "boolean" }).notNull().default(true),
    lastError: text("last_error"),
    notes: text("notes").notNull().default(""),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(now),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(now),
  },
  (t) => [
    index("requests_user_idx").on(t.userId),
    index("requests_status_idx").on(t.status),
    index("requests_broker_idx").on(t.brokerId),
  ],
);

export const messages = sqliteTable(
  "messages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    requestId: integer("request_id").notNull().references(() => requests.id, { onDelete: "cascade" }),
    direction: text("direction", { enum: ["out", "in"] }).notNull(),
    kind: text("kind", { enum: ["request", "reminder", "reply", "manual"] }).notNull().default("request"),
    fromAddr: text("from_addr").notNull().default(""),
    toAddr: text("to_addr").notNull().default(""),
    subject: text("subject").notNull().default(""),
    body: text("body").notNull().default(""),
    messageId: text("message_id"),
    inReplyTo: text("in_reply_to"),
    classification: text("classification"), // acknowledged | completed | rejected | needs_info | unknown
    occurredAt: integer("occurred_at", { mode: "timestamp" }).notNull().default(now),
  },
  (t) => [index("messages_request_idx").on(t.requestId), index("messages_mid_idx").on(t.messageId)],
);

export const activityLog = sqliteTable(
  "activity_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
    requestId: integer("request_id").references(() => requests.id, { onDelete: "cascade" }),
    level: text("level", { enum: ["info", "warn", "error"] }).notNull().default("info"),
    event: text("event").notNull(),
    detail: text("detail").notNull().default(""),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(now),
  },
  (t) => [index("activity_user_idx").on(t.userId), index("activity_created_idx").on(t.createdAt)],
);

export type User = typeof users.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
export type MailAccount = typeof mailAccounts.$inferSelect;
export type Broker = typeof brokers.$inferSelect;
export type Template = typeof templates.$inferSelect;
export type Request = typeof requests.$inferSelect;
export type Message = typeof messages.$inferSelect;
