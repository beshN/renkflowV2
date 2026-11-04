/** Recorded history only. No scheduler, quantity conversion or inferred active time. */
export function medianActiveSeconds(values: unknown[]): { n: number; median: number | null } {
  const measured = values.filter((v): v is number | string =>
    (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '')) && Number.isFinite(Number(v)) && Number(v) >= 0,
  ).map(Number).sort((a, b) => a - b);
  const n = measured.length;
  return { n, median: n < 2 ? null : (measured[Math.floor((n - 1) / 2)] + measured[Math.floor(n / 2)]) / 2 };
}

export function deadlineCounts(rows: { completedAt: string; dueAt: string | null }[]) {
  let onTime = 0, late = 0;
  for (const row of rows) {
    if (!row.dueAt) continue;
    const completed = Date.parse(row.completedAt), due = Date.parse(row.dueAt);
    if (!Number.isFinite(completed) || !Number.isFinite(due)) continue;
    if (completed <= due) onTime++; else late++;
  }
  return { n: onTime + late, onTime, late };
}

/** Keep native units separate; never infer a missing unit or convert it. */
export function lossByUnit(rows: { unit: string | null; value: unknown }[]) {
  const groups = new Map<string, { unit: string; n: number; total: number }>();
  for (const row of rows) {
    if (!row.unit || !['number', 'string'].includes(typeof row.value) || String(row.value).trim() === '') continue;
    const value = Number(row.value);
    if (!Number.isFinite(value) || value < 0) continue;
    const group = groups.get(row.unit) || { unit: row.unit, n: 0, total: 0 };
    group.n++; group.total += value; groups.set(row.unit, group);
  }
  return [...groups.values()].sort((a, b) => a.unit.localeCompare(b.unit));
}

/** Inclusive calendar dates in the factory's existing Europe/Istanbul (+03:00) convention. */
export function historyRange(start: string, end: string) {
  const valid = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
  if (!valid(start) || !valid(end) || start > end) throw new Error('Geçerli başlangıç ve bitiş tarihi seçin.');
  const from = new Date(start + 'T00:00:00+03:00');
  const until = new Date(Date.parse(end + 'T00:00:00+03:00') + 86400000);
  return { start, end, from: from.toISOString(), until: until.toISOString() };
}
