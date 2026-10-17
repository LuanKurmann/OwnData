import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { LogOut, ShieldCheck } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import NavLinks, { type NavItem } from "@/components/NavLinks";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import { logoutAction } from "./actions";
import { unmatchedCount } from "@/server/inbox";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const t = await getTranslations("nav");
  const open = await unmatchedCount(user.id);
  const items: NavItem[] = [
    { key: "dashboard", href: "/dashboard", label: t("dashboard") },
    { key: "brokers", href: "/brokers", label: t("brokers") },
    { key: "requests", href: "/requests", label: t("requests") },
    { key: "inbox", href: "/inbox", label: t("inbox"), badge: open },
    { key: "activity", href: "/activity", label: t("activity") },
    { key: "profile", href: "/profile", label: t("profile") },
    { key: "mail", href: "/settings/mail", label: t("mail") },
    { key: "templates", href: "/templates", label: t("templates") },
  ];
  return (
    <div className="min-h-screen md:flex">
      <aside className="flex w-full flex-col gap-4 border-b border-slate-200 bg-white p-4 md:min-h-screen md:w-60 md:border-b-0 md:border-r dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2 px-2">
          <ShieldCheck className="h-6 w-6 text-brand-600" />
          <span className="text-lg font-semibold">OwnData</span>
        </div>
        <NavLinks items={items} />
        <div className="mt-auto flex flex-col gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
          <div className="px-2 text-xs text-slate-500">
            <div className="truncate font-medium text-slate-700 dark:text-slate-200">{user.name}</div>
            <div className="truncate">{user.email}</div>
          </div>
          <div className="flex items-center justify-between px-2">
            <LocaleSwitcher />
            <form action={logoutAction}>
              <button className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
                <LogOut className="h-3.5 w-3.5" /> {t("logout")}
              </button>
            </form>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-8">
        <div className="mx-auto min-w-0 max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
