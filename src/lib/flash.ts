import { redirect } from "next/navigation";

export type SearchParams = Record<string, string | string[] | undefined>;

export function flashUrl(path: string, msg: string, kind: "ok" | "err" = "ok", params: Record<string, string | number> = {}) {
  const sp = new URLSearchParams({ msg, kind });
  for (const [k, v] of Object.entries(params)) sp.set(k, String(v));
  return `${path}${path.includes("?") ? "&" : "?"}${sp.toString()}`;
}

export function redirectFlash(path: string, msg: string, kind: "ok" | "err" = "ok", params: Record<string, string | number> = {}): never {
  redirect(flashUrl(path, msg, kind, params));
}

export function str(v: string | string[] | undefined, fallback = ""): string {
  if (Array.isArray(v)) return v[0] ?? fallback;
  return v ?? fallback;
}
