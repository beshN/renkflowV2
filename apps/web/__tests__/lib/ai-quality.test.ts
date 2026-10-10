import { colorIssues, customerIssues, normalPhone, tidyName, todoIssues, type CustomerRow } from '@/lib/ai/detectors/quality';

const c = (id: string, name: string, phone: string | null, orders = 0, createdAt = '2026-01-01'): CustomerRow => ({ id, name, phone, email: null, active: true, orders, createdAt });

describe('data quality guard', () => {
  it('phones and names: one spelling', () => {
    expect([normalPhone('+90 532 123 45 67'), normalPhone('532-123-4567'), normalPhone('0532 123 45 67'), normalPhone('123')]).toEqual(['05321234567', '05321234567', '05321234567', null]);
    expect([tidyName('  ahmet   YILMAZ '), tidyName('AYŞE KILIÇ'), tidyName('Ahmet Yılmaz'), tidyName('ahmet yılmaz')]).toEqual(['ahmet YILMAZ', 'Ayşe Kılıç', null, 'Ahmet Yılmaz']);
  });
  it('duplicate customers by phone: the card with more orders stays; the other is deactivated (reversible)', () => {
    const f = customerIssues([c('a', 'Selin Aydın', '0532 123 45 67', 1), c('b', 'Selin Aydin', '05321234567', 4)]).find((x) => x.payload.issue === 'duplicate_customer')!;
    expect(f.payload.changes).toEqual([{ table: 'customers', id: 'a', column: 'is_active', from: true, to: false }]);
    expect(f.confidence).toBe('high');
    expect(f.evidence.records.map((r) => r.entityId)).toEqual(['b', 'a']);
  });
  it('colour spelling on open items, grouped; unknown names untouched', () => {
    const f = colorIssues([
      { table: 'order_items', id: 'i1', parentId: 'o1', parentLabel: 'ORD-1', color: '7016 mat' },
      { table: 'quotation_items', id: 'i2', parentId: 'q1', parentLabel: 'TKL-1', color: '7016 mat' },
      { table: 'order_items', id: 'i3', parentId: 'o2', parentLabel: 'ORD-2', color: 'RAL 7016 Mat' },
      { table: 'order_items', id: 'i4', parentId: 'o3', parentLabel: 'ORD-3', color: 'bizim gri' },
    ]);
    expect(f).toHaveLength(1);
    expect(f[0].title).toBe('"7016 mat" → "RAL 7016 Mat" (2 kalem)');
    expect(f[0].payload.changes.map((x) => x.id)).toEqual(['i1', 'i2']);
  });
  it('missing price and unit mismatch become a to-do, never a guessed value', () => {
    const f = todoIssues([{ quotationId: 'q', number: 'TKL-9', lines: 2 }], [{ poId: 'p', number: 'SAS-3', itemName: 'Profil', lineUom: 'adet', itemUom: 'm' }]);
    expect(f.map((x) => [x.payload.issue, x.payload.changes.length, Boolean(x.payload.todo)])).toEqual([['zero_price', 0, true], ['unit_mismatch', 0, true]]);
  });
});
