"use server";
import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema, } from "@/db";
import { BROKER_CATEGORIES, JURISDICTIONS, REQUEST_TYPES } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { redirectFlash } from "@/lib/flash";
import { discoverPrivacyContact } from "@/lib/discover";
import { createRequests, getMailAccount, getProfile } from "@/server/requests";
import { runWorker } from "@/server/worker";

export async function createRequestsAction(formData: FormData) {
  const user = await requireUser();
  const ids = formData.getAll("brokerId").map(Number).filter((n) => Number.isInteger(n) && n > 0);
  const type = z.enum(REQUEST_TYPES).catch("erasure").parse(formData.get("type"));
  const mode = String(formData.get("mode")) === "draft" ? "draft" : "queue";
  const sendNow = String(formData.get("mode")) === "send";
  if (ids.length === 0) redirectFlash("/brokers", "invalid", "err");
  const profile = await getProfile(user.id);
  if (!profile.lastName && !profile.fullName) redirectFlash("/profile", "noProfile", "err");
  if (mode === "queue" && !(await getMailAccount(user.id))) redirectFlash("/settings/mail", "noMail", "err");
  const res = await createRequests({ userId: user.id, brokerIds: ids, type, queue: mode === "queue" });
  if (sendNow && res.created.length) await runWorker(user.id, "send");
  revalidatePath("/requests");
  revalidatePath("/brokers");
  if (res.created.length === 0) redirectFlash("/requests", "skipped", "err", { count: res.skipped.length });
  redirectFlash("/requests", mode === "queue" ? "queued" : "drafted", "ok", { count: res.created.length });
}

const brokerSchema = z.object({
  name: z.string().min(1).max(200),
  website: z.string().max(500).default(""),
  privacyEmail: z.string().max(200).default(""),
  privacyUrl: z.string().max(500).default(""),
  optOutUrl: z.string().max(500).default(""),
  country: z.string().max(2).default("").transform((s) => s.toUpperCase()),
  jurisdiction: z.enum(JURISDICTIONS),
  category: z.enum(BROKER_CATEGORIES).default("other"),
  language: z.enum(["de", "en"]),
  requiresIdVerification: z.string().optional(),
  preferredChannel: z.enum(["email", "form"]).default("email"),
  notes: z.string().max(4000).default(""),
  dataUrls: z.string().max(4000).default(""),
});

function slugify(s: string) {
  return s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "custom";
}

export async function saveBrokerAction(formData: FormData) {
  const user = await requireUser();
  const id = Number(formData.get("id") || 0);
  const parsed = brokerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirectFlash(id ? `/brokers/${id}` : "/brokers/new", "invalid", "err");
  const d = parsed.data;
  const db = await getDb();
  const values = {
    ...d,
    privacyEmail: d.privacyEmail.trim().toLowerCase(),
    requiresIdVerification: d.requiresIdVerification === "on",
  };
  if (id) {
    const own = await db.select().from(schema.brokers).where(and(eq(schema.brokers.id, id), eq(schema.brokers.userId, user.id))).get();
    if (!own) redirectFlash("/brokers", "invalid", "err");
    await db.update(schema.brokers).set(values).where(eq(schema.brokers.id, id)).run();
    revalidatePath("/brokers");
    redirectFlash(`/brokers/${id}`, "saved");
  }
  const row = await db
    .insert(schema.brokers)
    .values({ ...values, userId: user.id, slug: `${slugify(d.name)}-${user.id}-${Date.now().toString(36)}`, isCurated: false })
    .returning({ id: schema.brokers.id })
    .get();
  revalidatePath("/brokers");
  redirectFlash(`/brokers/${row.id}`, "saved");
}

export async function copyBrokerAction(formData: FormData) {
  const user = await requireUser();
  const id = Number(formData.get("id"));
  const db = await getDb();
  const src = await db.select().from(schema.brokers).where(eq(schema.brokers.id, id)).get();
  if (!src) redirectFlash("/brokers", "invalid", "err");
  const { id: _id, createdAt: _c, ...rest } = src;
  void _id; void _c;
  const row = await db
    .insert(schema.brokers)
    .values({ ...rest, userId: user.id, isCurated: false, slug: `${src.slug}-copy-${user.id}-${Date.now().toString(36)}`, name: `${src.name} (Kopie)` })
    .returning({ id: schema.brokers.id })
    .get();
  revalidatePath("/brokers");
  redirectFlash(`/brokers/${row.id}`, "saved");
}

export async function deleteBrokerAction(formData: FormData) {
  const user = await requireUser();
  const id = Number(formData.get("id"));
  const db = await getDb();
  const own = await db.select({ id: schema.brokers.id }).from(schema.brokers).where(and(eq(schema.brokers.id, id), eq(schema.brokers.userId, user.id))).get();
  if (!own) redirectFlash("/brokers", "invalid", "err");
  const reqIds = (await db.select({ id: schema.requests.id }).from(schema.requests).where(eq(schema.requests.brokerId, id)).all()).map((r) => r.id);
  if (reqIds.length) {
    await db.delete(schema.messages).where(inArray(schema.messages.requestId, reqIds)).run();
    await db.delete(schema.activityLog).where(inArray(schema.activityLog.requestId, reqIds)).run();
    await db.delete(schema.requests).where(inArray(schema.requests.id, reqIds)).run();
  }
  await db.delete(schema.brokers).where(eq(schema.brokers.id, id)).run();
  revalidatePath("/brokers");
  redirectFlash("/brokers", "deleted");
}

export async function discoverAction(formData: FormData) {
  await requireUser();
  const website = String(formData.get("website") || "").trim();
  const name = String(formData.get("name") || "").trim();
  if (!website) redirectFlash("/brokers/new", "invalid", "err");
  let result;
  try {
    result = await discoverPrivacyContact(website);
  } catch (e) {
    redirectFlash("/brokers/new", "error", "err", { error: e instanceof Error ? e.message : String(e), website, name });
  }
  const params: Record<string, string> = { website, name, emails: result.emails.slice(0, 8).join(","), privacyUrl: result.privacyUrl ?? "" };
  if (!result.best) redirectFlash("/brokers/new", "discoverNone", "err", params);
  redirectFlash("/brokers/new", "discoverFound", "ok", { ...params, email: result.best });
}
