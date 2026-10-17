const GENERIC_TOKENS = new Set(["gmbh", "inc", "llc", "ltd", "corp", "group", "holding", "services", "service", "data", "digital", "media", "online", "privacy", "information", "solutions", "consumer", "credit", "check", "schweiz", "deutschland", "germany", "europe", "international", "the", "und", "and", "ehem", "formerly"]);

/** Distinctive name tokens of a broker, e.g. "localsearch (local.ch / search.ch)" -> ["localsearch", "local.ch", "search.ch"]. */
export function brokerTokens(name: string): string[] {
  return name
    .toLowerCase()
    .split(/[\s,()\/&]+/)
    .map((t) => t.replace(/[^a-z0-9.-]/g, "").replace(/^[.-]+|[.-]+$/g, ""))
    .filter((t) => t.length >= 4 && !GENERIC_TOKENS.has(t) && !/^\d+$/.test(t));
}

export function rootDomain(host: string): string {
  const parts = host.split(".");
  return parts.length <= 2 ? host : parts.slice(-2).join(".");
}

export function emailAddress(from: string): string {
  const m = from.match(/<([^>]+)>/);
  return (m ? m[1] : from).trim().toLowerCase();
}

export function emailDomain(addr: string): string {
  return addr.split("@")[1]?.toLowerCase() ?? "";
}

/** Does the sender domain belong to the same organisation as a recipient address or website host? */
export function domainsRelated(senderDomain: string, candidates: string[]): boolean {
  return candidates
    .filter(Boolean)
    .some((x) => x === senderDomain || senderDomain.endsWith("." + x) || x.endsWith("." + senderDomain) || rootDomain(x) === rootDomain(senderDomain));
}
