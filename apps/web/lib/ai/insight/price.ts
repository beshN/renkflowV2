/**
 * Price suggestion with its evidence (pure). The basis is the firm's own accepted quotes for the same
 * product family and a similar size (price per m²); the price matrix is shown next to it. With fewer
 * than three comparable quotes nothing is suggested from history. The profit floor is checked only
 * when a material cost is known from past configured quotes; otherwise the screen says it is unknown.
 */
export type PricePoint = { quotationId: string; number: string; date: string; areaM2: number; unitPrice: number; costPerM2: number | null };
export type PriceSuggestion = {
  suggested: number | null;
  basis: 'history' | 'matrix' | 'none';
  evidence: { count: number; medianPerM2: number | null; minPerM2: number | null; maxPerM2: number | null; matrixUnitPrice: number | null; sources: Array<{ label: string; href: string }> };
  cost: { perM2: number; total: number; count: number } | null;
  margin: number | null;
  belowFloor: boolean;
  warnings: string[];
};

export const MIN_COMPARABLE = 3;
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const round10 = (v: number) => Math.round(v / 10) * 10;

export function suggestPrice(input: { areaM2: number; history: PricePoint[]; matrixUnitPrice: number | null; floorPercent: number; enteredPrice?: number | null }): PriceSuggestion {
  const { areaM2 } = input;
  // Comparable: within ±40% of the area (price per m² is not linear for very different sizes).
  const near = input.history.filter((h) => h.areaM2 > 0 && h.unitPrice > 0 && Math.abs(h.areaM2 - areaM2) / areaM2 <= 0.4);
  const perM2 = near.map((h) => h.unitPrice / h.areaM2);
  const med = perM2.length ? median(perM2) : null;
  const fromHistory = near.length >= MIN_COMPARABLE && med !== null ? round10(med * areaM2) : null;
  const suggested = fromHistory ?? input.matrixUnitPrice ?? null;
  const basis = fromHistory !== null ? 'history' : input.matrixUnitPrice !== null ? 'matrix' : 'none';
  const costs = near.map((h) => h.costPerM2).filter((c): c is number => c !== null && c > 0);
  const cost = costs.length >= 2 ? { perM2: median(costs), total: Math.round(median(costs) * areaM2), count: costs.length } : null;
  const price = input.enteredPrice ?? suggested;
  const margin = cost && price ? (price - cost.total) / price : null;
  const belowFloor = margin !== null && margin * 100 < input.floorPercent;
  const warnings: string[] = [];
  if (near.length < MIN_COMPARABLE) warnings.push(`Benzer ölçüde kabul edilmiş ${near.length} teklif var; geçmişten öneri için en az ${MIN_COMPARABLE} gerekir.`);
  if (!cost) warnings.push('Malzeme maliyeti bilinmiyor (geçmiş tekliflerde reçete ya da alış fiyatı yok); kâr tabanı kontrol edilemedi.');
  if (belowFloor) warnings.push(`Bu fiyatla tahmini kâr %${Math.round(margin! * 100)}; firmanın kâr tabanı %${input.floorPercent}.`);
  if (fromHistory !== null && input.matrixUnitPrice !== null && Math.abs(fromHistory - input.matrixUnitPrice) / input.matrixUnitPrice > 0.15)
    warnings.push(`Geçmiş teklifler matristen %${Math.round(((fromHistory - input.matrixUnitPrice) / input.matrixUnitPrice) * 100)} farklı; matris güncel olmayabilir.`);
  return {
    suggested, basis,
    evidence: {
      count: near.length, medianPerM2: med === null ? null : Math.round(med), minPerM2: perM2.length ? Math.round(Math.min(...perM2)) : null, maxPerM2: perM2.length ? Math.round(Math.max(...perM2)) : null,
      matrixUnitPrice: input.matrixUnitPrice,
      sources: near.slice(0, 5).map((h) => ({ label: `${h.number} · ${h.areaM2.toFixed(1)} m² · ${Math.round(h.unitPrice / h.areaM2).toLocaleString('tr-TR')} ₺/m²`, href: `/quotations/${h.quotationId}` })),
    },
    cost, margin, belowFloor, warnings,
  };
}
