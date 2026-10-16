/**
 * Best-effort discovery of a privacy contact address for a custom removal:
 * fetches the site's homepage and common privacy/imprint paths and extracts e-mail addresses.
 */
const CANDIDATE_PATHS = [
  "/",
  "/privacy",
  "/privacy-policy",
  "/datenschutz",
  "/datenschutzerklaerung",
  "/datenschutzerklärung",
  "/impressum",
  "/imprint",
  "/legal",
  "/legal/privacy",
  "/contact",
  "/kontakt",
  "/opt-out",
  "/optout",
  "/.well-known/dnt-policy.txt",
];

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PRIORITY = ["privacy", "datenschutz", "dpo", "dsb", "gdpr", "dsgvo", "legal", "compliance", "optout", "opt-out", "support", "info", "contact", "kontakt"];

export type DiscoveryResult = {
  emails: string[];
  best: string | null;
  privacyUrl: string | null;
  checked: string[];
};

function candidateBases(input: string): string[] {
  const s = input.trim();
  if (/^https?:\/\//i.test(s)) {
    const u = new URL(s);
    return [`${u.protocol}//${u.host}`];
  }
  const host = new URL("https://" + s).host;
  return [`https://${host}`, `http://${host}`];
}

export async function discoverPrivacyContact(website: string, timeoutMs = 6000): Promise<DiscoveryResult> {
  let result: DiscoveryResult = { emails: [], best: null, privacyUrl: null, checked: [] };
  for (const base of candidateBases(website)) {
    result = await discoverFromBase(base, timeoutMs);
    if (result.checked.length > 0) break; // host reachable over this scheme
  }
  return result;
}

async function discoverFromBase(base: string, timeoutMs: number): Promise<DiscoveryResult> {
  const found = new Map<string, number>();
  const checked: string[] = [];
  let privacyUrl: string | null = null;

  await Promise.all(
    CANDIDATE_PATHS.map(async (p) => {
      const url = base + p;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const res = await fetch(url, {
          signal: ctrl.signal,
          redirect: "follow",
          headers: { "user-agent": "OwnData/0.1 (privacy contact discovery)", accept: "text/html,text/plain" },
        });
        if (!res.ok) return;
        const ct = res.headers.get("content-type") ?? "";
        if (!/text\/(html|plain)/i.test(ct)) return;
        const text = (await res.text()).slice(0, 400_000);
        checked.push(url);
        if (!privacyUrl && /privacy|datenschutz/i.test(p)) privacyUrl = res.url || url;
        const decoded = text.replace(/&#64;|&commat;/g, "@").replace(/\s*\[at\]\s*|\s*\(at\)\s*/gi, "@").replace(/\s*\[dot\]\s*|\s*\(dot\)\s*/gi, ".");
        for (const m of decoded.match(EMAIL_RE) ?? []) {
          const e = m.toLowerCase();
          if (/\.(png|jpg|jpeg|gif|svg|webp|css|js)$/.test(e)) continue;
          if (/example\.|sentry|wixpress|@2x/.test(e)) continue;
          found.set(e, (found.get(e) ?? 0) + 1);
        }
      } catch {
        /* ignore unreachable paths */
      } finally {
        clearTimeout(timer);
      }
    }),
  );

  const host = new URL(base).host.replace(/^www\./, "");
  const score = (e: string) => {
    const [local, domain] = e.split("@");
    let s = 0;
    const idx = PRIORITY.findIndex((k) => local.includes(k));
    if (idx >= 0) s += (PRIORITY.length - idx) * 10;
    if (domain.endsWith(host)) s += 15;
    s += Math.min(found.get(e) ?? 0, 5);
    return s;
  };
  const emails = [...found.keys()].sort((a, b) => score(b) - score(a));
  return { emails, best: emails[0] ?? null, privacyUrl, checked };
}
