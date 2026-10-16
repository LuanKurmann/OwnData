import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { and, desc, eq, isNull, or } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import type { SearchParams } from "@/lib/flash";
import { fmtDate } from "@/lib/format";
import Flash from "@/components/Flash";
import StatusBadge from "@/components/StatusBadge";
import SubmitButton from "@/components/SubmitButton";
import BrokerForm from "../BrokerForm";
import { copyBrokerAction, deleteBrokerAction } from "../actions";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // mail sending / IMAP polling inside server actions (Vercel)

export default async function BrokerDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  const db = await getDb();
  const b = await db
    .select()
    .from(schema.brokers)
    .where(and(eq(schema.brokers.id, Number(id)), or(isNull(schema.brokers.userId), eq(schema.brokers.userId, user.id))))
    .get();
  if (!b) notFound();
  const t = await getTranslations("brokers");
  const tr = await getTranslations("requests");
  const tj = await getTranslations("jurisdiction");
  const tt = await getTranslations("type");
  const tc = await getTranslations("common");
  const locale = await getLocale();
  const reqs = await db
    .select()
    .from(schema.requests)
    .where(and(eq(schema.requests.brokerId, b.id), eq(schema.requests.userId, user.id)))
    .orderBy(desc(schema.requests.createdAt))
    .all();
  const own = b.userId === user.id;

  return (
    <div className="max-w-3xl">
      <Link href="/brokers" className="text-sm text-slate-500 hover:underline">← {tc("back")}</Link>
      <h1 className="mt-2 text-2xl font-semibold">{own ? t("editTitle") : b.name}</h1>
      <div className="mb-6 mt-1 flex flex-wrap gap-2 text-sm text-slate-500">
        <span className="badge bg-slate-100 dark:bg-slate-800">{b.isCurated ? t("curated") : t("custom")}</span>
        <span>{tj(b.jurisdiction)}</span>
        {b.country ? <span>· {b.country}</span> : null}
      </div>
      <Flash sp={sp} />

      {own ? (
        <>
          <BrokerForm b={b} />
          <form action={deleteBrokerAction} className="mt-4">
            <input type="hidden" name="id" value={b.id} />
            <SubmitButton className="btn-danger" confirm={tc("confirmDelete")}>{t("deleteBroker")}</SubmitButton>
            <span className="ml-2 text-xs text-slate-500">{t("deleteBrokerHint")}</span>
          </form>
        </>
      ) : (
        <div className="card">
          <dl className="grid gap-3 text-sm md:grid-cols-2">
            <Row k={t("website")} v={b.website ? <a className="text-brand-600 underline" href={b.website} target="_blank" rel="noreferrer">{b.website}</a> : "—"} />
            <Row k={t("privacyEmail")} v={<span className="font-mono">{b.privacyEmail || "—"}</span>} />
            <Row k={t("privacyUrl")} v={b.privacyUrl ? <a className="text-brand-600 underline break-all" href={b.privacyUrl} target="_blank" rel="noreferrer">{b.privacyUrl}</a> : "—"} />
            <Row k={t("optOutUrl")} v={b.optOutUrl ? <a className="text-brand-600 underline break-all" href={b.optOutUrl} target="_blank" rel="noreferrer">{b.optOutUrl}</a> : "—"} />
            <Row k={t("requiresId")} v={b.requiresIdVerification ? tc("yes") : tc("no")} />
            <Row k={t("notes")} v={b.notes || "—"} />
          </dl>
          <p className="mt-4 text-xs text-slate-500">{t("curatedReadonly")}</p>
          <form action={copyBrokerAction} className="mt-2">
            <input type="hidden" name="id" value={b.id} />
            <SubmitButton className="btn-secondary">{t("copyAsCustom")}</SubmitButton>
          </form>
        </div>
      )}

      <h2 className="mb-2 mt-8 font-semibold">{tr("title")}</h2>
      {reqs.length === 0 ? (
        <p className="text-sm text-slate-500">—</p>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="table">
            <thead><tr><th>{tr("reference")}</th><th>{tr("type")}</th><th>{tr("status")}</th><th>{tr("sentAt")}</th><th>{tr("deadline")}</th></tr></thead>
            <tbody>
              {reqs.map((r) => (
                <tr key={r.id}>
                  <td><Link href={`/requests/${r.id}`} className="font-mono text-xs hover:underline">{r.reference}</Link></td>
                  <td>{tt(r.type)}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td>{fmtDate(r.sentAt, locale)}</td>
                  <td>{fmtDate(r.deadlineAt, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{k}</dt>
      <dd className="mt-0.5">{v}</dd>
    </div>
  );
}
