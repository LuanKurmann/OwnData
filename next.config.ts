import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // standalone output is for the Docker image; Vercel builds its own bundle
  output: process.env.VERCEL ? undefined : "standalone",
  serverExternalPackages: ["@libsql/client", "imapflow", "nodemailer", "mailparser"],
  // migrations are read from disk at runtime, make sure they ship with the serverless function
  outputFileTracingIncludes: { "/**/*": ["./drizzle/**/*"] },
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
};

export default withNextIntl(nextConfig);
