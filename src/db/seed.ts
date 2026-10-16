import { and, eq, isNull } from "drizzle-orm";
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
  notes: string;
};

/** Insert curated brokers and system templates that are not present yet. Never touches user data. */
export function seedSystemData(db: Db) {
  const existingBrokers = new Set(
    db.select({ slug: brokers.slug }).from(brokers).where(isNull(brokers.userId)).all().map((r) => r.slug),
  );
  for (const b of brokerSeed as SeedBroker[]) {
    if (existingBrokers.has(b.slug)) continue;
    db.insert(brokers)
      .values({ ...b, userId: null, isCurated: true })
      .run();
  }

  for (const raw of SYSTEM_TEMPLATES) {
    const t = expandSystemTemplate(raw);
    const existing = db
      .select({ id: templates.id })
      .from(templates)
      .where(and(isNull(templates.userId), eq(templates.key, t.key)))
      .get();
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
    if (existing) {
      // keep system templates in sync with the code; user overrides live in separate rows
      db.update(templates).set(values).where(eq(templates.id, existing.id)).run();
    } else {
      db.insert(templates).values(values).run();
    }
  }
}
