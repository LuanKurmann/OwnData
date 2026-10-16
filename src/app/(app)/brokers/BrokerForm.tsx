import { getTranslations } from "next-intl/server";
import { BROKER_CATEGORIES, JURISDICTIONS, type Broker } from "@/db/schema";
import SubmitButton from "@/components/SubmitButton";
import { saveBrokerAction } from "./actions";

type Prefill = Partial<Pick<Broker, "name" | "website" | "privacyEmail" | "privacyUrl" | "optOutUrl" | "country" | "jurisdiction" | "category" | "language" | "requiresIdVerification" | "notes" | "dataUrls">> & { id?: number };

export default async function BrokerForm({ b, emails = [] }: { b: Prefill; emails?: string[] }) {
  const t = await getTranslations("brokers");
  const tj = await getTranslations("jurisdiction");
  const tcat = await getTranslations("category");
  const tc = await getTranslations("common");
  return (
    <form action={saveBrokerAction} className="card flex flex-col gap-4">
      {b.id ? <input type="hidden" name="id" value={b.id} /> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="label" htmlFor="name">{t("name")}</label>
          <input id="name" name="name" className="input" defaultValue={b.name ?? ""} required />
        </div>
        <div>
          <label className="label" htmlFor="website">{t("website")}</label>
          <input id="website" name="website" className="input" defaultValue={b.website ?? ""} placeholder={t("websitePlaceholder")} />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="privacyEmail">{t("privacyEmail")}</label>
        <input id="privacyEmail" name="privacyEmail" type="email" className="input" defaultValue={b.privacyEmail ?? ""} list="emails" />
        {emails.length ? (
          <>
            <datalist id="emails">{emails.map((e) => <option key={e} value={e} />)}</datalist>
            <p className="help">{t("foundEmails")}: {emails.join(", ")}</p>
          </>
        ) : null}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="label" htmlFor="privacyUrl">{t("privacyUrl")}</label>
          <input id="privacyUrl" name="privacyUrl" className="input" defaultValue={b.privacyUrl ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="optOutUrl">{t("optOutUrl")}</label>
          <input id="optOutUrl" name="optOutUrl" className="input" defaultValue={b.optOutUrl ?? ""} />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <div>
          <label className="label" htmlFor="country">{t("country")}</label>
          <input id="country" name="country" className="input" defaultValue={b.country ?? ""} maxLength={2} placeholder="CH" />
        </div>
        <div>
          <label className="label" htmlFor="jurisdiction">{t("jurisdiction")}</label>
          <select id="jurisdiction" name="jurisdiction" className="input" defaultValue={b.jurisdiction ?? "gdpr"}>
            {JURISDICTIONS.map((x) => <option key={x} value={x}>{tj(x)}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="category">{t("category")}</label>
          <select id="category" name="category" className="input" defaultValue={b.category ?? "other"}>
            {BROKER_CATEGORIES.map((x) => <option key={x} value={x}>{tcat(x)}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="language">{t("language")}</label>
          <select id="language" name="language" className="input" defaultValue={b.language ?? "de"}>
            <option value="de">Deutsch</option>
            <option value="en">English</option>
          </select>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="requiresIdVerification" defaultChecked={b.requiresIdVerification ?? false} /> {t("requiresId")}
      </label>
      <div>
        <label className="label" htmlFor="dataUrls">{t("dataUrls")}</label>
        <textarea id="dataUrls" name="dataUrls" className="input" rows={3} defaultValue={b.dataUrls ?? ""} />
        <p className="help">{t("dataUrlsHint")}</p>
      </div>
      <div>
        <label className="label" htmlFor="notes">{t("notes")}</label>
        <textarea id="notes" name="notes" className="input" rows={2} defaultValue={b.notes ?? ""} />
      </div>
      <div><SubmitButton>{tc("save")}</SubmitButton></div>
    </form>
  );
}
