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
  "action_required",
  "completed",
  "rejected",
  "overdue",
  "reminded",
  "escalation_ready",
  "escalated",
  "failed",
  "bounced",
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
  firstName: text("first_name").notNull().default(""),
  middleName: text("middle_name").notNull().default(""),
  lastName: text("last_name").notNull().default(""),
  /** derived: first + middle + last; kept for templates and display */
  fullName: text("full_name").notNull().default(""),
  aliases: text("aliases").notNull().default(""), // newline separated
  birthDate: text("birth_date").notNull().default(""), // ISO date (YYYY-MM-DD)
  /** legacy free-text addresses; structured addresses live in the `addresses` table */
  addresses: text("addresses").notNull().default(""),
  emails: text("emails").notNull().default(""), // newline separated
  phones: text("phones").notNull().default(""), // newline separated
  country: text("country").notNull().default("CH"),
  signature: text("signature").notNull().default(""),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(now),
});

export const ADDRESS_KINDS = ["current", "previous"] as const;
export type AddressKind = (typeof ADDRESS_KINDS)[number];

/** Structured postal addresses of a user (current and previous ones). */
export const addresses = sqliteTable(
  "addresses",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ADDRESS_KINDS }).notNull().default("current"),
    street: text("street").notNull().default(""),
    houseNumber: text("house_number").notNull().default(""),
    addressLine2: text("address_line2").notNull().default(""), // c/o, apartment, floor
    postalCode: text("postal_code").notNull().default(""),
    city: text("city").notNull().default(""),
    region: text("region").notNull().default(""), // canton / state / province
    country: text("country").notNull().default("CH"), // ISO 3166-1 alpha-2
    fromYear: text("from_year").notNull().default(""),
    toYear: text("to_year").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(now),
  },
  (t) => [index("addresses_user_idx").on(t.userId)],
);

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
    /** email: accepts requests by e-mail; form: only via web form/portal (e-mail gets an auto-reply or bounces) */
    preferredChannel: text("preferred_channel", { enum: ["email", "form"] }).notNull().default("email"),
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
    kind: text("kind", { enum: ["request", "reminder", "escalation", "followup"] }).notNull(),
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

export const INBOX_STATUSES = ["unmatched", "matched", "ignored"] as const;
export type InboxStatus = (typeof INBOX_STATUSES)[number];

export const CLASSIFICATIONS = ["completed", "rejected", "needs_info", "action_required", "acknowledged", "auto_reply", "bounced", "unknown"] as const;
export type Classification = (typeof CLASSIFICATIONS)[number];

/** Every inbound e-mail fetched via IMAP, matched to a request or waiting for manual assignment. */
export const inbox = sqliteTable(
  "inbox",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    requestId: integer("request_id").references(() => requests.id, { onDelete: "set null" }),
    status: text("status", { enum: INBOX_STATUSES }).notNull().default("unmatched"),
    imapUid: integer("imap_uid"),
    messageId: text("message_id"),
    inReplyTo: text("in_reply_to"),
    fromAddr: text("from_addr").notNull().default(""),
    fromName: text("from_name").notNull().default(""),
    toAddr: text("to_addr").notNull().default(""),
    subject: text("subject").notNull().default(""),
    body: text("body").notNull().default(""),
    /** JSON array of { url, label } extracted from the mail */
    links: text("links").notNull().default("[]"),
    classification: text("classification", { enum: CLASSIFICATIONS }).notNull().default("unknown"),
    /** JSON array of action hints: verify_identity, click_link, fill_form, provide_info, confirm_request */
    hints: text("hints").notNull().default("[]"),
    /** set when the user finished the required action or reviewed the mail */
    handledAt: integer("handled_at", { mode: "timestamp" }),
    receivedAt: integer("received_at", { mode: "timestamp" }).notNull().default(now),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(now),
  },
  (t) => [index("inbox_user_idx").on(t.userId), index("inbox_request_idx").on(t.requestId), index("inbox_mid_idx").on(t.messageId)],
);

/** Learned mapping sender address/domain -> broker, created when the user assigns a mail manually. */
export const senderRules = sqliteTable(
  "sender_rules",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    brokerId: integer("broker_id").notNull().references(() => brokers.id, { onDelete: "cascade" }),
    /** lower-case e-mail address or host name */
    pattern: text("pattern").notNull(),
    kind: text("kind", { enum: ["address", "domain"] }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(now),
  },
  (t) => [index("sender_rules_user_idx").on(t.userId, t.pattern)],
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
export type Address = typeof addresses.$inferSelect;
export type ProfileWithAddresses = Profile & { addressList: Address[] };
export type MailAccount = typeof mailAccounts.$inferSelect;
export type Broker = typeof brokers.$inferSelect;
export type Template = typeof templates.$inferSelect;
export type Request = typeof requests.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type InboxMail = typeof inbox.$inferSelect;
export type SenderRule = typeof senderRules.$inferSelect;
export type ExtractedLink = { url: string; label: string };
export type ActionHint = "verify_identity" | "click_link" | "fill_form" | "provide_info" | "confirm_request";
