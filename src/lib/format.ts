import { format, differenceInCalendarDays } from "date-fns";

export function fmtDate(d: Date | number | null | undefined, locale: string): string {
  if (!d) return "—";
  const date = typeof d === "number" ? new Date(d) : d;
  return format(date, locale === "de" ? "dd.MM.yyyy" : "yyyy-MM-dd");
}

export function fmtDateTime(d: Date | number | null | undefined, locale: string): string {
  if (!d) return "—";
  const date = typeof d === "number" ? new Date(d) : d;
  return format(date, locale === "de" ? "dd.MM.yyyy HH:mm" : "yyyy-MM-dd HH:mm");
}

/** positive = days left, negative = days overdue */
export function daysUntil(d: Date | null | undefined): number | null {
  if (!d) return null;
  return differenceInCalendarDays(d, new Date());
}
