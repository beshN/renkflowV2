import { compareQueue, detectorSettings, isThinned, resolvedKeys, suppression, type DetectorHistory } from '@/lib/ai/detectors/engine';

const now = Date.parse('2026-10-09T12:00:00Z');
const day = (n: number) => new Date(now - n * 86_400_000).toISOString();
const base: DetectorHistory = { pending: new Set(), rejected: [], approved: 0, decided: 0 };
const on = { enabled: true, quietDays: 7 };

describe('suppression', () => {
  it('files a new finding', () => {
    expect(suppression({ dedupeKey: 'a', priority: 'medium' }, base, on, now)).toEqual({ file: true });
  });
  it('never the same open situation twice', () => {
    expect(suppression({ dedupeKey: 'a', priority: 'high' }, { ...base, pending: new Set(['a']) }, on, now)).toEqual({ file: false, reason: 'open' });
  });
  it('stays quiet N days after a rejection, then may file again', () => {
    const h = { ...base, rejected: [{ dedupeKey: 'a', decidedAt: day(3), reason: 'not_relevant' }] };
    expect(suppression({ dedupeKey: 'a', priority: 'high' }, h, on, now)).toEqual({ file: false, reason: 'quiet' });
    expect(suppression({ dedupeKey: 'a', priority: 'high' }, h, { ...on, quietDays: 2 }, now)).toEqual({ file: true });
    expect(suppression({ dedupeKey: 'b', priority: 'high' }, h, on, now)).toEqual({ file: true });
  });
  it('"bir daha önerme" is forever for that situation', () => {
    const h = { ...base, rejected: [{ dedupeKey: 'a', decidedAt: day(400), reason: 'never' }] };
    expect(suppression({ dedupeKey: 'a', priority: 'high' }, h, on, now)).toEqual({ file: false, reason: 'never' });
  });
  it('a disabled detector files nothing', () => {
    expect(suppression({ dedupeKey: 'a', priority: 'high' }, base, { ...on, enabled: false }, now)).toEqual({ file: false, reason: 'disabled' });
  });
  it('a detector people keep rejecting files only urgent findings, with longer quiet', () => {
    const h = { ...base, approved: 1, decided: 10 };
    expect(isThinned(h)).toBe(true);
    expect(suppression({ dedupeKey: 'a', priority: 'medium' }, h, on, now)).toEqual({ file: false, reason: 'thinned' });
    expect(suppression({ dedupeKey: 'a', priority: 'high' }, h, on, now)).toEqual({ file: true });
    const r = { ...h, rejected: [{ dedupeKey: 'a', decidedAt: day(10), reason: null }] };
    expect(suppression({ dedupeKey: 'a', priority: 'high' }, r, on, now)).toEqual({ file: false, reason: 'quiet' });
    expect(isThinned({ approved: 0, decided: 7 })).toBe(false);
  });
});

describe('settings and queue', () => {
  it('saved values over defaults, clamped', () => {
    expect(detectorSettings({ enabled: true, quietDays: 7, threshold: 3 }, { quietDays: 14 })).toEqual({ enabled: true, quietDays: 14, threshold: 3 });
    expect(detectorSettings({ enabled: true, quietDays: 7 }, { enabled: false, quietDays: -3 })).toEqual({ enabled: false, quietDays: 7 });
    expect(detectorSettings({ enabled: true, quietDays: 7 }, { quietDays: 9999 }).quietDays).toBe(365);
    expect(detectorSettings({ enabled: true, quietDays: 7 }, null)).toEqual({ enabled: true, quietDays: 7 });
  });
  it('orders by priority then newest; resolved situations are found', () => {
    const list = [{ priority: 'low' as const, createdAt: day(0) }, { priority: 'high' as const, createdAt: day(2) }, { priority: 'high' as const, createdAt: day(1) }];
    expect(list.sort(compareQueue).map((x) => x.createdAt)).toEqual([day(1), day(2), day(0)]);
    expect(resolvedKeys(new Set(['a', 'b']), [{ dedupeKey: 'b' }])).toEqual(['a']);
  });
});
