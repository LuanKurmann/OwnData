import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { and, asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { LEGAL, JURISDICTION_LABEL } from "@/lib/legal";
import { render, varsFromRequest } from "@/lib/template-render";
import { escalationKey, getMailAccount, getProfile, resolveTemplate } from "@/server/requests";
import type { SearchParams } from "@/lib/flash";
import { daysUntil, fmtDate, fmtDateTime } from "@/lib/format";
import Flash from "@/components/Flash";
import StatusBadge from "@/components/StatusBadge";
import SubmitButton from "@/components/SubmitButton";
import CopyButton from "@/components/CopyButton";
import { deleteRequestAction, queueAction, reminderAction, saveNotesAction, setStatusAction, updateDraftAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function RequestDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  const db = getDb();
  const req = db.select().from(schema.requests).where(and(eq(schema.requests.id, Number(id)), eq(schema.requests.userId, user.id))).get();
  if (!req) notFound();
  const broker = db.select().from(schema.brokers).where(eq(schema.brokers.id, req.brokerId)).get();
  if (!broker) notFound();
  const msgs = db.select().from(schema.messages).where(eq(schema.messages.requestId, req.id)).orderBy(asc(schema.messages.occurredAt)).all();
  const t = await getTranslations("requests");
  const tt = await getTranslations("type");
  const tc = await getTranslations("common");
  const ts = await getTranslations("status");
  const locale = await getLocale();
  const profile = getProfile(user.id);
  const acc = getMailAccount(user.id);

  const editable = ["draft", "failed", "queued"].includes(req.status);
  const canRemind = ["sent", "acknowledged", "overdue", "reminded", "needs_info", "escalation_ready"].includes(req.status) && !!acc;
  const showEscalation = ["overdue", "reminded", "escalation_ready", "escalated", "rejected"].includes(req.status);
  const d = daysUntil(req.deadlineAt);
  const legal = LEGAL[req.jurisdiction];

  let escalationText: { subject: string; body: string } | null = null;
  if (showEscalation) {
    const tpl = resolveTemplate(user.id, escalationKey(req.jurisdiction, req.language));
    if (tpl) {
      const vars = varsFromRequest(req, broker, profile, acc?.fromEmail ?? profile.emails.split(/\r?\n/)[0] ?? "");
      escalationText = { subject: render(tpl.subject, vars), body: render(tpl.body, vars) };
    }
  }

  return (
    <div className="max-w-4xl">
      <Link href="/requests" className="text-sm text-slate-500 hover:underline">← {tc("back")}</Link>
      <div className="mt-2 mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t("detailTitle", { reference: req.reference })}</h1>
          <p className="text-sm text-slate-500">
            <Link href={`/brokers/${broker.id}`} className="font-medium hover:underline">{broker.name}</Link> · {tt(req.type)} · {JURISDICTION_LABEL[req.jurisdiction]}
          </p>
        </div>
        <StatusBadge status={req.status} />
      </div>
      <Flash sp={sp} />
      {broker.requiresIdVerification && !["completed", "rejected"].includes(req.status) ? (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">{t("idWarning")}</p>
      ) : null}
      {req.lastError ? <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-200">{t("lastError")}: {req.lastError}</p> : null}

      <div className="card mb-4 grid gap-3 text-sm md:grid-cols-4">
        <Meta k={t("to")} v={<span className="font-mono text-xs break-all">{req.toEmail}</span>} />
        <Meta k={t("sentAt")} v={fmtDateTime(req.sentAt, locale)} />
        <Meta
          k={t("deadline")}
          v={
            <>
              {fmtDate(req.deadlineAt, locale)}
              {d !== null && !["completed", "rejected", "escalated"].includes(req.status) ? (
                <span className={`ml-1 text-xs ${d < 0 ? "text-orange-600" : "text-slate-500"}`}>({d < 0 ? t("daysOverdue", { days: -d }) : t("daysLeft", { days: d })})</span>
              ) : null}
            </>
          }
        />
        <Meta k={t("lastResponse")} v={fmtDateTime(req.lastResponseAt, locale)} />
      </div>

      {/* Actions */}
      <div className="mb-6 flex flex-wrap gap-2">
        {editable ? (
          <>
            <form action={queueAction}><input type="hidden" name="id" value={req.id} /><input type="hidden" name="now" value="1" /><SubmitButton>{t("sendNow")}</SubmitButton></form>
            {req.status !== "queued" ? <form action={queueAction}><input type="hidden" name="id" value={req.id} /><SubmitButton className="btn-secondary">{t("queue")}</SubmitButton></form> : null}
          </>
        ) : null}
        {canRemind ? (
          <form action={reminderAction}><input type="hidden" name="id" value={req.id} /><SubmitButton className="btn-secondary">{t("sendReminder")}</SubmitButton></form>
        ) : null}
        {!["completed"].includes(req.status) && !editable ? (
          <form action={setStatusAction}><input type="hidden" name="id" value={req.id} /><input type="hidden" name="status" value="completed" /><SubmitButton className="btn-secondary">{t("markCompleted")}</SubmitButton></form>
        ) : null}
        {!["rejected", "completed"].includes(req.status) && !editable ? (
          <form action={setStatusAction}><input type="hidden" name="id" value={req.id} /><input type="hidden" name="status" value="rejected" /><SubmitButton className="btn-secondary">{t("markRejected")}</SubmitButton></form>
        ) : null}
        {["completed", "rejected", "escalated"].includes(req.status) ? (
          <form action={setStatusAction}><input type="hidden" name="id" value={req.id} /><input type="hidden" name="status" value={req.sentAt ? "sent" : "draft"} /><SubmitButton className="btn-secondary">{t("reopen")}</SubmitButton></form>
        ) : null}
        <form action={deleteRequestAction} className="ml-auto"><input type="hidden" name="id" value={req.id} /><SubmitButton className="btn-danger" confirm={tc("confirmDelete")}>{t("deleteRequest")}</SubmitButton></form>
      </div>

      {/* Draft editor or message preview */}
      {editable ? (
        <form action={updateDraftAction} className="card mb-6 flex flex-col gap-3">
          <h2 className="font-semibold">{t("editDraft")}</h2>
          <input type="hidden" name="id" value={req.id} />
          <div>
            <label className="label" htmlFor="toEmail">{t("to")}</label>
            <input id="toEmail" name="toEmail" type="email" className="input" defaultValue={req.toEmail} required />
          </div>
          <div>
            <label className="label" htmlFor="subject">{t("subject")}</label>
            <input id="subject" name="subject" className="input" defaultValue={req.subject} required />
          </div>
          <div>
            <label className="label" htmlFor="body">{t("body")}</label>
            <textarea id="body" name="body" className="input font-mono text-xs" rows={22} defaultValue={req.body} required />
          </div>
          <div><SubmitButton className="btn-secondary">{tc("save")}</SubmitButton></div>
        </form>
      ) : null}

      {/* Thread */}
      <div className="card mb-6">
        <h2 className="mb-3 font-semibold">{t("thread")}</h2>
        {msgs.length === 0 ? (
          <p className="text-sm text-slate-500">{t("noMessages")}</p>
        ) : (
          <ol className="flex flex-col gap-4">
            {msgs.map((m) => (
              <li key={m.id} className={`rounded-lg border p-3 ${m.direction === "out" ? "border-slate-200 dark:border-slate-800" : "border-brand-100 bg-brand-50/50 dark:border-slate-700 dark:bg-slate-800/50"}`}>
                <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="badge bg-slate-100 dark:bg-slate-800">{m.direction === "out" ? t("out") : t("in")} · {m.kind}</span>
                  <span>{fmtDateTime(m.occurredAt, locale)}</span>
                  <span className="truncate">{m.direction === "out" ? `→ ${m.toAddr}` : `← ${m.fromAddr}`}</span>
                  {m.classification ? <span className="badge bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">{t("classification")}: {m.classification}</span> : null}
                </div>
                <div className="text-sm font-medium">{m.subject}</div>
                <details className="mt-1">
                  <summary className="cursor-pointer text-xs text-slate-500">{t("body")}</summary>
                  <pre className="pre mt-2">{m.body}</pre>
                </details>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* Escalation */}
      {showEscalation && escalationText ? (
        <div className="card mb-6 border-red-200 dark:border-red-900">
          <h2 className="font-semibold">{t("escalation")}</h2>
          <p className="mt-1 text-sm text-slate-500">{t("escalationIntro")}</p>
          <p className="mt-2 text-sm">
            <span className="font-medium">{t("authority")}:</span> {legal.authority.name[req.language]} ·{" "}
            <a href={legal.authority.url} target="_blank" rel="noreferrer" className="text-brand-600 underline">{legal.authority.url}</a>
            {legal.authority.address ? <span className="block text-xs text-slate-500">{legal.authority.address}</span> : null}
          </p>
          <p className="mt-1 text-xs text-slate-500">{legal.authority.note[req.language]}</p>
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-medium text-brand-700 dark:text-brand-100">{t("escalationGenerate")}</summary>
            <div className="mt-2 flex flex-col gap-2">
              <div className="text-sm font-medium">{escalationText.subject}</div>
              <pre className="pre">{escalationText.body}</pre>
              <div className="flex gap-2">
                <CopyButton text={`${escalationText.subject}\n\n${escalationText.body}`} />
                {req.status !== "escalated" ? (
                  <form action={setStatusAction}><input type="hidden" name="id" value={req.id} /><input type="hidden" name="status" value="escalated" /><SubmitButton className="btn-secondary">{t("markEscalated")}</SubmitButton></form>
                ) : null}
              </div>
            </div>
          </details>
        </div>
      ) : null}

      {/* Notes + status override */}
      <form action={saveNotesAction} className="card flex flex-col gap-3">
        <input type="hidden" name="id" value={req.id} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="autoRemind" defaultChecked={req.autoRemind} /> {t("autoRemind")}
        </label>
        <div>
          <label className="label" htmlFor="notes">{t("notes")}</label>
          <textarea id="notes" name="notes" className="input" rows={3} defaultValue={req.notes} />
        </div>
        <div><SubmitButton className="btn-secondary">{tc("save")}</SubmitButton></div>
      </form>
      <form action={setStatusAction} className="mt-3 flex items-center gap-2 text-sm">
        <input type="hidden" name="id" value={req.id} />
        <label htmlFor="status">{t("setStatus")}</label>
        <select id="status" name="status" className="input w-auto" defaultValue={req.status}>
          {schema.REQUEST_STATUSES.map((s) => <option key={s} value={s}>{ts(s)}</option>)}
        </select>
        <SubmitButton className="btn-secondary">{tc("save")}</SubmitButton>
      </form>
    </div>
  );
}

function Meta({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{k}</dt>
      <dd className="mt-0.5">{v}</dd>
    </div>
  );
}
