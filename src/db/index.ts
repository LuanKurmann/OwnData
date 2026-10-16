import { createClient } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import * as schema from "./schema";
import { seedSystemData } from "./seed";

export type Db = LibSQLDatabase<typeof schema>;

const g = globalThis as unknown as { __owndataDb?: Promise<Db> };

/**
 * Database URL resolution:
 *  - DATABASE_URL: `libsql://<db>.turso.io` (Turso / Vercel), `file:/data/owndata.db` (Docker) or any libSQL URL
 *  - DATABASE_PATH (legacy): local file path
 *  - default: ./data/owndata.db
 */
export function databaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  return `file:${process.env.DATABASE_PATH ?? "./data/owndata.db"}`;
}

async function init(): Promise<Db> {
  const url = databaseUrl();
  const isFile = url.startsWith("file:");
  if (isFile) mkdirSync(dirname(url.slice(5)), { recursive: true });
  const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN || undefined });
  if (isFile) {
    await client.execute("PRAGMA journal_mode = WAL");
    await client.execute("PRAGMA foreign_keys = ON");
  }
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: join(process.cwd(), "drizzle") });
  await seedSystemData(db);
  return db;
}

/** Lazily connects, migrates and seeds once per process. Safe to call from every request. */
export function getDb(): Promise<Db> {
  if (!g.__owndataDb) {
    g.__owndataDb = init().catch((e) => {
      g.__owndataDb = undefined;
      throw e;
    });
  }
  return g.__owndataDb;
}

export { schema };
