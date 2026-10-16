import type { Broker, Profile, Request } from "@/db/schema";
import { format } from "date-fns";
import { LEGAL } from "./legal";

export type TemplateVars = Record<string, string>;

function lines(s: string): string[] {
  return s
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

function bullets(s: string, lang: "de" | "en", empty: string): string {
  const ls = lines(s);
  if (ls.length === 0) return empty;
  return ls.map((l) => `  - ${l}`).join("\n");
}

export function buildVars(opts: {
  profile: Profile;
  broker: Broker;
  reference: string;
  lang: "de" | "en";
  requestType: "erasure" | "access" | "optout";
  jurisdiction: "gdpr" | "dsg" | "ccpa";
  senderEmail: string;
  sentAt?: Date | null;
  deadlineAt?: Date | null;
  dataUrls?: string;
}): TemplateVars {
  const { profile, broker, lang } = opts;
  const dateFmt = lang === "de" ? "dd.MM.yyyy" : "yyyy-MM-dd";
  const none = lang === "de" ? "  - (keine Angabe)" : "  - (not provided)";
  const days = LEGAL[opts.jurisdiction].deadlineDays[opts.requestType];
  const now = new Date();
  const deadline = opts.deadlineAt ?? new Date(now.getTime() + days * 86400000);
  return {
    fullName: profile.fullName || "—",
    aliases: bullets(profile.aliases, lang, none),
    birthDate: profile.birthDate || (lang === "de" ? "(keine Angabe)" : "(not provided)"),
    addresses: bullets(profile.addresses, lang, none),
    emails: bullets(profile.emails || opts.senderEmail, lang, none),
    phones: bullets(profile.phones, lang, none),
    country: profile.country,
    signature: profile.signature || profile.fullName,
    brokerName: broker.name,
    brokerWebsite: broker.website,
    dataUrls: bullets(opts.dataUrls ?? broker.dataUrls, lang, none),
    date: format(now, dateFmt),
    sentDate: format(opts.sentAt ?? now, dateFmt),
    deadlineDate: format(deadline, dateFmt),
    deadlineDays: String(days),
    reference: opts.reference,
    senderEmail: opts.senderEmail,
    authorityName: LEGAL[opts.jurisdiction].authority.name[lang],
    authorityUrl: LEGAL[opts.jurisdiction].authority.url,
  };
}

export function render(text: string, vars: TemplateVars): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => (k in vars ? vars[k] : `{{${k}}}`));
}

export function varsFromRequest(req: Request, broker: Broker, profile: Profile, senderEmail: string): TemplateVars {
  return buildVars({
    profile,
    broker,
    reference: req.reference,
    lang: req.language,
    requestType: req.type,
    jurisdiction: req.jurisdiction,
    senderEmail,
    sentAt: req.sentAt,
    deadlineAt: req.deadlineAt,
  });
}

export const PLACEHOLDERS = [
  "fullName",
  "aliases",
  "birthDate",
  "addresses",
  "emails",
  "phones",
  "country",
  "signature",
  "brokerName",
  "brokerWebsite",
  "dataUrls",
  "date",
  "sentDate",
  "deadlineDate",
  "deadlineDays",
  "reference",
  "senderEmail",
  "authorityName",
  "authorityUrl",
] as const;
