import 'server-only';
import { WorkOrderApiError } from '@/lib/features/work-orders/security';
import { z } from 'zod';
import type { StationDevice } from './security.server';
import type { StationCheck } from './contract';
/** Only the frozen BOM and current operation attempt define required checks; clients cannot invent them. */
export async function stationChecks(
  db: any,
  device: StationDevice,
  op: any,
): Promise<StationCheck[]> {
  const prefix = `${op.attempt}:${op.completed_qty}:`,
    defs = device.checklist_labels.map((label, i) => ({
      key: prefix + 'general:' + i,
      label,
    }));
  const [job] =
    await db`SELECT id,bom_snapshot,planned_qty FROM work_orders WHERE tenant_id=${device.tenant_id} AND id=${op.work_order_id}`;
  if (!job) throw new WorkOrderApiError('İş emri bulunamadı.', 404);
  const materials =
    await db`SELECT m.item_id,m.required_qty,m.uom,i.name FROM work_order_materials m JOIN inventory_items i ON i.id=m.item_id AND i.tenant_id=m.tenant_id WHERE m.tenant_id=${device.tenant_id} AND m.work_order_id=${job.id} ORDER BY m.item_id`;
  if (device.kind === 'cutting')
    for (const [i, cut] of (job.bom_snapshot?.cuts ?? []).entries()) {
      const card = materials.find((m: any) => m.item_id === cut.itemId);
      defs.push({
        key: prefix + 'cut:' + i,
        label: `${card?.name ?? 'Profil'} · ${Number(cut.lengthMm).toLocaleString('tr-TR')} mm × ${Number(cut.quantity)} adet`,
      });
    }
  if (device.kind === 'packing')
    for (const m of materials.filter((m: any) =>
      ['adet', 'set', 'paket', 'pcs'].includes(m.uom),
    )) {
      const qty = Number(
        (
          (Number(m.required_qty) / Number(job.planned_qty)) *
          (Number(op.planned_qty) - Number(op.completed_qty))
        ).toFixed(3),
      );
      defs.push({
        key: prefix + 'accessory:' + m.item_id,
        label: `${m.name} · ${qty.toLocaleString('tr-TR')} ${m.uom}`,
      });
    }
  const saved =
    await db`SELECT check_key,checked,version FROM station_checklist_checks WHERE tenant_id=${device.tenant_id} AND operation_id=${op.id}`;
  return defs.map((d) => {
    const s = saved.find((v: any) => v.check_key === d.key);
    return { ...d, checked: Boolean(s?.checked), version: s?.version ?? 0 };
  });
}
export const StationCheckInputSchema = z.object({
  operationId: z.string().uuid(),
  operationVersion: z.number().int().positive(),
  key: z.string().min(1).max(200),
  checked: z.boolean(),
  version: z.number().int().nonnegative(),
});
