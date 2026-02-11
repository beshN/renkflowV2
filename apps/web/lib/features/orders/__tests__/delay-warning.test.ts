import { estimateDelayWarning } from '../delay-warning';

describe('delay warning heuristics', () => {
  it('returns on_track for delivered or missing delivery date', () => {
    const delivered = estimateDelayWarning({
      id: '1',
      orderNumber: 'ORD-1',
      customerName: 'Acme',
      status: 'delivered',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      deliveryDate: new Date('2026-01-10T00:00:00.000Z'),
    });
    expect(delivered.riskLevel).toBe('on_track');
    expect(delivered.predictedDelayDays).toBe(0);

    const missingPlan = estimateDelayWarning({
      id: '2',
      orderNumber: 'ORD-2',
      customerName: 'Acme',
      status: 'pending',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      deliveryDate: null,
    });
    expect(missingPlan.riskLevel).toBe('on_track');
  });

  it('flags delayed orders when progress is behind plan', () => {
    const warning = estimateDelayWarning({
      id: '3',
      orderNumber: 'ORD-3',
      customerName: 'Acme',
      status: 'pending',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 9),
      deliveryDate: new Date(Date.now() + 1000 * 60 * 60 * 24),
    });

    expect(['at_risk', 'delayed']).toContain(warning.riskLevel);
    expect(warning.predictedDelayDays).toBeGreaterThanOrEqual(0);
  });
});
