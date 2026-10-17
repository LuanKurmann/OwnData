import { describe, expect, it } from "vitest";
import { brokerTokens, domainsRelated, emailAddress, emailDomain } from "@/lib/match";
import { pickConfirmationLinks } from "@/lib/automation";

describe("brokerTokens", () => {
  it("keeps distinctive tokens only", () => {
    expect(brokerTokens("localsearch (local.ch / search.ch)")).toEqual(["localsearch", "local.ch", "search.ch"]);
    expect(brokerTokens("Intrum AG")).toEqual(["intrum"]);
    expect(brokerTokens("Dun & Bradstreet Schweiz (ehem. Bisnode)")).toEqual(["bradstreet", "bisnode"]);
  });
});

describe("domains", () => {
  it("parses addresses", () => {
    expect(emailAddress('"Spokeo Customer Care" <support@spokeo.zendesk.com>')).toBe("support@spokeo.zendesk.com");
    expect(emailDomain("a@b.example.com")).toBe("b.example.com");
  });
  it("relates sub-domains and shared root domains", () => {
    expect(domainsRelated("mail.broker.com", ["broker.com"])).toBe(true);
    expect(domainsRelated("broker.com", ["privacy.broker.com"])).toBe(true);
    expect(domainsRelated("other.com", ["broker.com"])).toBe(false);
  });
});

describe("pickConfirmationLinks", () => {
  it("only picks confirm-like links", () => {
    const picked = pickConfirmationLinks([
      { url: "https://x.test/unsubscribe", label: "Unsubscribe" },
      { url: "https://x.test/privacy", label: "Privacy" },
      { url: "https://x.test/verify?token=1", label: "Confirm" },
    ]);
    expect(picked).toEqual([{ url: "https://x.test/verify?token=1", label: "Confirm" }]);
  });
});
