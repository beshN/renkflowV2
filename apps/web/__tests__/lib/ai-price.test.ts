import { suggestPrice, type PricePoint } from '@/lib/ai/insight/price';

const p = (n: number, area: number, price: number, cost: number | null = null): PricePoint => ({ quotationId: `q${n}`, number: `TKL-${n}`, date: '2026-09-01', areaM2: area, unitPrice: price, costPerM2: cost });

describe('price suggestion', () => {
  it('three comparable accepted quotes → median per m² × area, with sources', () => {
    const s = suggestPrice({ areaM2: 12, history: [p(1, 12, 36000), p(2, 10, 31000), p(3, 14, 40600), p(4, 30, 60000)], matrixUnitPrice: null, floorPercent: 15 });
    expect(s.basis).toBe('history');
    expect(s.evidence.count).toBe(3);
    expect(s.evidence.medianPerM2).toBe(3000);
    expect(s.suggested).toBe(36000);
    expect(s.evidence.sources).toHaveLength(3);
  });
  it('fewer than three → matrix (or nothing), and it says why', () => {
    const s = suggestPrice({ areaM2: 12, history: [p(1, 12, 36000)], matrixUnitPrice: 33000, floorPercent: 15 });
    expect([s.basis, s.suggested]).toEqual(['matrix', 33000]);
    expect(s.warnings[0]).toMatch(/1 teklif var/);
    expect(suggestPrice({ areaM2: 12, history: [], matrixUnitPrice: null, floorPercent: 15 }).suggested).toBeNull();
  });
  it('profit floor: warned only when the cost is known', () => {
    const h = [p(1, 12, 36000, 2600), p(2, 12, 36000, 2600), p(3, 12, 36000, 2600)];
    const low = suggestPrice({ areaM2: 12, history: h, matrixUnitPrice: null, floorPercent: 15, enteredPrice: 33000 });
    expect(low.cost?.total).toBe(31200);
    expect(low.belowFloor).toBe(true);
    expect(low.warnings.join(' ')).toMatch(/kâr %5; firmanın kâr tabanı %15/);
    const unknown = suggestPrice({ areaM2: 12, history: [p(1, 12, 36000), p(2, 12, 36000), p(3, 12, 36000)], matrixUnitPrice: null, floorPercent: 15, enteredPrice: 1000 });
    expect([unknown.belowFloor, unknown.margin]).toEqual([false, null]);
    expect(unknown.warnings.join(' ')).toMatch(/maliyeti bilinmiyor/);
  });
});
