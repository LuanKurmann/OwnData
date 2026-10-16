"use client";
import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ExternalLink, ShieldAlert } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import SubmitButton from "@/components/SubmitButton";
import type { RequestStatus, RequestType } from "@/db/schema";

export type BrokerRow = {
  id: number;
  name: string;
  website: string;
  privacyEmail: string;
  country: string;
  jurisdiction: "gdpr" | "dsg" | "ccpa";
  category: string;
  isCurated: boolean;
  requiresIdVerification: boolean;
  last: { status: RequestStatus; type: RequestType } | null;
};

export default function BrokerTable({ rows, action }: { rows: BrokerRow[]; action: (fd: FormData) => Promise<void> }) {
  const t = useTranslations("brokers");
  const tj = useTranslations("jurisdiction");
  const tc = useTranslations("category");
  const tt = useTranslations("type");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const selectable = rows.filter((r) => r.privacyEmail);
  const allSelected = selectable.length > 0 && selectable.every((r) => selected.has(r.id));

  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(selectable.map((r) => r.id)));
  const toggle = (id: number) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <form action={action}>
      <div className="card mb-4 flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium">{t("selected", { count: selected.size })}</span>
        <label className="flex items-center gap-2 text-sm">
          {t("requestType")}
          <select name="type" className="input w-auto" defaultValue="erasure">
            <option value="erasure">{tt("erasure")}</option>
            <option value="access">{tt("access")}</option>
            <option value="optout">{tt("optout")}</option>
          </select>
        </label>
        <div className="ml-auto flex flex-wrap gap-2">
          <SubmitButton name="mode" value="draft" className="btn-secondary" disabled={selected.size === 0}>
            {t("createDraft")}
          </SubmitButton>
          <SubmitButton name="mode" value="send" disabled={selected.size === 0}>
            {t("createQueued")}
          </SubmitButton>
        </div>
      </div>
      <div className="card overflow-x-auto p-0">
        <table className="table">
          <thead>
            <tr>
              <th className="w-8"><input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="all" /></th>
              <th>{t("name")}</th>
              <th>{t("privacyEmail")}</th>
              <th>{t("country")}</th>
              <th>{t("jurisdiction")}</th>
              <th>{t("category")}</th>
              <th>{t("lastRequest")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={selected.has(r.id) ? "bg-brand-50/60 dark:bg-slate-800/60" : ""}>
                <td>
                  {r.privacyEmail ? (
                    <input type="checkbox" name="brokerId" value={r.id} checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
                  ) : null}
                </td>
                <td>
                  <div className="flex items-center gap-1.5">
                    <Link href={`/brokers/${r.id}`} className="font-medium hover:underline">{r.name}</Link>
                    {r.requiresIdVerification ? <ShieldAlert className="h-3.5 w-3.5 text-amber-500" aria-label={t("requiresId")} /> : null}
                    {!r.isCurated ? <span className="badge bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200">{t("custom")}</span> : null}
                  </div>
                  {r.website ? (
                    <a href={r.website} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-slate-500 hover:underline">
                      {r.website.replace(/^https?:\/\//, "")} <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null}
                </td>
                <td className="font-mono text-xs">{r.privacyEmail || <span className="text-slate-400">{t("noEmail")}</span>}</td>
                <td>{r.country}</td>
                <td className="whitespace-nowrap">{tj(r.jurisdiction)}</td>
                <td className="text-xs">{tc(r.category as never)}</td>
                <td>{r.last ? <div className="flex flex-col gap-0.5"><StatusBadge status={r.last.status} /><span className="text-xs text-slate-500">{tt(r.last.type)}</span></div> : <span className="text-slate-300">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </form>
  );
}
