import { suppression } from '@/lib/ai/detectors/engine';
import {
  detectCapacity, detectExpiries, detectLateOrders, detectOffcuts, detectOverdue, detectScrapAnomalies, detectShortages, detectStaleQuotes, pickSupplier,
  type OrderRow, type ShortageRow,
} from '@/lib/ai/detectors/rules';

const today = '2026-10-09';
const on = { enabled: true, quietDays: 7 };
const history = { pending: new Set<string>(), rejected: [] as Array<{ dedupeKey: string; decidedAt: string; reason: string | null }>, approved: 0, decided: 0 };
const order = (o: Partial<OrderRow>): OrderRow => ({ id: 'o1', number: 'ORD-1', customer: 'Ayşe Demir', tone: 'formal', firm: 'Firma', dueOn: '2026-10-11', promised: null, step: 3, lastMoveOn: '2026-10-08', missingMaterials: 0, materialLeadDays: null, openDelay: null, ...o });

describe('1 · late order', () => {
  it('flags a job that has stalled two days before its due date, with a new date and a message', () => {
    const [f] = detectLateOrders([order({ lastMoveOn: '2026-10-06' })], today, on);
    expect(f.title).toBe('ORD-1 termine yetişmeyebilir');
    expect(f.evidence.badges.map((b) => b.label)).toEqual(['2 gün kaldı', '3 gündür aynı aşamada']);
    expect(f.payload.newPromiseDate > '2026-10-11').toBe(true);
    expect(f.draft?.text).toContain('ORD-1');
  });
  it('late orders are high priority; material lead time pushes the new date', () => {
    const [f] = detectLateOrders([order({ dueOn: '2026-10-05', missingMaterials: 2, materialLeadDays: 10 })], today, on);
    expect(f.priority).toBe('high');
    expect(f.payload.newPromiseDate).toBe('2026-10-21');
    expect(f.payload.reason).toBe('malzeme tedariki');
  });
  it('quiet when on track (moving, far away, nothing missing) or without a date', () => {
    expect(detectLateOrders([order({ dueOn: '2026-10-30' }), order({ dueOn: null })], today, on)).toEqual([]);
    expect(detectLateOrders([order({ step: 5, dueOn: '2026-10-11' })], today, on)).toEqual([]);
  });
  it('one situation per order: open → not again; after an approval (new date) quiet for the quiet days', () => {
    const [f] = detectLateOrders([order({ lastMoveOn: '2026-10-01' })], today, on);
    expect(suppression(f, { ...history, pending: new Set([f.dedupeKey]) }, on, Date.now())).toEqual({ file: false, reason: 'open' });
    const [g] = detectLateOrders([order({ lastMoveOn: '2026-10-01', dueOn: '2026-10-10' })], today, on);
    expect(g.dedupeKey).toBe(f.dedupeKey);
    expect(suppression(g, { ...history, approvedKeys: [{ dedupeKey: f.dedupeKey, decidedAt: new Date().toISOString() }] }, on, Date.now())).toEqual({ file: false, reason: 'quiet' });
  });
});

describe('2 · shortage', () => {
  const row = (o: Partial<ShortageRow>): ShortageRow => ({ itemId: 'i1', name: 'Profil 7016', uom: 'm', demand: 120, free: 40, incoming: 20, orderMultiple: 6.5, jobs: [{ id: 'w1', label: 'İE-1', dueOn: '2026-10-14' }], suppliers: [], lengthMm: 6500, color: '7016', ...o });
  it('metre profiles are ordered in whole bars; without a bar length no supplier order is proposed', () => {
    const sup = [{ supplierId: 's1', name: 'A', unitPrice: 100, currency: 'TRY', score: null, leadDays: null }];
    const [f] = detectShortages([row({ suppliers: sup })], today);
    expect([f.payload.quantity, f.evidence.numbers.birim]).toEqual([10, 'çubuk']);
    const [g] = detectShortages([row({ suppliers: sup, lengthMm: null })], today);
    expect([g.payload.supplierId, g.confidence]).toEqual([null, 'low']);
  });
  it('missing = demand − free − incoming, rounded up to the order multiple, best supplier picked', () => {
    const [f] = detectShortages([row({ uom: 'adet', suppliers: [
      { supplierId: 's1', name: 'A', unitPrice: 100, currency: 'TRY', score: 70, leadDays: 5 },
      { supplierId: 's2', name: 'B', unitPrice: 90, currency: 'TRY', score: 85, leadDays: 9 },
    ] })], today);
    expect(f.evidence.numbers.eksik).toBe(60);
    expect(f.payload.quantity).toBe(65);
    expect(f.payload.supplierId).toBe('s2');
    expect(f.priority).toBe('high');
  });
  it('nothing when covered; low confidence without supplier history', () => {
    expect(detectShortages([row({ incoming: 80 })], today)).toEqual([]);
    expect(detectShortages([row({})], today)[0].confidence).toBe('low');
    expect(pickSupplier([{ supplierId: 'a', name: 'a', unitPrice: 5, currency: 'TRY', score: null, leadDays: 2 }, { supplierId: 'b', name: 'b', unitPrice: 4, currency: 'TRY', score: null, leadDays: 9 }])?.supplierId).toBe('b');
  });
});

describe('3 · stale quote', () => {
  const q = { id: 'q1', number: 'TKL-1', customer: 'Ali', tone: 'warm' as const, firm: null, sentOn: '2026-10-05', validUntil: '2026-10-20', total: 48000, currency: 'TRY' };
  it('first follow-up at 3 days, second at 7; each step is its own situation', () => {
    const [a] = detectStaleQuotes([q], today, on);
    expect([a.payload.step, a.dedupeKey]).toEqual([1, 'quote:q1:1']);
    const [b] = detectStaleQuotes([{ ...q, sentOn: '2026-10-01' }], today, on);
    expect([b.payload.step, b.priority]).toEqual([2, 'high']);
    expect(b.evidence.badges[0].label).toBe('8 gün cevapsız');
  });
  it('not before 3 days, not after it expired; the threshold is the firm\'s', () => {
    expect(detectStaleQuotes([{ ...q, sentOn: '2026-10-08' }, { ...q, validUntil: '2026-10-08' }], today, on)).toEqual([]);
    expect(detectStaleQuotes([{ ...q, sentOn: '2026-10-08' }], today, { ...on, threshold: 1 })).toHaveLength(1);
  });
});

describe('4 · overdue receivable', () => {
  const r = { invoiceId: 'f1', number: 'FTR-000001', orderId: 'o1', orderNumber: 'ORD-1', customer: 'Demir Yapı', tone: 'formal' as const, firm: 'X', dueOn: '2026-10-01', openAmount: 4000, currency: 'TRY' };
  it('a gentle reminder after the due date, a second one after 15 days', () => {
    expect(detectOverdue([r], today, on)[0].payload.step).toBe(1);
    const [b] = detectOverdue([{ ...r, dueOn: '2026-08-01' }], today, on);
    expect([b.payload.step, b.priority]).toEqual([2, 'high']);
    expect(b.draft?.text).toContain('4.000,00 TL');
  });
  it('nothing before or on the due date, or when paid', () => {
    expect(detectOverdue([{ ...r, dueOn: today }, { ...r, openAmount: 0 }], today, on)).toEqual([]);
  });
});

describe('5 · scrap anomaly', () => {
  const s = { dimension: 'color' as const, key: '7016', label: 'RAL 7016', recent: 8, baseline: [2, 3, 1], topReason: 'Kesim hatası', sampleWorkOrderId: 'w1', sampleLabel: 'İE-1' };
  it('twice the usual and at least 3 events → review, with the top reason', () => {
    const [f] = detectScrapAnomalies([s], on);
    expect(f.title).toBe('Fire artışı: RAL 7016 (renk)');
    expect(f.evidence.numbers.kat).toBe(4);
    expect(f.priority).toBe('high');
  });
  it('normal levels and tiny counts are quiet', () => {
    expect(detectScrapAnomalies([{ ...s, recent: 4, baseline: [3, 3, 3] }, { ...s, recent: 2, baseline: [0, 0, 0] }], on)).toEqual([]);
  });
});

describe('6 · capacity', () => {
  const job = (o: object) => ({ workOrderId: 'w1', label: 'İE-1', center: 'KESİM', dueAt: '2026-10-10T20:59:59Z', finishAt: '2026-10-12T12:00:00Z', priority: 'medium' as const, late: true, ...o });
  it('names the job that can give way (same station, slack ≥ delay, not more urgent)', () => {
    const [f] = detectCapacity([job({}), job({ workOrderId: 'w2', label: 'İE-2', late: false, dueAt: '2026-10-30T20:59:59Z', finishAt: '2026-10-11T10:00:00Z', priority: 'low' }), job({ workOrderId: 'w3', label: 'İE-3', late: false, priority: 'critical', dueAt: '2026-11-30T20:59:59Z', finishAt: '2026-10-10T10:00:00Z' })]);
    expect(f.payload).toEqual({ lateWorkOrderId: 'w1', moveWorkOrderId: 'w2' });
    expect(f.title).toBe('İE-1 termine yetişmiyor; İE-2 kayabilir');
  });
  it('says so when nothing can move; on-time plans are quiet', () => {
    expect(detectCapacity([job({})])[0].payload.moveWorkOrderId).toBeNull();
    expect(detectCapacity([job({ late: false })])).toEqual([]);
  });
});

describe('7 · expiry', () => {
  const v = { vehicleId: 'v1', plate: '34 RF 2026', kind: 'inspection', kindLabel: 'Muayene', dueOn: '2026-10-19', source: 'document' as const };
  it('within 15 days → task suggestion; expired → high', () => {
    expect(detectExpiries([v], today, on)[0].title).toBe('34 RF 2026: Muayene 10 gün içinde');
    expect(detectExpiries([{ ...v, dueOn: '2026-10-01' }], today, on)[0].priority).toBe('high');
    expect(detectExpiries([{ ...v, dueOn: '2026-12-01' }], today, on)).toEqual([]);
  });
});

describe('8 · offcut', () => {
  const rem = [
    { lotId: 'r1', lotNumber: 'ART-1', itemId: 'p', color: '7016', lengthMm: 2100, ageDays: 90 },
    { lotId: 'r2', lotNumber: 'ART-2', itemId: 'p', color: '7016', lengthMm: 1850, ageDays: 10 },
    { lotId: 'r3', lotNumber: 'ART-3', itemId: 'p', color: '9016', lengthMm: 3000, ageDays: 5 },
  ];
  it('best-fit offcuts of the same profile and colour, kerf included', () => {
    const [f] = detectOffcuts(rem, [{ workOrderId: 'w1', label: 'İE-1', itemId: 'p', color: '7016', lengthMm: 1840, quantity: 1 }], 4);
    expect(f.payload.lotIds).toEqual(['r2']);
    expect(detectOffcuts(rem, [{ workOrderId: 'w1', label: 'İE-1', itemId: 'p', color: '7016', lengthMm: 1847, quantity: 1 }], 4)[0].payload.lotIds).toEqual(['r1']);
    expect(f.evidence.badges[0].label).toBe('1 artık uygun');
    const [g] = detectOffcuts(rem, [{ workOrderId: 'w1', label: 'İE-1', itemId: 'p', color: '7016', lengthMm: 1800, quantity: 2 }], 4);
    expect(g.payload.lotIds.sort()).toEqual(['r1', 'r2']);
  });
  it('no match → nothing', () => {
    expect(detectOffcuts(rem, [{ workOrderId: 'w1', label: 'x', itemId: 'p', color: '1015', lengthMm: 500, quantity: 1 }], 4)).toEqual([]);
  });
});
