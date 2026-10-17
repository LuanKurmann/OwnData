"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { clearSession, getCurrentUser } from "@/lib/auth";
import { LOCALES, type Locale } from "@/i18n/config";
import { runWorker } from "@/server/worker";
import { redirectFlash } from "@/lib/flash";

export async function setLocaleAction(formData: FormData) {
  const locale = String(formData.get("locale"));
  if (!LOCALES.includes(locale as Locale)) return;
  const store = await cookies();
  store.set("locale", locale, { path: "/", maxAge: 365 * 24 * 3600, sameSite: "lax" });
  const user = await getCurrentUser();
  if (user) await (await getDb()).update(schema.users).set({ locale: locale as Locale }).where(eq(schema.users.id, user.id)).run();
  revalidatePath("/", "layout");
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}

export async function runWorkerAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const back = String(formData.get("back") || "/dashboard");
  const r = await runWorker(user.id, "manual");
  revalidatePath("/", "layout");
  if (r.errors.length) {
    redirectFlash(back, "workerErrors", "err", { errors: r.errors.join("; ").slice(0, 300) });
  }
  redirectFlash(back, "workerDone", "ok", { sent: r.sent, reminders: r.remindersSent, inbound: r.inboundMatched, failed: r.failed });
}
