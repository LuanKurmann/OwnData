import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { and, eq, isNull } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { PLACEHOLDERS, buildVars, render } from "@/lib/template-render";
import { getMailAccount, getProfile, resolveTemplate } from "@/server/requests";
import type { SearchParams } from "@/lib/flash";
import Flash from "@/components/Flash";
import SubmitButton from "@/components/SubmitButton";
import { resetTemplateAction, saveTemplateAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function TemplateEditPage({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<SearchParams> }) {
  const { key } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  const db = getDb();
  const sys = db.select().from(schema.templates).where(and(isNull(schema.templates.userId), eq(schema.templates.key, key))).get();
  if (!sys) notFound();
  const current = resolveTemplate(user.id, key)!;
  const overridden = current.userId === user.id;
  const t = await getTranslations("templates");
  const tc = await getTranslations("common");

  const profile = getProfile(user.id);
  const acc = getMailAccount(user.id);
  const demoBroker = { ...schema.brokers.$inferSelect, name: "Example Data Corp", website: "https://example.com", dataUrls: "https://example.com/people/you" } as unknown as schema.Broker;
  const vars = buildVars({
    profile,
    broker: demoBroker,
    reference: "OD-EXAMPL",
    lang: current.language,
    requestType: current.requestType ?? "erasure",
    jurisdiction: current.jurisdiction,
    senderEmail: acc?.fromEmail ?? profile.emails.split(/\r?\n/)[0] ?? "you@example.com",
  });

  return (
    <div className="max-w-4xl">
      <Link href="/templates" className="text-sm text-slate-500 hover:underline">← {tc("back")}</Link>
      <h1 className="mt-2 text-2xl font-semibold">{t("editTitle")}</h1>
      <p className="mb-4 text-sm text-slate-500">{sys.name} · <code className="text-xs">{key}</code></p>
      <Flash sp={sp} />
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div>
          <form action={saveTemplateAction} className="card flex flex-col gap-3">
            <input type="hidden" name="key" value={key} />
            <div>
              <label className="label" htmlFor="subject">{t("subject")}</label>
              <input id="subject" name="subject" className="input" defaultValue={current.subject} required />
            </div>
            <div>
              <label className="label" htmlFor="body">{t("body")}</label>
              <textarea id="body" name="body" className="input font-mono text-xs" rows={28} defaultValue={current.body} required />
            </div>
            <div className="flex gap-2">
              <SubmitButton>{tc("save")}</SubmitButton>
            </div>
          </form>
          {overridden ? (
            <form action={resetTemplateAction} className="mt-3">
              <input type="hidden" name="key" value={key} />
              <SubmitButton className="btn-danger">{t("reset")}</SubmitButton>
            </form>
          ) : null}
          <details className="card mt-6">
            <summary className="cursor-pointer font-medium">{t("preview")}</summary>
            <div className="mt-3 text-sm font-medium">{render(current.subject, vars)}</div>
            <pre className="pre mt-2">{render(current.body, vars)}</pre>
          </details>
        </div>
        <aside className="card h-fit text-xs">
          <h2 className="mb-2 text-sm font-semibold">{t("placeholders")}</h2>
          <ul className="flex flex-col gap-1 font-mono">
            {PLACEHOLDERS.map((p) => <li key={p}>{`{{${p}}}`}</li>)}
          </ul>
        </aside>
      </div>
    </div>
  );
}
