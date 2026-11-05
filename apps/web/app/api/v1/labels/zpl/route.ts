import { z } from "zod";
import { requireWorkOrderActor, WorkOrderApiError } from "@/lib/features/work-orders/security";
import { downloadLabels } from "@/lib/features/labels/service";
export const dynamic = "force-dynamic";
const query = z.object({ kind: z.enum(["cut", "job", "shipment", "location"]), id: z.string().uuid() });
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
export async function GET(request: Request) {
  try {
    const actor = await requireWorkOrderActor();
    const input = query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!input.success) return Response.json({ error: "Geçersiz etiket isteği" }, { status: 400, headers });
    const { kind, id } = input.data;
    const body = await downloadLabels(actor, kind, id);
    return new Response(body, { headers: { ...headers, "Content-Type": "application/octet-stream", "Content-Disposition": `attachment; filename="${kind}-${id}.zpl"` } });
  } catch (error) {
    const status = error instanceof WorkOrderApiError ? error.status : 500;
    return Response.json({ error: error instanceof WorkOrderApiError ? error.message : "ZPL hazırlanamadı" }, { status, headers });
  }
}
