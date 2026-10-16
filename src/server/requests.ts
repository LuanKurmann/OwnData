import "server-only";
import { and, eq, isNull, or, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Broker, Profile, Template, RequestType, Jurisdiction } from "@/db/schema";
import { newReference } from "@/lib/reference";
import { buildVars, render } from "@/lib/template-render";

/** Resolve a template: user override first, then system template. */
export function resolveTemplate(userId: number, key: string): Template | null {
  const db = getDb();
  const rows = db
    .select()
    .from(schema.templates)
    .where(and(eq(schema.templates.key, key), or(eq(schema.templates.userId, userId), isNull(schema.templates.userId))))
    .all();
  return rows.find((r) => r.userId === userId) ?? rows.find((r) => r.userId === null) ?? null;
}

export function templateKey(j: Jurisdiction, t: RequestType, lang: "de" | "en"): string {
  // CCPA templates only exist in English.
  const l = j === "ccpa" ? "en" : lang;
  return `${j}_${t}_${l}`;
}

export function reminderKey(lang: "de" | "en") {
  return `reminder_${lang}`;
}

export function escalationKey(j: Jurisdiction, lang: "de" | "en") {
  if (j === "dsg") return "escalation_dsg_de";
  if (j === "ccpa") return "escalation_ccpa_en";
  return `escalation_gdpr_${lang}`;
}

export function getProfile(userId: number): Profile {
  const db = getDb();
  let p = db.select().from(schema.profiles).where(eq(schema.profiles.userId, userId)).get();
  if (!p) {
    p = db.insert(schema.profiles).values({ userId }).returning().get();
  }
  return p;
}

export function getMailAccount(userId: number) {
  const db = getDb();
  return db.select().from(schema.mailAccounts).where(eq(schema.mailAccounts.userId, userId)).get() ?? null;
}

export function visibleBrokers(userId: number): Broker[] {
  const db = getDb();
  return db
    .select()
    .from(schema.brokers)
    .where(or(isNull(schema.brokers.userId), eq(schema.brokers.userId, userId)))
    .orderBy(schema.brokers.name)
    .all();
}

export type CreateRequestInput = {
  userId: number;
  brokerIds: number[];
  type: RequestType;
  language?: "de" | "en"; // default: broker language
  queue: boolean; // true = send with next worker run, false = keep as draft
  toEmailOverride?: string;
};

export function createRequests(input: CreateRequestInput): { created: number[]; skipped: { brokerId: number; reason: string }[] } {
  const db = getDb();
  const profile = getProfile(input.userId);
  const account = getMailAccount(input.userId);
  const senderEmail = account?.fromEmail ?? profile.emails.split(/\r?\n/)[0] ?? "";
  const brokersList = db
    .select()
    .from(schema.brokers)
    .where(and(inArray(schema.brokers.id, input.brokerIds), or(isNull(schema.brokers.userId), eq(schema.brokers.userId, input.userId))))
    .all();

  const created: number[] = [];
  const skipped: { brokerId: number; reason: string }[] = [];

  for (const broker of brokersList) {
    const toEmail = (input.toEmailOverride || broker.privacyEmail).trim();
    if (!toEmail) {
      skipped.push({ brokerId: broker.id, reason: "noEmail" });
      continue;
    }
    const lang = input.language ?? broker.language;
    const tpl = resolveTemplate(input.userId, templateKey(broker.jurisdiction, input.type, lang));
    if (!tpl) {
      skipped.push({ brokerId: broker.id, reason: "noTemplate" });
      continue;
    }
    const reference = newReference();
    const vars = buildVars({
      profile,
      broker,
      reference,
      lang: tpl.language,
      requestType: input.type,
      jurisdiction: broker.jurisdiction,
      senderEmail,
    });
    const row = db
      .insert(schema.requests)
      .values({
        userId: input.userId,
        brokerId: broker.id,
        reference,
        type: input.type,
        jurisdiction: broker.jurisdiction,
        language: tpl.language,
        status: input.queue ? "queued" : "draft",
        toEmail,
        subject: render(tpl.subject, vars),
        body: render(tpl.body, vars),
      })
      .returning({ id: schema.requests.id })
      .get();
    created.push(row.id);
    db.insert(schema.activityLog)
      .values({ userId: input.userId, requestId: row.id, event: input.queue ? "request.queued" : "request.drafted", detail: broker.name })
      .run();
  }
  return { created, skipped };
}
