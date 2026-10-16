import { getLocale, getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { getProfile } from "@/server/requests";
import type { SearchParams } from "@/lib/flash";
import { describeAddress } from "@/lib/address";
import Flash from "@/components/Flash";
import SubmitButton from "@/components/SubmitButton";
import AddressForm from "./AddressForm";
import { saveProfileAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function ProfilePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const p = await getProfile(user.id);
  const t = await getTranslations("profile");
  const tc = await getTranslations("common");
  const locale = (await getLocale()) as "de" | "en";
  const current = p.addressList.filter((a) => a.kind === "current");
  const previous = p.addressList.filter((a) => a.kind === "previous");
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="mb-6 mt-1 text-sm text-slate-500">{t("intro")}</p>
      <Flash sp={sp} />

      <form action={saveProfileAction} className="card flex flex-col gap-4">
        <h2 className="font-semibold">{t("person")}</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="label" htmlFor="firstName">{t("firstName")}</label>
            <input id="firstName" name="firstName" className="input" defaultValue={p.firstName} required autoComplete="given-name" />
          </div>
          <div>
            <label className="label" htmlFor="middleName">{t("middleName")} <span className="text-slate-400">({tc("optional")})</span></label>
            <input id="middleName" name="middleName" className="input" defaultValue={p.middleName} autoComplete="additional-name" />
          </div>
          <div>
            <label className="label" htmlFor="lastName">{t("lastName")}</label>
            <input id="lastName" name="lastName" className="input" defaultValue={p.lastName} required autoComplete="family-name" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="birthDate">{t("birthDate")} <span className="text-slate-400">({tc("optional")})</span></label>
            <input id="birthDate" name="birthDate" type="date" className="input" defaultValue={p.birthDate} autoComplete="bday" />
          </div>
          <div>
            <label className="label" htmlFor="signature">{t("signature")} <span className="text-slate-400">({tc("optional")})</span></label>
            <input id="signature" name="signature" className="input" defaultValue={p.signature} placeholder={p.fullName} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="aliases">{t("aliases")}</label>
          <textarea id="aliases" name="aliases" className="input" rows={2} defaultValue={p.aliases} />
          <p className="help">{t("aliasesHint")}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="emails">{t("emails")}</label>
            <textarea id="emails" name="emails" className="input" rows={3} defaultValue={p.emails} />
          </div>
          <div>
            <label className="label" htmlFor="phones">{t("phones")}</label>
            <textarea id="phones" name="phones" className="input" rows={3} defaultValue={p.phones} placeholder="+41 79 123 45 67" />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="locale">{t("uiLanguage")}</label>
          <select id="locale" name="locale" className="input md:w-60" defaultValue={user.locale}>
            <option value="de">Deutsch</option>
            <option value="en">English</option>
          </select>
        </div>
        <div>
          <SubmitButton>{tc("save")}</SubmitButton>
        </div>
      </form>

      <div className="card mt-6 flex flex-col gap-4">
        <div>
          <h2 className="font-semibold">{t("addresses")}</h2>
          <p className="text-sm text-slate-500">{t("addressesHint")}</p>
        </div>
        {p.addresses && p.addressList.length === 0 ? (
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">
            {t("legacyAddresses")}
            <pre className="mt-1 whitespace-pre-wrap font-sans">{p.addresses}</pre>
          </div>
        ) : null}
        {current.length + previous.length > 0 ? (
          <ul className="flex flex-col gap-1 text-sm">
            {[...current, ...previous].map((a) => (
              <li key={a.id} className="flex items-center gap-2">
                <span className={`badge ${a.kind === "current" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"}`}>
                  {a.kind === "current" ? t("addrCurrent") : t("addrPrevious")}
                </span>
                {describeAddress(a, locale)}
              </li>
            ))}
          </ul>
        ) : null}
        {[...current, ...previous].map((a) => (
          <details key={a.id} className="group">
            <summary className="cursor-pointer text-sm text-brand-700 dark:text-brand-100">{tc("edit")}: {describeAddress(a, locale)}</summary>
            <div className="mt-2">
              <AddressForm a={a} />
            </div>
          </details>
        ))}
        <h3 className="text-sm font-semibold">{t("newAddress")}</h3>
        <AddressForm defaultCountry={p.country || "CH"} />
      </div>
    </div>
  );
}
