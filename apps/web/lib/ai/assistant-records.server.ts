import "server-only";
import { hasPermission } from '@/lib/auth/permissions';
import { sql } from "@/lib/db";
import { resolveMemberAccess } from "@/lib/security/member-access.server";
import {
  can,
  redactFields,
  type FieldGroup,
} from "@/lib/security/access-matrix";
import type { WorkOrderActor } from "@/lib/features/work-orders/security";

/** The firm's custom role and hidden-field rules apply to model context too. */
export function hideAssistantFields(value: unknown, hidden: FieldGroup[]): any {
  if (Array.isArray(value))
    return value.map((v) => hideAssistantFields(v, hidden));
  if (value instanceof Date) return value;
  if (!value || typeof value !== "object") return value;
  const forbidden = (key: string) =>
    (hidden.includes("price") &&
      /(price|amount|subtotal|discount|tax_amount|collected|ordered_value|revenue)/i.test(
        key,
      )) ||
    (hidden.includes("cost") && /cost/i.test(key)) ||
    (hidden.includes("profit") && /profit|margin/i.test(key)) ||
    (hidden.includes("customer_contact") &&
      /customer|contact|supplier_name|full_name|company_name|phone|email|address/i.test(
        key,
      ));
  return redactFields(
    Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !forbidden(key))
        .map(([key, v]) => [key, hideAssistantFields(v, hidden)]),
    ),
    hidden,
  );
}

export async function searchAssistantRecords(
  actor: WorkOrderActor,
  category: string,
  query: string,
) {
  const access = await resolveMemberAccess(actor.userId, actor.tenantId);
  if (!access || access.deactivated)
    return { scope: "Firma üyeliği etkin değil." };
  const t = actor.tenantId,
    q = "%" + query.trim().slice(0, 120).replace(/[%_]/g, "") + "%";
  const id = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(query)
    ? query
    : null;
  let result: unknown;
  if (category === 'employees' && can(access,'finance','view') && hasPermission(actor.role,'finance.employees.view'))
    result = await sql`SELECT id, full_name, department, active FROM employees WHERE tenant_id=${t} AND full_name ILIKE ${q} ORDER BY full_name LIMIT 20`;
  else if (category === 'warehouses' && can(access,'inventory','view'))
    result = await sql`SELECT id,code,name,warehouse_type FROM warehouses WHERE tenant_id=${t} AND active AND (name ILIKE ${q} OR code ILIKE ${q}) ORDER BY code LIMIT 30`;
  else if (category === "quotations" && can(access, "quotations", "view"))
    result =
      await sql`SELECT id,quotation_number,customer_name,status,currency,total_amount,valid_until FROM quotations WHERE tenant_id=${t} AND (quotation_number ILIKE ${q} OR customer_name ILIKE ${q}) ORDER BY created_at DESC LIMIT 20`;
  else if (category === "purchases" && can(access, "purchasing", "view"))
    result =
      await sql`SELECT p.id,p.purchase_order_number,p.status,p.expected_at,s.name AS supplier_name FROM purchase_orders p LEFT JOIN suppliers s ON s.id=p.supplier_id AND s.tenant_id=p.tenant_id WHERE p.tenant_id=${t} AND (p.purchase_order_number ILIKE ${q} OR s.name ILIKE ${q}) ORDER BY p.created_at DESC LIMIT 20`;
  else if (category === "suppliers" && can(access, "purchasing", "view"))
    result =
      await sql`SELECT id,name AS supplier_name FROM suppliers WHERE tenant_id=${t} AND name ILIKE ${q} LIMIT 20`;
  else if (
    category === "shipments" &&
    can(access, "orders", "view") &&
    ["owner", "admin", "office"].includes(actor.role)
  )
    result =
      await sql`SELECT id,shipment_number,customer_name,status,scheduled_date,actual_date,carrier FROM shipments WHERE tenant_id=${t} AND (shipment_number ILIKE ${q} OR customer_name ILIKE ${q}) ORDER BY created_at DESC LIMIT 20`;
  else if (
    category === "recipes" &&
    can(access, "production", "view") &&
    actor.role !== "worker"
  )
    result =
      await sql`SELECT id,code,name,version,status FROM production_recipes WHERE tenant_id=${t} AND (code ILIKE ${q} OR name ILIKE ${q}) ORDER BY version DESC LIMIT 20`;
  else if (
    category === "quote-detail" &&
    id &&
    can(access, "quotations", "view")
  ) {
    const [quote] =
      await sql`SELECT id,quotation_number,customer_name,status,currency,total_amount,subtotal,discount_amount,tax_amount,valid_until,notes,terms_and_conditions FROM quotations WHERE tenant_id=${t} AND id=${id}`;
    result = quote
      ? {
          quote,
          items:
            await sql`SELECT product_name,description,quantity,unit_price,total_price,color,width_mm,height_mm,projection_mm,mounting_height_mm,notes FROM quotation_items WHERE quotation_id=${id} AND tenant_id=${t} ORDER BY position LIMIT 40`,
        }
      : { found: false };
  } else if (
    category === "order-detail" &&
    id &&
    can(access, "orders", "view") &&
    actor.role !== "worker"
  ) {
    const [order] =
      await sql`SELECT id,order_number,customer_name,status,priority,delivery_date,shipment_status,currency,total_amount,notes FROM orders WHERE tenant_id=${t} AND id=${id}`;
    result = order
      ? {
          order,
          items:
            await sql`SELECT i.product_name,i.quantity,i.unit_price,i.total_price,i.color,i.width_mm,i.height_mm,i.projection_mm,i.mounting_height_mm,i.notes FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.tenant_id=${t} AND o.id=${id} LIMIT 40`,
        }
      : { found: false };
  } else
    return {
      scope:
        "Bu kayıt türü mevcut çalışma kapsamına dahil değil veya detay için gerçek kayıt kimliği gerekiyor.",
    };
  return hideAssistantFields(result, access.hidden);
}
