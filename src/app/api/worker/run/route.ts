import { runWorker } from "@/server/worker";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Trigger a worker run. Either an authenticated user (own account only) or the WORKER_TOKEN header (all users). */
export async function POST(req: Request) {
  const token = process.env.WORKER_TOKEN;
  const header = req.headers.get("x-worker-token");
  if (token && header && header === token) {
    return Response.json(await runWorker());
  }
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  return Response.json(await runWorker(user.id));
}
