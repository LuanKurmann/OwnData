import { getTranslations } from "next-intl/server";
import type { SearchParams } from "@/lib/flash";
import { str } from "@/lib/flash";

export default async function Flash({ sp }: { sp: SearchParams }) {
  const msg = str(sp.msg);
  if (!msg) return null;
  const kind = str(sp.kind, "ok");
  const t = await getTranslations("flash");
  const params: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) if (k !== "msg" && k !== "kind") params[k] = str(v);
  let text: string;
  try {
    text = (t as unknown as (k: string, p: Record<string, string>) => string)(msg, params);
  } catch {
    text = msg;
  }
  return (
    <div
      role="status"
      className={
        kind === "ok"
          ? "mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
          : "mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
      }
    >
      {text}
    </div>
  );
}
