"use server";
import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { redirectFlash } from "@/lib/flash";

export async function saveTemplateAction(formData: FormData) {
  const user = await requireUser();
  const key = String(formData.get("key"));
  const parsed = z.object({ subject: z.string().min(1).max(500), body: z.string().min(1).max(50000) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirectFlash(`/templates/${key}`, "invalid", "err");
  const db = await getDb();
  const sys = await db.select().from(schema.templates).where(and(isNull(schema.templates.userId), eq(schema.templates.key, key))).get();
  if (!sys) redirectFlash("/templates", "invalid", "err");
  const mine = await db.select().from(schema.templates).where(and(eq(schema.templates.userId, user.id), eq(schema.templates.key, key))).get();
  if (mine) {
    await db.update(schema.templates).set({ ...parsed.data, updatedAt: new Date() }).where(eq(schema.templates.id, mine.id)).run();
  } else {
    const { id: _id, ...rest } = sys;
    void _id;
    await db.insert(schema.templates).values({ ...rest, ...parsed.data, userId: user.id, isSystem: false, updatedAt: new Date() }).run();
  }
  revalidatePath("/templates");
  redirectFlash(`/templates/${key}`, "saved");
}

export async function resetTemplateAction(formData: FormData) {
  const user = await requireUser();
  const key = String(formData.get("key"));
  await (await getDb()).delete(schema.templates).where(and(eq(schema.templates.userId, user.id), eq(schema.templates.key, key))).run();
  revalidatePath("/templates");
  redirectFlash(`/templates/${key}`, "saved");
}
