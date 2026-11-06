import 'server-only';
import { getSql } from '@/lib/db';
import { requireCap } from '../field/common.server';
import { WorkOrderApiError, type WorkOrderActor } from '../work-orders/security';
import { canPromiseOrder } from '@/lib/security/access-matrix';
import { schedulingSnapshot, scheduleSnapshot } from './planning.service';
import { promiseDate, type PromiseOperation, type PromiseResult } from './promise';
import { materialReadyAt, promiseLine } from './promise-order';
import { promiseMaterialReadyDate } from './promise-material.server';
import { colorKey } from '../colors/color-spec';

export async function orderPromise(actor: WorkOrderActor, id: string, now = new Date().toISOString()) {
  const access = await requireCap(actor, 'orders', 'view', 'Termin önerisi');
  if (!canPromiseOrder(access)) throw new WorkOrderApiError('Sipariş bulunamadı', 404);
  const t = actor.tenantId;
  return getSql().begin('isolation level repeatable read read only', async (tx: any) => {
    const [order] = await tx`SELECT id FROM orders WHERE tenant_id=${t} AND id=${id}`;
    if (!order) throw new WorkOrderApiError('Sipariş bulunamadı', 404);
    // order_items has no tenant_id: preserve its existing parent-order tenant scope.
    const items = await tx`SELECT i.* FROM order_items i JOIN orders o ON o.id=i.order_id
      WHERE o.tenant_id=${t} AND o.id=${id} ORDER BY i.id`;
    const recipes = await tx`SELECT * FROM production_recipes WHERE tenant_id=${t} AND status='published'`;
    const missing: PromiseResult['missing'] = [];
    const operations: PromiseOperation[] = [];
    const groups = new Map<string, ReturnType<typeof promiseLine>[]>();
    if (!items.length) missing.push({ reason: 'Sipariş kalemi gerekli' });
    for (const item of items) {
      try {
        const line = promiseLine(item, recipes.find((r: any) => r.id === item.product_configuration?.recipeId));
        for (const op of line.calculated.operations) operations.push({ id: `${item.id}:${op.position}`,
          position: operations.length, workCenterCode: op.workCenterCode, plannedMinutes: op.plannedMinutes, setupMinutes: op.setupMinutes });
        const key = colorKey(line.color);
        groups.set(key, [...(groups.get(key) ?? []), line]);
      } catch (error) {
        missing.push({ operationId: item.id, reason: error instanceof Error ? error.message : 'Reçete bilgileri eksik' });
      }
    }
    // One snapshot; planning owns remaining-time and resource projection rules.
    const snapshot = await schedulingSnapshot(tx, t);
    let planned: Pick<ReturnType<typeof scheduleSnapshot>, 'tasks' | 'blocked'> = { tasks: [], blocked: [] };
    try { planned = scheduleSnapshot(snapshot, now, Date.parse(now)); }
    catch (error) { missing.push({ reason: error instanceof Error ? error.message : 'Mevcut yük bilgileri eksik' }); }
    const calendar = (r: any) => ({ code: r.code, parallelCapacity: r.parallel_capacity,
      shiftStart: r.shift_start, shiftEnd: r.shift_end, workDays: r.work_days, maintenance: r.maintenance,
      machineRequired: r.machine_required, teamRequired: r.team_required });
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now));
    const material = [];
    for (const [first, ...rest] of groups.values()) {
      material.push(await promiseMaterialReadyDate({ ...actor, role: access.base }, { ...first, additionalRecipes: rest, today }, tx));
    }
    const dates = material.map(m => m.readyDate);
    if (dates.some(d => d === null)) missing.push({ reason: 'Malzeme hazır tarihi için tedarik süresi veya birim bilgileri eksik' });
    const readyDate = dates.length && dates.every(d => d !== null) ? dates.sort().at(-1)! : null;
    const result = promiseDate({ now, load: [...planned.tasks, ...planned.blocked], centers: snapshot.centers.map(calendar),
      resources: snapshot.resources.map((r: any) => ({ ...calendar(r), id: r.id, kind: r.kind,
        userId: r.user_id, memberIds: r.member_ids, workCenterCodes: r.work_center_codes })),
      operations, materialReadyAt: readyDate ? materialReadyAt(readyDate) : '' });
    if (missing.length) {
      result.earliestFinish = null; result.bindingConstraint = null; result.tasks = [];
      result.missing.push(...missing); result.explanation = 'Eksikler giderilmeden termin hesaplanamaz.';
    }
    return { orderId: id, ...result, material, requiresHumanApproval: true as const };
  });
}
