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
  html: string | null;
  /** decoded text of attached originals / delivery-status parts (bounces) */
  attachmentsText: string;
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

const SENT_CANDIDATES = ["Sent", "Sent Items", "Sent Messages", "Gesendet", "Gesendete Elemente", "Gesendete Objekte", "INBOX.Sent", "INBOX/Sent", "[Gmail]/Sent Mail", "[Gmail]/Gesendet"];

/** Find the folder flagged \Sent (or a common name). Returns null when none exists. */
export async function detectSentMailbox(acc: MailAccount): Promise<string | null> {
  const client = imapClient(acc);
  await client.connect();
  try {
    const boxes = await client.list();
    const special = boxes.find((b) => b.specialUse === "\\Sent");
    if (special) return special.path;
    const byName = boxes.find((b) => SENT_CANDIDATES.some((c) => c.toLowerCase() === b.path.toLowerCase()));
    return byName?.path ?? null;
  } finally {
    await client.logout().catch(() => undefined);
  }
}

/** Store a copy of an outgoing message in the account's Sent folder (configured or auto-detected). */
export async function appendToSent(acc: MailAccount, raw: Buffer): Promise<string> {
  const folder = acc.imapSentMailbox || (await detectSentMailbox(acc));
  if (!folder) throw new Error("no Sent folder found");
  const client = imapClient(acc);
  await client.connect();
  try {
    await client.append(folder, raw, ["\\Seen"], new Date());
    return folder;
  } finally {
    await client.logout().catch(() => undefined);
  }
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

/**
 * Fetch messages with UID greater than `sinceUid`. On the very first poll (sinceUid = 0) the last
 * `initialDays` days are ingested so replies that arrived before setup are not lost.
 * Returns messages and the highest UID seen.
 */
export async function fetchNewMail(acc: MailAccount, sinceUid: number, limit = 150, initialDays = 30): Promise<{ mails: InboundMail[]; lastUid: number }> {
  const client = imapClient(acc);
  await client.connect();
  const mails: InboundMail[] = [];
  let lastUid = sinceUid;
  try {
    const lock = await client.getMailboxLock(acc.imapMailbox || "INBOX");
    try {
      const status = client.mailbox;
      const uidNext = status && typeof status === "object" && "uidNext" in status ? Number(status.uidNext) : 0;
      let range: string | number[] = `${sinceUid + 1}:*`;
      if (sinceUid === 0) {
        // First run: ingest recent history instead of starting from "now".
        const since = new Date(Date.now() - initialDays * 86400000);
        const uids = (await client.search({ since }, { uid: true })) || [];
        lastUid = Math.max(0, uidNext - 1);
        if (uids.length === 0) return { mails: [], lastUid };
        range = uids.slice(-limit);
      }
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
          text: parsed.text ?? (parsed.html ? String(parsed.html).replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ") : ""),
          html: parsed.html ? String(parsed.html) : null,
          attachmentsText: (parsed.attachments ?? [])
            .filter((a) => /message\/|delivery-status|text\//i.test(a.contentType) && a.size < 200_000)
            .map((a) => a.content.toString("utf8"))
            .join("\n")
            .slice(0, 100_000),
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
