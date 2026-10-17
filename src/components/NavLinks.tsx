"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Building2, Send, UserRound, Mail, FileText, Inbox, History } from "lucide-react";

const ICONS = { dashboard: LayoutDashboard, brokers: Building2, requests: Send, inbox: Inbox, activity: History, profile: UserRound, mail: Mail, templates: FileText };

export type NavItem = { key: keyof typeof ICONS; href: string; label: string; badge?: number };

export default function NavLinks({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav className="flex flex-col gap-0.5">
      {items.map((it) => {
        const Icon = ICONS[it.key];
        const active = path === it.href || path.startsWith(it.href + "/");
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm ${
              active
                ? "bg-brand-50 font-medium text-brand-700 dark:bg-slate-800 dark:text-brand-100"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
          >
            <Icon className="h-4 w-4" />
            <span className="flex-1">{it.label}</span>
            {it.badge ? <span className="rounded-full bg-amber-100 px-1.5 text-xs font-medium text-amber-800 dark:bg-amber-900 dark:text-amber-200">{it.badge}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
