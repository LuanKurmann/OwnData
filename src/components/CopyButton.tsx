"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";

export default function CopyButton({ text, className = "btn-secondary" }: { text: string; className?: string }) {
  const [done, setDone] = useState(false);
  const t = useTranslations("common");
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? t("copied") : t("copy")}
    </button>
  );
}
