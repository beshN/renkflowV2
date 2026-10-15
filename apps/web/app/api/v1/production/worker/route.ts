import { sql } from "@/lib/db";
import { requireWorkOrderActor } from "@/lib/features/work-orders/security";
import { needTechnical } from "@/lib/features/orders/technical.server";
import { technicalFamily } from "@/lib/features/orders/technical";
import { redactedJson } from "@/lib/security/field-access.server";
import { recordError, NO_STORE } from "@/lib/features/records/http";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const a = await requireWorkOrderActor();
    await needTechnical(a);
    const orders =
      await sql`SELECT o.id,o.order_number,o.product_name,o.quantity,o.status,o.delivery_date,
      r.family,r.revision,r.status AS technical_status,
      EXISTS(SELECT 1 FROM work_orders w WHERE w.tenant_id=o.tenant_id AND w.order_id=o.id AND w.assigned_to=${a.userId} AND w.status<>'cancelled') AS assigned
      FROM orders o LEFT JOIN LATERAL(SELECT family,revision,status FROM order_technical_revisions WHERE tenant_id=o.tenant_id AND order_id=o.id ORDER BY revision DESC LIMIT 1)r ON true
      WHERE o.tenant_id=${a.tenantId} AND o.provisional=false AND o.status NOT IN('cancelled','completed','delivered') AND EXISTS(SELECT 1 FROM work_orders w WHERE w.tenant_id=o.tenant_id AND w.order_id=o.id AND w.status<>'cancelled') ORDER BY o.delivery_date NULLS LAST,o.created_at`;
    return redactedJson(
      {
        orders: orders
          .map((o: any) => ({
            ...o,
            family: o.family || technicalFamily(o.product_name || ""),
          }))
          .filter(
            (o: any) =>
              a.role !== "worker" ||
              o.assigned ||
              (o.family || technicalFamily(o.product_name)) === "other",
          ),
        worker: a.role === "worker",
      },
      { headers: NO_STORE },
    );
  } catch (e) {
    return recordError(e, "worker-list");
  }
}
