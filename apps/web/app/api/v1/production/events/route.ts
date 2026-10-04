import { NextRequest } from "next/server";
import { requireWorkOrderActor } from "@/lib/features/work-orders/security";
import { sql } from "@/lib/db";
export const maxDuration = 60;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  let actor;
  try {
    actor = await requireWorkOrderActor();
    if (!["owner", "admin", "office", "worker"].includes(actor.role))
      return new Response("Forbidden", { status: 403 });
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }
  let cursor = Number(
    req.headers.get("last-event-id") ||
      req.nextUrl.searchParams.get("cursor") ||
      0,
  );
  if (!Number.isSafeInteger(cursor) || cursor < 0) cursor = 0;
  let timer: ReturnType<typeof setTimeout> | undefined,
    closed = false;
  let lifetime: ReturnType<typeof setTimeout> | undefined;
  let closeStream: (()=>void) | undefined;
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const close = () => {
        if (closed) return;
        closed = true;
        clearTimeout(timer);
        clearTimeout(lifetime);
        req.signal.removeEventListener("abort", close);
        try {
          controller.close();
        } catch {}
      };
      closeStream = close;
      lifetime = setTimeout(close, 50000);
      controller.enqueue(encoder.encode("retry: 3000\n\n"));
      req.signal.addEventListener("abort", close, { once: true });
      const tick = async () => {
        if (closed) return;
        try {
          const rows =
            await sql`SELECT e.id,e.event_type,e.work_order_id,e.created_at FROM production_events e WHERE e.tenant_id=${actor.tenantId} AND e.id>${cursor} AND (${actor.role !== "worker"} OR e.work_order_id IN(SELECT id FROM work_orders WHERE tenant_id=${actor.tenantId} AND (assigned_to=${actor.userId} OR EXISTS(SELECT 1 FROM production_operations p WHERE p.work_order_id=work_orders.id AND p.tenant_id=${actor.tenantId} AND p.assigned_to=${actor.userId})))) ORDER BY e.id LIMIT 200`;
          if (closed) return;
          for (const row of rows) {
            cursor = Number(row.id);
            controller.enqueue(
              encoder.encode(
                `id: ${cursor}\nevent: update\ndata: ${JSON.stringify(row)}\n\n`,
              ),
            );
          }
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
          timer = setTimeout(tick, 4000);
        } catch {
          close();
        }
      };
      void tick();
    },
    cancel() {
      closeStream?.();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      Connection: "keep-alive",
    },
  });
}
