import "server-only";
import { and, eq, isNull, or, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Broker, ProfileWithAddresses, Template, RequestType, Jurisdiction } from "@/db/schema";
import { newReference } from "@/lib/reference";
import { buildVars, render } from "@/lib/template-render";
import { addFormAction } from "./inbox";

/** Resolve a template: user override first, then system template. */
export async function resolveTemplate(userId: number, key: string): Promise<Template | null> {
  const db = await getDb();
  const rows = await db
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

export const FOLLOWUP_KINDS = ["identity", "info", "confirm", "status"] as const;
export type FollowupKind = (typeof FOLLOWUP_KINDS)[number];

export function followupKey(kind: FollowupKind, lang: "de" | "en") {
  return `followup_${kind}_${lang}`;
}

export function escalationKey(j: Jurisdiction, lang: "de" | "en") {
  if (j === "dsg") return "escalation_dsg_de";
  if (j === "ccpa") return "escalation_ccpa_en";
  return `escalation_gdpr_${lang}`;
}

export async function getProfile(userId: number): Promise<ProfileWithAddresses> {
  const db = await getDb();
  let p = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, userId)).get();
  if (!p) {
    p = await db.insert(schema.profiles).values({ userId }).returning().get();
  }
  const addressList = await db
    .select()
    .from(schema.addresses)
    .where(eq(schema.addresses.userId, userId))
    .orderBy(schema.addresses.kind, schema.addresses.sortOrder, schema.addresses.id)
    .all();
  return { ...p, addressList };
}

export async function getMailAccount(userId: number) {
  const db = await getDb();
  return await db.select().from(schema.mailAccounts).where(eq(schema.mailAccounts.userId, userId)).get() ?? null;
}

export async function visibleBrokers(userId: number): Promise<Broker[]> {
  const db = await getDb();
  return await db
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

export async function createRequests(input: CreateRequestInput): Promise<{ created: number[]; skipped: { brokerId: number; reason: string }[] }> {
  const db = await getDb();
  const profile = await getProfile(input.userId);
  const account = await getMailAccount(input.userId);
  const senderEmail = account?.fromEmail ?? profile.emails.split(/\r?\n/)[0] ?? "";
  const brokersList = await db
    .select()
    .from(schema.brokers)
    .where(and(inArray(schema.brokers.id, input.brokerIds), or(isNull(schema.brokers.userId), eq(schema.brokers.userId, input.userId))))
    .all();

  const created: number[] = [];
  const skipped: { brokerId: number; reason: string }[] = [];

  for (const broker of brokersList) {
    const toEmail = (input.toEmailOverride || broker.privacyEmail).trim();
    const formOnly = broker.preferredChannel === "form" && !!broker.optOutUrl && !input.toEmailOverride;
    if (!toEmail && !formOnly) {
      skipped.push({ brokerId: broker.id, reason: "noEmail" });
      continue;
    }
    const lang = input.language ?? broker.language;
    const tpl = await resolveTemplate(input.userId, templateKey(broker.jurisdiction, input.type, lang));
    if (!tpl) {
      skipped.push({ brokerId: broker.id, reason: "noTemplate" });
      continue;
    }
    const reference = newReference();
    if (formOnly) {
      // No e-mail: the broker only processes web-form requests. Create the request as an open action with the form link.
      const vars = buildVars({ profile, broker, reference, lang: tpl.language, requestType: input.type, jurisdiction: broker.jurisdiction, senderEmail });
      const row = await db
        .insert(schema.requests)
        .values({
          userId: input.userId,
          brokerId: broker.id,
          reference,
          type: input.type,
          jurisdiction: broker.jurisdiction,
          language: tpl.language,
          status: "action_required",
          toEmail: toEmail || "",
          subject: render(tpl.subject, vars),
          body: render(tpl.body, vars),
          notes: "",
        })
        .returning({ id: schema.requests.id })
        .get();
      await addFormAction(input.userId, row.id, broker);
      await db.insert(schema.activityLog).values({ userId: input.userId, requestId: row.id, event: "request.form_only", detail: broker.optOutUrl }).run();
      created.push(row.id);
      continue;
    }
    const vars = buildVars({
      profile,
      broker,
      reference,
      lang: tpl.language,
      requestType: input.type,
      jurisdiction: broker.jurisdiction,
      senderEmail,
    });
    const row = await db
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
    await db.insert(schema.activityLog)
      .values({ userId: input.userId, requestId: row.id, event: input.queue ? "request.queued" : "request.drafted", detail: broker.name })
      .run();
  }
  return { created, skipped };
}
