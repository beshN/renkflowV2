import {
  cleanMeasures, conversionReport, installationConflicts, leadStageProblem, mapLink, measureDiff, measureFields, measureProblems,
  minuteOf, serviceReport, ticketStatusProblem, warrantyStatus,
} from '@/lib/features/field/engine';

describe('lead pipeline', () => {
  it('moves along the pipeline; losing needs a reason; won is final; lost can reopen', () => {
    expect(leadStageProblem('new', 'survey')).toBeNull();
    expect(leadStageProblem('quoted', 'won')).toBeNull();
    expect(leadStageProblem('new', 'won')).toMatch(/geçilemez/);
    expect(leadStageProblem('negotiation', 'lost')).toMatch(/Kayıp nedeni/);
    expect(leadStageProblem('negotiation', 'lost', 'price')).toBeNull();
    expect(leadStageProblem('won', 'lost', 'price')).toMatch(/geçilemez/);
    expect(leadStageProblem('lost', 'new')).toBeNull();
  });

  it('conversion = won / closed per source, open apart, days to win', () => {
    const r = conversionReport([
      { source: 'web', stage: 'won', createdAt: '2026-09-01T10:00:00Z', closedAt: '2026-09-11T10:00:00Z' },
      { source: 'web', stage: 'lost', createdAt: '2026-09-02T10:00:00Z', closedAt: '2026-09-05T10:00:00Z' },
      { source: 'web', stage: 'quoted', createdAt: '2026-09-03T10:00:00Z', closedAt: null },
      { source: 'referral', stage: 'won', createdAt: '2026-09-04T10:00:00Z', closedAt: '2026-09-08T10:00:00Z' },
      { source: 'referral', stage: 'won', createdAt: '2026-08-01T10:00:00Z', closedAt: '2026-08-02T10:00:00Z' },
    ], '2026-09-01', '2026-10-01');
    expect(r.overall).toEqual({ total: 4, open: 1, won: 2, lost: 1, conversionPct: 67, avgDaysToWin: 7 });
    expect(r.bySource.find((s) => s.source === 'web')).toMatchObject({ won: 1, lost: 1, conversionPct: 50 });
    expect(r.bySource.find((s) => s.source === 'referral')).toMatchObject({ total: 1, conversionPct: 100, avgDaysToWin: 4 });
    expect(r.funnel.find((f) => f.stage === 'quoted')?.count).toBe(1);
    expect(conversionReport([]).overall.conversionPct).toBeNull();
  });
});

describe('survey measures', () => {
  it('a family asks for its own dimensions and site facts; others for width and height', () => {
    expect(measureFields('pergola').map((f) => f.key)).toEqual(expect.arrayContaining(['widthMm', 'projectionMm', 'mountingHeightMm', 'postCount', 'motorSide']));
    expect(measureFields(null).map((f) => f.key)).toEqual(['widthMm', 'heightMm']);
  });
  it('requires the dimensions, positive and plausible numbers, and known choices', () => {
    expect(measureProblems('pergola', { widthMm: 4000, projectionMm: 3000 })).toEqual(['Yükseklik (mm) girilmeli']);
    expect(measureProblems('pergola', { widthMm: -1, projectionMm: 40_000, mountingHeightMm: 2500, motorSide: 'Üst' })).toEqual([
      'En (mm) sıfırdan büyük bir sayı olmalı', 'Açılım (mm) 30 metreyi aşamaz', 'Motor yönü için geçersiz seçim',
    ]);
    expect(cleanMeasures('pergola', { widthMm: '4000', power: 'true', hack: 1, drainage: '  sol köşe ' } as any)).toEqual({ widthMm: 4000, power: true, drainage: 'sol köşe' });
  });
  it('shows what changed after the quote', () => {
    expect(measureDiff('pergola', { widthMm: 4000, projectionMm: 3000 }, { widthMm: 4200, projectionMm: 3000, postCount: 2 })).toEqual([
      { key: 'widthMm', label: 'En (mm)', before: 4000, after: 4200 },
      { key: 'postCount', label: 'Ayak sayısı', before: null, after: 2 },
    ]);
  });
});

describe('installation planning', () => {
  const base = { status: 'planned' as const, label: 'x', durationMinutes: 240 };
  it('flags the same person in two overlapping jobs on one day only', () => {
    const c = installationConflicts([
      { ...base, id: 'a', date: '2026-10-10', startMinute: 540, crew: ['ali', 'veli'] },
      { ...base, id: 'b', date: '2026-10-10', startMinute: 660, crew: ['veli'] },
      { ...base, id: 'c', date: '2026-10-10', startMinute: 780, crew: ['ali'] }, // starts when a ends
      { ...base, id: 'd', date: '2026-10-11', startMinute: 540, crew: ['ali'] },
      { ...base, id: 'e', date: '2026-10-10', startMinute: 540, crew: ['ali'], status: 'cancelled' },
    ]);
    expect(c).toEqual([{ a: 'a', b: 'b', people: ['veli'], date: '2026-10-10' }]);
  });
  it('reads clock times', () => {
    expect([minuteOf('09:30'), minuteOf('24:00'), minuteOf(null)]).toEqual([570, null, null]);
  });
});

describe('warranty and service', () => {
  it('warranty runs months from the delivery day; month ends fall back', () => {
    expect(warrantyStatus('2025-10-09', 24, '2026-10-09')).toEqual({ covered: true, endsOn: '2027-10-09', daysLeft: 365, reason: null });
    expect(warrantyStatus('2024-01-31', 1, '2024-03-01')).toMatchObject({ endsOn: '2024-02-29', covered: false, reason: 'Garanti süresi doldu' });
    expect(warrantyStatus(null, 24, '2026-10-09')).toMatchObject({ covered: false, reason: 'Teslim tarihi yok' });
  });
  it('resolving needs a written resolution; closed is final', () => {
    expect(ticketStatusProblem('open', 'resolved')).toMatch(/Çözümü/);
    expect(ticketStatusProblem('in_progress', 'resolved', 'Motor değişti')).toBeNull();
    expect(ticketStatusProblem('closed', 'open')).toMatch(/geçilemez/);
  });
  it('reports resolution time and recurring issues', () => {
    const r = serviceReport([
      { id: '1', orderId: 'o1', category: 'leak', family: 'pergola', openedAt: '2026-10-01T08:00:00Z', resolvedAt: '2026-10-01T20:00:00Z' },
      { id: '2', orderId: 'o1', category: 'leak', family: 'pergola', openedAt: '2026-10-03T08:00:00Z', resolvedAt: '2026-10-04T08:00:00Z' },
      { id: '3', orderId: 'o2', category: 'motor', family: 'pergola', openedAt: '2026-10-05T08:00:00Z', resolvedAt: null },
    ]);
    expect([r.total, r.open, r.avgResolutionHours, r.maxResolutionHours]).toEqual([3, 1, 18, 24]);
    expect(r.recurring.byCategory).toEqual([{ category: 'leak', family: 'pergola', count: 2 }]);
    expect(r.recurring.byOrder).toEqual([{ orderId: 'o1', count: 2 }]);
  });
  it('map links point to OpenStreetMap search', () => {
    expect(mapLink('Bağdat Cad. 10, Kadıköy')).toBe('https://www.openstreetmap.org/search?query=Ba%C4%9Fdat%20Cad.%2010%2C%20Kad%C4%B1k%C3%B6y');
    expect(mapLink('  ')).toBeNull();
  });
});
