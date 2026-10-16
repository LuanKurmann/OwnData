import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { getProfile } from "@/server/requests";
import type { SearchParams } from "@/lib/flash";
import Flash from "@/components/Flash";
import SubmitButton from "@/components/SubmitButton";
import { saveProfileAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function ProfilePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const p = getProfile(user.id);
  const t = await getTranslations("profile");
  const tc = await getTranslations("common");
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="mb-6 mt-1 text-sm text-slate-500">{t("intro")}</p>
      <Flash sp={sp} />
      <form action={saveProfileAction} className="card flex flex-col gap-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="fullName">{t("fullName")}</label>
            <input id="fullName" name="fullName" className="input" defaultValue={p.fullName} required />
          </div>
          <div>
            <label className="label" htmlFor="birthDate">{t("birthDate")} <span className="text-slate-400">({tc("optional")})</span></label>
            <input id="birthDate" name="birthDate" className="input" defaultValue={p.birthDate} placeholder="1990-01-31" />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="aliases">{t("aliases")}</label>
          <textarea id="aliases" name="aliases" className="input" rows={2} defaultValue={p.aliases} />
        </div>
        <div>
          <label className="label" htmlFor="addresses">{t("addresses")}</label>
          <textarea id="addresses" name="addresses" className="input" rows={3} defaultValue={p.addresses} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="emails">{t("emails")}</label>
            <textarea id="emails" name="emails" className="input" rows={3} defaultValue={p.emails} />
          </div>
          <div>
            <label className="label" htmlFor="phones">{t("phones")}</label>
            <textarea id="phones" name="phones" className="input" rows={3} defaultValue={p.phones} />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="country">{t("country")}</label>
            <input id="country" name="country" className="input" defaultValue={p.country} maxLength={2} />
          </div>
          <div>
            <label className="label" htmlFor="signature">{t("signature")}</label>
            <input id="signature" name="signature" className="input" defaultValue={p.signature} placeholder={p.fullName} />
          </div>
        </div>
        <h2 className="mt-2 font-semibold">{t("account")}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="name">{t("signature")}</label>
            <input id="name" name="name" className="input" defaultValue={user.name} required />
          </div>
          <div>
            <label className="label" htmlFor="locale">{t("uiLanguage")}</label>
            <select id="locale" name="locale" className="input" defaultValue={user.locale}>
              <option value="de">Deutsch</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>
        <div>
          <SubmitButton>{tc("save")}</SubmitButton>
        </div>
      </form>
    </div>
  );
}
