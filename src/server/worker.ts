import "server-only";
import { and, eq, inArray, isNotNull, lt, or } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { MailAccount, Request } from "@/db/schema";
import { LEGAL } from "@/lib/legal";
import { REFERENCE_REGEX } from "@/lib/reference";
import { classifyReply, isAutoReply } from "@/lib/classify";
import { render, varsFromRequest } from "@/lib/template-render";
import { sendMail } from "./mail/smtp";
import { fetchNewMail } from "./mail/imap";
import { getProfile, reminderKey, resolveTemplate } from "./requests";

export type WorkerReport = {
  startedAt: string;
  finishedAt: string;
  sent: number;
  failed: number;
  inboundMatched: number;
  inboundIgnored: number;
  remindersSent: number;
  overdueMarked: number;
  escalationReady: number;
  errors: string[];
};

const g = globalThis as unknown as { __owndataWorkerRunning?: boolean };

function log(userId: number | null, requestId: number | null, event: string, detail = "", level: "info" | "warn" | "error" = "info") {
  getDb().insert(schema.activityLog).values({ userId, requestId, event, detail, level }).run();
}

function addDays(d: Date, days: number) {
  return new Date(d.getTime() + days * 86400000);
}

export async function runWorker(onlyUserId?: number): Promise<WorkerReport> {
  const report: WorkerReport = {
    startedAt: new Date().toISOString(),
    finishedAt: "",
    sent: 0,
    failed: 0,
    inboundMatched: 0,
    inboundIgnored: 0,
    remindersSent: 0,
    overdueMarked: 0,
    escalationReady: 0,
    errors: [],
  };
  if (g.__owndataWorkerRunning) {
    report.errors.push("worker already running");
    report.finishedAt = new Date().toISOString();
    return report;
  }
  g.__owndataWorkerRunning = true;
  try {
    const db = getDb();
    const accounts = db
      .select()
      .from(schema.mailAccounts)
      .where(onlyUserId ? eq(schema.mailAccounts.userId, onlyUserId) : undefined)
      .all();

    for (const acc of accounts) {
      await sendQueued(acc, report);
      markDeadlines(acc.userId, report);
      await sendReminders(acc, report);
      if (acc.imapEnabled && acc.imapHost) await pollInbox(acc, report);
    }
    // users without mail account still get deadline bookkeeping
    if (!onlyUserId) {
      const withAcc = new Set(accounts.map((a) => a.userId));
      for (const u of db.select({ id: schema.users.id }).from(schema.users).all()) {
        if (!withAcc.has(u.id)) markDeadlines(u.id, report);
      }
    }
  } catch (e) {
    report.errors.push(String(e instanceof Error ? e.message : e));
  } finally {
    g.__owndataWorkerRunning = false;
    report.finishedAt = new Date().toISOString();
  }
  return report;
}

async function sendQueued(acc: MailAccount, report: WorkerReport) {
  const db = getDb();
  const queued = db
    .select()
    .from(schema.requests)
    .where(and(eq(schema.requests.userId, acc.userId), eq(schema.requests.status, "queued")))
    .all();
  for (const req of queued) {
    try {
      const { messageId } = await sendMail(acc, { to: req.toEmail, subject: req.subject, text: req.body });
      const now = new Date();
      const days = LEGAL[req.jurisdiction].deadlineDays[req.type];
      db.update(schema.requests)
        .set({ status: "sent", sentAt: now, deadlineAt: addDays(now, days), lastError: null, updatedAt: now })
        .where(eq(schema.requests.id, req.id))
        .run();
      db.insert(schema.messages)
        .values({
          requestId: req.id,
          direction: "out",
          kind: "request",
          fromAddr: acc.fromEmail,
          toAddr: req.toEmail,
          subject: req.subject,
          body: req.body,
          messageId,
          occurredAt: now,
        })
        .run();
      log(acc.userId, req.id, "request.sent", `${req.toEmail} (${messageId})`);
      report.sent++;
      db.update(schema.mailAccounts).set({ smtpLastError: null }).where(eq(schema.mailAccounts.id, acc.id)).run();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      db.update(schema.requests)
        .set({ status: "failed", lastError: msg, updatedAt: new Date() })
        .where(eq(schema.requests.id, req.id))
        .run();
      db.update(schema.mailAccounts).set({ smtpLastError: msg }).where(eq(schema.mailAccounts.id, acc.id)).run();
      log(acc.userId, req.id, "request.failed", msg, "error");
      report.failed++;
      report.errors.push(`send ${req.reference}: ${msg}`);
    }
  }
}

function markDeadlines(userId: number, report: WorkerReport) {
  const db = getDb();
  const now = new Date();
  // sent/acknowledged past deadline -> overdue
  const overdue = db
    .select()
    .from(schema.requests)
    .where(
      and(
        eq(schema.requests.userId, userId),
        inArray(schema.requests.status, ["sent", "acknowledged"]),
        isNotNull(schema.requests.deadlineAt),
        lt(schema.requests.deadlineAt, now),
      ),
    )
    .all();
  for (const r of overdue) {
    db.update(schema.requests).set({ status: "overdue", updatedAt: now }).where(eq(schema.requests.id, r.id)).run();
    log(userId, r.id, "request.overdue", r.reference, "warn");
    report.overdueMarked++;
  }
  // reminded past escalation deadline -> escalation_ready
  const esc = db
    .select()
    .from(schema.requests)
    .where(
      and(
        eq(schema.requests.userId, userId),
        eq(schema.requests.status, "reminded"),
        isNotNull(schema.requests.escalationDeadlineAt),
        lt(schema.requests.escalationDeadlineAt, now),
      ),
    )
    .all();
  for (const r of esc) {
    db.update(schema.requests).set({ status: "escalation_ready", updatedAt: now }).where(eq(schema.requests.id, r.id)).run();
    log(userId, r.id, "request.escalation_ready", r.reference, "warn");
    report.escalationReady++;
  }
}

export async function sendReminderFor(acc: MailAccount, req: Request): Promise<void> {
  const db = getDb();
  const broker = db.select().from(schema.brokers).where(eq(schema.brokers.id, req.brokerId)).get();
  if (!broker) throw new Error("broker missing");
  const tpl = resolveTemplate(acc.userId, reminderKey(req.language));
  if (!tpl) throw new Error("reminder template missing");
  const profile = getProfile(acc.userId);
  const vars = varsFromRequest(req, broker, profile, acc.fromEmail);
  const subject = render(tpl.subject, vars);
  const body = render(tpl.body, vars);
  const original = db
    .select()
    .from(schema.messages)
    .where(and(eq(schema.messages.requestId, req.id), eq(schema.messages.direction, "out")))
    .orderBy(schema.messages.occurredAt)
    .get();
  const { messageId } = await sendMail(acc, {
    to: req.toEmail,
    subject,
    text: body,
    inReplyTo: original?.messageId,
    references: original?.messageId ? [original.messageId] : [],
  });
  const now = new Date();
  const grace = LEGAL[req.jurisdiction].escalationGraceDays;
  db.update(schema.requests)
    .set({ status: "reminded", reminderSentAt: now, escalationDeadlineAt: addDays(now, grace), updatedAt: now })
    .where(eq(schema.requests.id, req.id))
    .run();
  db.insert(schema.messages)
    .values({ requestId: req.id, direction: "out", kind: "reminder", fromAddr: acc.fromEmail, toAddr: req.toEmail, subject, body, messageId, occurredAt: now })
    .run();
  log(acc.userId, req.id, "reminder.sent", req.toEmail);
}

async function sendReminders(acc: MailAccount, report: WorkerReport) {
  const db = getDb();
  const due = db
    .select()
    .from(schema.requests)
    .where(and(eq(schema.requests.userId, acc.userId), eq(schema.requests.status, "overdue"), eq(schema.requests.autoRemind, true)))
    .all();
  for (const req of due) {
    try {
      await sendReminderFor(acc, req);
      report.remindersSent++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log(acc.userId, req.id, "reminder.failed", msg, "error");
      report.errors.push(`reminder ${req.reference}: ${msg}`);
    }
  }
}

async function pollInbox(acc: MailAccount, report: WorkerReport) {
  const db = getDb();
  try {
    const { mails, lastUid } = await fetchNewMail(acc, acc.imapLastUid);
    for (const mail of mails) {
      const matched = matchRequest(acc.userId, mail.inReplyTo, mail.references, mail.subject, mail.text, mail.from);
      if (!matched) {
        report.inboundIgnored++;
        continue;
      }
      if (isAutoReply(mail.subject, mail.headers)) {
        // store but don't change status
        db.insert(schema.messages)
          .values({
            requestId: matched.id,
            direction: "in",
            kind: "reply",
            fromAddr: mail.from,
            toAddr: mail.to,
            subject: mail.subject,
            body: mail.text.slice(0, 20000),
            messageId: mail.messageId,
            inReplyTo: mail.inReplyTo,
            classification: "auto_reply",
            occurredAt: mail.date,
          })
          .run();
        report.inboundMatched++;
        continue;
      }
      const cls = classifyReply(mail.subject, mail.text);
      db.insert(schema.messages)
        .values({
          requestId: matched.id,
          direction: "in",
          kind: "reply",
          fromAddr: mail.from,
          toAddr: mail.to,
          subject: mail.subject,
          body: mail.text.slice(0, 20000),
          messageId: mail.messageId,
          inReplyTo: mail.inReplyTo,
          classification: cls,
          occurredAt: mail.date,
        })
        .run();
      const now = new Date();
      const patch: Partial<Request> = { lastResponseAt: mail.date, updatedAt: now };
      const terminal = ["completed", "rejected", "escalated"].includes(matched.status);
      if (!terminal) {
        if (cls === "completed") Object.assign(patch, { status: "completed", closedAt: now });
        else if (cls === "rejected") Object.assign(patch, { status: "rejected", closedAt: now });
        else if (cls === "needs_info") Object.assign(patch, { status: "needs_info" });
        else if (cls === "acknowledged" && ["sent", "overdue"].includes(matched.status)) Object.assign(patch, { status: "acknowledged" });
        // unknown: keep status; the user reviews it in the UI
      }
      db.update(schema.requests).set(patch).where(eq(schema.requests.id, matched.id)).run();
      log(acc.userId, matched.id, "reply.received", `${cls} from ${mail.from}`);
      report.inboundMatched++;
    }
    db.update(schema.mailAccounts)
      .set({ imapLastUid: lastUid, imapLastPollAt: new Date(), imapLastError: null })
      .where(eq(schema.mailAccounts.id, acc.id))
      .run();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    db.update(schema.mailAccounts).set({ imapLastError: msg, imapLastPollAt: new Date() }).where(eq(schema.mailAccounts.id, acc.id)).run();
    log(acc.userId, null, "imap.failed", msg, "error");
    report.errors.push(`imap ${acc.fromEmail}: ${msg}`);
  }
}

function matchRequest(userId: number, inReplyTo: string | null, references: string[], subject: string, text: string, from: string): Request | null {
  const db = getDb();
  // 1) threading headers
  const ids = [inReplyTo, ...references].filter((x): x is string => !!x);
  if (ids.length) {
    const out = db
      .select({ requestId: schema.messages.requestId })
      .from(schema.messages)
      .where(and(eq(schema.messages.direction, "out"), inArray(schema.messages.messageId, ids)))
      .get();
    if (out) {
      const req = db.select().from(schema.requests).where(and(eq(schema.requests.id, out.requestId), eq(schema.requests.userId, userId))).get();
      if (req) return req;
    }
  }
  // 2) reference code in subject or body
  const refs = new Set([...(subject.match(REFERENCE_REGEX) ?? []), ...(text.slice(0, 5000).match(REFERENCE_REGEX) ?? [])]);
  for (const ref of refs) {
    const req = db.select().from(schema.requests).where(and(eq(schema.requests.reference, ref), eq(schema.requests.userId, userId))).get();
    if (req) return req;
  }
  // 3) sender domain matches an open request's recipient domain (single candidate only)
  const fromDomain = from.match(/@([a-z0-9.-]+)/i)?.[1]?.toLowerCase();
  if (fromDomain) {
    const open = db
      .select()
      .from(schema.requests)
      .where(
        and(
          eq(schema.requests.userId, userId),
          or(
            inArray(schema.requests.status, ["sent", "acknowledged", "needs_info", "overdue", "reminded", "escalation_ready"]),
          ),
        ),
      )
      .all()
      .filter((r) => r.toEmail.toLowerCase().endsWith("@" + fromDomain) || r.toEmail.toLowerCase().endsWith("." + fromDomain));
    if (open.length === 1) return open[0];
  }
  return null;
}

/** Start the periodic worker once per process. */
export function startScheduler() {
  const gg = globalThis as unknown as { __owndataScheduler?: NodeJS.Timeout };
  if (gg.__owndataScheduler) return;
  const minutes = Number(process.env.WORKER_INTERVAL_MINUTES ?? "10");
  if (!minutes || minutes <= 0) return;
  const tick = () =>
    runWorker()
      .then((r) => {
        if (r.sent || r.remindersSent || r.inboundMatched || r.errors.length) console.log("[owndata worker]", JSON.stringify(r));
      })
      .catch((e) => console.error("[owndata worker]", e));
  gg.__owndataScheduler = setInterval(tick, minutes * 60 * 1000);
  setTimeout(tick, 15_000);
  console.log(`[owndata] worker scheduled every ${minutes} min`);
}
