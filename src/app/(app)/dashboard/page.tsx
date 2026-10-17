import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { CheckCircle2, Circle, AlertTriangle } from "lucide-react";
import { getDb, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { getMailAccount, getProfile, visibleBrokers } from "@/server/requests";
import { unmatchedCount } from "@/server/inbox";
import type { SearchParams } from "@/lib/flash";
import { fmtDateTime } from "@/lib/format";
import Flash from "@/components/Flash";
import StatusBadge from "@/components/StatusBadge";
import SubmitButton from "@/components/SubmitButton";
import { runWorkerAction } from "../actions";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // mail sending / IMAP polling inside server actions (Vercel)

const OPEN = ["queued", "sent", "acknowledged", "needs_info", "overdue", "reminded", "escalation_ready"] as const;
const ATTENTION = ["needs_info", "action_required", "bounced", "escalation_ready", "failed", "draft"] as const;

export default async function DashboardPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const t = await getTranslations("dashboard");
  const tc = await getTranslations("common");
  const tr = await getTranslations("requests");
  const locale = await getLocale();
  const db = await getDb();

  const profile = await getProfile(user.id);
  const mail = await getMailAccount(user.id);
  const all = await db.select().from(schema.requests).where(eq(schema.requests.userId, user.id)).all();
  const open = all.filter((r) => (OPEN as readonly string[]).includes(r.status)).length;
  const completed = all.filter((r) => r.status === "completed").length;
  const overdue = all.filter((r) => ["overdue", "reminded", "escalation_ready"].includes(r.status)).length;
  const contacted = new Set(all.map((r) => r.brokerId)).size;
  const total = (await visibleBrokers(user.id)).length;

  const attention = await db
    .select({ req: schema.requests, broker: schema.brokers })
    .from(schema.requests)
    .innerJoin(schema.brokers, eq(schema.brokers.id, schema.requests.brokerId))
    .where(and(eq(schema.requests.userId, user.id), inArray(schema.requests.status, [...ATTENTION])))
    .orderBy(desc(schema.requests.updatedAt))
    .limit(20)
    .all();
  // replies that could not be classified on non-closed requests
  const unknownReplies = (
    await db
      .select({ req: schema.requests, broker: schema.brokers })
      .from(schema.inbox)
      .innerJoin(schema.requests, eq(schema.requests.id, schema.inbox.requestId))
      .innerJoin(schema.brokers, eq(schema.brokers.id, schema.requests.brokerId))
      .where(and(eq(schema.inbox.userId, user.id), eq(schema.inbox.classification, "unknown"), isNull(schema.inbox.handledAt)))
      .all()
  ).filter((r) => !["completed", "rejected", "escalated"].includes(r.req.status) && !(ATTENTION as readonly string[]).includes(r.req.status));
  const unmatched = await unmatchedCount(user.id);

  const activity = await db
    .select()
    .from(schema.activityLog)
    .where(eq(schema.activityLog.userId, user.id))
    .orderBy(desc(schema.activityLog.createdAt))
    .limit(15)
    .all();

  const setup = [
    { done: !!profile.lastName && profile.addressList.length > 0, label: t("setupProfile"), href: "/profile" },
    { done: !!mail, label: t("setupMail"), href: "/settings/mail" },
    { done: all.length > 0, label: t("setupFirst"), href: "/brokers" },
  ];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-slate-500">{t("welcome", { name: user.name })}</p>
        </div>
        <form action={runWorkerAction} title={tc("runWorkerHint")}>
          <input type="hidden" name="back" value="/dashboard" />
          <SubmitButton className="btn-secondary">{tc("runWorker")}</SubmitButton>
        </form>
      </div>
      <Flash sp={sp} />

      {setup.some((s) => !s.done) ? (
        <div className="card mb-6">
          <h2 className="mb-3 font-semibold">{t("setup")}</h2>
          <ul className="flex flex-col gap-2">
            {setup.map((s) => (
              <li key={s.href} className="flex items-center gap-2 text-sm">
                {s.done ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Circle className="h-4 w-4 text-slate-400" />}
                <Link href={s.href} className={s.done ? "text-slate-500 line-through" : "text-brand-700 underline dark:text-brand-100"}>
                  {s.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label={t("open")} value={open} />
        <Stat label={t("completed")} value={completed} />
        <Stat label={t("overdue")} value={overdue} warn={overdue > 0} />
        <Stat label={t("brokersCovered")} value={contacted} sub={t("ofTotal", { total })} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4 text-amber-500" /> {t("attention")}
          </h2>
          {unmatched > 0 ? (
            <Link href="/inbox" className="mb-2 block rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-200">
              {t("unmatchedMails", { count: unmatched })}
            </Link>
          ) : null}
          {attention.length + unknownReplies.length === 0 ? (
            <p className="text-sm text-slate-500">{t("nothingToDo")}</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {[...unknownReplies.map((r) => ({ ...r, review: true })), ...attention.map((r) => ({ ...r, review: false }))].map((r) => (
                <li key={`${r.req.id}-${r.review}`} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <Link href={`/requests/${r.req.id}`} className="truncate font-medium hover:underline">
                    {r.broker.name}
                  </Link>
                  {r.review ? <span className="badge bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">{tr("needsReview")}</span> : <StatusBadge status={r.req.status} />}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card">
          <h2 className="mb-3 font-semibold">{t("activity")}</h2>
          <p className="mb-2 text-xs text-slate-500">
            {t("lastPoll")}: {mail?.imapLastPollAt ? fmtDateTime(mail.imapLastPollAt, locale) : t("never")}
          </p>
          {activity.length === 0 ? (
            <p className="text-sm text-slate-500">{t("noActivity")}</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
              {activity.map((a) => (
                <li key={a.id} className="py-1.5">
                  <span className="text-xs text-slate-400">{fmtDateTime(a.createdAt, locale)}</span>{" "}
                  <span className={a.level === "error" ? "text-red-600" : a.level === "warn" ? "text-amber-600" : ""}>{a.event}</span>
                  {a.detail ? <span className="text-slate-500"> · {a.detail.slice(0, 80)}</span> : null}
                  {a.requestId ? (
                    <Link href={`/requests/${a.requestId}`} className="ml-1 text-brand-600 underline">#{a.requestId}</Link>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, warn }: { label: string; value: number; sub?: string; warn?: boolean }) {
  return (
    <div className="card">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-3xl font-semibold ${warn ? "text-orange-600" : ""}`}>{value}</div>
      {sub ? <div className="text-xs text-slate-400">{sub}</div> : null}
    </div>
  );
}
