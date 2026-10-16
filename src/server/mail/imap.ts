import "server-only";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { decrypt } from "@/lib/crypto";
import type { MailAccount } from "@/db/schema";

export type InboundMail = {
  uid: number;
  messageId: string | null;
  inReplyTo: string | null;
  references: string[];
  from: string;
  to: string;
  subject: string;
  text: string;
  date: Date;
  headers: Map<string, string>;
};

function imapClient(acc: MailAccount) {
  return new ImapFlow({
    host: acc.imapHost,
    port: acc.imapPort,
    secure: acc.imapSecure,
    auth: { user: acc.imapUser || acc.smtpUser, pass: decrypt(acc.imapPassEnc || acc.smtpPassEnc) },
    logger: false,
    connectionTimeout: 20000,
    greetingTimeout: 20000,
  });
}

export async function verifyImap(acc: MailAccount): Promise<void> {
  const client = imapClient(acc);
  await client.connect();
  try {
    const lock = await client.getMailboxLock(acc.imapMailbox || "INBOX");
    lock.release();
  } finally {
    await client.logout().catch(() => undefined);
  }
}

/** Fetch messages with UID greater than `sinceUid`. Returns messages and the highest UID seen. */
export async function fetchNewMail(acc: MailAccount, sinceUid: number, limit = 200): Promise<{ mails: InboundMail[]; lastUid: number }> {
  const client = imapClient(acc);
  await client.connect();
  const mails: InboundMail[] = [];
  let lastUid = sinceUid;
  try {
    const lock = await client.getMailboxLock(acc.imapMailbox || "INBOX");
    try {
      const status = client.mailbox;
      const uidNext = status && typeof status === "object" && "uidNext" in status ? Number(status.uidNext) : 0;
      // First run: only look at mail from now on, don't ingest the whole mailbox history.
      if (sinceUid === 0) {
        return { mails: [], lastUid: Math.max(0, uidNext - 1) };
      }
      const range = `${sinceUid + 1}:*`;
      let count = 0;
      for await (const msg of client.fetch(range, { uid: true, source: true }, { uid: true })) {
        if (msg.uid <= sinceUid) continue; // "*" may return the last message again
        lastUid = Math.max(lastUid, msg.uid);
        if (++count > limit) break;
        if (!msg.source) continue;
        const parsed = await simpleParser(msg.source);
        const headers = new Map<string, string>();
        for (const [k, v] of parsed.headers) headers.set(k.toLowerCase(), typeof v === "string" ? v : JSON.stringify(v));
        const refs = Array.isArray(parsed.references) ? parsed.references : parsed.references ? [parsed.references] : [];
        mails.push({
          uid: msg.uid,
          messageId: parsed.messageId ?? null,
          inReplyTo: parsed.inReplyTo ?? null,
          references: refs,
          from: parsed.from?.text ?? "",
          to: Array.isArray(parsed.to) ? parsed.to.map((t) => t.text).join(", ") : parsed.to?.text ?? "",
          subject: parsed.subject ?? "",
          text: parsed.text ?? (parsed.html ? String(parsed.html).replace(/<[^>]+>/g, " ") : ""),
          date: parsed.date ?? new Date(),
          headers,
        });
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => undefined);
  }
  return { mails, lastUid };
}
