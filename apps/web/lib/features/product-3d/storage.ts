import "server-only";
import { columnExists } from "@/lib/db/schema-guard";
import { WorkOrderApiError } from "@/lib/features/work-orders/security";
import { ProductVisualizationSchema } from "./catalog";
export async function requireVisualizationStorage(
  table: "order_items" | "quotation_items",
  items: Array<{ productVisualization?: unknown }>,
) {
  if (
    items.some((i) => i.productVisualization) &&
    !(await columnExists(table, "product_visualization"))
  )
    throw new WorkOrderApiError(
      "3D görünüm kaydı için veritabanı güncellemesi bekleniyor. Görünümü inceleyebilirsiniz; kaydetmek için güncelleme gerekli.",
      409,
    );
}
export async function storeVisualization(
  tx: any,
  table: "order_items" | "quotation_items",
  tenantId: string,
  id: string,
  raw: unknown,
) {
  if (!raw) return;
  const value = JSON.stringify(ProductVisualizationSchema.parse(raw));
  if (table === "order_items")
    await tx`UPDATE order_items i SET product_visualization=${value}::text::jsonb FROM orders o WHERE i.id=${id} AND i.order_id=o.id AND o.tenant_id=${tenantId}`;
  else
    await tx`UPDATE quotation_items SET product_visualization=${value}::text::jsonb WHERE id=${id} AND tenant_id=${tenantId}`;
}
