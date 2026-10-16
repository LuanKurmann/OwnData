import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { LOCALES, type Locale } from "./config";

export default getRequestConfig(async () => {
  const store = await cookies();
  const raw = store.get("locale")?.value;
  const fallback = (process.env.DEFAULT_LOCALE as Locale) ?? "de";
  const locale: Locale = LOCALES.includes(raw as Locale) ? (raw as Locale) : LOCALES.includes(fallback) ? fallback : "de";
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    timeZone: "Europe/Zurich",
  };
});
