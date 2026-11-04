import "server-only";
import { z } from "zod";
import { sql } from "@/lib/db";
import {
  WorkOrderApiError,
  type WorkOrderActor,
} from "../work-orders/security";
import { needTechnical } from "./technical.server";
import { requireTechnicalAssignment } from "./technical-assignment";
import { makasliDrawing } from "./makasli-drawing";

export async function orderDrawings(
  actor: WorkOrderActor,
  orderId: string,
): Promise<{
  orderNumber: string;
  lines: Array<{
    id: string;
    productName: string;
    svg: string | null;
    message: string | null;
  }>;
}> {
  await needTechnical(actor);
  z.uuid().parse(orderId);
  const [order] =
    await sql`SELECT id,order_number FROM orders WHERE tenant_id=${actor.tenantId} AND id=${orderId}`;
  if (!order) throw new WorkOrderApiError("Sipariş bulunamadı", 404);
  if (actor.role === "worker") {
    const jobs = await sql`SELECT assigned_to FROM work_orders
      WHERE tenant_id=${actor.tenantId} AND order_id=${orderId} AND status<>'cancelled'`;
    requireTechnicalAssignment(actor, jobs);
  }
  // order_items has no tenant column: the owning order scopes every line, including the join.
  const lines =
    await sql`SELECT i.id,i.product_name,i.width_mm,i.projection_mm,i.mounting_height_mm,
    i.product_configuration->>'family' AS family,i.awning_configuration->>'productCode' AS awning_code
    FROM order_items i JOIN orders o ON o.id=i.order_id AND o.tenant_id=${actor.tenantId}
    WHERE o.tenant_id=${actor.tenantId} AND o.id=${orderId} ORDER BY i.created_at,i.id`;
  return {
    orderNumber: order.order_number as string,
    lines: lines
      .filter((l: any) =>
        l.family
          ? l.family === "makasli"
          : l.awning_code === "WINMAX-MAKASLI" ||
            /^(makaslı tente|winmax makaslı tente)$/i.test(
              (l.product_name || "").trim(),
            ),
      )
      .map((l: any) => ({
        id: l.id as string,
        productName: l.product_name as string,
        ...makasliDrawing(
          {
            widthMm: l.width_mm == null ? null : Number(l.width_mm),
            projectionMm:
              l.projection_mm == null ? null : Number(l.projection_mm),
            mountingHeightMm:
              l.mounting_height_mm == null
                ? null
                : Number(l.mounting_height_mm),
          },
          l.product_name || "Makaslı tente",
        ),
      })),
  };
}
