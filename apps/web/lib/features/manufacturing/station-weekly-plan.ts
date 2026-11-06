/** Read-only projection of persisted schedules. Never runs or changes the scheduler. */
export const FACTORY_TIMEZONE = "Europe/Istanbul";
const DAY = 86_400_000;
const localDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: FACTORY_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
export function factoryDate(value: Date | string): string {
  return localDate.format(new Date(value));
}
export function planWeek(value = factoryDate(new Date())) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new Error("Geçerli bir tarih seçin");
  const date = Date.parse(`${value}T00:00:00+03:00`);
  if (!Number.isFinite(date) || factoryDate(new Date(date)) !== value)
    throw new Error("Geçerli bir tarih seçin");
  // The existing factory calendar uses Istanbul's UTC+3 (post-2016).
  if (value < "2017-01-01")
    throw new Error("Plan tarihi 2017 veya sonrası olmalı");
  const weekday = new Date(date + 3 * 3_600_000).getUTCDay();
  const start = date - ((weekday + 6) % 7) * DAY;
  return {
    start,
    end: start + 7 * DAY,
    days: Array.from({ length: 7 }, (_, i) =>
      factoryDate(new Date(start + i * DAY)),
    ),
    previous: factoryDate(new Date(start - 7 * DAY)),
    next: factoryDate(new Date(start + 7 * DAY)),
  };
}
export type PlanOperation = {
  id: string;
  workOrderId: string;
  title: string;
  product: string | null;
  quantity: string | null;
  unit: string | null;
  center: string;
  name: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
};
export type PlanTask = {
  id: string;
  workOrderId: string;
  workCenterCode: string;
  segments: Array<{ start: string; end: string }>;
};
export type PlanEntry = {
  operation: PlanOperation;
  plannedMinutes: number | null;
  recordedRunning: boolean;
};
export type PlanCenter = {
  code: string;
  name: string;
  parallelCapacity: number | null;
  active: boolean;
};
const timestamp = (value: string | null) => (value ? Date.parse(value) : NaN);
function validSegments(task: PlanTask | undefined) {
  if (!Array.isArray(task?.segments)) return [];
  return task.segments.filter(
    (s) =>
      s &&
      Number.isFinite(timestamp(s.start)) &&
      timestamp(s.end) > timestamp(s.start),
  );
}
export function projectStationWeek(
  week: ReturnType<typeof planWeek>,
  operations: PlanOperation[],
  centers: PlanCenter[],
  tasks: PlanTask[],
  now = Date.now(),
) {
  const rows = new Map(
    centers.map((center) => [
      center.code,
      { center, days: week.days.map(() => [] as PlanEntry[]) },
    ]),
  );
  const unscheduled: PlanOperation[] = [];
  for (const operation of operations) {
    // A JSON snapshot is not authority for job/product/quantity or tenancy. Hydrate only verified live rows.
    const segments = validSegments(
      tasks.find(
        (t) =>
          t.id === operation.id &&
          t.workOrderId === operation.workOrderId &&
          t.workCenterCode === operation.center,
      ),
    );
    if (!segments.length) unscheduled.push(operation);
    if (!rows.has(operation.center))
      rows.set(operation.center, {
        center: {
          code: operation.center,
          name: operation.center,
          parallelCapacity: null,
          active: false,
        },
        days: week.days.map(() => [] as PlanEntry[]),
      });
    for (let day = 0; day < 7; day++) {
      const from = week.start + day * DAY,
        until = from + DAY;
      const planned = segments.reduce(
        (sum, s) =>
          sum +
          Math.max(
            0,
            Math.min(timestamp(s.end), until) -
              Math.max(timestamp(s.start), from),
          ) /
            60_000,
        0,
      );
      const started = timestamp(operation.startedAt);
      const recordedRunning =
        operation.status === "running" &&
        Number.isFinite(started) &&
        started < until &&
        Math.min(timestamp(operation.completedAt) || now, now) > from;
      if (planned > 0 || recordedRunning) {
        const entries = rows.get(operation.center)!.days[day];
        entries.push({
          operation,
          plannedMinutes: planned > 0 ? planned : null,
          recordedRunning,
        });
      }
    }
  }
  return { rows: [...rows.values()], unscheduled };
}
