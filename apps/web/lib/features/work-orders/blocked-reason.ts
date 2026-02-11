import { z } from 'zod';

export const WORK_ORDER_BLOCK_REASON_CATEGORIES = [
  'material',
  'machine',
  'planning',
  'manpower',
  'quality',
  'other',
] as const;

export const WorkOrderBlockReasonCategorySchema = z.enum(WORK_ORDER_BLOCK_REASON_CATEGORIES);

export type WorkOrderBlockReasonCategory =
  (typeof WORK_ORDER_BLOCK_REASON_CATEGORIES)[number];

export function normalizeBlockedReasonCategory(
  value: string | null | undefined
): WorkOrderBlockReasonCategory | null {
  const normalized = (value || '').trim().toLowerCase();
  if (!normalized) return null;
  return WorkOrderBlockReasonCategorySchema.safeParse(normalized).success
    ? (normalized as WorkOrderBlockReasonCategory)
    : null;
}

export function normalizeBlockedReasonDetail(value: string | null | undefined): string | null {
  const normalized = (value || '').trim();
  return normalized ? normalized : null;
}

export function validateBlockedReasonForStatus(
  targetStatus: string,
  category: WorkOrderBlockReasonCategory | null,
  detail: string | null
): void {
  if (targetStatus !== 'blocked') {
    return;
  }

  if (!category) {
    throw new Error('Bloke durumunda gecikme nedeni kategorisi zorunludur');
  }

  if (!detail || detail.length < 5) {
    throw new Error('Bloke durumunda en az 5 karakter gecikme açıklaması zorunludur');
  }
}
