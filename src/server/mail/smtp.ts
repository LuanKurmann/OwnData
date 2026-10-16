import "server-only";
import nodemailer from "nodemailer";
import { decrypt } from "@/lib/crypto";
import type { MailAccount } from "@/db/schema";

export function smtpTransport(acc: MailAccount) {
  return nodemailer.createTransport({
    host: acc.smtpHost,
    port: acc.smtpPort,
    secure: acc.smtpSecure,
    auth: { user: acc.smtpUser, pass: decrypt(acc.smtpPassEnc) },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
  });
}

export async function verifySmtp(acc: MailAccount): Promise<void> {
  await smtpTransport(acc).verify();
}

export async function sendMail(
  acc: MailAccount,
  opts: { to: string; subject: string; text: string; inReplyTo?: string | null; references?: string[] },
): Promise<{ messageId: string }> {
  const transport = smtpTransport(acc);
  const info = await transport.sendMail({
    from: acc.fromName ? { name: acc.fromName, address: acc.fromEmail } : acc.fromEmail,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    inReplyTo: opts.inReplyTo ?? undefined,
    references: opts.references?.length ? opts.references : undefined,
    headers: { "X-OwnData": "1" },
  });
  return { messageId: info.messageId };
}
