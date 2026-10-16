import type { Config } from "drizzle-kit";

const url = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL || `file:${process.env.DATABASE_PATH ?? "./data/owndata.db"}`;
const remote = !url.startsWith("file:");

export default (remote
  ? {
      schema: "./src/db/schema.ts",
      out: "./drizzle",
      dialect: "turso",
      dbCredentials: { url, authToken: process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN },
    }
  : {
      schema: "./src/db/schema.ts",
      out: "./drizzle",
      dialect: "sqlite",
      dbCredentials: { url: url.slice(5) },
    }) satisfies Config;
