import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { and, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { REQUEST_STATUSES, type RequestStatus } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import type { SearchParams } from "@/lib/flash";
import { str } from "@/lib/flash";
import { daysUntil, fmtDate } from "@/lib/format";
import Flash from "@/components/Flash";
import StatusBadge from "@/components/StatusBadge";
import SubmitButton from "@/components/SubmitButton";
import { runWorkerAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function RequestsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const t = await getTranslations("requests");
  const ts = await getTranslations("status");
  const tt = await getTranslations("type");
  const tc = await getTranslations("common");
  const locale = await getLocale();
  const status = str(sp.status) as RequestStatus | "";
  const db = getDb();
  const rows = db
    .select({ req: schema.requests, broker: schema.brokers })
    .from(schema.requests)
    .innerJoin(schema.brokers, eq(schema.brokers.id, schema.requests.brokerId))
    .where(and(eq(schema.requests.userId, user.id), status ? eq(schema.requests.status, status) : undefined))
    .orderBy(desc(schema.requests.updatedAt))
    .all();

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <div className="flex flex-wrap gap-2">
          <form method="get" className="flex gap-2">
            <select name="status" defaultValue={status} className="input w-auto">
              <option value="">{t("filterStatus")}: {tc("all")}</option>
              {REQUEST_STATUSES.map((s) => <option key={s} value={s}>{ts(s)}</option>)}
            </select>
            <button className="btn-secondary">{tc("search")}</button>
          </form>
          <form action={runWorkerAction} title={tc("runWorkerHint")}>
            <input type="hidden" name="back" value="/requests" />
            <SubmitButton className="btn-secondary">{tc("runWorker")}</SubmitButton>
          </form>
        </div>
      </div>
      <Flash sp={sp} />
      {rows.length === 0 ? (
        <p className="card text-sm text-slate-500">{t("empty")}</p>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="table">
            <thead>
              <tr>
                <th>{t("broker")}</th>
                <th>{t("reference")}</th>
                <th>{t("type")}</th>
                <th>{t("status")}</th>
                <th>{t("sentAt")}</th>
                <th>{t("deadline")}</th>
                <th>{t("lastResponse")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ req, broker }) => {
                const d = daysUntil(req.deadlineAt);
                const open = !["completed", "rejected", "escalated", "draft", "queued", "failed"].includes(req.status);
                return (
                  <tr key={req.id}>
                    <td><Link href={`/requests/${req.id}`} className="font-medium hover:underline">{broker.name}</Link></td>
                    <td className="font-mono text-xs">{req.reference}</td>
                    <td>{tt(req.type)}</td>
                    <td><StatusBadge status={req.status} /></td>
                    <td>{fmtDate(req.sentAt, locale)}</td>
                    <td>
                      {fmtDate(req.deadlineAt, locale)}
                      {open && d !== null ? (
                        <div className={`text-xs ${d < 0 ? "text-orange-600" : "text-slate-500"}`}>
                          {d < 0 ? t("daysOverdue", { days: -d }) : t("daysLeft", { days: d })}
                        </div>
                      ) : null}
                    </td>
                    <td>{fmtDate(req.lastResponseAt, locale)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
