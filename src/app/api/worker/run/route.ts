import { runWorker } from "@/server/worker";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorizedByToken(req: Request): boolean {
  const workerToken = process.env.WORKER_TOKEN;
  const cronSecret = process.env.CRON_SECRET;
  const header = req.headers.get("x-worker-token");
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (workerToken && (header === workerToken || bearer === workerToken)) return true;
  if (cronSecret && bearer === cronSecret) return true;
  return false;
}

/**
 * Trigger a worker run for all users.
 *  - Vercel Cron: GET with `Authorization: Bearer <CRON_SECRET>` (set CRON_SECRET in the project env)
 *  - External cron (cron-job.org, curl): GET/POST with header `x-worker-token: <WORKER_TOKEN>`
 *  - Logged-in user: POST runs the worker for their own account only
 */
export async function GET(req: Request) {
  if (authorizedByToken(req)) return Response.json(await runWorker());
  // Zero-config fallback: with no secret configured, Vercel Cron may still trigger a run,
  // but the response carries no details.
  const noSecrets = !process.env.WORKER_TOKEN && !process.env.CRON_SECRET;
  if (noSecrets && (req.headers.get("user-agent") ?? "").startsWith("vercel-cron/")) {
    await runWorker();
    return Response.json({ ok: true });
  }
  return new Response("Unauthorized", { status: 401 });
}

export async function POST(req: Request) {
  if (authorizedByToken(req)) return Response.json(await runWorker());
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  return Response.json(await runWorker(user.id));
}
