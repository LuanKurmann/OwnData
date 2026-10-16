import { getLocale, getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { getMailAccount } from "@/server/requests";
import type { SearchParams } from "@/lib/flash";
import { fmtDateTime } from "@/lib/format";
import Flash from "@/components/Flash";
import SubmitButton from "@/components/SubmitButton";
import { saveMailAction, testImapAction, testSmtpAction } from "./actions";
import { runWorkerAction } from "../../actions";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // mail sending / IMAP polling inside server actions (Vercel)

export default async function MailSettingsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const acc = await getMailAccount(user.id);
  const t = await getTranslations("mail");
  const tc = await getTranslations("common");
  const locale = await getLocale();
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="mb-2 mt-1 text-sm text-slate-500">{t("intro")}</p>
      <p className="mb-6 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700 dark:bg-slate-900 dark:text-brand-100">{t("hint")}</p>
      <Flash sp={sp} />
      <form action={saveMailAction} className="card flex flex-col gap-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="fromName">{t("fromName")}</label>
            <input id="fromName" name="fromName" className="input" defaultValue={acc?.fromName ?? user.name} />
          </div>
          <div>
            <label className="label" htmlFor="fromEmail">{t("fromEmail")}</label>
            <input id="fromEmail" name="fromEmail" type="email" className="input" defaultValue={acc?.fromEmail ?? ""} required />
          </div>
        </div>

        <h2 className="mt-2 font-semibold">{t("smtp")}</h2>
        <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
          <div>
            <label className="label" htmlFor="smtpHost">{t("host")}</label>
            <input id="smtpHost" name="smtpHost" className="input" defaultValue={acc?.smtpHost ?? ""} required placeholder="smtp.example.com" />
          </div>
          <div>
            <label className="label" htmlFor="smtpPort">{t("port")}</label>
            <input id="smtpPort" name="smtpPort" type="number" className="input" defaultValue={acc?.smtpPort ?? 587} required />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="smtpSecure" defaultChecked={acc?.smtpSecure ?? false} /> {t("secure")}
        </label>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="smtpUser">{t("user")}</label>
            <input id="smtpUser" name="smtpUser" className="input" defaultValue={acc?.smtpUser ?? ""} required autoComplete="off" />
          </div>
          <div>
            <label className="label" htmlFor="smtpPass">{t("password")}</label>
            <input id="smtpPass" name="smtpPass" type="password" className="input" autoComplete="new-password" required={!acc} />
            {acc ? <p className="help">{t("passwordKeep")}</p> : null}
          </div>
        </div>
        {acc?.smtpLastError ? <p className="text-xs text-red-600">{t("lastError")}: {acc.smtpLastError}</p> : null}

        <h2 className="mt-2 font-semibold">{t("imap")}</h2>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="imapEnabled" defaultChecked={acc?.imapEnabled ?? true} /> {t("imapEnabled")}
        </label>
        <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
          <div>
            <label className="label" htmlFor="imapHost">{t("host")}</label>
            <input id="imapHost" name="imapHost" className="input" defaultValue={acc?.imapHost ?? ""} placeholder="imap.example.com" />
          </div>
          <div>
            <label className="label" htmlFor="imapPort">{t("port")}</label>
            <input id="imapPort" name="imapPort" type="number" className="input" defaultValue={acc?.imapPort ?? 993} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="imapSecure" defaultChecked={acc?.imapSecure ?? true} /> {t("secure")}
        </label>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="label" htmlFor="imapUser">{t("user")}</label>
            <input id="imapUser" name="imapUser" className="input" defaultValue={acc?.imapUser ?? ""} autoComplete="off" />
            <p className="help">{t("imapSameCreds")}</p>
          </div>
          <div>
            <label className="label" htmlFor="imapPass">{t("password")}</label>
            <input id="imapPass" name="imapPass" type="password" className="input" autoComplete="new-password" />
          </div>
          <div>
            <label className="label" htmlFor="imapMailbox">{t("mailbox")}</label>
            <input id="imapMailbox" name="imapMailbox" className="input" defaultValue={acc?.imapMailbox ?? "INBOX"} />
          </div>
        </div>
        {acc?.imapLastError ? <p className="text-xs text-red-600">{t("lastError")}: {acc.imapLastError}</p> : null}
        {acc ? <p className="text-xs text-slate-500">{t("lastPoll")}: {fmtDateTime(acc.imapLastPollAt, locale)}</p> : null}

        <div className="flex flex-wrap gap-2">
          <SubmitButton>{tc("save")}</SubmitButton>
        </div>
      </form>
      {acc ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <form action={testSmtpAction}><SubmitButton className="btn-secondary">{t("testSmtp")}</SubmitButton></form>
          <form action={testImapAction}><SubmitButton className="btn-secondary">{t("testImap")}</SubmitButton></form>
          <form action={runWorkerAction}>
            <input type="hidden" name="back" value="/settings/mail" />
            <SubmitButton className="btn-secondary">{tc("runWorker")}</SubmitButton>
          </form>
        </div>
      ) : null}
    </div>
  );
}
