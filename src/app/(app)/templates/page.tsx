import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { eq, isNull, or } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { JURISDICTION_LABEL } from "@/lib/legal";
import type { SearchParams } from "@/lib/flash";
import Flash from "@/components/Flash";

export const dynamic = "force-dynamic";

export default async function TemplatesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const t = await getTranslations("templates");
  const tt = await getTranslations("type");
  const db = getDb();
  const all = db
    .select()
    .from(schema.templates)
    .where(or(isNull(schema.templates.userId), eq(schema.templates.userId, user.id)))
    .all();
  const overridden = new Set(all.filter((x) => x.userId === user.id).map((x) => x.key));
  const system = all.filter((x) => x.userId === null).sort((a, b) => a.key.localeCompare(b.key));
  const groups: Array<{ kind: "request" | "reminder" | "escalation"; label: string }> = [
    { kind: "request", label: t("kindRequest") },
    { kind: "reminder", label: t("kindReminder") },
    { kind: "escalation", label: t("kindEscalation") },
  ];
  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="mb-6 mt-1 text-sm text-slate-500">{t("intro")}</p>
      <Flash sp={sp} />
      {groups.map((g) => (
        <div key={g.kind} className="mb-6">
          <h2 className="mb-2 font-semibold">{g.label}</h2>
          <div className="card overflow-x-auto p-0">
            <table className="table">
              <tbody>
                {system.filter((x) => x.kind === g.kind).map((x) => (
                  <tr key={x.key}>
                    <td><Link href={`/templates/${x.key}`} className="font-medium hover:underline">{x.name}</Link></td>
                    <td className="text-xs text-slate-500">{JURISDICTION_LABEL[x.jurisdiction]}</td>
                    <td className="text-xs text-slate-500">{x.requestType ? tt(x.requestType) : "—"}</td>
                    <td className="text-xs uppercase text-slate-500">{x.language}</td>
                    <td>
                      {overridden.has(x.key) ? (
                        <span className="badge bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200">{t("overridden")}</span>
                      ) : (
                        <span className="badge bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">{t("system")}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
