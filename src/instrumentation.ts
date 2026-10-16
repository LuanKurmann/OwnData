export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getDb } = await import("@/db");
    getDb(); // run migrations + seed at boot
    const { startScheduler } = await import("@/server/worker");
    startScheduler();
  }
}
