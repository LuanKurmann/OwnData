"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { redirectFlash } from "@/lib/flash";
import { assignInboxMail, setInboxStatus } from "@/server/inbox";

export async function assignAction(formData: FormData) {
  const user = await requireUser();
  const inboxId = Number(formData.get("inboxId"));
  const requestId = Number(formData.get("requestId"));
  if (!inboxId || !requestId) redirectFlash("/inbox", "invalid", "err");
  const ok = await assignInboxMail(user.id, inboxId, requestId, formData.get("learn") !== "off");
  revalidatePath("/inbox");
  revalidatePath(`/requests/${requestId}`);
  if (!ok) redirectFlash("/inbox", "invalid", "err");
  redirectFlash("/inbox", "assigned", "ok", { id: requestId });
}

export async function ignoreAction(formData: FormData) {
  const user = await requireUser();
  const inboxId = Number(formData.get("inboxId"));
  await setInboxStatus(user.id, inboxId, "ignored");
  revalidatePath("/inbox");
  redirectFlash("/inbox", "ignored");
}

export async function unignoreAction(formData: FormData) {
  const user = await requireUser();
  const inboxId = Number(formData.get("inboxId"));
  await setInboxStatus(user.id, inboxId, "unmatched");
  revalidatePath("/inbox");
  redirectFlash("/inbox?tab=ignored", "saved");
}
