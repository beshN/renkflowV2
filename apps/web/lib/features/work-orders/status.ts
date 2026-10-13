export const WORK_ORDER_STATUSES = [
  'open',
  'in_progress',
  'blocked',
  'done',
  'cancelled',
] as const;

export type WorkOrderStatus = (typeof WORK_ORDER_STATUSES)[number];

export const WORK_ORDER_PRIORITIES = [
  'low',
  'medium',
  'high',
  'critical',
] as const;

export type WorkOrderPriority = (typeof WORK_ORDER_PRIORITIES)[number];

const STATUS_TRANSITIONS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  open: ['in_progress', 'blocked', 'cancelled'],
  in_progress: ['blocked', 'done', 'cancelled', 'open'],
  blocked: ['in_progress', 'cancelled'],
  done: ['in_progress'],
  cancelled: ['open'],
};

export function canTransitionWorkOrderStatus(
  from: WorkOrderStatus,
  to: WorkOrderStatus
): boolean {
  if (from === to) return true;
  return STATUS_TRANSITIONS[from]?.includes(to) || false;
}

export function isWorkOrderTerminalStatus(status: WorkOrderStatus): boolean {
  return status === 'done' || status === 'cancelled';
}
