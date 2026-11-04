import { deadlineCounts, historyRange, lossByUnit, medianActiveSeconds } from '@/lib/features/manufacturing/production-history';

describe('production history — synthetic fixtures', () => {
  test('empty records do not fabricate measurements', () => {
    expect(medianActiveSeconds([])).toEqual({ n: 0, median: null });
    expect(deadlineCounts([])).toEqual({ n: 0, onTime: 0, late: 0 });
    expect(lossByUnit([])).toEqual([]);
  });
  test('one sample is explicitly insufficient for median', () => {
    expect(medianActiveSeconds([12])).toEqual({ n: 1, median: null });
    expect(lossByUnit([{ unit: 'mm', value: 0 }])).toEqual([{ unit: 'mm', n: 1, total: 0 }]);
  });
  test('median ignores missing and invalid durations, retains measured zero', () => {
    expect(medianActiveSeconds([null, '', -1, Infinity, 'bad', 0, '10', 20, 30])).toEqual({ n: 4, median: 15 });
    expect(medianActiveSeconds([10, 0, 20])).toEqual({ n: 3, median: 10 });
  });
  test('mixed units stay separate and missing units are never inferred', () => {
    expect(lossByUnit([{ unit: 'm', value: 2 }, { unit: 'kg', value: 3 }, { unit: 'adet', value: 4 }, { unit: 'mm', value: 1000 }, { unit: 'm', value: 1 }, { unit: null, value: 9 }])).toEqual([
      { unit: 'adet', n: 1, total: 4 }, { unit: 'kg', n: 1, total: 3 }, { unit: 'm', n: 2, total: 3 }, { unit: 'mm', n: 1, total: 1000 },
    ]);
  });
  test('deadlines include equality, exclude unknown dates', () => {
    expect(deadlineCounts([{ completedAt: '2026-01-01T12:00:00Z', dueAt: '2026-01-01T12:00:00Z' }, { completedAt: '2026-01-02', dueAt: '2026-01-01' }, { completedAt: '2026-01-01', dueAt: null }])).toEqual({ n: 2, onTime: 1, late: 1 });
  });
  test('date range is strict and uses half-open Istanbul boundaries', () => {
    expect(historyRange('2026-01-01', '2026-01-01')).toMatchObject({ from: '2025-12-31T21:00:00.000Z', until: '2026-01-01T21:00:00.000Z' });
    for (const [a, b] of [['2026-02-30', '2026-03-01'], ['2026-02-02', '2026-02-01'], ['bad', 'bad']]) expect(() => historyRange(a, b)).toThrow();
  });
});
