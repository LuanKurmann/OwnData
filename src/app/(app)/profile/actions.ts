"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { redirectFlash } from "@/lib/flash";
import { getProfile } from "@/server/requests";

const schemaZ = z.object({
  fullName: z.string().max(200),
  aliases: z.string().max(2000),
  birthDate: z.string().max(40),
  addresses: z.string().max(4000),
  emails: z.string().max(2000),
  phones: z.string().max(1000),
  country: z.string().max(2).transform((s) => s.toUpperCase()),
  signature: z.string().max(200),
  locale: z.enum(["de", "en"]),
  name: z.string().min(1).max(120),
});

export async function saveProfileAction(formData: FormData) {
  const user = await requireUser();
  const parsed = schemaZ.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirectFlash("/profile", "invalid", "err");
  const { locale, name, ...profile } = parsed.data;
  const db = await getDb();
  await getProfile(user.id);
  await db.update(schema.profiles)
    .set({ ...profile, updatedAt: new Date() })
    .where(eq(schema.profiles.userId, user.id))
    .run();
  await db.update(schema.users).set({ locale, name }).where(eq(schema.users.id, user.id)).run();
  const store = await cookies();
  store.set("locale", locale, { path: "/", maxAge: 365 * 24 * 3600, sameSite: "lax" });
  revalidatePath("/", "layout");
  redirectFlash("/profile", "saved");
}
