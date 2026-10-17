import { describe, expect, it } from "vitest";
import { composeFullName, describeAddress, formatAddress } from "@/lib/address";

const base = { id: 1, userId: 1, kind: "current" as const, street: "Musterstrasse", houseNumber: "1", addressLine2: "", postalCode: "8000", city: "Zürich", region: "", country: "CH", fromYear: "", toYear: "", sortOrder: 0, createdAt: new Date() };

describe("addresses", () => {
  it("formats by country convention", () => {
    expect(formatAddress(base, "de")).toBe("Musterstrasse 1, 8000 Zürich, Schweiz");
    expect(formatAddress({ ...base, street: "Old Road", houseNumber: "5", postalCode: "SW1A 1AA", city: "London", country: "GB" }, "en")).toBe("5 Old Road, SW1A 1AA London, United Kingdom");
  });
  it("labels previous addresses", () => {
    expect(describeAddress({ ...base, kind: "previous", fromYear: "2015", toYear: "2020" }, "de")).toContain("(frühere Adresse, 2015–2020)");
  });
  it("composes names", () => {
    expect(composeFullName("Anna", "", "Muster")).toBe("Anna Muster");
    expect(composeFullName(" Anna ", "Maria", "Muster")).toBe("Anna Maria Muster");
  });
});
