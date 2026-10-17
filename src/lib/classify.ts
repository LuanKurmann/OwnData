import type { ActionHint, Classification, ExtractedLink } from "@/db/schema";

export type ClassifyResult = { classification: Classification; hints: ActionHint[] };

const HINT_RULES: Array<{ hint: ActionHint; patterns: RegExp[] }> = [
  {
    hint: "verify_identity",
    patterns: [
      /verify (your )?identity/i,
      /proof of (your )?identity/i,
      /identit(ä|ae)tsnachweis/i,
      /ausweis(kopie|dokument)?/i,
      /identit(ä|ae)t (zu )?(best(ä|ae)tigen|nachweisen|verifizieren|pr(ü|ue)fen)/i,
      /government[- ]issued (photo )?id/i,
      /photo id/i,
      /identity (document|verification)/i,
      /(lichtbild|pass|personal)ausweis/i,
      /legitimation/i,
    ],
  },
  {
    hint: "confirm_request",
    patterns: [
      /confirm (your|this|the) (request|e-?mail( address)?|identity|submission)/i,
      /(click|tap|follow) (on )?(the|this) (link|button) (below )?(to|and) (confirm|verify|validate|authenticate|proceed|complete)/i,
      /verify (your )?e-?mail( address)?/i,
      /(best(ä|ae)tigen|verifizieren) sie (ihre|die|diesen|den) (anfrage|e-?mail|antrag|link)/i,
      /bitte best(ä|ae)tigen sie/i,
      /(klicken|tippen) sie (auf )?(den|diesen|folgenden) (link|button)/i,
      /one[- ]time (code|passcode|password)|verification code|best(ä|ae)tigungscode/i,
    ],
  },
  {
    hint: "fill_form",
    patterns: [
      /(complete|fill (in|out)|submit|use|visit|go to|access) (the|this|our|a|your) (online |web ?|self[- ]service |easy,? self-service )?(form|webform|request form|portal|tool|privacy (portal|center|centre|request|choices|rights page))/i,
      /(removal|opt[- ]?out|information claim|privacy) website/i,
      /your-privacy-choices|privacy\.saymine\.io|\/optout\b|\/opt-out\b|\/removal\b|\/privacy-rights\b|\/privacyrequest\b/i,
      /we do not (process|accept) (privacy )?requests (received |submitted )?(via|by|through) e-?mail/i,
      /requests made through other channels cannot be processed/i,
      /(privacy|data subject|consumer|dsar) (request )?(portal|center|centre|form|page)/i,
      /submit (a|your) request (through|via|at|using|on)/i,
      /(f(ü|ue)llen|nutzen|verwenden) sie (bitte )?(das|unser|dieses) (online-?)?formular/i,
      /(ü|ue)ber (das|unser) (online-?)?(formular|portal)/i,
      /datenschutz(-| )?portal/i,
      /opt[- ]?out (page|form|tool|link)/i,
      /(removal|suppression) (form|tool|page)/i,
    ],
  },
  {
    hint: "provide_info",
    patterns: [
      /please (provide|send|supply|reply with|respond with|confirm which|specify|include)/i,
      /(provide|send|supply) us (with )?(the following|more|further|additional|your)/i,
      /we (need|require|will need) (you to provide |from you )?(the following|more|further|additional|your (member|account|profile))/i,
      /unless we receive (sufficient|additional|the requested)/i,
      /bitte (senden|teilen|nennen|geben|übermitteln|uebermitteln) sie (uns )?(noch |bitte )?(folgende|weitere|ihre|die)/i,
      /(ben(ö|oe)tigen|brauchen) wir (von ihnen )?(noch|folgende|weitere|zus(ä|ae)tzlich)/i,
      /unable to (locate|find|identify) (an |your |a |any )?(record|profile|account|data|information|listing)/i,
      /(konnten|k(ö|oe)nnen) (wir )?(keine|keinen|kein) (passenden |entsprechenden )?(daten|eintrag|datensatz|profil|konto) (zu|unter|mit) (ihnen|ihrer|ihrem|dieser)/i,
      /(specific |exact )?url\(?s?\)? of (all )?(the |your )?(listing|profile|record)/i,
      /(profile|listing) (url|link)s? (containing|of|for)/i,
      /could not match/i,
    ],
  },
];

const CLASS_RULES: Array<{ cls: Classification | "rejected_weak"; patterns: RegExp[] }> = [
  {
    cls: "completed",
    patterns: [
      /\b(has|have|had) been (deleted|removed|erased|suppressed|opted[- ]out|purged|anonymi[sz]ed)/i,
      /\b(deleted|removed|erased|suppressed|purged) (all )?(of )?(your|the) (personal )?(data|information|record|profile|listing|details)/i,
      /\b(we|i) (have )?(now )?(deleted|removed|erased|suppressed|processed|completed|fulfilled|honou?red)/i,
      /request (has been|was|is now) (completed|processed|fulfilled|actioned|closed as completed)/i,
      /successfully (removed|deleted|opted|processed|completed)/i,
      /opt[- ]?out (request )?(is|has been|was) (complete|successful|processed)/i,
      /no longer (hold|process|have|retain|store)/i,
      /wurde(n)? (vollst(ä|ae)ndig )?gel(ö|oe)scht/i,
      /haben (wir )?(ihre|s(ä|ae)mtliche|alle|die) (daten|eintr(ä|ae)ge|angaben|personendaten) (vollst(ä|ae)ndig )?(gel(ö|oe)scht|entfernt|gesperrt|anonymisiert)/i,
      /l(ö|oe)schung (ist|wurde) (erfolgt|durchgef(ü|ue)hrt|abgeschlossen|vorgenommen|veranlasst)/i,
      /(entfernt|gesperrt|gel(ö|oe)scht) (worden|wurde)/i,
      /ihrem (antrag|begehren|wunsch|ersuchen) (wurde|haben wir|sind wir) (entsprochen|nachgekommen)/i,
      /(sind|wurden) (keine|nicht) (mehr )?(daten|personendaten) (mehr )?(gespeichert|vorhanden)/i,
      /haben (wir )?(generell |grunds(ä|ae)tzlich )?(zu ihnen|(ü|ue)ber sie|von ihnen) keine (daten|personendaten|suchergebnisse|eintr(ä|ae)ge|informationen)/i,
      /(liegen|haben) (uns |wir )?keine (daten|personendaten|informationen|eintr(ä|ae)ge) (zu ihrer person|(ü|ue)ber sie|zu ihnen) (vor)?/i,
      /we (do not|don't|no longer) (hold|have|store|retain|process) any (personal )?(data|information|records?) (about|on|relating to|concerning) you/i,
      /(no|zero) (records?|data|information|results?) (were |was )?(found|located|identified) (for|about|matching|relating to) you/i,
      /(added|placed) (you|your name|your details) (to|on) (our|the) (internal )?(suppression|block|do[- ]not[- ]contact|sperr)[- ]?list/i,
      /sperrliste/i,
    ],
  },
  {
    cls: "rejected",
    patterns: [
      // strong: an explicit, unconditional refusal
      /(k(ö|oe)nnen|werden|d(ü|ue)rfen) (wir )?(ihrem|dem|diesem) (antrag|begehren|wunsch|ersuchen) (leider )?nicht (entsprechen|nachkommen|stattgeben)/i,
      /(daten|eintrag|eintr(ä|ae)ge) (k(ö|oe)nnen|d(ü|ue)rfen) (derzeit |noch )?nicht (gel(ö|oe)scht|entfernt) werden/i,
      /request (is|has been|was) (denied|rejected|refused|declined)/i,
      /(wurde|wird|haben wir) (abgelehnt|zur(ü|ue)ckgewiesen|abgewiesen)/i,
      /we (must|have to|are required to) (retain|keep|store) (your|this|the) (data|information|record)/i,
      /(legal(ly)? (obligation|required|requirement) to (retain|keep|store)|gesetzliche(n|r)? aufbewahrungs(pflicht|frist)).{0,120}(cannot|unable|nicht (gel(ö|oe)scht|m(ö|oe)glich))/i,
      /not subject to (the )?(gdpr|ccpa|fadp|dsg)/i,
      /we (will not|won't|decline to|refuse to) (delete|remove|erase|comply|process|fulfil|honou?r|action)/i,
    ],
  },
  {
    cls: "rejected_weak",
    patterns: [
      /we (are unable to|cannot|can't|do not|don't) (delete|remove|erase|comply|process|fulfil|honou?r|action)/i,
      /exempt(ion)? (from|under)/i,
      /(public record|publicly available|(ö|oe)ffentlich(e|en) (quellen|register|verzeichnis))/i,
    ],
  },
  {
    cls: "acknowledged",
    patterns: [
      /(received|got|acknowledge) (receipt of )?your (request|message|e-?mail|inquiry|enquiry|submission)/i,
      /(acknowledge|confirm) receipt/i,
      /(thank you|thanks) for (contacting|reaching out|your (request|e-?mail|message))/i,
      /we (will|are|'ll) (now )?(process|review|look into|investigate|get back|respond|handle|be in touch)/i,
      /(within|in) (the next )?(\d+|one|two|thirty|forty-five) (business |working )?days/i,
      /(haben|ist) (ihre|ihr|die) (anfrage|antrag|nachricht|e-?mail|begehren|ersuchen) erhalten/i,
      /eingang(sbest(ä|ae)tigung)?/i,
      /(vielen|besten|herzlichen) dank f(ü|ue)r (ihre|ihr|die) (anfrage|nachricht|e-?mail|mitteilung)/i,
      /wir (werden|k(ü|ue)mmern) uns (schnellstm(ö|oe)glich|umgehend|zeitnah|so schnell wie m(ö|oe)glich|baldm(ö|oe)glichst)?/i,
      /wird (bearbeitet|gepr(ü|ue)ft|umgehend)/i,
      /in bearbeitung/i,
      /(ticket|case|reference|request) ?(number|id|#|no\.?|nr\.?)/i,
      /\[(ticket|case|request) ?#?\d+\]/i,
    ],
  },
];

const AUTO_REPLY_SUBJECT = /^(auto(matic|mated)?[- ]?(reply|response|antwort)|out of (the )?office|abwesenheit|automatische antwort|delivery (status|failure)|undeliverable|mail delivery failed|unzustellbar)/i;

function matches(cls: string, text: string): boolean {
  return CLASS_RULES.find((r) => r.cls === cls)!.patterns.some((p) => p.test(text));
}

/**
 * Keyword heuristic over subject + body. Priority: completed > strong rejection > action required
 * (form/link) > needs info > weak rejection > acknowledged > unknown. Users can override manually.
 */
export function classifyReply(subject: string, body: string): ClassifyResult {
  const text = `${subject}\n${body}`.slice(0, 12000);
  const hints: ActionHint[] = [];
  for (const rule of HINT_RULES) if (rule.patterns.some((p) => p.test(text))) hints.push(rule.hint);
  const wantsForm = hints.includes("confirm_request") || hints.includes("fill_form");
  if (wantsForm && !hints.includes("click_link")) hints.push("click_link");

  if (matches("completed", text)) return { classification: "completed", hints };
  if (matches("rejected", text)) return { classification: "rejected", hints };
  if (wantsForm) return { classification: "action_required", hints };
  if (hints.includes("verify_identity") || hints.includes("provide_info")) return { classification: "needs_info", hints };
  if (matches("rejected_weak", text)) return { classification: "rejected", hints };
  if (matches("acknowledged", text)) return { classification: "acknowledged", hints };
  return { classification: "unknown", hints };
}

const BOUNCE_SUBJECT = /^(undeliverable|undelivered|unzustellbar|returned mail|mail delivery (failed|failure|subsystem)|delivery (status notification|failure|has failed)|failure notice|nicht zustellbar|non[- ]?remis|message not delivered)/i;
const BOUNCE_FROM = /mailer-daemon|postmaster|mail delivery (system|subsystem)|microsoft outlook/i;

/** Non-delivery report detection (DSN). */
export function isBounce(subject: string, from: string, headers: Map<string, string>): boolean {
  const ct = headers.get("content-type") ?? "";
  if (/multipart\/report/i.test(ct) && /delivery-status/i.test(ct)) return true;
  if (BOUNCE_FROM.test(from) && (BOUNCE_SUBJECT.test(subject.trim()) || /fail|deliver|zustell/i.test(subject))) return true;
  if (headers.get("x-failed-recipients")) return true;
  return BOUNCE_SUBJECT.test(subject.trim()) && BOUNCE_FROM.test(from);
}

export type BounceInfo = { recipients: string[]; diagnostic: string; references: string[]; messageIds: string[] };

/** Pull failed recipient, diagnostic text, our reference codes and Message-IDs out of a bounce (body + attached original). */
export function extractBounceInfo(text: string, attachmentsText: string, ownAddress: string): BounceInfo {
  const all = `${text}\n${attachmentsText}`;
  const own = ownAddress.toLowerCase();
  const recips = new Set<string>();
  for (const m of all.matchAll(/(?:Final|Original)-Recipient:\s*(?:rfc822|RFC822)?;?\s*<?([^\s<>]+@[^\s<>]+)>?/gi)) recips.add(m[1].toLowerCase());
  for (const m of all.matchAll(/(?:Your message to|couldn't be delivered to|Delivery has failed to these recipients or groups:|an folgende Empf(?:ä|ae)nger oder Gruppen:|could not be delivered to)\s*<?([^\s<>]+@[^\s<>]+)>?/gi)) recips.add(m[1].toLowerCase());
  for (const m of text.matchAll(/^<([^\s<>]+@[^\s<>]+)>:/gim)) recips.add(m[1].toLowerCase());
  const recipients = [...recips].filter((r) => r !== own && !/mailer-daemon|postmaster/i.test(r) && !r.includes("mailto:"));
  const diag =
    all.match(/Diagnostic-Code:\s*([^\n]+)/i)?.[1] ??
    all.match(/(5\d\d[ -]\d\.\d\.\d+[^\n]{0,160})/)?.[1] ??
    all.match(/(Remote Server returned[^\n]{0,200})/i)?.[1] ??
    all.match(/((?:wasn't|was not|couldn't be) found[^\n]{0,120})/i)?.[1] ??
    "";
  const references = [...new Set(all.match(/OD-[A-HJ-NP-Z2-9]{6}/g) ?? [])];
  const messageIds = [...new Set([...attachmentsText.matchAll(/^Message-ID:\s*(<[^>]+>)/gim)].map((m) => m[1]))];
  return { recipients, diagnostic: diag.replace(/\s+/g, " ").trim().slice(0, 300), references, messageIds };
}

export function isAutoReply(subject: string, headers: Map<string, string> | Record<string, string>): boolean {
  const get = (k: string) =>
    headers instanceof Map ? headers.get(k.toLowerCase()) : (headers as Record<string, string>)[k.toLowerCase()];
  if ((get("auto-submitted") ?? "").toLowerCase().startsWith("auto-")) return true;
  if (get("x-autoreply") || get("x-autorespond")) return true;
  if ((get("precedence") ?? "").toLowerCase() === "auto_reply") return true;
  return AUTO_REPLY_SUBJECT.test(subject.trim());
}

const URL_RE = /https?:\/\/[^\s<>"'()\[\]{}]+[^\s<>"'()\[\]{}.,;:!?]/gi;
const ANCHOR_RE = /<a\b[^>]*?href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
const SKIP_URL = /\.(png|jpe?g|gif|svg|webp|ico|css|js)(\?|$)|\/(pixel|track|open|beacon|img)\b|unsubscribe|list-manage|mailchimp\.com\/track|googleusercontent|gravatar|fonts\./i;
const LINK_PRIORITY = [/verif|confirm|validat|best(ä|ae)tig|token|otp/i, /portal|privacy|datenschutz|dsar|request|form|opt-?out|removal|suppress|delete|erase/i];

/** Extract actionable links from an e-mail (HTML anchors preferred, falls back to plain-text URLs). */
export function extractLinks(text: string, html?: string | null, max = 10): ExtractedLink[] {
  const found = new Map<string, string>();
  if (html) {
    for (const m of html.matchAll(ANCHOR_RE)) {
      const url = decodeEntities(m[1].trim());
      const label = decodeEntities(m[2].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim().slice(0, 80);
      if (/^https?:\/\//i.test(url) && !SKIP_URL.test(url) && !found.has(url)) found.set(url, label);
    }
  }
  for (const m of text.matchAll(URL_RE)) {
    const url = m[0];
    if (!SKIP_URL.test(url) && !found.has(url)) found.set(url, "");
  }
  const score = (u: string, l: string) => {
    let s = 0;
    LINK_PRIORITY.forEach((re, i) => {
      if (re.test(u) || re.test(l)) s += (LINK_PRIORITY.length - i) * 10;
    });
    if (l) s += 2;
    return s;
  };
  return [...found.entries()]
    .map(([url, label]) => ({ url, label: !label || /^https?:\/\//i.test(label) || label.length > 48 ? shortUrl(url) : label }))
    .sort((a, b) => score(b.url, b.label) - score(a.url, a.label))
    .slice(0, max);
}

function shortUrl(u: string): string {
  try {
    const x = new URL(u);
    const s = (x.host.replace(/^www\./, "") + x.pathname).replace(/\/$/, "");
    return s.length > 44 ? s.slice(0, 41) + "…" : s;
  } catch {
    return u.slice(0, 44);
  }
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

/** Strip quoted history and signatures so the classifier looks at the new content first. */
export function stripQuoted(text: string): string {
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    if (/^(on .+wrote:|am .+schrieb .*:|-----\s*(original|ursprüngliche|urspruengliche) (message|nachricht)|von: |from: |>)/i.test(line.trim())) break;
    out.push(line);
  }
  const stripped = out.join("\n").trim();
  return stripped.length > 40 ? stripped : text;
}
