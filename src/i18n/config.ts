export const LOCALES = ["de", "en"] as const;
export type Locale = (typeof LOCALES)[number];
