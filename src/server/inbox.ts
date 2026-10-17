import "server-only";
import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { ActionHint, Classification, InboxMail, Request } from "@/db/schema";
import { REFERENCE_REGEX } from "@/lib/reference";
import { classifyReply, extractBounceInfo, extractLinks, isAutoReply, isBounce, stripQuoted } from "@/lib/classify";
import type { InboundMail } from "./mail/imap";
import { brokerTokens, domainsRelated, emailAddress, emailDomain } from "@/lib/match";

const OPEN_STATUSES = ["sent", "acknowledged", "needs_info", "action_required", "overdue", "reminded", "escalation_ready"] as const;
const TERMINAL = ["completed", "rejected", "escalated"];
const GENERIC_DOMAINS = /(^|\.)(gmail|googlemail|outlook|hotmail|live|yahoo|gmx|web|icloud|me|proton|protonmail|bluewin|sunrise|hispeed|t-online|aol)\.[a-z.]+$/i;


async function log(userId: number, requestId: number | null, event: string, detail = "", level: "info" | "warn" | "error" = "info") {
  await (await getDb()).insert(schema.activityLog).values({ userId, requestId, event, detail, level }).run();
}

/** Find the request an inbound mail belongs to: threading headers, reference code, learned sender rules, sender domain. */
export async function matchRequest(userId: number, mail: { inReplyTo: string | null; references: string[]; subject: string; text: string; from: string }): Promise<Request | null> {
  const db = await getDb();
  // 1) threading headers against our outbound messages
  const ids = [mail.inReplyTo, ...mail.references].filter((x): x is string => !!x);
  if (ids.length) {
    const out = await db
      .select({ requestId: schema.messages.requestId })
      .from(schema.messages)
      .where(and(eq(schema.messages.direction, "out"), inArray(schema.messages.messageId, ids)))
      .get();
    if (out) {
      const req = await db.select().from(schema.requests).where(and(eq(schema.requests.id, out.requestId), eq(schema.requests.userId, userId))).get();
      if (req) return req;
    }
  }
  // 2) reference code anywhere in subject or body (including quoted text)
  const refs = new Set([...(mail.subject.match(REFERENCE_REGEX) ?? []), ...(mail.text.match(REFERENCE_REGEX) ?? [])]);
  for (const ref of refs) {
    const req = await db.select().from(schema.requests).where(and(eq(schema.requests.reference, ref), eq(schema.requests.userId, userId))).get();
    if (req) return req;
  }
  const addr = emailAddress(mail.from);
  const domain = emailDomain(addr);
  // 3) learned sender rules (exact address first, then domain)
  const rules = await db
    .select()
    .from(schema.senderRules)
    .where(and(eq(schema.senderRules.userId, userId), inArray(schema.senderRules.pattern, [addr, domain].filter(Boolean))))
    .all();
  const rule = rules.find((r) => r.kind === "address") ?? rules.find((r) => r.kind === "domain");
  if (rule) {
    const req = await latestRequestForBroker(userId, rule.brokerId);
    if (req) return req;
  }
  const open = await db
    .select({ req: schema.requests, brokerName: schema.brokers.name, brokerWebsite: schema.brokers.website })
    .from(schema.requests)
    .innerJoin(schema.brokers, eq(schema.brokers.id, schema.requests.brokerId))
    .where(and(eq(schema.requests.userId, userId), inArray(schema.requests.status, [...OPEN_STATUSES])))
    .all();
  // 4) sender domain equals the recipient domain (or the broker's website domain) of exactly one open request
  if (domain) {
    const byDomain = open.filter(({ req, brokerWebsite }) => {
      const d = emailDomain(req.toEmail.toLowerCase());
      const w = brokerWebsite.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].toLowerCase();
      return domainsRelated(domain, [d, w]);
    });
    const pick = uniqueBroker(byDomain);
    if (pick) return pick;
  }
  // 5) broker name appears in the sender name or subject (ticket systems like Zendesk/OneTrust send from foreign domains)
  const hay = `${mail.from} ${mail.subject}`.toLowerCase();
  const byName = open.filter(({ brokerName }) => brokerTokens(brokerName).some((tok) => hay.includes(tok)));
  return uniqueBroker(byName);
}

/** Several candidates are fine when they all belong to the same broker: take the most recently updated one. */
function uniqueBroker(cands: Array<{ req: Request; brokerName: string; brokerWebsite: string }>): Request | null {
  if (cands.length === 0) return null;
  if (new Set(cands.map((c) => c.req.brokerId)).size !== 1) return null;
  return [...cands].sort((a, b) => b.req.updatedAt.getTime() - a.req.updatedAt.getTime())[0].req;
}


async function latestRequestForBroker(userId: number, brokerId: number): Promise<Request | null> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.requests)
    .where(and(eq(schema.requests.userId, userId), eq(schema.requests.brokerId, brokerId)))
    .orderBy(desc(schema.requests.updatedAt))
    .all();
  return rows.find((r) => (OPEN_STATUSES as readonly string[]).includes(r.status)) ?? rows[0] ?? null;
}

export type IngestOptions = { autoResend?: boolean };

/** Create the "fill in the broker's form" action for a request (used for form-only brokers and after bounces). */
export async function addFormAction(userId: number, requestId: number, broker: { name: string; optOutUrl: string }) {
  const db = await getDb();
  await db
    .insert(schema.inbox)
    .values({
      userId,
      requestId,
      status: "matched",
      fromAddr: "owndata",
      fromName: "OwnData",
      toAddr: "",
      subject: broker.name,
      body: "",
      links: JSON.stringify([{ url: broker.optOutUrl, label: broker.optOutUrl.replace(/^https?:\/\//, "").slice(0, 60) }]),
      classification: "action_required",
      hints: JSON.stringify(["fill_form"]),
    })
    .run();
}

/** Store an inbound mail (deduplicated by Message-ID) and try to match it. Returns the inbox row and whether it matched. */
export async function ingestMail(userId: number, mail: InboundMail, ownAddress: string, opts: IngestOptions = {}): Promise<{ row: InboxMail | null; matched: boolean; duplicate: boolean; auto?: string }> {
  const db = await getDb();
  const from = emailAddress(mail.from);
  if (from && from === ownAddress.toLowerCase()) return { row: null, matched: false, duplicate: true };
  if (mail.messageId) {
    const dup = await db.select({ id: schema.inbox.id }).from(schema.inbox).where(and(eq(schema.inbox.userId, userId), eq(schema.inbox.messageId, mail.messageId))).get();
    if (dup) return { row: null, matched: false, duplicate: true };
  }
  // --- non-delivery reports
  if (isBounce(mail.subject, mail.from, mail.headers)) {
    const info = extractBounceInfo(mail.text, mail.attachmentsText, ownAddress);
    let matched: Request | null = null;
    for (const ref of info.references) {
      matched = (await db.select().from(schema.requests).where(and(eq(schema.requests.reference, ref), eq(schema.requests.userId, userId))).get()) ?? null;
      if (matched) break;
    }
    if (!matched && (info.messageIds.length || mail.inReplyTo)) {
      const ids = [...info.messageIds, mail.inReplyTo].filter((x): x is string => !!x);
      const out = await db.select({ requestId: schema.messages.requestId }).from(schema.messages).where(inArray(schema.messages.messageId, ids)).get();
      if (out) matched = (await db.select().from(schema.requests).where(and(eq(schema.requests.id, out.requestId), eq(schema.requests.userId, userId))).get()) ?? null;
    }
    if (!matched && info.recipients.length) {
      const cands = (await db.select().from(schema.requests).where(eq(schema.requests.userId, userId)).all()).filter((r) => info.recipients.includes(r.toEmail.toLowerCase()) && !TERMINAL.includes(r.status));
      if (cands.length === 1) matched = cands[0];
    }
    const row = await db
      .insert(schema.inbox)
      .values({
        userId,
        requestId: matched?.id ?? null,
        status: matched ? "matched" : "unmatched",
        imapUid: mail.uid,
        messageId: mail.messageId,
        inReplyTo: mail.inReplyTo,
        fromAddr: from,
        fromName: "Mail Delivery System",
        toAddr: mail.to,
        subject: mail.subject,
        body: `${info.recipients.join(", ")}\n${info.diagnostic}\n\n${mail.text.slice(0, 4000)}`,
        links: "[]",
        classification: "bounced",
        hints: "[]",
        receivedAt: mail.date,
      })
      .returning()
      .get();
    if (matched) {
      const now = new Date();
      const lastError = `${info.recipients[0] ?? matched.toEmail}: ${info.diagnostic || "undeliverable"}`.slice(0, 400);
      await db
        .update(schema.requests)
        .set({ status: TERMINAL.includes(matched.status) ? matched.status : "bounced", lastError, lastResponseAt: mail.date, updatedAt: now })
        .where(eq(schema.requests.id, matched.id))
        .run();
      await log(userId, matched.id, "request.bounced", lastError.slice(0, 200), "error");
      // automatic recovery: the broker entry may carry a corrected address or a form by now
      if (opts.autoResend && !TERMINAL.includes(matched.status) && matched.resendCount < 2) {
        const broker = await db.select().from(schema.brokers).where(eq(schema.brokers.id, matched.brokerId)).get();
        if (broker) {
          const newEmail = broker.privacyEmail.trim().toLowerCase();
          if (newEmail && newEmail !== matched.toEmail.toLowerCase() && broker.preferredChannel !== "form") {
            await db
              .update(schema.requests)
              .set({ toEmail: newEmail, status: "queued", resendCount: matched.resendCount + 1, updatedAt: now })
              .where(eq(schema.requests.id, matched.id))
              .run();
            await log(userId, matched.id, "auto.resend", `${matched.toEmail} → ${newEmail}`);
            return { row, matched: true, duplicate: false, auto: "resend" };
          }
          if (broker.preferredChannel === "form" && broker.optOutUrl) {
            await db.update(schema.requests).set({ status: "action_required", updatedAt: now }).where(eq(schema.requests.id, matched.id)).run();
            await addFormAction(userId, matched.id, broker);
            await log(userId, matched.id, "auto.form_fallback", broker.optOutUrl);
            return { row, matched: true, duplicate: false, auto: "form" };
          }
        }
      }
    }
    return { row, matched: !!matched, duplicate: false };
  }

  const auto = isAutoReply(mail.subject, mail.headers);
  const fresh = stripQuoted(mail.text);
  const result = classifyReply(mail.subject, fresh);
  // auto-generated mails without any actionable content are plain auto-replies; ones with instructions keep their classification
  if (auto && result.classification === "unknown" && result.hints.length === 0) {
    result.classification = "auto_reply" as Classification;
  }
  const links = extractLinks(mail.text, mail.html);
  const matched = await matchRequest(userId, { inReplyTo: mail.inReplyTo, references: mail.references, subject: mail.subject, text: mail.text, from: mail.from });
  const row = await db
    .insert(schema.inbox)
    .values({
      userId,
      requestId: matched?.id ?? null,
      status: matched ? "matched" : "unmatched",
      imapUid: mail.uid,
      messageId: mail.messageId,
      inReplyTo: mail.inReplyTo,
      fromAddr: from,
      fromName: mail.from.replace(/<[^>]+>/, "").replace(/"/g, "").trim(),
      toAddr: mail.to,
      subject: mail.subject,
      body: mail.text.slice(0, 30000),
      links: JSON.stringify(links),
      classification: result.classification,
      hints: JSON.stringify(result.hints),
      receivedAt: mail.date,
    })
    .returning()
    .get();
  if (matched) await applyInboundToRequest(row, matched);
  return { row, matched: !!matched, duplicate: false };
}

/** Update a request's status from an inbound mail's classification (never reopens closed requests). */
export async function applyInboundToRequest(row: InboxMail, req: Request) {
  const db = await getDb();
  const now = new Date();
  const patch: Partial<Request> = { lastResponseAt: row.receivedAt, updatedAt: now };
  if (!TERMINAL.includes(req.status)) {
    switch (row.classification) {
      case "completed":
        Object.assign(patch, { status: "completed", closedAt: now });
        break;
      case "rejected":
        Object.assign(patch, { status: "rejected", closedAt: now });
        break;
      case "needs_info":
        Object.assign(patch, { status: "needs_info" });
        break;
      case "action_required":
        Object.assign(patch, { status: "action_required" });
        break;
      case "acknowledged":
      case "auto_reply":
        if (["sent", "overdue", "bounced"].includes(req.status)) Object.assign(patch, { status: "acknowledged" });
        break;
      case "bounced":
        Object.assign(patch, { status: "bounced" });
        break;
      default:
        break; // unknown: keep status, the user reviews it
    }
  }
  await db.update(schema.requests).set(patch).where(eq(schema.requests.id, req.id)).run();
  await log(req.userId, req.id, "reply.received", `${row.classification} from ${row.fromAddr}`);
}

/** Manual assignment from the inbox page; learns the sender for future mails. */
export async function assignInboxMail(userId: number, inboxId: number, requestId: number, learn = true) {
  const db = await getDb();
  const row = await db.select().from(schema.inbox).where(and(eq(schema.inbox.id, inboxId), eq(schema.inbox.userId, userId))).get();
  const req = await db.select().from(schema.requests).where(and(eq(schema.requests.id, requestId), eq(schema.requests.userId, userId))).get();
  if (!row || !req) return false;
  const updated = await db
    .update(schema.inbox)
    .set({ requestId: req.id, status: "matched" })
    .where(eq(schema.inbox.id, row.id))
    .returning()
    .get();
  await applyInboundToRequest(updated, req);
  if (learn && row.fromAddr) {
    const domain = emailDomain(row.fromAddr);
    const patterns: Array<{ pattern: string; kind: "address" | "domain" }> = [{ pattern: row.fromAddr, kind: "address" }];
    if (domain && !GENERIC_DOMAINS.test(domain)) patterns.push({ pattern: domain, kind: "domain" });
    for (const p of patterns) {
      const exists = await db
        .select({ id: schema.senderRules.id })
        .from(schema.senderRules)
        .where(and(eq(schema.senderRules.userId, userId), eq(schema.senderRules.pattern, p.pattern)))
        .get();
      if (exists) await db.update(schema.senderRules).set({ brokerId: req.brokerId, kind: p.kind }).where(eq(schema.senderRules.id, exists.id)).run();
      else await db.insert(schema.senderRules).values({ userId, brokerId: req.brokerId, ...p }).run();
    }
  }
  await log(userId, req.id, "inbox.assigned", row.fromAddr);
  return true;
}

export async function setInboxStatus(userId: number, inboxId: number, status: "ignored" | "unmatched") {
  const db = await getDb();
  await db
    .update(schema.inbox)
    .set({ status, requestId: status === "unmatched" ? null : undefined })
    .where(and(eq(schema.inbox.id, inboxId), eq(schema.inbox.userId, userId)))
    .run();
}

export async function markHandled(userId: number, inboxId: number) {
  const db = await getDb();
  await db
    .update(schema.inbox)
    .set({ handledAt: new Date() })
    .where(and(eq(schema.inbox.id, inboxId), eq(schema.inbox.userId, userId)))
    .run();
}

export async function unmatchedCount(userId: number): Promise<number> {
  const db = await getDb();
  return (await db.select({ id: schema.inbox.id }).from(schema.inbox).where(and(eq(schema.inbox.userId, userId), eq(schema.inbox.status, "unmatched"))).all()).length;
}

/** Requests offered in the "assign to" dropdown: open ones first, then the rest. */
export async function assignableRequests(userId: number) {
  const db = await getDb();
  const rows = await db
    .select({ req: schema.requests, brokerName: schema.brokers.name })
    .from(schema.requests)
    .innerJoin(schema.brokers, eq(schema.brokers.id, schema.requests.brokerId))
    .where(and(eq(schema.requests.userId, userId), or(isNull(schema.requests.closedAt), inArray(schema.requests.status, [...OPEN_STATUSES]))))
    .orderBy(desc(schema.requests.updatedAt))
    .all();
  const closed = await db
    .select({ req: schema.requests, brokerName: schema.brokers.name })
    .from(schema.requests)
    .innerJoin(schema.brokers, eq(schema.brokers.id, schema.requests.brokerId))
    .where(and(eq(schema.requests.userId, userId), inArray(schema.requests.status, TERMINAL as ("completed" | "rejected" | "escalated")[])))
    .orderBy(desc(schema.requests.updatedAt))
    .all();
  const seen = new Set<number>();
  return [...rows, ...closed].filter((r) => (seen.has(r.req.id) ? false : (seen.add(r.req.id), true)));
}

export function parseLinks(row: InboxMail): Array<{ url: string; label: string }> {
  try {
    return JSON.parse(row.links);
  } catch {
    return [];
  }
}

export function parseHints(row: InboxMail): ActionHint[] {
  try {
    return JSON.parse(row.hints);
  } catch {
    return [];
  }
}
