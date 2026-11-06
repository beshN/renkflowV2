import "server-only";
import { sql } from "@/lib/db";
import { requireCap } from "@/lib/features/field/common.server";
import {
  WorkOrderApiError,
  type WorkOrderActor,
} from "@/lib/features/work-orders/security";
import {
  planWeek,
  projectStationWeek,
  type PlanOperation,
  type PlanTask,
} from "./station-weekly-plan";

export type WeeklyPlanData = ReturnType<typeof projectStationWeek> & {
  week: ReturnType<typeof planWeek>;
  schedule: { id: string; status: string; createdAt: string } | null;
};
export async function stationWeeklyPlan(
  actor: WorkOrderActor,
  date?: string,
): Promise<WeeklyPlanData> {
  const access = await requireCap(
    actor,
    "production",
    "view",
    "Haftalık üretim planı",
  );
  if (!["owner", "admin", "office"].includes(access.base))
    throw new WorkOrderApiError("Üretim planlama erişimi gerekli", 403);
  const week = planWeek(date);
  const tenantId = actor.tenantId;
  return sql.begin(
    "isolation level repeatable read read only",
    async (tx: any) => {
      const operations = await tx`
      SELECT p.id, p.work_order_id, p.name, p.work_center_code, p.status, p.planned_qty,
        p.started_at, p.completed_at, w.title, w.production_uom, i.name AS product
      FROM production_operations p
      JOIN work_orders w ON w.id = p.work_order_id AND w.tenant_id = p.tenant_id AND w.tenant_id = ${tenantId}
      LEFT JOIN inventory_items i ON i.id = w.production_item_id AND i.tenant_id = w.tenant_id AND i.tenant_id = ${tenantId}
      WHERE p.tenant_id = ${tenantId} AND w.category = 'production'
        AND w.status NOT IN ('done', 'cancelled') AND p.status NOT IN ('done', 'cancelled')
      ORDER BY p.work_center_code, w.created_at, w.id, p.position`;
      const centers =
        await tx`SELECT code, name, parallel_capacity, active FROM work_centers WHERE tenant_id = ${tenantId} ORDER BY code`;
      // Published plan takes precedence; a draft is explicitly a proposal, never a new write/preview.
      const [schedule] = await tx`
      SELECT id, status, created_at, tasks FROM production_schedules WHERE tenant_id = ${tenantId}
        AND status IN ('published', 'draft')
      ORDER BY (status = 'published') DESC, created_at DESC, id DESC LIMIT 1`;
      const live: PlanOperation[] = operations.map((p: any) => ({
        id: p.id,
        workOrderId: p.work_order_id,
        title: p.title,
        product: p.product,
        quantity: p.planned_qty == null ? null : String(p.planned_qty),
        unit: p.production_uom,
        center: p.work_center_code,
        name: p.name,
        status: p.status,
        startedAt: p.started_at ? new Date(p.started_at).toISOString() : null,
        completedAt: p.completed_at
          ? new Date(p.completed_at).toISOString()
          : null,
      }));
      const tasks: PlanTask[] = Array.isArray(schedule?.tasks?.tasks)
        ? schedule.tasks.tasks.filter((t: any) => t && typeof t.id === "string")
        : [];
      return {
        week,
        schedule: schedule
          ? {
              id: schedule.id as string,
              status: schedule.status as string,
              createdAt: new Date(schedule.created_at).toISOString(),
            }
          : null,
        ...projectStationWeek(
          week,
          live,
          centers.map((c: any) => ({
            code: c.code,
            name: c.name,
            parallelCapacity: c.parallel_capacity,
            active: c.active,
          })),
          tasks,
        ),
      };
    },
  );
}
