import type { WorkOrder, WorkOrderStatus } from './client';

export const KANBAN_COLUMNS: Array<{ id: WorkOrderStatus; title: string; color: string }> = [
  { id: 'open', title: 'Planlandı', color: 'bg-slate-400' },
  { id: 'in_progress', title: 'Devam ediyor', color: 'bg-blue-500' },
  { id: 'blocked', title: 'Bloke', color: 'bg-amber-500' },
  { id: 'done', title: 'Tamamlandı', color: 'bg-emerald-500' },
  { id: 'cancelled', title: 'İptal edildi', color: 'bg-rose-400' },
];
export const PRIORITY_LABELS = { low: 'Düşük', medium: 'Normal', high: 'Yüksek', critical: 'Kritik' };
export const BLOCK_LABELS = { material: 'Malzeme', machine: 'Makine', planning: 'Planlama', manpower: 'İş gücü', quality: 'Kalite', other: 'Diğer' };
export const READONLY_CAPABILITIES = { create: false, edit: false, assign: false, transition: false, close: false, comment: false, checklist: false };

export function cardPlacement(targetItems: Pick<WorkOrder, 'id'>[], cardId: string, index: number) {
  const remaining = targetItems.filter(item => item.id !== cardId);
  const at = Math.max(0, Math.min(index, remaining.length));
  return { beforeId: remaining[at - 1]?.id ?? null, afterId: remaining[at]?.id ?? null };
}

export function optimisticCardMove(items: WorkOrder[], cardId: string, status: WorkOrderStatus, placement: ReturnType<typeof cardPlacement>): WorkOrder[] {
  const card = items.find(item => item.id === cardId);
  if (!card) return items;
  const remaining = items.filter(item => item.id !== cardId);
  const at = placement.afterId ? remaining.findIndex(item => item.id === placement.afterId) : placement.beforeId ? remaining.findIndex(item => item.id === placement.beforeId) + 1 : remaining.length;
  remaining.splice(Math.max(0, at), 0, { ...card, status });
  return remaining;
}
