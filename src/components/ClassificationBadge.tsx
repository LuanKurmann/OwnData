import { useTranslations } from "next-intl";
import type { Classification } from "@/db/schema";

const COLORS: Record<Classification, string> = {
  completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  rejected: "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200",
  needs_info: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  action_required: "bg-amber-200 text-amber-900 dark:bg-amber-800 dark:text-amber-100",
  acknowledged: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  auto_reply: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  bounced: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  unknown: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

export default function ClassificationBadge({ value }: { value: Classification | string | null }) {
  const t = useTranslations("classification");
  const v = (value && value in COLORS ? value : "unknown") as Classification;
  return <span className={`badge ${COLORS[v]}`}>{t(v)}</span>;
}
