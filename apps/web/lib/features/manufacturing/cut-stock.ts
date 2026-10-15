/** Translate stock quantities into physical bars. Never join a counted batch into one long bar. */
export type PhysicalStock = {
  id: string; itemId: string; lotNumber: string; quantity: number;
  uom: string; lengthM?: number | null; pieceLengthMm?: number | null;
  color: string; kind: 'new' | 'remnant' | 'scrap'; unitCost?: number;
};
export function physicalBars(stock: PhysicalStock) {
  const { quantity, uom } = stock;
  const base = { itemId: stock.itemId, lotNumber: stock.lotNumber, color: stock.color, kind: stock.kind, unitCost: stock.unitCost };
  if (!(quantity > 0) || !Number.isFinite(quantity)) return { bars: [], problem: 'Stok miktarı geçersiz' };
  if (uom === 'm') {
    // length_m is written by individual-bar receipt and opening-count workflows. A total-only
    // legacy lot has no such evidence: its physical distribution must be entered by the workshop.
    if (!(Number(stock.lengthM) > 0) || !Number.isFinite(Number(stock.lengthM)) || quantity > Number(stock.lengthM) + 0.000001)
      return { bars: [], problem: 'Toplam metre bilgisi var; fiziksel çubuk boyları ve adetleri girilmeli' };
    return { bars: [{ ...base, id: stock.id, lengthMm: quantity * 1000 }], problem: null };
  }
  if (['adet', 'boy', 'pcs', 'piece'].includes(uom) && Number(stock.pieceLengthMm) > 0 && Number.isFinite(Number(stock.pieceLengthMm)) && Number.isInteger(quantity) && quantity <= 10000) {
    return { bars: Array.from({ length: quantity }, (_, i) => ({ ...base, id: `${stock.id}:bar:${i + 1}`, lotNumber: `${stock.lotNumber} · ${i + 1}/${quantity}`, lengthMm: Number(stock.pieceLengthMm) })), problem: null };
  }
  return { bars: [], problem: ['adet', 'boy', 'pcs', 'piece'].includes(uom) ? 'Adet ve tek parça boyu kontrol edilmeli (en fazla 10.000 çubuk)' : 'Bu stok biriminden fiziksel kesim boyu belirlenemiyor; çubuk boyları ve adetleri girilmeli' };
}
