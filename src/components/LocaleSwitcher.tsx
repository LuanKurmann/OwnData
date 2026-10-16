import { getLocale } from "next-intl/server";
import { setLocaleAction } from "@/app/(app)/actions";
import { LOCALES } from "@/i18n/config";

export default async function LocaleSwitcher() {
  const current = await getLocale();
  return (
    <form action={setLocaleAction} className="flex gap-1">
      {LOCALES.map((l) => (
        <button
          key={l}
          name="locale"
          value={l}
          className={`rounded px-2 py-0.5 text-xs uppercase ${
            l === current ? "bg-brand-600 text-white" : "text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800"
          }`}
        >
          {l}
        </button>
      ))}
    </form>
  );
}
