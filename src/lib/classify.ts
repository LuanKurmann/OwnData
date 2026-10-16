export type Classification = "completed" | "rejected" | "needs_info" | "acknowledged" | "unknown";

const RULES: Array<{ cls: Classification; patterns: RegExp[] }> = [
  {
    cls: "needs_info",
    patterns: [
      /verify (your )?identity/i,
      /proof of (your )?identity/i,
      /identit(ä|ae)tsnachweis/i,
      /ausweis(kopie)?/i,
      /identit(ä|ae)t (zu )?(best(ä|ae)tigen|nachweisen|verifizieren)/i,
      /additional (information|details)/i,
      /weitere (angaben|informationen)/i,
      /government[- ]issued id/i,
      /unable to (locate|find) (your|a) (record|profile|account)/i,
      /konnten (wir )?(keine|keinen) (daten|eintrag)/i,
    ],
  },
  {
    cls: "completed",
    patterns: [
      /\b(has|have) been (deleted|removed|erased|suppressed|opted out)/i,
      /\b(deleted|removed|erased) (your|the) (data|information|record|profile|listing)/i,
      /request (has been|was) (completed|processed|fulfilled)/i,
      /successfully (removed|deleted|opted)/i,
      /wurde(n)? gel(ö|oe)scht/i,
      /haben (wir )?(ihre )?(daten|eintrag|angaben) (vollst(ä|ae)ndig )?gel(ö|oe)scht/i,
      /l(ö|oe)schung (ist|wurde) (erfolgt|durchgef(ü|ue)hrt|abgeschlossen|vorgenommen)/i,
      /(entfernt|gesperrt) (worden|wurde)/i,
      /no longer (hold|process|have)/i,
      /ihrem (antrag|begehren|wunsch) (wurde|haben wir) entsprochen/i,
    ],
  },
  {
    cls: "rejected",
    patterns: [
      /we (are unable to|cannot|can't|will not|decline to) (delete|remove|comply|process)/i,
      /(k(ö|oe)nnen|werden) (wir )?(ihrem|dem) (antrag|begehren|wunsch) (leider )?nicht (entsprechen|nachkommen)/i,
      /nicht (gel(ö|oe)scht|entfernt) werden/i,
      /legal obligation to retain/i,
      /gesetzliche(n)? aufbewahrungs(pflicht|frist)/i,
      /request (is|has been) denied/i,
      /abgelehnt/i,
    ],
  },
  {
    cls: "acknowledged",
    patterns: [
      /received your (request|message|e-?mail)/i,
      /(acknowledge|confirm) receipt/i,
      /we (will|are) (process|review|look)/i,
      /(haben|ist) (ihre|ihr) (anfrage|antrag|nachricht|e-?mail|begehren) erhalten/i,
      /eingang(sbest(ä|ae)tigung)?/i,
      /wird (bearbeitet|gepr(ü|ue)ft)/i,
      /in bearbeitung/i,
      /ticket/i,
      /case (number|id)/i,
    ],
  },
];

/** Keyword heuristic over subject + body. Users can override the result manually. */
export function classifyReply(subject: string, body: string): Classification {
  const text = `${subject}\n${body}`.slice(0, 6000);
  for (const rule of RULES) {
    if (rule.patterns.some((p) => p.test(text))) return rule.cls;
  }
  return "unknown";
}

export function isAutoReply(subject: string, headers: Map<string, string> | Record<string, string>): boolean {
  const get = (k: string) =>
    headers instanceof Map ? headers.get(k.toLowerCase()) : (headers as Record<string, string>)[k.toLowerCase()];
  if ((get("auto-submitted") ?? "").toLowerCase().startsWith("auto-")) return true;
  if (get("x-autoreply") || get("x-autorespond")) return true;
  return /^(auto(matic)?[- ]?reply|out of office|abwesenheit|automatische antwort)/i.test(subject);
}
