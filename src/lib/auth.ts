import "server-only";
import { cookies } from "next/headers";
import { eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { getDb, schema } from "@/db";
import { createSessionToken, verifySessionToken, SESSION_COOKIE, sessionCookieOptions } from "./session";
import type { User } from "@/db/schema";

export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await verifySessionToken(token);
  if (!session) return null;
  const db = await getDb();
  return await db.select().from(schema.users).where(eq(schema.users.id, session.uid)).get() ?? null;
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}

export async function userCount(): Promise<number> {
  const db = await getDb();
  return (await db.select({ n: sql<number>`count(*)` }).from(schema.users).get())?.n ?? 0;
}

export async function registrationOpen(): Promise<boolean> {
  if ((await userCount()) === 0) return true;
  return (process.env.ALLOW_REGISTRATION ?? "false").toLowerCase() === "true";
}

export async function registerUser(input: { email: string; password: string; name: string; locale: "de" | "en" }) {
  const db = await getDb();
  const email = input.email.trim().toLowerCase();
  const existing = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email)).get();
  if (existing) return { error: "emailTaken" as const };
  const isFirst = (await userCount()) === 0;
  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await db
    .insert(schema.users)
    .values({ email, passwordHash, name: input.name.trim(), role: isFirst ? "admin" : "user", locale: input.locale })
    .returning()
    .get();
  await db.insert(schema.profiles).values({ userId: user.id, fullName: user.name, emails: email }).run();
  await setSessionCookie(user);
  return { user };
}

export async function loginUser(email: string, password: string) {
  const db = await getDb();
  const user = await db.select().from(schema.users).where(eq(schema.users.email, email.trim().toLowerCase())).get();
  if (!user) return { error: "invalidCredentials" as const };
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return { error: "invalidCredentials" as const };
  await setSessionCookie(user);
  return { user };
}

export async function setSessionCookie(user: User) {
  const token = await createSessionToken({ uid: user.id, role: user.role });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, sessionCookieOptions);
  store.set("locale", user.locale, { path: "/", maxAge: 365 * 24 * 3600, sameSite: "lax" });
}

export async function clearSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
