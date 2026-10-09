/** Production depth rules as pure functions: reason catalogues, Pareto, daily capacity, plan history. */

export const REASON_KINDS = ['scrap', 'rework', 'delay'] as const;
export type ReasonKind = (typeof REASON_KINDS)[number];
export type ReasonCode = { code: string; label: string; active: boolean };

/** What every firm starts with; the firm renames, adds or switches off its own. */
export const DEFAULT_REASONS: Record<ReasonKind, Array<{ code: string; label: string }>> = {
  scrap: [
    { code: 'cut_error', label: 'Yanlış kesim' },
    { code: 'measurement', label: 'Ölçü hatası' },
    { code: 'material_defect', label: 'Malzeme kusuru' },
    { code: 'paint_damage', label: 'Boya hasarı' },
    { code: 'handling', label: 'Taşıma / düşme' },
    { code: 'other', label: 'Diğer' },
  ],
  // The rework codes production commands already use.
  rework: [
    { code: 'measurement', label: 'Ölçü' },
    { code: 'material', label: 'Malzeme' },
    { code: 'assembly', label: 'Montaj' },
    { code: 'quality', label: 'Kalite' },
    { code: 'other', label: 'Diğer' },
  ],
  delay: [
    { code: 'material', label: 'Malzeme bekleniyor' },
    { code: 'paint', label: 'Boyahane' },
    { code: 'machine', label: 'Makine arızası' },
    { code: 'manpower', label: 'Personel' },
    { code: 'customer', label: 'Müşteri kaynaklı' },
    { code: 'planning', label: 'Planlama' },
    { code: 'other', label: 'Diğer' },
  ],
};

/** A code the firm writes itself: lower case, digits and underscore, from a label if needed. */
export function reasonCodeFrom(label: string) {
  const map: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' };
  return label.toLocaleLowerCase('tr').replace(/[çğıöşü]/g, (c) => map[c]).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'kod';
}

/** Pareto: the reasons that cause most, with their running share (the "vital few" reach 80 %). */
export function pareto(rows: Array<{ code: string; label: string; count: number; quantity?: number }>, by: 'count' | 'quantity' = 'count') {
  const value = (r: (typeof rows)[number]) => (by === 'count' ? r.count : r.quantity ?? 0);
  const total = rows.reduce((s, r) => s + value(r), 0);
  let running = 0;
  return [...rows].sort((a, b) => value(b) - value(a) || a.label.localeCompare(b.label, 'tr')).map((r) => {
    const before = running;
    running += value(r);
    return { ...r, value: value(r), share: total ? Math.round((value(r) / total) * 1000) / 10 : 0, cumulative: total ? Math.round((running / total) * 1000) / 10 : 0, vital: total > 0 && before / total < 0.8 };
  });
}

// Capacity ----------------------------------------------------------------------------------------

export type CenterCalendar = { code: string; name?: string; parallelCapacity: number; shiftStart: string; shiftEnd: string; workDays: number[] };
export type ScheduledTask = { workCenterCode: string; segments: Array<{ start: string; end: string }>; late?: boolean; workOrderId?: string };

const clock = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
};
const ISTANBUL_OFFSET_MIN = 180;
/** The Istanbul calendar day of an instant (Turkey keeps UTC+3 all year). */
export const istanbulDay = (iso: string) => new Date(Date.parse(iso) + ISTANBUL_OFFSET_MIN * 60_000).toISOString().slice(0, 10);
const nextDay = (day: string, n = 1) => new Date(Date.parse(day + 'T00:00:00Z') + n * 86_400_000).toISOString().slice(0, 10);

/**
 * Per work centre and day: minutes the schedule books against minutes the centre has (shift × parallel
 * places on working days). Over 100 % cannot happen in a finite schedule, so a full day reads 100 %;
 * the late jobs are what overload looks like.
 */
export function dailyCapacity(tasks: ScheduledTask[], centers: CenterCalendar[], fromDay: string, days = 7) {
  const range = Array.from({ length: days }, (_, i) => nextDay(fromDay, i));
  return centers.map((c) => {
    const perDay = range.map((day) => {
      const weekday = new Date(day + 'T12:00:00Z').getUTCDay();
      const available = c.workDays.includes(weekday) ? Math.max(0, clock(c.shiftEnd) - clock(c.shiftStart)) * c.parallelCapacity : 0;
      let booked = 0;
      for (const t of tasks) {
        if (t.workCenterCode !== c.code) continue;
        for (const s of t.segments) {
          const dayStart = Date.parse(day + 'T00:00:00Z') - ISTANBUL_OFFSET_MIN * 60_000;
          const from = Math.max(Date.parse(s.start), dayStart);
          const to = Math.min(Date.parse(s.end), dayStart + 86_400_000);
          if (to > from) booked += (to - from) / 60_000;
        }
      }
      booked = Math.round(booked);
      return { day, available, booked, load: available ? Math.min(100, Math.round((booked / available) * 100)) : booked > 0 ? 100 : 0 };
    });
    const late = new Set(tasks.filter((t) => t.workCenterCode === c.code && t.late).map((t) => t.workOrderId ?? '')).size;
    return { code: c.code, name: c.name ?? c.code, days: perDay, lateJobs: late };
  });
}

// Cutting plan history ----------------------------------------------------------------------------

export type PlanRow = { id: string; status: string; version: number; createdAt: string; result: { wastePercent?: number; newBars?: number; inputMm?: number; bars?: unknown[]; unfulfilled?: unknown[]; algorithm?: string } | null };

/**
 * The plans made for the same jobs, oldest first, each with its waste and bar count and the change
 * from the plan before it, so a re-plan shows whether it got better.
 */
export function planHistory(plans: PlanRow[]) {
  const sorted = [...plans].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  return sorted.map((p, i) => {
    const waste = Math.round((p.result?.wastePercent ?? 0) * 10) / 10;
    const bars = p.result?.bars?.length ?? 0;
    const prev = i ? sorted[i - 1] : null;
    const prevWaste = prev ? Math.round((prev.result?.wastePercent ?? 0) * 10) / 10 : null;
    return {
      id: p.id, n: i + 1, status: p.status, version: p.version, createdAt: p.createdAt, algorithm: p.result?.algorithm ?? null,
      wastePercent: waste, bars, newBars: p.result?.newBars ?? 0, missing: p.result?.unfulfilled?.length ?? 0,
      wasteDelta: prevWaste == null ? null : Math.round((waste - prevWaste) * 10) / 10,
    };
  });
}

/** Whether a configured job can take a recalculated bill of materials: nothing cut, started or planned yet. */
export function bomRecalcBlocker(job: { status: string; cutPlanId: string | null; producedQty: number; startedOperations: number }) {
  if (job.status === 'done' || job.status === 'cancelled') return 'İş emri kapanmış';
  if (job.cutPlanId) return 'Kesim planına alınmış; planı iptal edip yeniden planlayın ya da rework açın';
  if (job.producedQty > 0 || job.startedOperations > 0) return 'Üretim başlamış; rework açın';
  return null;
}
