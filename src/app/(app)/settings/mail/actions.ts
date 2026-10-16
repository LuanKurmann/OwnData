"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { encrypt } from "@/lib/crypto";
import { redirectFlash } from "@/lib/flash";
import { getMailAccount } from "@/server/requests";
import { verifySmtp } from "@/server/mail/smtp";
import { verifyImap } from "@/server/mail/imap";

const PATH = "/settings/mail";

const mailSchema = z.object({
  fromName: z.string().max(120).default(""),
  fromEmail: z.string().email(),
  smtpHost: z.string().min(1),
  smtpPort: z.coerce.number().int().min(1).max(65535),
  smtpSecure: z.string().optional(),
  smtpUser: z.string().min(1),
  smtpPass: z.string().default(""),
  imapEnabled: z.string().optional(),
  imapHost: z.string().default(""),
  imapPort: z.coerce.number().int().min(1).max(65535).default(993),
  imapSecure: z.string().optional(),
  imapUser: z.string().default(""),
  imapPass: z.string().default(""),
  imapMailbox: z.string().default("INBOX"),
});

export async function saveMailAction(formData: FormData) {
  const user = await requireUser();
  const parsed = mailSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirectFlash(PATH, "invalid", "err");
  const d = parsed.data;
  const db = await getDb();
  const existing = await getMailAccount(user.id);
  if (!existing && !d.smtpPass) redirectFlash(PATH, "invalid", "err");
  const values = {
    fromName: d.fromName,
    fromEmail: d.fromEmail,
    smtpHost: d.smtpHost,
    smtpPort: d.smtpPort,
    smtpSecure: d.smtpSecure === "on",
    smtpUser: d.smtpUser,
    smtpPassEnc: d.smtpPass ? encrypt(d.smtpPass) : existing!.smtpPassEnc,
    imapEnabled: d.imapEnabled === "on",
    imapHost: d.imapHost,
    imapPort: d.imapPort,
    imapSecure: d.imapSecure === "on",
    imapUser: d.imapUser,
    imapPassEnc: d.imapPass ? encrypt(d.imapPass) : existing?.imapPassEnc ?? "",
    imapMailbox: d.imapMailbox || "INBOX",
    updatedAt: new Date(),
  };
  if (existing) {
    const hostChanged = existing.imapHost !== d.imapHost || existing.imapMailbox !== (d.imapMailbox || "INBOX");
    await db.update(schema.mailAccounts)
      .set({ ...values, ...(hostChanged ? { imapLastUid: 0 } : {}) })
      .where(eq(schema.mailAccounts.id, existing.id))
      .run();
  } else {
    await db.insert(schema.mailAccounts).values({ userId: user.id, ...values }).run();
  }
  revalidatePath(PATH);
  redirectFlash(PATH, "saved");
}

export async function testSmtpAction() {
  const user = await requireUser();
  const acc = await getMailAccount(user.id);
  if (!acc) redirectFlash(PATH, "noMail", "err");
  try {
    await verifySmtp(acc);
    await (await getDb()).update(schema.mailAccounts).set({ smtpLastError: null }).where(eq(schema.mailAccounts.id, acc.id)).run();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await (await getDb()).update(schema.mailAccounts).set({ smtpLastError: msg }).where(eq(schema.mailAccounts.id, acc.id)).run();
    redirectFlash(PATH, "smtpFail", "err", { error: msg.slice(0, 200) });
  }
  redirectFlash(PATH, "smtpOk");
}

export async function testImapAction() {
  const user = await requireUser();
  const acc = await getMailAccount(user.id);
  if (!acc) redirectFlash(PATH, "noMail", "err");
  try {
    await verifyImap(acc);
    await (await getDb()).update(schema.mailAccounts).set({ imapLastError: null }).where(eq(schema.mailAccounts.id, acc.id)).run();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await (await getDb()).update(schema.mailAccounts).set({ imapLastError: msg }).where(eq(schema.mailAccounts.id, acc.id)).run();
    redirectFlash(PATH, "imapFail", "err", { error: msg.slice(0, 200) });
  }
  redirectFlash(PATH, "imapOk");
}
