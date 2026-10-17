import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { and, asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { LEGAL, JURISDICTION_LABEL } from "@/lib/legal";
import { render, varsFromRequest } from "@/lib/template-render";
import { escalationKey, followupKey, getMailAccount, getProfile, resolveTemplate, FOLLOWUP_KINDS, type FollowupKind } from "@/server/requests";
import { parseHints, parseLinks } from "@/server/inbox";
import ClassificationBadge from "@/components/ClassificationBadge";
import { ExternalLink } from "lucide-react";
import { str } from "@/lib/flash";
import type { SearchParams } from "@/lib/flash";
import { daysUntil, fmtDate, fmtDateTime } from "@/lib/format";
import Flash from "@/components/Flash";
import StatusBadge from "@/components/StatusBadge";
import SubmitButton from "@/components/SubmitButton";
import { deleteRequestAction, formSubmittedAction, queueAction, reminderAction, replyAction, resolveActionAction, saveNotesAction, setStatusAction, updateDraftAction } from "../actions";
import EventLabel from "@/components/EventLabel";
import CopyButton from "@/components/CopyButton";
import { describeAddress } from "@/lib/address";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // mail sending / IMAP polling inside server actions (Vercel)

export default async function RequestDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  const db = await getDb();
  const req = await db.select().from(schema.requests).where(and(eq(schema.requests.id, Number(id)), eq(schema.requests.userId, user.id))).get();
  if (!req) notFound();
  const broker = await db.select().from(schema.brokers).where(eq(schema.brokers.id, req.brokerId)).get();
  if (!broker) notFound();
  const outMsgs = await db.select().from(schema.messages).where(eq(schema.messages.requestId, req.id)).orderBy(asc(schema.messages.occurredAt)).all();
  const inMails = await db.select().from(schema.inbox).where(and(eq(schema.inbox.requestId, req.id), eq(schema.inbox.userId, user.id))).orderBy(asc(schema.inbox.receivedAt)).all();
  type ThreadItem =
    | { kind: "out"; at: Date; msg: (typeof outMsgs)[number] }
    | { kind: "in"; at: Date; mail: (typeof inMails)[number] };
  const thread: ThreadItem[] = [
    ...outMsgs.map((m) => ({ kind: "out" as const, at: m.occurredAt, msg: m })),
    ...inMails.map((m) => ({ kind: "in" as const, at: m.receivedAt, mail: m })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());
  const latestIn = inMails.filter((m) => !["auto_reply", "bounced"].includes(m.classification) && m.fromAddr !== "owndata").at(-1) ?? null;
  const th = await getTranslations("hints");
  const t = await getTranslations("requests");
  const tt = await getTranslations("type");
  const tc = await getTranslations("common");
  const ts = await getTranslations("status");
  const locale = await getLocale();
  const profile = await getProfile(user.id);
  const acc = await getMailAccount(user.id);
  const activity = await db.select().from(schema.activityLog).where(eq(schema.activityLog.requestId, req.id)).orderBy(asc(schema.activityLog.createdAt)).all();
  const formOnly = broker.preferredChannel === "form" && !!broker.optOutUrl;
  const formData = [
    `${profile.fullName}`,
    profile.birthDate ? `${profile.birthDate}` : "",
    ...profile.addressList.map((a) => describeAddress(a, req.language)),
    ...profile.emails.split(/\r?\n/).filter(Boolean),
    ...profile.phones.split(/\r?\n/).filter(Boolean),
    ...(broker.dataUrls ? broker.dataUrls.split(/\r?\n/).filter(Boolean) : []),
  ].filter(Boolean);

  const editable = ["draft", "failed", "queued", "bounced"].includes(req.status);
  const canRemind = ["sent", "acknowledged", "overdue", "reminded", "needs_info", "action_required", "escalation_ready"].includes(req.status) && !!acc;
  const showNextSteps = latestIn && !latestIn.handledAt && ["needs_info", "action_required", "unknown"].includes(latestIn.classification) && !["completed", "rejected", "escalated"].includes(req.status);
  const canReply = !!acc && !!req.sentAt;
  // reply composer prefill from a follow-up template
  const tplKind = (FOLLOWUP_KINDS as readonly string[]).includes(str(sp.tpl)) ? (str(sp.tpl) as FollowupKind) : null;
  let replyPrefill = { subject: `Re: ${latestIn?.subject || req.subject}`, body: "" };
  if (tplKind) {
    const tpl = await resolveTemplate(user.id, followupKey(tplKind, req.language));
    if (tpl) {
      const vars = varsFromRequest(req, broker, profile, acc?.fromEmail ?? "");
      replyPrefill = { subject: latestIn?.subject ? `Re: ${latestIn.subject.replace(/^(re|aw|wg|fwd?):\s*/i, "")}` : render(tpl.subject, vars), body: render(tpl.body, vars) };
    }
  }
  const showEscalation = ["overdue", "reminded", "escalation_ready", "escalated", "rejected"].includes(req.status);
  const d = daysUntil(req.deadlineAt);
  const legal = LEGAL[req.jurisdiction];

  let escalationText: { subject: string; body: string } | null = null;
  if (showEscalation) {
    const tpl = await resolveTemplate(user.id, escalationKey(req.jurisdiction, req.language));
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
      {req.status === "bounced" ? (
        <div className="card mb-4 border-red-200 dark:border-red-900">
          <h2 className="font-semibold text-red-700 dark:text-red-300">{t("bouncedTitle")}</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t("bouncedIntro")}</p>
          {req.lastError ? <p className="mt-2 font-mono text-xs text-red-700 dark:text-red-300">{req.lastError}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {broker.optOutUrl ? <a href={broker.optOutUrl} target="_blank" rel="noreferrer noopener" className="btn-secondary"><ExternalLink className="h-3.5 w-3.5" /> {t("openForm")}</a> : null}
            {broker.privacyUrl ? <a href={broker.privacyUrl} target="_blank" rel="noreferrer noopener" className="btn-secondary"><ExternalLink className="h-3.5 w-3.5" /> {t("openPrivacyPage")}</a> : null}
            <Link href={`/brokers/${broker.id}`} className="btn-secondary">{t("checkBroker")}</Link>
          </div>
          {broker.privacyEmail && broker.privacyEmail.toLowerCase() !== req.toEmail.toLowerCase() ? (
            <p className="mt-2 text-xs text-slate-500">{t("brokerHasNewEmail", { email: broker.privacyEmail })}</p>
          ) : null}
        </div>
      ) : req.lastError ? (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-200">{t("lastError")}: {req.lastError}</p>
      ) : null}
      {broker.preferredChannel === "form" && broker.optOutUrl && !["completed", "rejected"].includes(req.status) ? (
        <p className="mb-4 flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">
          {t("formOnlyHint")}
          <a href={broker.optOutUrl} target="_blank" rel="noreferrer noopener" className="underline">{broker.optOutUrl}</a>
        </p>
      ) : null}

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
            <form action={queueAction}><input type="hidden" name="id" value={req.id} /><input type="hidden" name="now" value="1" /><SubmitButton>{req.status === "bounced" ? t("resend") : t("sendNow")}</SubmitButton></form>
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
            <input id="toEmail" name="toEmail" type="email" className="input" defaultValue={req.status === "bounced" && broker.privacyEmail && broker.privacyEmail.toLowerCase() !== req.toEmail.toLowerCase() ? broker.privacyEmail : req.toEmail} required />
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

      {/* Form-only broker: data to paste + "submitted" button */}
      {formOnly && !["completed", "rejected", "escalated"].includes(req.status) && !req.formSubmittedAt ? (
        <div className="card mb-6 border-amber-200 dark:border-amber-900">
          <h2 className="font-semibold">{t("formTitle")}</h2>
          <p className="mt-1 text-sm text-slate-500">{t("formIntro")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={broker.optOutUrl} target="_blank" rel="noreferrer noopener" className="btn-primary"><ExternalLink className="h-4 w-4" /> {t("openForm")}</a>
            <CopyButton text={formData.join("\n")} />
            <CopyButton text={req.body} className="btn-secondary" />
          </div>
          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-slate-500">{t("formDataPreview")}</summary>
            <pre className="pre mt-2">{formData.join("\n")}</pre>
          </details>
          <form action={formSubmittedAction} className="mt-3">
            <input type="hidden" name="id" value={req.id} />
            <SubmitButton className="btn-secondary">{t("formSubmitted")}</SubmitButton>
          </form>
        </div>
      ) : null}
      {req.formSubmittedAt ? <p className="mb-4 text-xs text-slate-500">{t("formSubmittedAt", { when: fmtDateTime(req.formSubmittedAt, locale) })}</p> : null}

      {/* Next steps */}
      {showNextSteps && latestIn ? (
        <div className="card mb-6 border-amber-200 dark:border-amber-900">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">{t("nextSteps")}</h2>
            <ClassificationBadge value={latestIn.classification} />
          </div>
          <p className="mt-1 text-sm text-slate-500">{latestIn.classification === "unknown" ? t("nextStepsUnknown") : t("nextStepsIntro")}</p>
          {parseHints(latestIn).length ? (
            <ul className="mt-3 flex flex-col gap-1 text-sm">
              {parseHints(latestIn).map((h) => (
                <li key={h} className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> {th(h)}</li>
              ))}
            </ul>
          ) : null}
          {parseLinks(latestIn).length ? (
            <div className="mt-3">
              <div className="mb-1 text-xs uppercase tracking-wide text-slate-500">{t("linksFound")}</div>
              <div className="flex flex-wrap gap-1.5">
                {parseLinks(latestIn).slice(0, 6).map((l) => (
                  <a key={l.url} href={l.url} target="_blank" rel="noreferrer noopener" className="btn-secondary max-w-full px-2 py-1 text-xs" title={l.url}>
                    <ExternalLink className="h-3 w-3 shrink-0" /> <span className="truncate">{l.label}</span>
                  </a>
                ))}
              </div>
            </div>
          ) : null}
          <details className="mt-3" open={latestIn.classification !== "unknown"}>
            <summary className="cursor-pointer text-xs text-slate-500">{t("inboundMail")}: {latestIn.subject}</summary>
            <pre className="pre mt-2 max-h-72 overflow-auto">{latestIn.body}</pre>
          </details>
          <div className="mt-3 flex flex-wrap gap-2">
            {canReply ? (
              <>
                {(["identity", "info", "confirm", "status"] as FollowupKind[]).map((k) => (
                  <Link key={k} href={`/requests/${req.id}?tpl=${k}#reply`} className={`btn-secondary ${tplKind === k ? "ring-2 ring-brand-500" : ""}`}>
                    {t(`tpl_${k}`)}
                  </Link>
                ))}
              </>
            ) : null}
            <form action={resolveActionAction} className="ml-auto">
              <input type="hidden" name="id" value={req.id} />
              <SubmitButton className="btn-primary">{latestIn.classification === "unknown" ? t("markReviewed") : t("actionDone")}</SubmitButton>
            </form>
          </div>
        </div>
      ) : null}

      {/* Thread */}
      <div className="card mb-6">
        <h2 className="mb-3 font-semibold">{t("thread")}</h2>
        {thread.length === 0 ? (
          <p className="text-sm text-slate-500">{t("noMessages")}</p>
        ) : (
          <ol className="flex flex-col gap-4">
            {thread.map((item) =>
              item.kind === "out" ? (
                <li key={`o${item.msg.id}`} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="badge bg-slate-100 dark:bg-slate-800">{t("out")} · {item.msg.kind}</span>
                    <span>{fmtDateTime(item.msg.occurredAt, locale)}</span>
                    <span className="break-anywhere">→ {item.msg.toAddr}</span>
                  </div>
                  <div className="break-anywhere text-sm font-medium">{item.msg.subject}</div>
                  <details className="mt-1">
                    <summary className="cursor-pointer text-xs text-slate-500">{t("body")}</summary>
                    <pre className="pre mt-2">{item.msg.body}</pre>
                  </details>
                </li>
              ) : (
                <li key={`i${item.mail.id}`} className="rounded-lg border border-brand-100 bg-brand-50/50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="badge bg-slate-100 dark:bg-slate-800">{t("in")}</span>
                    <span>{fmtDateTime(item.mail.receivedAt, locale)}</span>
                    <span className="break-anywhere">← {item.mail.fromAddr}</span>
                    <ClassificationBadge value={item.mail.classification} />
                    {item.mail.handledAt ? <span className="badge bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">✓</span> : null}
                  </div>
                  <div className="break-anywhere text-sm font-medium">{item.mail.subject}</div>
                  <details className="mt-1">
                    <summary className="cursor-pointer text-xs text-slate-500">{t("body")}</summary>
                    <pre className="pre mt-2">{item.mail.body}</pre>
                    {parseLinks(item.mail).length ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {parseLinks(item.mail).slice(0, 6).map((l) => (
                          <a key={l.url} href={l.url} target="_blank" rel="noreferrer noopener" className="btn-secondary max-w-full px-2 py-1 text-xs" title={l.url}>
                            <ExternalLink className="h-3 w-3 shrink-0" /> <span className="truncate">{l.label}</span>
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </details>
                </li>
              ),
            )}
          </ol>
        )}
      </div>

      {/* Timeline */}
      <div className="card mb-6">
        <h2 className="mb-3 font-semibold">{t("timeline")}</h2>
        <ol className="relative ml-2 border-l border-slate-200 pl-4 dark:border-slate-800">
          <li className="mb-3 text-sm">
            <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-slate-300 dark:bg-slate-600" />
            <span className="text-xs text-slate-500">{fmtDateTime(req.createdAt, locale)}</span>
            <div><EventLabel event="request.drafted" /></div>
          </li>
          {activity.map((a) => (
            <li key={a.id} className="mb-3 text-sm">
              <span className={`absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full ${a.level === "error" ? "bg-red-500" : a.level === "warn" ? "bg-amber-400" : a.event.startsWith("auto.") ? "bg-violet-400" : "bg-brand-500"}`} />
              <span className="text-xs text-slate-500">{fmtDateTime(a.createdAt, locale)}</span>
              <div className="flex flex-wrap items-baseline gap-2">
                <EventLabel event={a.event} />
                {a.detail ? <span className="break-anywhere min-w-0 text-xs text-slate-500">{a.detail}</span> : null}
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* Reply composer */}
      {canReply ? (
        <form action={replyAction} id="reply" className="card mb-6 flex flex-col gap-3">
          <div>
            <h2 className="font-semibold">{t("reply")}</h2>
            <p className="text-xs text-slate-500">{t("replyIntro")} → {req.toEmail}</p>
          </div>
          <input type="hidden" name="id" value={req.id} />
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-slate-500">{t("replyTemplate")}:</span>
            {(["identity", "info", "confirm", "status"] as FollowupKind[]).map((k) => (
              <Link key={k} href={`/requests/${req.id}?tpl=${k}#reply`} className={`rounded-full border px-2 py-0.5 ${tplKind === k ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-slate-800 dark:text-brand-100" : "border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"}`}>
                {t(`tpl_${k}`)}
              </Link>
            ))}
          </div>
          <div>
            <label className="label" htmlFor="reply-subject">{t("replySubject")}</label>
            <input id="reply-subject" name="subject" className="input" defaultValue={replyPrefill.subject} required />
          </div>
          <div>
            <label className="label" htmlFor="reply-body">{t("replyBody")}</label>
            <textarea id="reply-body" name="body" className="input font-mono text-xs" rows={tplKind ? 18 : 8} defaultValue={replyPrefill.body} required />
          </div>
          <div><SubmitButton>{t("sendReply")}</SubmitButton></div>
        </form>
      ) : null}

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
