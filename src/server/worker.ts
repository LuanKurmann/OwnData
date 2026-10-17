import "server-only";
import { and, eq, inArray, isNotNull, lt } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { MailAccount, Request } from "@/db/schema";
import { LEGAL } from "@/lib/legal";
import { render, varsFromRequest } from "@/lib/template-render";
import { sendMail } from "./mail/smtp";
import { fetchNewMail } from "./mail/imap";
import { getProfile, reminderKey, resolveTemplate } from "./requests";
import { ingestMail } from "./inbox";

export type WorkerReport = {
  startedAt: string;
  finishedAt: string;
  sent: number;
  failed: number;
  inboundMatched: number;
  /** stored in the inbox for manual assignment */
  inboundIgnored: number;
  remindersSent: number;
  overdueMarked: number;
  escalationReady: number;
  errors: string[];
};

const g = globalThis as unknown as { __owndataWorkerRunning?: boolean };

async function log(userId: number | null, requestId: number | null, event: string, detail = "", level: "info" | "warn" | "error" = "info") {
  await (await getDb()).insert(schema.activityLog).values({ userId, requestId, event, detail, level }).run();
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
    const db = await getDb();
    const accounts = await db
      .select()
      .from(schema.mailAccounts)
      .where(onlyUserId ? eq(schema.mailAccounts.userId, onlyUserId) : undefined)
      .all();

    for (const acc of accounts) {
      await sendQueued(acc, report);
      await markDeadlines(acc.userId, report);
      await sendReminders(acc, report);
      if (acc.imapEnabled && acc.imapHost) await pollInbox(acc, report);
    }
    // users without mail account still get deadline bookkeeping
    if (!onlyUserId) {
      const withAcc = new Set(accounts.map((a) => a.userId));
      for (const u of await db.select({ id: schema.users.id }).from(schema.users).all()) {
        if (!withAcc.has(u.id)) await markDeadlines(u.id, report);
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
  const db = await getDb();
  const queued = await db
    .select()
    .from(schema.requests)
    .where(and(eq(schema.requests.userId, acc.userId), eq(schema.requests.status, "queued")))
    .all();
  for (const req of queued) {
    try {
      const { messageId } = await sendMail(acc, { to: req.toEmail, subject: req.subject, text: req.body });
      const now = new Date();
      const days = LEGAL[req.jurisdiction].deadlineDays[req.type];
      await db.update(schema.requests)
        .set({ status: "sent", sentAt: now, deadlineAt: addDays(now, days), lastError: null, updatedAt: now })
        .where(eq(schema.requests.id, req.id))
        .run();
      await db.insert(schema.messages)
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
      await log(acc.userId, req.id, "request.sent", `${req.toEmail} (${messageId})`);
      report.sent++;
      await db.update(schema.mailAccounts).set({ smtpLastError: null }).where(eq(schema.mailAccounts.id, acc.id)).run();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await db.update(schema.requests)
        .set({ status: "failed", lastError: msg, updatedAt: new Date() })
        .where(eq(schema.requests.id, req.id))
        .run();
      await db.update(schema.mailAccounts).set({ smtpLastError: msg }).where(eq(schema.mailAccounts.id, acc.id)).run();
      await log(acc.userId, req.id, "request.failed", msg, "error");
      report.failed++;
      report.errors.push(`send ${req.reference}: ${msg}`);
    }
  }
}

async function markDeadlines(userId: number, report: WorkerReport) {
  const db = await getDb();
  const now = new Date();
  // sent/acknowledged past deadline -> overdue
  const overdue = await db
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
    await db.update(schema.requests).set({ status: "overdue", updatedAt: now }).where(eq(schema.requests.id, r.id)).run();
    await log(userId, r.id, "request.overdue", r.reference, "warn");
    report.overdueMarked++;
  }
  // reminded past escalation deadline -> escalation_ready
  const esc = await db
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
    await db.update(schema.requests).set({ status: "escalation_ready", updatedAt: now }).where(eq(schema.requests.id, r.id)).run();
    await log(userId, r.id, "request.escalation_ready", r.reference, "warn");
    report.escalationReady++;
  }
}

export async function sendReminderFor(acc: MailAccount, req: Request): Promise<void> {
  const db = await getDb();
  const broker = await db.select().from(schema.brokers).where(eq(schema.brokers.id, req.brokerId)).get();
  if (!broker) throw new Error("broker missing");
  const tpl = await resolveTemplate(acc.userId, reminderKey(req.language));
  if (!tpl) throw new Error("reminder template missing");
  const profile = await getProfile(acc.userId);
  const vars = varsFromRequest(req, broker, profile, acc.fromEmail);
  const subject = render(tpl.subject, vars);
  const body = render(tpl.body, vars);
  const original = await db
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
  await db.update(schema.requests)
    .set({ status: "reminded", reminderSentAt: now, escalationDeadlineAt: addDays(now, grace), updatedAt: now })
    .where(eq(schema.requests.id, req.id))
    .run();
  await db.insert(schema.messages)
    .values({ requestId: req.id, direction: "out", kind: "reminder", fromAddr: acc.fromEmail, toAddr: req.toEmail, subject, body, messageId, occurredAt: now })
    .run();
  await log(acc.userId, req.id, "reminder.sent", req.toEmail);
}

async function sendReminders(acc: MailAccount, report: WorkerReport) {
  const db = await getDb();
  const due = await db
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
      await log(acc.userId, req.id, "reminder.failed", msg, "error");
      report.errors.push(`reminder ${req.reference}: ${msg}`);
    }
  }
}

async function pollInbox(acc: MailAccount, report: WorkerReport) {
  const db = await getDb();
  try {
    const { mails, lastUid } = await fetchNewMail(acc, acc.imapLastUid);
    for (const mail of mails) {
      const res = await ingestMail(acc.userId, mail, acc.fromEmail);
      if (res.duplicate) continue;
      if (res.matched) report.inboundMatched++;
      else report.inboundIgnored++;
    }
    await db
      .update(schema.mailAccounts)
      .set({ imapLastUid: lastUid, imapLastPollAt: new Date(), imapLastError: null })
      .where(eq(schema.mailAccounts.id, acc.id))
      .run();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await db.update(schema.mailAccounts).set({ imapLastError: msg, imapLastPollAt: new Date() }).where(eq(schema.mailAccounts.id, acc.id)).run();
    await log(acc.userId, null, "imap.failed", msg, "error");
    report.errors.push(`imap ${acc.fromEmail}: ${msg}`);
  }
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
