import type { Broker, ProfileWithAddresses, Request } from "@/db/schema";
import { composeFullName, countryName, describeAddress } from "./address";
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
  profile: ProfileWithAddresses;
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
  const fullName = composeFullName(profile.firstName, profile.middleName, profile.lastName) || profile.fullName || "—";
  const current = profile.addressList.find((a) => a.kind === "current");
  const structured = profile.addressList.map((a) => describeAddress(a, lang)).join("\n");
  const addressText = structured || profile.addresses;
  const residence = current?.country || profile.country;
  return {
    fullName,
    firstName: profile.firstName,
    middleName: profile.middleName,
    lastName: profile.lastName,
    aliases: bullets(profile.aliases, lang, none),
    birthDate: profile.birthDate || (lang === "de" ? "(keine Angabe)" : "(not provided)"),
    addresses: bullets(addressText, lang, none),
    currentAddress: current ? describeAddress(current, lang) : lang === "de" ? "(keine Angabe)" : "(not provided)",
    emails: bullets(profile.emails || opts.senderEmail, lang, none),
    phones: bullets(profile.phones, lang, none),
    country: countryName(residence, lang) || residence,
    signature: profile.signature || fullName,
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

export function varsFromRequest(req: Request, broker: Broker, profile: ProfileWithAddresses, senderEmail: string): TemplateVars {
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
  "firstName",
  "middleName",
  "lastName",
  "aliases",
  "birthDate",
  "addresses",
  "currentAddress",
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
