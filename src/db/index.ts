import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import * as schema from "./schema";
import { seedSystemData } from "./seed";

export type Db = BetterSQLite3Database<typeof schema>;

const g = globalThis as unknown as { __owndataDb?: Db; __owndataSeeded?: boolean };

export function getDb(): Db {
  if (g.__owndataDb) return g.__owndataDb;
  const path = process.env.DATABASE_PATH ?? "./data/owndata.db";
  mkdirSync(dirname(path), { recursive: true });
  const sqlite = new Database(path);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: join(process.cwd(), "drizzle") });
  g.__owndataDb = db;
  if (!g.__owndataSeeded) {
    g.__owndataSeeded = true;
    seedSystemData(db);
  }
  return db;
}

export { schema };
