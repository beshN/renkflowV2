import { readFile } from "@/lib/storage";
import { requireWorkOrderActor } from "@/lib/features/work-orders/security";
import { sql } from "@/lib/db";
import { z } from "zod";
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tenant: string; id: string }> },
) {
  try {
    const a = await requireWorkOrderActor(),
      { tenant, id } = await params;
    if (tenant !== a.tenantId)
      return new Response("Not found", { status: 404 });
    z.string().uuid().parse(id);
    const [f] =
      await sql`SELECT f.* FROM production_files f WHERE f.tenant_id=${a.tenantId} AND f.id=${id} AND (${["owner", "admin", "office", "accountant"].includes(a.role)} OR (${a.role === "worker"} AND f.work_order_id IN(SELECT id FROM work_orders WHERE tenant_id=${a.tenantId} AND (assigned_to=${a.userId} OR EXISTS(SELECT 1 FROM production_operations p WHERE p.work_order_id=work_orders.id AND p.tenant_id=${a.tenantId} AND p.assigned_to=${a.userId})))))`;
    if (!f) return new Response("Not found", { status: 404 });
    const content = f.file_path ? (await readFile(f.file_path)).body : new Uint8Array(f.body);
    return new Response(content, {
      headers: {
        "Content-Type": f.mime,
        "Content-Disposition": `inline; filename="document.${f.mime === "application/pdf" ? "pdf" : "image"}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy":
          "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      },
    });
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }
}
