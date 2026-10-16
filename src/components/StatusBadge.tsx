import { useTranslations } from "next-intl";
import type { RequestStatus } from "@/db/schema";

const COLORS: Record<RequestStatus, string> = {
  draft: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  queued: "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200",
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  acknowledged: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  needs_info: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  rejected: "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200",
  overdue: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  reminded: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  escalation_ready: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  escalated: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export default function StatusBadge({ status }: { status: RequestStatus }) {
  const t = useTranslations("status");
  return <span className={`badge ${COLORS[status]}`}>{t(status)}</span>;
}
