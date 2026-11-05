import {
  factoryDate,
  planWeek,
  projectStationWeek,
  type PlanOperation,
  type PlanTask,
} from "@/lib/features/manufacturing/station-weekly-plan";
// Explicitly synthetic fixtures.
const op: PlanOperation = {
  id: "op",
  workOrderId: "job",
  title: "Synthetic job",
  product: "Synthetic profil",
  quantity: "2.5",
  unit: "kg",
  center: "CUT",
  name: "Kesim",
  status: "ready",
  startedAt: null,
  completedAt: null,
};
const week = planWeek("2026-11-04");
const task = (start: string, end: string): PlanTask => ({
  id: "op",
  workOrderId: "job",
  workCenterCode: "CUT",
  segments: [{ start, end }],
});
const project = (ops: PlanOperation[], tasks: PlanTask[] = []) =>
  projectStationWeek(
    week,
    ops,
    [{ code: "CUT", name: "Kesim", parallelCapacity: 2, active: true }],
    tasks,
    Date.parse("2026-11-04T10:00:00+03:00"),
  );
it("uses Istanbul date and Monday week across UTC and year boundaries", () => {
  expect(factoryDate("2026-11-01T21:00:00Z")).toBe("2026-11-02");
  expect(week.days).toEqual([
    "2026-11-02",
    "2026-11-03",
    "2026-11-04",
    "2026-11-05",
    "2026-11-06",
    "2026-11-07",
    "2026-11-08",
  ]);
  expect(new Date(week.start).toISOString()).toBe("2026-11-01T21:00:00.000Z");
  expect(planWeek("2027-01-01").days[0]).toBe("2026-12-28");
});
it("empty week preserves stations and seven empty days", () => {
  expect(project([]).rows[0].days).toEqual(Array.from({ length: 7 }, () => []));
  expect(project([]).unscheduled).toEqual([]);
});
it("keeps unscheduled quantities and units without conversions or invented dates", () => {
  const result = project([
    op,
    { ...op, id: "metre", unit: "m" },
    { ...op, id: "piece", unit: "adet" },
  ]);
  expect(result.unscheduled.map((o) => [o.quantity, o.unit])).toEqual([
    ["2.5", "kg"],
    ["2.5", "m"],
    ["2.5", "adet"],
  ]);
  expect(result.rows[0].days.every((d) => !d.length)).toBe(true);
});
it("clips cross-week segments and excludes overnight gaps", () => {
  const t = task("2026-11-01T23:30:00+03:00", "2026-11-02T00:30:00+03:00");
  t.segments.push({
    start: "2026-11-08T23:45:00+03:00",
    end: "2026-11-09T00:30:00+03:00",
  });
  expect(
    project([op], [t]).rows[0].days.map((d) => d[0]?.plannedMinutes ?? null),
  ).toEqual([30, null, null, null, null, null, 15]);
});
it("uses exclusive day/week ends", () => {
  for (const t of [
    task("2026-11-09T00:00:00+03:00", "2026-11-09T01:00:00+03:00"),
    task("2026-11-01T23:00:00+03:00", "2026-11-02T00:00:00+03:00"),
  ])
    expect(project([op], [t]).rows[0].days.every((d) => !d.length)).toBe(true);
});
it("separates recorded running start from plan and never projects it into the future", () => {
  const result = project([
    { ...op, status: "running", startedAt: "2026-11-01T23:00:00+03:00" },
  ]);
  expect(result.rows[0].days.map((d) => d.length)).toEqual([
    1, 1, 1, 0, 0, 0, 0,
  ]);
  expect(result.rows[0].days[0][0]).toMatchObject({
    plannedMinutes: null,
    recordedRunning: true,
  });
  expect(result.unscheduled).toHaveLength(1);
});
it("rejects bad dates and mismatched or invalid snapshot tasks", () => {
  for (const date of ["2026-02-30", "invalid", "2026-1-1", "2016-10-01"])
    expect(() => planWeek(date)).toThrow();
  for (const t of [
    task("bad", "bad"),
    {
      ...task("2026-11-02T00:00:00Z", "2026-11-02T01:00:00Z"),
      workOrderId: "other",
    },
  ])
    expect(project([op], [t]).unscheduled).toHaveLength(1);
});
it("retains unknown stations with unknown capacity and unallocated multi-day quantities", () => {
  const result = projectStationWeek(
    week,
    [op],
    [],
    [task("2026-11-02T23:30:00+03:00", "2026-11-03T00:30:00+03:00")],
  );
  expect(result.rows[0].center.parallelCapacity).toBeNull();
  expect(
    result.rows[0].days.slice(0, 2).map((d) => d[0].operation.quantity),
  ).toEqual(["2.5", "2.5"]);
});
