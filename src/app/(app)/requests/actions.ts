"use server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { REQUEST_STATUSES } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { redirectFlash } from "@/lib/flash";
import { getMailAccount } from "@/server/requests";
import { runWorker, sendReminderFor } from "@/server/worker";

async function ownRequest(id: number) {
  const user = await requireUser();
  const req = await (await getDb()).select().from(schema.requests).where(and(eq(schema.requests.id, id), eq(schema.requests.userId, user.id))).get();
  if (!req) redirectFlash("/requests", "invalid", "err");
  return { user, req };
}

async function log(userId: number, requestId: number, event: string, detail = "") {
  await (await getDb()).insert(schema.activityLog).values({ userId, requestId, event, detail }).run();
}

export async function updateDraftAction(formData: FormData) {
  const id = Number(formData.get("id"));
  const { user, req } = await ownRequest(id);
  const parsed = z.object({ toEmail: z.string().email(), subject: z.string().min(1).max(500), body: z.string().min(1).max(50000) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirectFlash(`/requests/${id}`, "invalid", "err");
  if (!["draft", "failed", "queued"].includes(req.status)) redirectFlash(`/requests/${id}`, "invalid", "err");
  await (await getDb()).update(schema.requests).set({ ...parsed.data, updatedAt: new Date() }).where(eq(schema.requests.id, id)).run();
  await log(user.id, id, "request.edited");
  revalidatePath(`/requests/${id}`);
  redirectFlash(`/requests/${id}`, "saved");
}

export async function queueAction(formData: FormData) {
  const id = Number(formData.get("id"));
  const sendNow = formData.get("now") === "1";
  const { user, req } = await ownRequest(id);
  if (!(await getMailAccount(user.id))) redirectFlash("/settings/mail", "noMail", "err");
  if (!["draft", "failed", "queued"].includes(req.status)) redirectFlash(`/requests/${id}`, "invalid", "err");
  await (await getDb()).update(schema.requests).set({ status: "queued", lastError: null, updatedAt: new Date() }).where(eq(schema.requests.id, id)).run();
  await log(user.id, id, "request.queued");
  if (sendNow) {
    const r = await runWorker(user.id);
    revalidatePath(`/requests/${id}`);
    if (r.errors.length) redirectFlash(`/requests/${id}`, "workerErrors", "err", { errors: r.errors.join("; ").slice(0, 300) });
    redirectFlash(`/requests/${id}`, "workerDone", "ok", { sent: r.sent, reminders: r.remindersSent, inbound: r.inboundMatched, failed: r.failed });
  }
  revalidatePath(`/requests/${id}`);
  redirectFlash(`/requests/${id}`, "queued", "ok", { count: 1 });
}

export async function reminderAction(formData: FormData) {
  const id = Number(formData.get("id"));
  const { user, req } = await ownRequest(id);
  const acc = await getMailAccount(user.id);
  if (!acc) redirectFlash("/settings/mail", "noMail", "err");
  try {
    await sendReminderFor(acc, req);
  } catch (e) {
    redirectFlash(`/requests/${id}`, "error", "err", { error: (e instanceof Error ? e.message : String(e)).slice(0, 200) });
  }
  revalidatePath(`/requests/${id}`);
  redirectFlash(`/requests/${id}`, "reminderSent");
}

export async function setStatusAction(formData: FormData) {
  const id = Number(formData.get("id"));
  const { user } = await ownRequest(id);
  const status = z.enum(REQUEST_STATUSES).safeParse(formData.get("status"));
  if (!status.success) redirectFlash(`/requests/${id}`, "invalid", "err");
  const closed = ["completed", "rejected", "escalated"].includes(status.data);
  await (await getDb())
    .update(schema.requests)
    .set({ status: status.data, closedAt: closed ? new Date() : null, updatedAt: new Date() })
    .where(eq(schema.requests.id, id))
    .run();
  await log(user.id, id, "request.status", status.data);
  revalidatePath(`/requests/${id}`);
  revalidatePath("/requests");
  redirectFlash(`/requests/${id}`, "saved");
}

export async function saveNotesAction(formData: FormData) {
  const id = Number(formData.get("id"));
  await ownRequest(id);
  const notes = String(formData.get("notes") ?? "").slice(0, 10000);
  const autoRemind = formData.get("autoRemind") === "on";
  await (await getDb()).update(schema.requests).set({ notes, autoRemind, updatedAt: new Date() }).where(eq(schema.requests.id, id)).run();
  revalidatePath(`/requests/${id}`);
  redirectFlash(`/requests/${id}`, "saved");
}

export async function deleteRequestAction(formData: FormData) {
  const id = Number(formData.get("id"));
  await ownRequest(id);
  const db = await getDb();
  await db.delete(schema.messages).where(eq(schema.messages.requestId, id)).run();
  await db.delete(schema.activityLog).where(eq(schema.activityLog.requestId, id)).run();
  await db.delete(schema.requests).where(eq(schema.requests.id, id)).run();
  revalidatePath("/requests");
  redirectFlash("/requests", "deleted");
}
