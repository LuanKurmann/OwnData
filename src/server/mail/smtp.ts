import "server-only";
import nodemailer from "nodemailer";
import MailComposer from "nodemailer/lib/mail-composer";
import { decrypt } from "@/lib/crypto";
import type { MailAccount } from "@/db/schema";
import { appendToSent } from "./imap";

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

export type SendResult = { messageId: string; sentCopy: "stored" | "skipped" | "failed"; sentCopyError?: string };

/**
 * Build the MIME message once, deliver it via SMTP and store the identical bytes in the IMAP "Sent" folder,
 * so the user's mail client shows everything the app sent.
 */
export async function sendMail(
  acc: MailAccount,
  opts: { to: string; subject: string; text: string; inReplyTo?: string | null; references?: string[] },
): Promise<SendResult> {
  const domain = acc.fromEmail.split("@")[1] || "owndata.local";
  const messageId = `<${cryptoRandom()}@${domain}>`;
  const composer = new MailComposer({
    from: acc.fromName ? { name: acc.fromName, address: acc.fromEmail } : acc.fromEmail,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    messageId,
    inReplyTo: opts.inReplyTo ?? undefined,
    references: opts.references?.length ? opts.references : undefined,
    headers: { "X-OwnData": "1" },
  });
  const raw = await composer.compile().build();
  const transport = smtpTransport(acc);
  await transport.sendMail({ envelope: { from: acc.fromEmail, to: [opts.to] }, raw });
  const result: SendResult = { messageId, sentCopy: "skipped" };
  if (acc.imapEnabled && acc.imapHost) {
    try {
      await appendToSent(acc, raw);
      result.sentCopy = "stored";
    } catch (e) {
      result.sentCopy = "failed";
      result.sentCopyError = e instanceof Error ? e.message : String(e);
    }
  }
  return result;
}

function cryptoRandom(): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
