import { getLocale, getTranslations } from "next-intl/server";
import type { Address } from "@/db/schema";
import { countryOptions } from "@/lib/address";
import SubmitButton from "@/components/SubmitButton";
import { deleteAddressAction, saveAddressAction } from "./actions";

export default async function AddressForm({ a, defaultCountry = "CH" }: { a?: Address; defaultCountry?: string }) {
  const t = await getTranslations("profile");
  const tc = await getTranslations("common");
  const locale = (await getLocale()) as "de" | "en";
  const countries = countryOptions(locale);
  const p = a ? `a${a.id}-` : "new-";
  return (
    <div className={`rounded-lg border p-4 ${a ? "border-slate-200 dark:border-slate-800" : "border-dashed border-slate-300 dark:border-slate-700"}`}>
      <form action={saveAddressAction} className="flex flex-col gap-3">
        {a ? <input type="hidden" name="id" value={a.id} /> : null}
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-44">
            <label className="label" htmlFor={`${p}kind`}>{t("addrKind")}</label>
            <select id={`${p}kind`} name="kind" className="input" defaultValue={a?.kind ?? "current"}>
              <option value="current">{t("addrCurrent")}</option>
              <option value="previous">{t("addrPrevious")}</option>
            </select>
          </div>
          <div className="w-24">
            <label className="label" htmlFor={`${p}fromYear`}>{t("addrFrom")}</label>
            <input id={`${p}fromYear`} name="fromYear" className="input" defaultValue={a?.fromYear ?? ""} placeholder="2015" maxLength={4} inputMode="numeric" />
          </div>
          <div className="w-24">
            <label className="label" htmlFor={`${p}toYear`}>{t("addrTo")}</label>
            <input id={`${p}toYear`} name="toYear" className="input" defaultValue={a?.toYear ?? ""} placeholder="2020" maxLength={4} inputMode="numeric" />
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-[3fr_1fr]">
          <div>
            <label className="label" htmlFor={`${p}street`}>{t("street")}</label>
            <input id={`${p}street`} name="street" className="input" defaultValue={a?.street ?? ""} required autoComplete="address-line1" />
          </div>
          <div>
            <label className="label" htmlFor={`${p}houseNumber`}>{t("houseNumber")}</label>
            <input id={`${p}houseNumber`} name="houseNumber" className="input" defaultValue={a?.houseNumber ?? ""} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor={`${p}addressLine2`}>{t("addressLine2")} <span className="text-slate-400">({tc("optional")})</span></label>
          <input id={`${p}addressLine2`} name="addressLine2" className="input" defaultValue={a?.addressLine2 ?? ""} autoComplete="address-line2" />
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_2fr_2fr_2fr]">
          <div>
            <label className="label" htmlFor={`${p}postalCode`}>{t("postalCode")}</label>
            <input id={`${p}postalCode`} name="postalCode" className="input" defaultValue={a?.postalCode ?? ""} required autoComplete="postal-code" />
          </div>
          <div>
            <label className="label" htmlFor={`${p}city`}>{t("city")}</label>
            <input id={`${p}city`} name="city" className="input" defaultValue={a?.city ?? ""} required autoComplete="address-level2" />
          </div>
          <div>
            <label className="label" htmlFor={`${p}region`}>{t("region")} <span className="text-slate-400">({tc("optional")})</span></label>
            <input id={`${p}region`} name="region" className="input" defaultValue={a?.region ?? ""} autoComplete="address-level1" />
          </div>
          <div>
            <label className="label" htmlFor={`${p}country`}>{t("country")}</label>
            <select id={`${p}country`} name="country" className="input" defaultValue={a?.country ?? defaultCountry} autoComplete="country">
              {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-2">
          <SubmitButton className={a ? "btn-secondary" : "btn-primary"}>{a ? tc("save") : t("addAddress")}</SubmitButton>
        </div>
      </form>
      {a ? (
        <form action={deleteAddressAction} className="mt-2">
          <input type="hidden" name="id" value={a.id} />
          <SubmitButton className="btn-danger" confirm={tc("confirmDelete")}>{tc("delete")}</SubmitButton>
        </form>
      ) : null}
    </div>
  );
}
