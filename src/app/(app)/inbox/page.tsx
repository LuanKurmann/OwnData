import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { and, desc, eq } from "drizzle-orm";
import { ExternalLink } from "lucide-react";
import { getDb, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import type { SearchParams } from "@/lib/flash";
import { str } from "@/lib/flash";
import { fmtDateTime } from "@/lib/format";
import { assignableRequests, parseHints, parseLinks } from "@/server/inbox";
import Flash from "@/components/Flash";
import StatusBadge from "@/components/StatusBadge";
import SubmitButton from "@/components/SubmitButton";
import ClassificationBadge from "@/components/ClassificationBadge";
import { runWorkerAction } from "../actions";
import { assignAction, ignoreAction, unignoreAction } from "./actions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function InboxPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const t = await getTranslations("inbox");
  const tc = await getTranslations("common");
  const th = await getTranslations("hints");
  const locale = await getLocale();
  const tab = (["open", "matched", "ignored"].includes(str(sp.tab)) ? str(sp.tab) : "open") as "open" | "matched" | "ignored";
  const db = await getDb();
  const status = tab === "open" ? "unmatched" : tab === "matched" ? "matched" : "ignored";
  const rows = await db
    .select()
    .from(schema.inbox)
    .where(and(eq(schema.inbox.userId, user.id), eq(schema.inbox.status, status)))
    .orderBy(desc(schema.inbox.receivedAt))
    .limit(200)
    .all();
  const requests = tab === "matched" ? [] : await assignableRequests(user.id);
  const reqById = new Map<number, { reference: string; brokerName: string; status: schema.RequestStatus }>();
  if (tab === "matched") {
    const all = await db
      .select({ id: schema.requests.id, reference: schema.requests.reference, status: schema.requests.status, brokerName: schema.brokers.name })
      .from(schema.requests)
      .innerJoin(schema.brokers, eq(schema.brokers.id, schema.requests.brokerId))
      .where(eq(schema.requests.userId, user.id))
      .all();
    for (const r of all) reqById.set(r.id, r);
  }
  const counts = {
    open: (await db.select({ id: schema.inbox.id }).from(schema.inbox).where(and(eq(schema.inbox.userId, user.id), eq(schema.inbox.status, "unmatched"))).all()).length,
  };

  return (
    <div className="max-w-5xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">{t("intro")}</p>
        </div>
        <form action={runWorkerAction} title={tc("runWorkerHint")}>
          <input type="hidden" name="back" value="/inbox" />
          <SubmitButton className="btn-secondary">{t("poll")}</SubmitButton>
        </form>
      </div>
      <Flash sp={sp} />
      <div className="mb-4 flex gap-1 border-b border-slate-200 text-sm dark:border-slate-800">
        {(["open", "matched", "ignored"] as const).map((k) => (
          <Link
            key={k}
            href={`/inbox?tab=${k}`}
            className={`-mb-px border-b-2 px-3 py-2 ${tab === k ? "border-brand-600 font-medium text-brand-700 dark:text-brand-100" : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"}`}
          >
            {t(`tab_${k}`)}
            {k === "open" && counts.open ? <span className="ml-1 rounded-full bg-amber-100 px-1.5 text-xs text-amber-800 dark:bg-amber-900 dark:text-amber-200">{counts.open}</span> : null}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="card text-sm text-slate-500">{t(`empty_${tab}`)}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((m) => {
            const links = parseLinks(m);
            const hints = parseHints(m);
            const linked = m.requestId ? reqById.get(m.requestId) : null;
            return (
              <li key={m.id} className="card">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{m.subject || "(ohne Betreff)"}</div>
                    <div className="truncate text-xs text-slate-500">
                      {m.fromName ? `${m.fromName} · ` : ""}
                      <span className="font-mono">{m.fromAddr}</span> · {fmtDateTime(m.receivedAt, locale)}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <ClassificationBadge value={m.classification} />
                    {linked ? (
                      <Link href={`/requests/${m.requestId}`} className="flex items-center gap-1 text-xs text-brand-700 underline dark:text-brand-100">
                        {linked.brokerName} · {linked.reference} <StatusBadge status={linked.status} />
                      </Link>
                    ) : null}
                  </div>
                </div>
                {hints.length ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {hints.map((h) => <span key={h} className="badge bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200">{th(h)}</span>)}
                  </div>
                ) : null}
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-slate-500">{t("showBody")}</summary>
                  <pre className="pre mt-2 max-h-80 overflow-auto">{m.body}</pre>
                </details>
                {links.length ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {links.slice(0, 5).map((l) => (
                      <a key={l.url} href={l.url} target="_blank" rel="noreferrer noopener" className="btn-secondary px-2 py-1 text-xs" title={l.url}>
                        <ExternalLink className="h-3 w-3" /> {l.label}
                      </a>
                    ))}
                  </div>
                ) : null}
                {tab !== "matched" ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                    <form action={assignAction} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="inboxId" value={m.id} />
                      <select name="requestId" className="input w-auto max-w-xs" defaultValue="" required>
                        <option value="" disabled>{t("assignTo")}</option>
                        {requests.map((r) => (
                          <option key={r.req.id} value={r.req.id}>
                            {r.brokerName} · {r.req.reference}
                          </option>
                        ))}
                      </select>
                      <label className="flex items-center gap-1 text-xs text-slate-500" title={t("learnHint")}>
                        <input type="checkbox" name="learn" value="on" defaultChecked /> {t("learn")}
                      </label>
                      <SubmitButton className="btn-primary">{t("assign")}</SubmitButton>
                    </form>
                    {tab === "open" ? (
                      <form action={ignoreAction} className="ml-auto">
                        <input type="hidden" name="inboxId" value={m.id} />
                        <SubmitButton className="btn-secondary">{t("ignore")}</SubmitButton>
                      </form>
                    ) : (
                      <form action={unignoreAction} className="ml-auto">
                        <input type="hidden" name="inboxId" value={m.id} />
                        <SubmitButton className="btn-secondary">{t("unignore")}</SubmitButton>
                      </form>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
