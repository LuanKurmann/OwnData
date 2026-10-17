import "server-only";
import { and, desc, eq, inArray, isNotNull, isNull, lt } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { MailAccount, Request } from "@/db/schema";
import { LEGAL } from "@/lib/legal";
import { render, varsFromRequest } from "@/lib/template-render";
import { pickConfirmationLinks, visitLink } from "@/lib/automation";
import { sendMail } from "./mail/smtp";
import { fetchNewMail } from "./mail/imap";
import { followupKey, getProfile, reminderKey, resolveTemplate } from "./requests";
import { addFormAction, ingestMail, markHandled, parseHints, parseLinks } from "./inbox";

export type WorkerTrigger = "cron" | "manual" | "send" | "scheduler" | "api";

export type WorkerReport = {
  runId: number | null;
  trigger: WorkerTrigger;
  startedAt: string;
  finishedAt: string;
  sent: number;
  failed: number;
  inboundMatched: number;
  /** stored in the inbox for manual assignment */
  inboundIgnored: number;
  remindersSent: number;
  autoActions: number;
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

export async function runWorker(onlyUserId?: number, trigger: WorkerTrigger = "manual"): Promise<WorkerReport> {
  const report: WorkerReport = {
    runId: null,
    trigger,
    startedAt: new Date().toISOString(),
    finishedAt: "",
    sent: 0,
    failed: 0,
    inboundMatched: 0,
    inboundIgnored: 0,
    remindersSent: 0,
    autoActions: 0,
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
  const db = await getDb();
  const run = await db.insert(schema.workerRuns).values({ userId: onlyUserId ?? null, trigger }).returning({ id: schema.workerRuns.id }).get();
  report.runId = run.id;
  try {
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
      await runAutomations(acc, report);
      // automations may have queued new mails (resend / follow-up): deliver them in the same run
      await sendQueued(acc, report);
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
    await db
      .update(schema.workerRuns)
      .set({
        finishedAt: new Date(),
        sent: report.sent,
        failed: report.failed,
        inboundMatched: report.inboundMatched,
        inboundUnmatched: report.inboundIgnored,
        remindersSent: report.remindersSent,
        autoActions: report.autoActions,
        overdueMarked: report.overdueMarked + report.escalationReady,
        errors: JSON.stringify(report.errors),
      })
      .where(eq(schema.workerRuns.id, run.id))
      .run();
  }
  return report;
}

async function sendQueued(acc: MailAccount, report: WorkerReport) {
  const db = await getDb();
  const queued = await db
    .select({ req: schema.requests, broker: schema.brokers })
    .from(schema.requests)
    .innerJoin(schema.brokers, eq(schema.brokers.id, schema.requests.brokerId))
    .where(and(eq(schema.requests.userId, acc.userId), eq(schema.requests.status, "queued")))
    .all();
  for (const { req, broker } of queued) {
    // the broker entry may have been corrected to "form only" since the request was created
    if (!req.toEmail && broker.preferredChannel === "form" && broker.optOutUrl) {
      await db.update(schema.requests).set({ status: "action_required", updatedAt: new Date() }).where(eq(schema.requests.id, req.id)).run();
      await addFormAction(acc.userId, req.id, broker);
      await log(acc.userId, req.id, "request.form_only", broker.optOutUrl);
      continue;
    }
    try {
      const res = await sendMail(acc, { to: req.toEmail, subject: req.subject, text: req.body });
      const now = new Date();
      const days = LEGAL[req.jurisdiction].deadlineDays[req.type];
      await db
        .update(schema.requests)
        .set({ status: "sent", sentAt: now, deadlineAt: addDays(now, days), lastError: null, updatedAt: now })
        .where(eq(schema.requests.id, req.id))
        .run();
      await db
        .insert(schema.messages)
        .values({
          requestId: req.id,
          direction: "out",
          kind: req.resendCount > 0 ? "request" : "request",
          fromAddr: acc.fromEmail,
          toAddr: req.toEmail,
          subject: req.subject,
          body: req.body,
          messageId: res.messageId,
          occurredAt: now,
        })
        .run();
      const copy = res.sentCopy === "stored" ? "Kopie in Gesendet" : res.sentCopy === "failed" ? `Kopie fehlgeschlagen: ${res.sentCopyError}` : "";
      await log(acc.userId, req.id, "request.sent", `${req.toEmail} · ${res.messageId}${copy ? " · " + copy : ""}`, res.sentCopy === "failed" ? "warn" : "info");
      report.sent++;
      await db.update(schema.mailAccounts).set({ smtpLastError: null }).where(eq(schema.mailAccounts.id, acc.id)).run();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await db
        .update(schema.requests)
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

/** Thread headers for a follow-up: reply to the latest inbound mail, reference everything we sent. */
async function threadHeaders(req: Request): Promise<{ inReplyTo: string | null; references: string[] }> {
  const db = await getDb();
  const ours = await db
    .select({ messageId: schema.messages.messageId })
    .from(schema.messages)
    .where(and(eq(schema.messages.requestId, req.id), eq(schema.messages.direction, "out")))
    .orderBy(schema.messages.occurredAt)
    .all();
  const refs = ours.map((m) => m.messageId).filter((x): x is string => !!x);
  const latestIn = (
    await db
      .select({ messageId: schema.inbox.messageId, classification: schema.inbox.classification })
      .from(schema.inbox)
      .where(and(eq(schema.inbox.requestId, req.id), isNotNull(schema.inbox.messageId)))
      .orderBy(desc(schema.inbox.receivedAt))
      .all()
  ).find((m) => !["bounced", "auto_reply"].includes(m.classification));
  if (latestIn?.messageId) refs.push(latestIn.messageId);
  return { inReplyTo: latestIn?.messageId ?? refs[0] ?? null, references: refs };
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
  const { inReplyTo, references } = await threadHeaders(req);
  const res = await sendMail(acc, { to: req.toEmail, subject, text: body, inReplyTo, references });
  const now = new Date();
  const grace = LEGAL[req.jurisdiction].escalationGraceDays;
  await db
    .update(schema.requests)
    .set({ status: "reminded", reminderSentAt: now, escalationDeadlineAt: addDays(now, grace), updatedAt: now })
    .where(eq(schema.requests.id, req.id))
    .run();
  await db
    .insert(schema.messages)
    .values({ requestId: req.id, direction: "out", kind: "reminder", fromAddr: acc.fromEmail, toAddr: req.toEmail, subject, body, messageId: res.messageId, inReplyTo, occurredAt: now })
    .run();
  await log(acc.userId, req.id, "reminder.sent", `${req.toEmail} · ${res.messageId}${res.sentCopy === "stored" ? " · Kopie in Gesendet" : ""}`);
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
      const res = await ingestMail(acc.userId, mail, acc.fromEmail, { autoResend: acc.autoResend });
      if (res.duplicate) continue;
      if (res.matched) report.inboundMatched++;
      else report.inboundIgnored++;
      if (res.auto) report.autoActions++;
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

/**
 * Automatic handling of broker replies:
 *  - identity / additional-info questions get the matching follow-up template (once per request)
 *  - "click to confirm your request" links are opened server-side and the result is recorded
 */
async function runAutomations(acc: MailAccount, report: WorkerReport) {
  if (!acc.autoFollowup && !acc.autoConfirmLinks) return;
  const db = await getDb();
  const pending = await db
    .select({ mail: schema.inbox, req: schema.requests })
    .from(schema.inbox)
    .innerJoin(schema.requests, eq(schema.requests.id, schema.inbox.requestId))
    .where(
      and(
        eq(schema.inbox.userId, acc.userId),
        isNull(schema.inbox.handledAt),
        inArray(schema.inbox.classification, ["needs_info", "action_required"]),
        inArray(schema.requests.status, ["needs_info", "action_required"]),
      ),
    )
    .orderBy(schema.inbox.receivedAt)
    .all();

  for (const { mail, req } of pending) {
    const hints = parseHints(mail);
    const links = parseLinks(mail);
    const now = new Date();

    // 1) confirmation links
    if (acc.autoConfirmLinks && hints.includes("confirm_request") && links.length) {
      const candidates = pickConfirmationLinks(links);
      for (const link of candidates) {
        const result = await visitLink(link.url);
        await log(acc.userId, req.id, result.ok ? "auto.confirm" : "auto.confirm_failed", `${link.url} → HTTP ${result.status}${result.title ? " · " + result.title : ""}${result.snippet ? " · " + result.snippet.slice(0, 160) : ""}${result.error ? " · " + result.error : ""}`, result.ok ? "info" : "warn");
        report.autoActions++;
        if (result.ok) {
          await markHandled(acc.userId, mail.id);
          await db.update(schema.requests).set({ status: "acknowledged", updatedAt: now }).where(eq(schema.requests.id, req.id)).run();
        }
      }
      if (candidates.length) continue;
    }

    // 2) identity / info follow-ups (never when the broker insists on a form)
    if (acc.autoFollowup && !hints.includes("fill_form") && !req.autoFollowupAt && req.toEmail && mail.fromAddr !== "owndata") {
      const kind = hints.includes("verify_identity") ? "identity" : hints.includes("provide_info") ? "info" : null;
      if (!kind) continue;
      try {
        const broker = await db.select().from(schema.brokers).where(eq(schema.brokers.id, req.brokerId)).get();
        const tpl = await resolveTemplate(acc.userId, followupKey(kind, req.language));
        if (!broker || !tpl) continue;
        const profile = await getProfile(acc.userId);
        const vars = varsFromRequest(req, broker, profile, acc.fromEmail);
        const subject = mail.subject ? `Re: ${mail.subject.replace(/^(re|aw|wg|fwd?):\s*/i, "")}` : render(tpl.subject, vars);
        const body = render(tpl.body, vars);
        const { inReplyTo, references } = await threadHeaders(req);
        const res = await sendMail(acc, { to: req.toEmail, subject, text: body, inReplyTo, references });
        await db
          .insert(schema.messages)
          .values({ requestId: req.id, direction: "out", kind: "reply", fromAddr: acc.fromEmail, toAddr: req.toEmail, subject, body, messageId: res.messageId, inReplyTo, occurredAt: now })
          .run();
        await markHandled(acc.userId, mail.id);
        await db.update(schema.requests).set({ status: "acknowledged", autoFollowupAt: now, updatedAt: now }).where(eq(schema.requests.id, req.id)).run();
        await log(acc.userId, req.id, "auto.followup", `${kind} → ${req.toEmail} · ${res.messageId}`);
        report.autoActions++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await log(acc.userId, req.id, "auto.followup_failed", msg, "error");
        report.errors.push(`auto-followup ${req.reference}: ${msg}`);
      }
    }
  }
}

/** Start the periodic worker once per process. */
export function startScheduler() {
  const gg = globalThis as unknown as { __owndataScheduler?: NodeJS.Timeout };
  if (gg.__owndataScheduler) return;
  const minutes = Number(process.env.WORKER_INTERVAL_MINUTES ?? "10");
  if (!minutes || minutes <= 0) return;
  const tick = () =>
    runWorker(undefined, "scheduler")
      .then((r) => {
        if (r.sent || r.remindersSent || r.inboundMatched || r.autoActions || r.errors.length) console.log("[owndata worker]", JSON.stringify(r));
      })
      .catch((e) => console.error("[owndata worker]", e));
  gg.__owndataScheduler = setInterval(tick, minutes * 60 * 1000);
  setTimeout(tick, 15_000);
  console.log(`[owndata] worker scheduled every ${minutes} min`);
}
