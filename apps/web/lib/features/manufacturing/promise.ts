import { buildSchedule, type Center, type Resource, type ScheduleInput } from './scheduler';

export type PromiseOperation = Pick<ScheduleInput,
  'id' | 'position' | 'workCenterCode' | 'machineId' | 'teamId' | 'assignedTo'
> & { plannedMinutes: number; setupMinutes?: number };
export type PromiseInput = {
  now: string;
  load: ScheduleInput[];
  centers: Center[];
  resources?: Resource[];
  operations: PromiseOperation[];
  /** ISO timestamp with explicit offset, e.g. 2026-11-02T08:00:00+03:00.
   * Convert date-only readiness at the caller to the factory shift start in
   * Europe/Istanbul; this function does not choose a time for YYYY-MM-DD. */
  materialReadyAt: string;
};
export type PromiseConstraint = { kind: 'material' } | { kind: 'workCenter'; workCenterCode: string };
export type PromiseResult = {
  earliestFinish: string | null;
  bindingConstraint: PromiseConstraint | null;
  explanation: string;
  missing: Array<{ operationId?: string; reason: string }>;
  ignoredLoad: Array<{ operationId: string; workOrderId: string; reason: string }>;
  optimistic: boolean;
  tasks: ReturnType<typeof buildSchedule>['tasks'];
};

/** Pure estimate in the scheduler's Europe/Istanbul calendar. Supply holidays as
 * full-day maintenance intervals on centers/resources. plannedMinutes is the
 * recipe's total run time (already quantity-scaled); setup is added once.
 * Existing load keeps its scheduler order; the candidate is placed last, while
 * unused parallel lanes and earlier free calendar slots remain available.
 */
export function promiseDate(input: PromiseInput): PromiseResult {
  const missing: PromiseResult['missing'] = [];
  const ignoredLoad: PromiseResult['ignoredLoad'] = [];
  const fail = (): PromiseResult => ({ earliestFinish: null, bindingConstraint: null,
    explanation: 'Eksikler giderilmeden termin hesaplanamaz.', missing, ignoredLoad, optimistic: ignoredLoad.length > 0, tasks: [] });
  for (const [value, reason] of [[input.now, 'Başlangıç tarihi geçersiz'],
    [input.materialReadyAt, 'Malzeme hazır tarihi gerekli veya geçersiz']] as const) {
    if (!Number.isFinite(Date.parse(value))) missing.push({ reason });
  }
  if (!input.operations.length) missing.push({ reason: 'Aday operasyon gerekli' });
  for (const op of [...input.load, ...input.operations]) {
    if (!input.centers.some(c => c.code === op.workCenterCode))
      missing.push({ operationId: op.id, reason: `İş merkezi tanımsız: ${op.workCenterCode}` });
    const minutes = 'plannedMinutes' in op ? op.plannedMinutes : op.minutes;
    if (!Number.isFinite(minutes) || minutes <= 0)
      missing.push({ operationId: op.id, reason: 'Operasyon süresi pozitif olmalı' });
    if (op.setupMinutes !== undefined && (!Number.isFinite(op.setupMinutes) || op.setupMinutes < 0))
      missing.push({ operationId: op.id, reason: 'Hazırlık süresi geçersiz' });
  }
  if (new Set(input.operations.map(o => o.id)).size !== input.operations.length)
    missing.push({ reason: 'Aday operasyon kodları benzersiz olmalı' });
  if (missing.length) return fail();
  try {
    const resources = input.resources ?? [];
    const existing = buildSchedule(input.load, input.centers, input.now, resources);
    // Exclude whole blocked routes, including any scheduled prefix: retaining
    // a prefix would reserve capacity for a job whose completion is unknown.
    const blockedOrders = new Map(existing.blocked.map(o => [o.workOrderId, o.blockedReason]));
    for (const op of input.load) {
      const reason = blockedOrders.get(op.workOrderId);
      if (reason) ignoredLoad.push({ operationId: op.id, workOrderId: op.workOrderId, reason });
    }
    // Replay the scheduler's existing group order ahead of the candidate without
    // changing scheduler.ts or letting candidate priority reorder current work.
    const order = [...new Set(existing.tasks.map(o => o.workOrderId))];
    const load = input.load.filter(o => !blockedOrders.has(o.workOrderId)).map(o => ({ ...o, id: `load:${o.id}`,
      workOrderId: `load:${String(order.indexOf(o.workOrderId)).padStart(10, '0')}`,
      running: true, priority: 'medium', dueAt: undefined }));
    const candidate = input.operations.map((o): ScheduleInput => ({ ...o,
      id: `candidate:${o.id}`, workOrderId: 'candidate', priority: 'low',
      minutes: o.plannedMinutes + (o.setupMinutes ?? 0), materialReady: false,
      materialReadyAt: input.materialReadyAt }));
    const schedule = (materialReadyAt: string) => buildSchedule([
      ...load, ...candidate.map(o => ({ ...o, materialReadyAt })),
    ], input.centers, input.now, resources);
    const result = schedule(input.materialReadyAt);
    if (result.blocked.length) {
      missing.push(...result.blocked.map(o => ({ operationId: o.id.replace(/^candidate:/, ''), reason: o.blockedReason })));
      return fail();
    }
    const tasks = result.tasks.filter(o => o.workOrderId === 'candidate')
      .map(o => ({ ...o, id: o.id.slice('candidate:'.length) }));
    const finish = (items: typeof tasks) => items.reduce((end, o) => Math.max(end, Date.parse(o.end)), -Infinity);
    const earliestFinish = new Date(finish(tasks)).toISOString();
    // A material date is binding only if relaxing it improves completion.
    const withoutMaterial = schedule(input.now).tasks.filter(o => o.workOrderId === 'candidate');
    const materialBinds = finish(withoutMaterial) < finish(tasks);
    const isolated = buildSchedule(candidate, input.centers, input.now, resources).tasks;
    // Attribute added load delay to the operation where it enters the route,
    // rather than to downstream operations that merely inherit the delay.
    let inheritedDelay = 0;
    const delays = tasks.map(task => {
      const baseline = isolated.find(t => t.id === `candidate:${task.id}`)!;
      const totalDelay = Date.parse(task.end) - Date.parse(baseline.end);
      const addedDelay = totalDelay - inheritedDelay;
      inheritedDelay = totalDelay;
      return { task, addedDelay };
    });
    const limiting = delays.sort((a, b) => b.addedDelay - a.addedDelay
      || Date.parse(b.task.end) - Date.parse(a.task.end))[0].task;
    const bindingConstraint: PromiseConstraint = materialBinds ? { kind: 'material' }
      : { kind: 'workCenter', workCenterCode: limiting.workCenterCode };
    return { earliestFinish, bindingConstraint, missing, ignoredLoad, optimistic: ignoredLoad.length > 0, tasks,
      explanation: `${ignoredLoad.length ? 'Bekleyen işler hariç, iyimser tahmin. ' : ''}${materialBinds ? 'Malzeme hazır tarihi' : `${limiting.workCenterCode} iş merkezi ve ortak kaynak takvimi`} termini belirliyor. Mevcut yük önce yerleştirildi; vardiya, iş günü ve duruşlar dikkate alındı. Tahmin insan onayı gerektirir.` };
  } catch (error) {
    missing.push({ reason: error instanceof Error ? error.message : 'Planlama girdileri geçersiz' });
    return fail();
  }
}
