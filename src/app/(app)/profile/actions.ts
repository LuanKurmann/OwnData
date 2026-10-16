"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { ADDRESS_KINDS } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { redirectFlash } from "@/lib/flash";
import { composeFullName } from "@/lib/address";
import { getProfile } from "@/server/requests";

const profileSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  middleName: z.string().trim().max(100).default(""),
  lastName: z.string().trim().min(1).max(100),
  aliases: z.string().max(2000).default(""),
  birthDate: z.string().max(10).default(""),
  emails: z.string().max(2000).default(""),
  phones: z.string().max(1000).default(""),
  signature: z.string().trim().max(200).default(""),
  locale: z.enum(["de", "en"]),
});

export async function saveProfileAction(formData: FormData) {
  const user = await requireUser();
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirectFlash("/profile", "invalid", "err");
  const { locale, ...profile } = parsed.data;
  const fullName = composeFullName(profile.firstName, profile.middleName, profile.lastName);
  const db = await getDb();
  const existing = await getProfile(user.id);
  const country = existing.addressList.find((a) => a.kind === "current")?.country ?? existing.country;
  await db
    .update(schema.profiles)
    .set({ ...profile, fullName, country, updatedAt: new Date() })
    .where(eq(schema.profiles.userId, user.id))
    .run();
  await db.update(schema.users).set({ locale, name: fullName }).where(eq(schema.users.id, user.id)).run();
  const store = await cookies();
  store.set("locale", locale, { path: "/", maxAge: 365 * 24 * 3600, sameSite: "lax" });
  revalidatePath("/", "layout");
  redirectFlash("/profile", "saved");
}

const addressSchema = z.object({
  id: z.coerce.number().int().optional(),
  kind: z.enum(ADDRESS_KINDS).default("current"),
  street: z.string().trim().min(1).max(200),
  houseNumber: z.string().trim().max(20).default(""),
  addressLine2: z.string().trim().max(200).default(""),
  postalCode: z.string().trim().min(1).max(20),
  city: z.string().trim().min(1).max(120),
  region: z.string().trim().max(120).default(""),
  country: z.string().trim().length(2).transform((s) => s.toUpperCase()),
  fromYear: z.string().trim().max(4).default(""),
  toYear: z.string().trim().max(4).default(""),
});

export async function saveAddressAction(formData: FormData) {
  const user = await requireUser();
  const raw = Object.fromEntries(formData);
  if (!raw.id) delete raw.id;
  const parsed = addressSchema.safeParse(raw);
  if (!parsed.success) redirectFlash("/profile", "invalid", "err");
  const { id, ...values } = parsed.data;
  const db = await getDb();
  if (id) {
    await db
      .update(schema.addresses)
      .set(values)
      .where(and(eq(schema.addresses.id, id), eq(schema.addresses.userId, user.id)))
      .run();
  } else {
    await db.insert(schema.addresses).values({ ...values, userId: user.id }).run();
  }
  // keep the profile's residence country in sync with the current address
  const profile = await getProfile(user.id);
  const current = profile.addressList.find((a) => a.kind === "current");
  if (current) await db.update(schema.profiles).set({ country: current.country }).where(eq(schema.profiles.userId, user.id)).run();
  revalidatePath("/profile");
  redirectFlash("/profile", "saved");
}

export async function deleteAddressAction(formData: FormData) {
  const user = await requireUser();
  const id = Number(formData.get("id"));
  const db = await getDb();
  await db.delete(schema.addresses).where(and(eq(schema.addresses.id, id), eq(schema.addresses.userId, user.id))).run();
  revalidatePath("/profile");
  redirectFlash("/profile", "deleted");
}
