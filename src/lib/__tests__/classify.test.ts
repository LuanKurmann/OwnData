import { describe, expect, it } from "vitest";
import { classifyReply, extractBounceInfo, extractLinks, isAutoReply, isBounce, stripQuoted } from "@/lib/classify";

const H = (o: Record<string, string> = {}) => new Map(Object.entries(o));

describe("classifyReply", () => {
  it("detects completion in German and English", () => {
    expect(classifyReply("Re: Antrag", "Sehr geehrter Herr Muster, wir haben Ihre Daten vollständig gelöscht.").classification).toBe("completed");
    expect(classifyReply("Re: Request", "Your personal information has been removed from our database.").classification).toBe("completed");
    expect(classifyReply("Re: Antrag", "Wir haben generell zu Ihnen keine Daten in unseren Systemen, ausser Ihrem Namen auf unserer Sperrliste.").classification).toBe("completed");
  });
  it("prefers an action over a weak refusal", () => {
    const r = classifyReply("Privacy Instructions", "We do not process privacy requests received via email. Please use our Opt-Out Form: https://example.com/removal");
    expect(r.classification).toBe("action_required");
    expect(r.hints).toContain("fill_form");
  });
  it("detects confirmation links", () => {
    const r = classifyReply("Confirm", "Please click the link below to confirm your request: https://example.com/confirm/abc");
    expect(r.classification).toBe("action_required");
    expect(r.hints).toEqual(expect.arrayContaining(["confirm_request", "click_link"]));
  });
  it("detects identity verification requests", () => {
    const r = classifyReply("Re: Request", "Before we can process your request we need you to verify your identity. Please reply with a copy of your government-issued ID.");
    expect(r.classification).toBe("needs_info");
    expect(r.hints).toContain("verify_identity");
  });
  it("detects requests for more details", () => {
    const r = classifyReply("Re: Request", "We were unable to locate an account with your email address. Please provide us with your Member ID and the name associated with your account.");
    expect(r.classification).toBe("needs_info");
    expect(r.hints).toContain("provide_info");
  });
  it("detects strong rejections", () => {
    expect(classifyReply("Re", "Leider können wir Ihrem Antrag nicht nachkommen.").classification).toBe("rejected");
    expect(classifyReply("Re", "Your request has been denied.").classification).toBe("rejected");
  });
  it("detects acknowledgements and ticket numbers", () => {
    expect(classifyReply("Ihre Anfrage", "Besten Dank für Ihre Nachricht. Wir werden uns schnellstmöglich um Ihr Anliegen kümmern.").classification).toBe("acknowledged");
    expect(classifyReply("[##123##] Your ticket has been created", "We have received your request.").classification).toBe("acknowledged");
  });
  it("does not read legal boilerplate as a question", () => {
    const r = classifyReply("Automatic reply", "Wir bestätigen den Eingang Ihrer E-Mail. Information zum Datenschutz: innerhalb eines Monats werden der betroffenen Person Informationen zur Verfügung gestellt.");
    expect(r.classification).toBe("acknowledged");
    expect(r.hints).toHaveLength(0);
  });
});

describe("isAutoReply", () => {
  it("uses headers and subjects", () => {
    expect(isAutoReply("Automatische Antwort: Abwesenheit", H())).toBe(true);
    expect(isAutoReply("Re: x", H({ "auto-submitted": "auto-replied" }))).toBe(true);
    expect(isAutoReply("Re: x", H())).toBe(false);
  });
});

describe("bounces", () => {
  const dsnHeaders = H({ "content-type": 'multipart/report; report-type=delivery-status; boundary="x"' });
  it("detects non-delivery reports", () => {
    expect(isBounce("Undelivered Mail Returned to Sender", "Mail Delivery System <MAILER-DAEMON@mail.example>", H())).toBe(true);
    expect(isBounce("Undeliverable: Antrag", "postmaster@example.com", dsnHeaders)).toBe(true);
    expect(isBounce("Re: Antrag", "privacy@example.com", H())).toBe(false);
  });
  it("extracts recipient, diagnostic and our reference from a DSN", () => {
    const text = "This is the mail system. <privacy@broker.example>: host mx.broker.example said: 550 5.1.1 User unknown\nFinal-Recipient: rfc822; privacy@broker.example\nDiagnostic-Code: smtp; 550 5.1.1 User unknown";
    const att = "Message-ID: <abc@owndata.test>\nSubject: Request [OD-ABC234]\n";
    const info = extractBounceInfo(text, att, "me@owndata.test");
    expect(info.recipients).toEqual(["privacy@broker.example"]);
    expect(info.references).toEqual(["OD-ABC234"]);
    expect(info.messageIds).toEqual(["<abc@owndata.test>"]);
    expect(info.diagnostic).toContain("550 5.1.1");
  });
  it("handles Exchange style NDRs", () => {
    const text = "Your message to datenschutz@broker.example couldn't be delivered. datenschutz wasn't found at broker.example.";
    const info = extractBounceInfo(text, "", "me@owndata.test");
    expect(info.recipients).toEqual(["datenschutz@broker.example"]);
  });
});

describe("extractLinks", () => {
  it("prefers confirmation links and skips images and unsubscribe links", () => {
    const html = '<a href="https://x.test/img.png">img</a><a href="https://x.test/unsubscribe">Unsubscribe</a><a href="https://x.test/portal">Privacy portal</a><a href="https://x.test/verify?token=1">Confirm request</a>';
    const links = extractLinks("plain https://x.test/other", html);
    expect(links[0].url).toBe("https://x.test/verify?token=1");
    expect(links.map((l) => l.url)).not.toContain("https://x.test/img.png");
    expect(links.map((l) => l.url)).not.toContain("https://x.test/unsubscribe");
  });
});

describe("stripQuoted", () => {
  it("drops quoted history", () => {
    const s = stripQuoted("Thanks, we deleted everything you asked for in your request.\n\nOn Mon, X wrote:\n> please delete");
    expect(s).not.toContain("please delete");
  });
});
