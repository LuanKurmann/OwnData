import { useTranslations } from "next-intl";

const ICONS: Record<string, string> = {
  "request.drafted": "📝",
  "request.queued": "⏳",
  "request.sent": "📤",
  "request.failed": "⚠️",
  "request.bounced": "⛔",
  "request.overdue": "⏰",
  "request.escalation_ready": "⚖️",
  "request.status": "🔁",
  "request.edited": "✏️",
  "request.form_only": "🧾",
  "request.form_submitted": "🧾",
  "reminder.sent": "🔔",
  "reminder.failed": "⚠️",
  "reply.received": "📥",
  "reply.sent": "↩️",
  "inbox.assigned": "🔗",
  "action.resolved": "✅",
  "imap.failed": "⚠️",
  "auto.followup": "🤖",
  "auto.followup_failed": "⚠️",
  "auto.confirm": "🤖",
  "auto.confirm_failed": "⚠️",
  "auto.resend": "🤖",
  "auto.form_fallback": "🤖",
};

/** Human-readable label for an activity-log event key; falls back to the key itself. */
export default function EventLabel({ event }: { event: string }) {
  const t = useTranslations("events");
  const key = event.replace(".", "_");
  let label: string;
  try {
    label = t.has(key as never) ? t(key as never) : event;
  } catch {
    label = event;
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span aria-hidden>{ICONS[event] ?? "•"}</span>
      {label}
    </span>
  );
}
