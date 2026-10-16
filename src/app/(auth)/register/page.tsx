import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ShieldCheck } from "lucide-react";
import Flash from "@/components/Flash";
import SubmitButton from "@/components/SubmitButton";
import { registrationOpen, userCount } from "@/lib/auth";
import type { SearchParams } from "@/lib/flash";
import { registerAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const t = await getTranslations("auth");
  const locale = await getLocale();
  const open = await registrationOpen();
  const first = (await userCount()) === 0;
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2">
          <ShieldCheck className="h-7 w-7 text-brand-600" />
          <div className="text-lg font-semibold">OwnData</div>
        </div>
        <Flash sp={sp} />
        {!open ? (
          <p className="text-sm text-slate-600 dark:text-slate-300">{t("closed")}</p>
        ) : (
          <form action={registerAction} className="flex flex-col gap-3">
            {first ? <p className="text-xs text-slate-500">{t("firstUserHint")}</p> : null}
            <div>
              <label className="label" htmlFor="name">{t("name")}</label>
              <input id="name" name="name" required className="input" autoComplete="name" />
            </div>
            <div>
              <label className="label" htmlFor="email">{t("email")}</label>
              <input id="email" name="email" type="email" required className="input" autoComplete="email" />
            </div>
            <div>
              <label className="label" htmlFor="password">{t("password")}</label>
              <input id="password" name="password" type="password" minLength={10} required className="input" autoComplete="new-password" />
            </div>
            <div>
              <label className="label" htmlFor="locale">{t("language")}</label>
              <select id="locale" name="locale" defaultValue={locale} className="input">
                <option value="de">Deutsch</option>
                <option value="en">English</option>
              </select>
            </div>
            <SubmitButton>{t("register")}</SubmitButton>
          </form>
        )}
        <p className="mt-4 text-center text-sm text-slate-500">
          {t("hasAccount")} <Link className="text-brand-600 underline" href="/login">{t("login")}</Link>
        </p>
      </div>
    </div>
  );
}
