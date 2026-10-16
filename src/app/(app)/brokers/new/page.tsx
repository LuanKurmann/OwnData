import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import type { SearchParams } from "@/lib/flash";
import { str } from "@/lib/flash";
import Flash from "@/components/Flash";
import SubmitButton from "@/components/SubmitButton";
import BrokerForm from "../BrokerForm";
import { discoverAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewBrokerPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  await requireUser();
  const t = await getTranslations("brokers");
  const emails = str(sp.emails).split(",").filter(Boolean);
  const website = str(sp.website);
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold">{t("newTitle")}</h1>
      <p className="mb-6 mt-1 text-sm text-slate-500">{t("newIntro")}</p>
      <Flash sp={sp} />
      <form action={discoverAction} className="card mb-4 flex flex-wrap items-end gap-3">
        <div className="flex-1">
          <label className="label" htmlFor="d-name">{t("name")}</label>
          <input id="d-name" name="name" className="input" defaultValue={str(sp.name)} />
        </div>
        <div className="flex-1">
          <label className="label" htmlFor="d-website">{t("website")}</label>
          <input id="d-website" name="website" className="input" defaultValue={website} placeholder={t("websitePlaceholder")} required />
        </div>
        <SubmitButton className="btn-secondary">{t("discover")}</SubmitButton>
      </form>
      <BrokerForm
        b={{
          name: str(sp.name),
          website: website ? (/^https?:\/\//.test(website) ? website : `https://${website}`) : "",
          privacyEmail: str(sp.email) || emails[0] || "",
          privacyUrl: str(sp.privacyUrl),
          jurisdiction: "gdpr",
          language: "de",
        }}
        emails={emails}
      />
    </div>
  );
}
