import type { Address } from "@/db/schema";

/** Countries where the house number precedes the street name. */
const NUMBER_FIRST = new Set(["US", "GB", "CA", "AU", "NZ", "IE", "FR", "IN", "ZA"]);

export function countryName(code: string, locale: "de" | "en"): string {
  if (!code) return "";
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

export function formatAddress(a: Address, locale: "de" | "en"): string {
  const streetLine = NUMBER_FIRST.has(a.country.toUpperCase())
    ? [a.houseNumber, a.street].filter(Boolean).join(" ")
    : [a.street, a.houseNumber].filter(Boolean).join(" ");
  const cityLine = [a.postalCode, a.city].filter(Boolean).join(" ");
  const parts = [streetLine, a.addressLine2, cityLine, a.region, countryName(a.country, locale)].filter(Boolean);
  return parts.join(", ");
}

export function describeAddress(a: Address, locale: "de" | "en"): string {
  const base = formatAddress(a, locale);
  if (a.kind === "previous") {
    const span = [a.fromYear, a.toYear].filter(Boolean).join("–");
    const label = locale === "de" ? "frühere Adresse" : "previous address";
    return span ? `${base} (${label}, ${span})` : `${base} (${label})`;
  }
  return base;
}

export function composeFullName(first: string, middle: string, last: string): string {
  return [first, middle, last].map((s) => s.trim()).filter(Boolean).join(" ");
}

/** ISO 3166-1 alpha-2 codes; names come from Intl.DisplayNames at render time. */
export const COUNTRY_CODES = [
  "CH", "DE", "AT", "LI", "FR", "IT", "ES", "PT", "NL", "BE", "LU", "GB", "IE", "DK", "SE", "NO", "FI", "IS", "PL", "CZ", "SK", "HU", "SI", "HR", "RO", "BG", "GR", "CY", "MT", "EE", "LV", "LT",
  "US", "CA", "MX", "BR", "AR", "CL", "CO", "PE", "AU", "NZ", "JP", "KR", "CN", "HK", "SG", "TW", "IN", "TH", "VN", "ID", "MY", "PH", "AE", "SA", "IL", "TR", "ZA", "EG", "MA", "NG", "KE", "RU", "UA", "RS", "BA", "ME", "MK", "AL", "MD", "GE", "AM", "AZ", "KZ",
];

export function countryOptions(locale: "de" | "en"): Array<{ code: string; name: string }> {
  return COUNTRY_CODES.map((code) => ({ code, name: countryName(code, locale) })).sort((a, b) => a.name.localeCompare(b.name, locale));
}
