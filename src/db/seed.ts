import { eq, isNull } from "drizzle-orm";
import type { Db } from "./index";
import { brokers, templates, type BrokerCategory, type Jurisdiction } from "./schema";
import brokerSeed from "@/data/brokers.json";
import { SYSTEM_TEMPLATES, expandSystemTemplate } from "@/data/templates";

type SeedBroker = {
  slug: string;
  name: string;
  website: string;
  privacyEmail: string;
  privacyUrl: string;
  optOutUrl: string;
  country: string;
  jurisdiction: Jurisdiction;
  category: BrokerCategory;
  language: "de" | "en";
  requiresIdVerification: boolean;
  preferredChannel: "email" | "form";
  notes: string;
};

/** Insert curated brokers and system templates that are not present yet. Never touches user data. */
export async function seedSystemData(db: Db) {
  const existingBrokers = new Map(
    (await db.select().from(brokers).where(isNull(brokers.userId)).all()).map((r) => [r.slug, r] as const),
  );
  const seed = brokerSeed as SeedBroker[];
  const missing = seed.filter((b) => !existingBrokers.has(b.slug));
  if (missing.length) {
    await db.insert(brokers).values(missing.map((b) => ({ ...b, userId: null, isCurated: true }))).run();
  }
  // keep curated contact data in sync with the shipped list (curated rows are read-only for users)
  for (const b of seed) {
    const cur = existingBrokers.get(b.slug);
    if (!cur) continue;
    const changed = (Object.keys(b) as (keyof SeedBroker)[]).some((k) => cur[k] !== b[k]);
    if (changed) await db.update(brokers).set({ ...b }).where(eq(brokers.id, cur.id)).run();
  }

  const existingTemplates = new Map(
    (await db.select({ id: templates.id, key: templates.key, subject: templates.subject, body: templates.body }).from(templates).where(isNull(templates.userId)).all()).map(
      (r) => [r.key, r] as const,
    ),
  );
  for (const raw of SYSTEM_TEMPLATES) {
    const t = expandSystemTemplate(raw);
    const values = {
      userId: null,
      key: t.key,
      jurisdiction: t.jurisdiction,
      kind: t.kind,
      requestType: t.requestType,
      language: t.language,
      name: t.name,
      subject: t.subject,
      body: t.body,
      isSystem: true,
    };
    const existing = existingTemplates.get(t.key);
    if (!existing) {
      await db.insert(templates).values(values).run();
    } else if (existing.subject !== t.subject || existing.body !== t.body) {
      // keep system templates in sync with the code; user overrides live in separate rows
      await db.update(templates).set(values).where(eq(templates.id, existing.id)).run();
    }
  }
}
