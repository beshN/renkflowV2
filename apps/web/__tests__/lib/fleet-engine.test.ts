import {
  assignmentConflicts, checkPosition, costPerKm, currentDocuments, documentAlerts, documentLevel, fitZoom, formatPlate, fuelConsumption, haversineKm,
  monthlyCosts, normalizePlate, project, retentionCutoff, routeSummary, vehicleHealth, type Position,
} from '@/lib/features/fleet/engine';

const today = '2026-10-09';

describe('plates', () => {
  it('normalizes Turkish plates and refuses others', () => {
    expect(normalizePlate('34 abc 123')).toBe('34ABC123');
    expect(normalizePlate('06-a-1234')).toBe('06A1234');
    expect(normalizePlate('99 X 1')).toBeNull();
    expect(normalizePlate('ABC123')).toBeNull();
    expect(formatPlate('34ABC123')).toBe('34 ABC 123');
  });
});

describe('document warnings', () => {
  it('30 / 15 / 7 days and expired', () => {
    expect(documentLevel('2026-11-09', today)).toEqual({ level: 'ok', daysLeft: 31 });
    expect(documentLevel('2026-11-08', today)).toEqual({ level: 'd30', daysLeft: 30 });
    expect(documentLevel('2026-10-24', today)).toEqual({ level: 'd15', daysLeft: 15 });
    expect(documentLevel('2026-10-16', today)).toEqual({ level: 'd7', daysLeft: 7 });
    expect(documentLevel('2026-10-08', today)).toEqual({ level: 'expired', daysLeft: -1 });
    expect(documentLevel(null, today)).toEqual({ level: 'none', daysLeft: null });
  });
  it('only the latest document of a kind counts (a renewed policy does not warn)', () => {
    const docs = [{ kind: 'casco', expiresOn: '2026-09-01' }, { kind: 'casco', expiresOn: '2027-09-01' }, { kind: 'inspection', expiresOn: '2026-10-12' }];
    expect(currentDocuments(docs)).toHaveLength(2);
    expect(documentAlerts(docs, today).map((d) => [d.kind, d.level])).toEqual([['inspection', 'd7']]);
  });
});

describe('vehicle health', () => {
  const docs = [{ kind: 'inspection', expiresOn: '2027-01-01' }, { kind: 'traffic_insurance', expiresOn: '2027-01-01' }];
  it('good when documents and service are fine', () => {
    expect(vehicleHealth({ docs, odometerKm: 50_000, nextService: { dueOn: '2027-01-01', dueKm: 60_000 } }, today)).toEqual({ health: 'good', reasons: [] });
  });
  it('critical when a required document expired or service is overdue; attention when close or missing', () => {
    expect(vehicleHealth({ docs: [{ kind: 'inspection', expiresOn: '2026-10-01' }, docs[1]], odometerKm: null, nextService: null }, today).health).toBe('critical');
    expect(vehicleHealth({ docs, odometerKm: 60_500, nextService: { dueOn: null, dueKm: 60_000 } }, today)).toEqual({ health: 'critical', reasons: ["Bakım km'si geçti"] });
    expect(vehicleHealth({ docs, odometerKm: 59_500, nextService: { dueOn: '2026-10-20', dueKm: 60_000 } }, today)).toEqual({ health: 'attention', reasons: ['Bakıma 11 gün', 'Bakıma 500 km'] });
    expect(vehicleHealth({ docs: [docs[0]], odometerKm: null, nextService: null }, today).reasons).toEqual(['Trafik sigortası kaydı yok']);
  });
});

describe('costs', () => {
  const entries = [
    { on: '2026-09-03', amount: 2000, kind: 'fuel' as const }, { on: '2026-09-20', amount: 1500.5, kind: 'fuel' as const },
    { on: '2026-09-25', amount: 4000, kind: 'maintenance' as const }, { on: '2026-10-02', amount: 1800, kind: 'fuel' as const },
  ];
  it('groups by month', () => {
    expect(monthlyCosts(entries)).toEqual([{ month: '2026-09', fuel: 3500.5, maintenance: 4000 }, { month: '2026-10', fuel: 1800, maintenance: 0 }]);
  });
  it('cost per km over the odometer readings', () => {
    expect(costPerKm(entries, [50_000, 51_000, 52_000])).toBe(4.65);
    expect(costPerKm(entries, [50_000])).toBeNull();
  });
  it('consumption between full tanks', () => {
    expect(fuelConsumption([
      { on: '1', liters: 50, km: 10_000, fullTank: true }, { on: '2', liters: 20, km: 10_300, fullTank: false }, { on: '3', liters: 40, km: 10_600, fullTank: true },
    ])).toBe(10);
    expect(fuelConsumption([{ on: '1', liters: 50, km: 1, fullTank: true }])).toBeNull();
  });
});

describe('assignments', () => {
  it('flags one vehicle in two jobs at once', () => {
    expect(assignmentConflicts([
      { id: 'a', vehicleId: 'v', startsAt: '2026-10-10T08:00:00Z', endsAt: '2026-10-10T12:00:00Z', label: '' },
      { id: 'b', vehicleId: 'v', startsAt: '2026-10-10T11:00:00Z', endsAt: '2026-10-10T15:00:00Z', label: '' },
      { id: 'c', vehicleId: 'v', startsAt: '2026-10-10T15:00:00Z', endsAt: '2026-10-10T16:00:00Z', label: '' },
      { id: 'd', vehicleId: 'w', startsAt: '2026-10-10T08:00:00Z', endsAt: '2026-10-10T12:00:00Z', label: '' },
    ])).toEqual([{ a: 'a', b: 'b', vehicleId: 'v' }]);
  });
});

describe('telemetry', () => {
  const now = Date.parse('2026-10-09T12:00:00Z');
  it('checks each point', () => {
    expect(checkPosition({ t: '2026-10-09T11:59:00Z', lat: 41.0, lng: 29.0, speed: 40 }, now).ok).toBe(true);
    expect(checkPosition({ t: '2026-10-09T12:10:00Z', lat: 41, lng: 29 }, now)).toEqual({ ok: false, reason: 'gelecek zaman' });
    expect(checkPosition({ t: '2026-08-01T00:00:00Z', lat: 41, lng: 29 }, now)).toEqual({ ok: false, reason: 'çok eski' });
    expect(checkPosition({ t: '2026-10-09T11:00:00Z', lat: 0, lng: 0 }, now)).toEqual({ ok: false, reason: 'koordinat' });
    expect(checkPosition({ t: '2026-10-09T11:00:00Z', lat: 41, lng: 29, speed: 400 }, now)).toEqual({ ok: false, reason: 'hız' });
    expect(checkPosition({ t: 'x', lat: 41, lng: 29 }, now)).toEqual({ ok: false, reason: 'zaman' });
  });
  it('measures distance', () => {
    expect(Math.round(haversineKm({ lat: 41.0082, lng: 28.9784 }, { lat: 39.9334, lng: 32.8597 }))).toBe(349); // İstanbul–Ankara, great circle
  });
  const p = (at: string, lat: number, lng: number, ignition: boolean | null = true): Position => ({ at, lat, lng, speedKmh: null, heading: null, ignition, odometerKm: null });
  it('sums the route by Istanbul day, finds stops, skips impossible jumps', () => {
    const r = routeSummary([
      p('2026-10-08T20:50:00Z', 41.0, 29.0), p('2026-10-08T21:10:00Z', 41.09, 29.0), // crosses midnight in Istanbul (00:10 on the 9th)
      p('2026-10-09T06:00:00Z', 41.09, 29.0, false), p('2026-10-09T06:20:00Z', 41.09, 29.0005, false), // 20 min stop
      p('2026-10-09T06:30:00Z', 41.18, 29.0),
      p('2026-10-09T06:31:00Z', 45.0, 29.0), // impossible jump: not counted
    ]);
    expect(r.distanceKm).toBe(20.1); // 10 + 10 km legs and 40 m moved during the stop
    expect(r.dailyKm).toEqual([{ day: '2026-10-09', km: 20.1 }]);
    // Parked overnight at the same place, then 20 min with the ignition off: one stop of 550 min.
    expect(r.stops).toEqual([{ from: '2026-10-08T21:10:00Z', to: '2026-10-09T06:20:00Z', minutes: 550, lat: 41.09, lng: 29.0 }]);
  });
  it('retention cutoff; none for keep-forever', () => {
    expect(retentionCutoff(365, Date.parse('2026-10-09T00:00:00Z'))).toBe('2025-10-09T00:00:00.000Z');
    expect(retentionCutoff(null, Date.now())).toBeNull();
  });
});

describe('map tiles', () => {
  it('projects and fits', () => {
    expect(project(0, 0, 0)).toEqual({ x: 128, y: 128 });
    expect(fitZoom([{ lat: 41.0, lng: 29.0 }], 600, 400)).toBe(15);
    const z = fitZoom([{ lat: 41.0, lng: 28.9 }, { lat: 41.1, lng: 29.1 }], 600, 400);
    expect(z).toBeGreaterThanOrEqual(10);
    expect(z).toBeLessThanOrEqual(12);
  });
});
