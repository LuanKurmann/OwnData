import type { ExtractedLink } from "@/db/schema";

/** Links that look like "confirm your request" links and are safe to open with a plain GET. */
const CONFIRM_URL = /(confirm|verify|verif|validate|activate|approve|best(ä|ae)tig|token=|otp)/i;
const NOT_CONFIRM = /(unsubscribe|abmelden|login|signin|password|reset|delete-account|cancel)/i;

export function pickConfirmationLinks(links: ExtractedLink[], max = 1): ExtractedLink[] {
  return links.filter((l) => (CONFIRM_URL.test(l.url) || CONFIRM_URL.test(l.label)) && !NOT_CONFIRM.test(l.url)).slice(0, max);
}

export type VisitResult = { url: string; ok: boolean; status: number; title: string; snippet: string; error?: string };

/** Open a confirmation link server-side (GET, follows redirects) and report what the page said. */
export async function visitLink(url: string, timeoutMs = 10000): Promise<VisitResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "user-agent": "Mozilla/5.0 (compatible; OwnData/0.1)", accept: "text/html,*/*" },
    });
    const html = (await res.text()).slice(0, 200_000);
    const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim().slice(0, 120) ?? "";
    const text = html
      .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const idx = text.search(/(confirmed|verified|success|thank you|best(ä|ae)tigt|erfolgreich|vielen dank|received|complete)/i);
    const snippet = (idx >= 0 ? text.slice(Math.max(0, idx - 80), idx + 160) : text.slice(0, 240)).trim();
    const looksOk = res.ok && !/(error|invalid|expired|abgelaufen|ung(ü|ue)ltig|not found|fehler)/i.test(snippet);
    return { url, ok: looksOk, status: res.status, title, snippet };
  } catch (e) {
    return { url, ok: false, status: 0, title: "", snippet: "", error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(timer);
  }
}
