import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { and, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import type { SearchParams } from "@/lib/flash";
import { str } from "@/lib/flash";
import { fmtDateTime } from "@/lib/format";
import EventLabel from "@/components/EventLabel";

export const dynamic = "force-dynamic";

export default async function ActivityPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const t = await getTranslations("activity");
  const tc = await getTranslations("common");
  const locale = await getLocale();
  const db = await getDb();
  const level = str(sp.level);
  const rows = await db
    .select({ a: schema.activityLog, reference: schema.requests.reference, brokerName: schema.brokers.name })
    .from(schema.activityLog)
    .leftJoin(schema.requests, eq(schema.requests.id, schema.activityLog.requestId))
    .leftJoin(schema.brokers, eq(schema.brokers.id, schema.requests.brokerId))
    .where(and(eq(schema.activityLog.userId, user.id), level === "warn" || level === "error" ? eq(schema.activityLog.level, level) : undefined))
    .orderBy(desc(schema.activityLog.createdAt))
    .limit(300)
    .all();
  return (
    <div className="max-w-5xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="mt-1 text-sm text-slate-500">{t("intro")}</p>
        </div>
        <form method="get" className="flex gap-2">
          <select name="level" defaultValue={level} className="input w-auto">
            <option value="">{tc("all")}</option>
            <option value="warn">{t("warnOnly")}</option>
            <option value="error">{t("errorOnly")}</option>
          </select>
          <button className="btn-secondary">{tc("search")}</button>
        </form>
      </div>
      {rows.length === 0 ? (
        <p className="card text-sm text-slate-500">{t("empty")}</p>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="table">
            <thead><tr><th>{t("when")}</th><th>{t("event")}</th><th>{t("request")}</th><th>{t("detail")}</th></tr></thead>
            <tbody>
              {rows.map(({ a, reference, brokerName }) => (
                <tr key={a.id} className={a.level === "error" ? "bg-red-50/60 dark:bg-red-950/30" : a.level === "warn" ? "bg-amber-50/60 dark:bg-amber-950/30" : ""}>
                  <td className="whitespace-nowrap text-xs text-slate-500">{fmtDateTime(a.createdAt, locale)}</td>
                  <td className="whitespace-nowrap"><EventLabel event={a.event} /></td>
                  <td className="whitespace-nowrap text-xs">{a.requestId ? <Link href={`/requests/${a.requestId}`} className="text-brand-700 underline dark:text-brand-100">{brokerName} · {reference}</Link> : "—"}</td>
                  <td className="max-w-xl break-words text-xs text-slate-600 dark:text-slate-300">{a.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
