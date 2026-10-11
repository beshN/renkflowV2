import { performance } from '@/lib/ai/performance';

const t0 = '2026-10-01T08:00:00Z';
const after = (h: number) => new Date(Date.parse(t0) + h * 3_600_000).toISOString();
const row = (kind: string, status: string, extra: object = {}) => ({ kind, status, rejectReason: null, edited: false, createdAt: t0, decidedAt: status === 'pending' ? null : after(2), ...extra });

describe('assistant performance', () => {
  it('per kind: counts, acceptance, decision time, reasons, edits, minutes saved', () => {
    const p = performance([
      row('detector.late_order', 'approved', { decidedAt: after(1) }), row('detector.late_order', 'approved', { decidedAt: after(3), edited: true }),
      row('detector.late_order', 'rejected', { rejectReason: 'wrong', decidedAt: after(5) }), row('detector.late_order', 'expired'), row('detector.late_order', 'pending'),
      row('detector.stale_quote', 'rejected', { rejectReason: 'never' }),
    ], [], { 'detector.late_order': 'Geciken sipariş' });
    const late = p.perKind[0];
    expect(late).toMatchObject({ label: 'Geciken sipariş', filed: 5, approved: 2, rejected: 1, expired: 1, pending: 1, edited: 1, acceptance: 67, medianHoursToDecide: 3, minutesSaved: 20 });
    expect(late.rejectReasons).toEqual({ wrong: 1 });
    expect(p.totals).toMatchObject({ filed: 6, approved: 2, rejected: 2, acceptance: 50, delaysActedOn: 2 });
  });
  it('model usage: cost only when prices are known; no decisions → no rate', () => {
    const p = performance([row('detector.expiry', 'pending')], [
      { feature: 'assistant.chat', calls: 10, errors: 1, inputTokens: 1000, outputTokens: 500, costUsd: 0.02 },
      { feature: 'command.parse', calls: 4, errors: 0, inputTokens: 200, outputTokens: 80, costUsd: null },
    ], {});
    expect(p.perKind[0].acceptance).toBeNull();
    expect(p.model).toMatchObject({ calls: 14, errors: 1, tokens: 1780, costUsd: 0.02 });
    expect(performance([], [{ feature: 'x', calls: 1, errors: 0, inputTokens: 1, outputTokens: 1, costUsd: null }], {}).model.costUsd).toBeNull();
  });
});
