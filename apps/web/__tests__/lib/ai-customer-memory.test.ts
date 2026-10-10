import { customerMemory } from '@/lib/ai/insight/customer-memory';

const base = {
  orders: [
    { id: 'o1', number: 'ORD-1', date: '2025-03-01', total: 40000, status: 'delivered', colors: ['RAL 7016'] },
    { id: 'o2', number: 'ORD-2', date: '2026-08-10', total: 60000, status: 'in_production', colors: ['RAL 7016', 'RAL 9016'] },
    { id: 'o3', number: 'ORD-3', date: '2026-09-01', total: 99999, status: 'cancelled', colors: [] },
  ],
  quotes: [
    { id: 'q1', number: 'TKL-1', date: '2026-07-01', status: 'converted', colors: ['RAL 7016'] },
    { id: 'q2', number: 'TKL-2', date: '2026-09-20', status: 'rejected', colors: [] },
    { id: 'q3', number: 'TKL-3', date: '2026-10-01', status: 'sent', colors: [] },
  ],
  overdue: [{ number: 'FTR-9', dueOn: '2026-09-15', open: 12500, orderId: 'o2' }],
  hidePrices: false, financeVisible: true,
};

describe('customer memory', () => {
  it('facts only from records, each with its source; cancelled orders do not count', () => {
    const f = customerMemory(base);
    const by = (k: string) => f.find((x) => x.key === k)!;
    expect(by('since')).toMatchObject({ value: '01.03.2025', sources: [{ label: 'ORD-1', href: '/orders/o1' }] });
    expect(by('orders').value).toBe('2 sipariş · toplam 100.000 ₺ · son: 10.08.2026');
    expect(by('quotes').value).toMatch(/3 teklif · sonuçlananların %50'i kabul · son: 01.10.2026/);
    expect(by('colors').value).toBe('RAL 7016 (2 kez)'); // the converted quote counts once, as its order
    expect(by('overdue').value).toMatch(/1 fatura · 12.500 ₺ açık · en eski vade 15.09.2026/);
    f.forEach((x) => expect(x.sources.length).toBeGreaterThan(0));
  });
  it('a role hiding prices sees no amounts; without finance rights no overdue line', () => {
    const f = customerMemory({ ...base, hidePrices: true, financeVisible: false });
    expect(f.map((x) => x.value).join(' ')).not.toMatch(/₺/);
    expect(f.find((x) => x.key === 'overdue')).toBeUndefined();
  });
  it('a new customer has no facts (nothing is made up)', () => {
    expect(customerMemory({ orders: [], quotes: [], overdue: [], hidePrices: false, financeVisible: true })).toEqual([]);
  });
});

describe('customer memory: currencies', () => {
  it('lira orders are added up; a foreign-currency order is counted, never converted', () => {
    const f = customerMemory({ ...base, orders: [...base.orders, { id: 'o4', number: 'ORD-4', date: '2026-09-05', total: 5000, currency: 'EUR', status: 'delivered', colors: [] }] });
    expect(f.find((x) => x.key === 'orders')!.value).toBe('3 sipariş · toplam 100.000 ₺ (+1 döviz sipariş) · son: 05.09.2026');
  });
});
