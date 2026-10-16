import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ShieldCheck } from "lucide-react";
import Flash from "@/components/Flash";
import SubmitButton from "@/components/SubmitButton";
import { registrationOpen } from "@/lib/auth";
import type { SearchParams } from "@/lib/flash";
import { str } from "@/lib/flash";
import { loginAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const t = await getTranslations("auth");
  const ta = await getTranslations("app");
  const open = registrationOpen();
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2">
          <ShieldCheck className="h-7 w-7 text-brand-600" />
          <div>
            <div className="text-lg font-semibold">{ta("name")}</div>
            <div className="text-xs text-slate-500">{ta("tagline")}</div>
          </div>
        </div>
        <Flash sp={sp} />
        <form action={loginAction} className="flex flex-col gap-3">
          <input type="hidden" name="next" value={str(sp.next)} />
          <div>
            <label className="label" htmlFor="email">{t("email")}</label>
            <input id="email" name="email" type="email" required autoComplete="email" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="password">{t("password")}</label>
            <input id="password" name="password" type="password" required autoComplete="current-password" className="input" />
          </div>
          <SubmitButton>{t("login")}</SubmitButton>
        </form>
        {open ? (
          <p className="mt-4 text-center text-sm text-slate-500">
            {t("noAccount")} <Link className="text-brand-600 underline" href="/register">{t("register")}</Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}
