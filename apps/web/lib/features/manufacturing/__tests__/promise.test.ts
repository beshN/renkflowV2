import { promiseDate, type PromiseInput } from '../promise';
const now = '2026-11-02T08:00:00+03:00';
const iso = (s: string) => new Date(s).toISOString();
const base = (): PromiseInput => ({ now, materialReadyAt: now, load: [],
  centers: [{ code: 'CUT', parallelCapacity: 1, shiftStart: '08:00', shiftEnd: '17:00', workDays: [1,2,3,4,5], maintenance: [] }],
  operations: [{ id: 'new', position: 0, workCenterCode: 'CUT', plannedMinutes: 60 }],
});
const load = () => ({ id: 'old', workOrderId: 'zzz', position: 0, workCenterCode: 'CUT', minutes: 120, priority: 'low', materialReady: true });
describe('promiseDate', () => {
  it('uses recipe minutes plus setup once and is deterministic', () => {
    const input = base(); input.operations[0].setupMinutes = 30;
    expect(promiseDate(input).earliestFinish).toBe(iso('2026-11-02T09:30:00+03:00'));
    expect(promiseDate(input)).toEqual(promiseDate(input));
  });
  it('spans shifts and skips weekends', () => {
    const input = base(); input.now = input.materialReadyAt = '2026-11-06T16:30:00+03:00';
    expect(promiseDate(input).earliestFinish).toBe(iso('2026-11-09T08:30:00+03:00'));
  });
  it('places the candidate after current load', () => {
    const input = base(); input.load = [load()];
    expect(promiseDate(input).earliestFinish).toBe(iso('2026-11-02T11:00:00+03:00'));
    expect(promiseDate(input).bindingConstraint).toEqual({ kind: 'workCenter', workCenterCode: 'CUT' });
  });
  it('uses unused parallel lanes', () => {
    const input = base(); input.load = [load()]; input.centers[0].parallelCapacity = 2;
    expect(promiseDate(input).earliestFinish).toBe(iso('2026-11-02T09:00:00+03:00'));
  });
  it('gates all operations on material', () => {
    const input = base(); input.materialReadyAt = '2026-11-03T10:00:00+03:00';
    input.operations.push({ id: 'next', position: 1, workCenterCode: 'CUT', plannedMinutes: 30 });
    const result = promiseDate(input);
    expect(result.earliestFinish).toBe(iso('2026-11-03T11:30:00+03:00'));
    expect(result.tasks.every(t => Date.parse(t.start) >= Date.parse(input.materialReadyAt))).toBe(true);
    expect(result.bindingConstraint).toEqual({ kind: 'material' });
  });
  it('reports capacity when material delay is absorbed by load', () => {
    const input = base(); input.load = [load()]; input.materialReadyAt = '2026-11-02T09:00:00+03:00';
    expect(promiseDate(input).bindingConstraint?.kind).toBe('workCenter');
  });
  it('skips maintenance and holidays represented by full-day downtime', () => {
    const input = base(); input.now = input.materialReadyAt = '2026-11-02T16:30:00+03:00';
    input.centers[0].maintenance = [
      { start: '2026-11-02T16:45:00+03:00', end: '2026-11-02T17:00:00+03:00' },
      { start: '2026-11-03T00:00:00+03:00', end: '2026-11-04T00:00:00+03:00' }];
    expect(promiseDate(input).earliestFinish).toBe(iso('2026-11-04T08:45:00+03:00'));
  });
  it('honors machine capacity and calendar', () => {
    const input = base(); input.resources = [{ ...input.centers[0], id: 'machine', kind: 'machine', shiftStart: '10:00' }];
    input.operations[0].machineId = 'machine'; input.load = [{ ...load(), machineId: 'machine' }];
    expect(promiseDate(input).earliestFinish).toBe(iso('2026-11-02T13:00:00+03:00'));
  });
  it('collects undefined centers and zero durations without a date', () => {
    const input = base(); input.operations[0].workCenterCode = 'UNKNOWN'; input.operations[0].plannedMinutes = 0;
    const result = promiseDate(input);
    expect(result.earliestFinish).toBeNull(); expect(result.bindingConstraint).toBeNull();
    expect(result.missing).toHaveLength(2); expect(result.missing.every(m => m.operationId === 'new')).toBe(true);
  });
  it.each([NaN, Infinity, -1])('rejects invalid minutes %s', plannedMinutes => {
    const input = base(); input.operations[0].plannedMinutes = plannedMinutes;
    expect(promiseDate(input).earliestFinish).toBeNull();
  });
  it('reports blocked load and missing resources', () => {
    const input = base(); input.load = [{ ...load(), materialReady: false }];
    expect(promiseDate(input).missing[0].operationId).toBe('old');
    input.load = []; input.centers[0].machineRequired = true;
    expect(promiseDate(input).earliestFinish).toBeNull();
  });
  it('attributes inherited delay to the upstream center', () => {
    const input = base(); input.load = [load()];
    input.centers.push({ ...input.centers[0], code: 'PACK' });
    input.operations.push({ id: 'pack', position: 1, workCenterCode: 'PACK', plannedMinutes: 30 });
    expect(promiseDate(input).bindingConstraint).toEqual({ kind: 'workCenter', workCenterCode: 'CUT' });
  });
  it('preserves existing group order including running work', () => {
    const input = base(); input.load = [
      { ...load(), id: 'later', workOrderId: 'a', materialReady: false, materialReadyAt: '2026-11-02T12:00:00+03:00' },
      { ...load(), id: 'running', workOrderId: 'b', running: true, minutes: 300 },
    ];
    expect(promiseDate(input).earliestFinish).toBe(iso('2026-11-02T16:00:00+03:00'));
  });
  it('does not mutate inputs', () => {
    const input = base(); input.load = [load()]; const before = JSON.stringify(input);
    promiseDate(input); expect(JSON.stringify(input)).toBe(before);
  });
});
