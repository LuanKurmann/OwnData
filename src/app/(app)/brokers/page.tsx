import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { desc, eq } from "drizzle-orm";
import { Plus } from "lucide-react";
import { getDb, schema } from "@/db";
import { BROKER_CATEGORIES, JURISDICTIONS } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { visibleBrokers } from "@/server/requests";
import type { SearchParams } from "@/lib/flash";
import { str } from "@/lib/flash";
import Flash from "@/components/Flash";
import BrokerTable, { type BrokerRow } from "./BrokerTable";
import { createRequestsAction } from "./actions";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // mail sending / IMAP polling inside server actions (Vercel)

export default async function BrokersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const t = await getTranslations("brokers");
  const tj = await getTranslations("jurisdiction");
  const tcat = await getTranslations("category");
  const tc = await getTranslations("common");
  const q = str(sp.q).toLowerCase();
  const j = str(sp.j);
  const c = str(sp.c);

  const db = await getDb();
  const lastByBroker = new Map<number, NonNullable<BrokerRow["last"]>>();
  for (const r of await db.select().from(schema.requests).where(eq(schema.requests.userId, user.id)).orderBy(desc(schema.requests.createdAt)).all()) {
    if (!lastByBroker.has(r.brokerId)) lastByBroker.set(r.brokerId, { status: r.status, type: r.type });
  }
  const rows: BrokerRow[] = (await visibleBrokers(user.id))
    .filter((b) => !q || b.name.toLowerCase().includes(q) || b.website.toLowerCase().includes(q) || b.privacyEmail.includes(q))
    .filter((b) => !j || b.jurisdiction === j)
    .filter((b) => !c || b.category === c)
    .map((b) => ({
      id: b.id,
      name: b.name,
      website: b.website,
      privacyEmail: b.privacyEmail,
      country: b.country,
      jurisdiction: b.jurisdiction,
      category: b.category,
      isCurated: b.isCurated,
      requiresIdVerification: b.requiresIdVerification,
      last: lastByBroker.get(b.id) ?? null,
    }));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">{t("intro")}</p>
        </div>
        <Link href="/brokers/new" className="btn-primary"><Plus className="h-4 w-4" /> {t("addCustom")}</Link>
      </div>
      <Flash sp={sp} />
      <form className="mb-4 flex flex-wrap gap-2" method="get">
        <input name="q" defaultValue={str(sp.q)} placeholder={tc("search")} className="input w-56" />
        <select name="j" defaultValue={j} className="input w-auto">
          <option value="">{t("filterJurisdiction")}: {tc("all")}</option>
          {JURISDICTIONS.map((x) => <option key={x} value={x}>{tj(x)}</option>)}
        </select>
        <select name="c" defaultValue={c} className="input w-auto">
          <option value="">{t("filterCategory")}: {tc("all")}</option>
          {BROKER_CATEGORIES.map((x) => <option key={x} value={x}>{tcat(x)}</option>)}
        </select>
        <button className="btn-secondary">{tc("search")}</button>
      </form>
      <BrokerTable rows={rows} action={createRequestsAction} />
    </div>
  );
}
