export async function register() {
  // On Vercel (serverless) there is no long-running process: the worker is triggered by cron via /api/worker/run.
  if (process.env.NEXT_RUNTIME === "nodejs" && !process.env.VERCEL) {
    const { getDb } = await import("@/db");
    await getDb(); // run migrations + seed at boot
    const { startScheduler } = await import("@/server/worker");
    startScheduler();
  }
}
