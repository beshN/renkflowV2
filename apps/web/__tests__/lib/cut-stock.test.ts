import { physicalBars, type PhysicalStock } from '@/lib/features/manufacturing/cut-stock';

const stock: PhysicalStock = { id: 'lot', itemId: 'profile', lotNumber: 'SAYIM-24', quantity: 220, uom: 'adet', pieceLengthMm: 4000, color: 'Boyasız', kind: 'new' };

describe('stock quantity is not a physical bar length', () => {
  it('220 counted pieces of 4m become 220 separate bars, never one 220m bar', () => {
    const p = physicalBars(stock);
    expect(p.problem).toBeNull();
    expect(p.bars).toHaveLength(220);
    expect(p.bars.every((b) => b.lengthMm === 4000)).toBe(true);
    expect(new Set(p.bars.map((b) => b.id)).size).toBe(220);
  });
  it('refuses aggregated metres with no physical lengths instead of inventing a distribution', () => {
    const p = physicalBars({ ...stock, uom: 'm', pieceLengthMm: null });
    expect(p.bars).toEqual([]);
    expect(p.problem).toMatch(/fiziksel/);
  });
  it('preserves an individual 6m bar and a partially used 2.8m remnant', () => {
    expect(physicalBars({ ...stock, uom: 'm', lengthM: 6, quantity: 6 }).bars[0].lengthMm).toBe(6000);
    expect(physicalBars({ ...stock, uom: 'm', lengthM: 6, quantity: 2.8, kind: 'remnant' }).bars[0].lengthMm).toBe(2800);
  });
  it('does not turn kilograms or counted pieces with no piece length into metres', () => {
    expect(physicalBars({ ...stock, uom: 'kg' }).bars).toEqual([]);
    expect(physicalBars({ ...stock, pieceLengthMm: null }).bars).toEqual([]);
  });
});
