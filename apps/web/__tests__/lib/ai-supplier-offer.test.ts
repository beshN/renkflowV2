import { parseSupplierOffer, trMoney } from '@/lib/ai/extract/supplier-offer';

const lines = [
  { lineId: 'l1', name: 'Taşıyıcı profil 7016', codes: ['PRG-120'], color: '7016', quantity: 20 },
  { lineId: 'l2', name: 'Kenar kapak profili', codes: ['KK-40'], color: null, quantity: 10 },
  { lineId: 'l3', name: 'Motor seti Somfy', codes: [], color: null, quantity: 2 },
];

describe('supplier offer → RFQ answer draft', () => {
  it('reads Turkish money', () => {
    expect([trMoney('1.234,50'), trMoney('12,5'), trMoney('980'), trMoney('2.500')]).toEqual([1234.5, 12.5, 980, 2500]);
  });
  it('matches by code (high, separators ignored), reads lead time and validity; a missing line stays empty', () => {
    const d = parseSupplierOffer(`ÖRNEK ALÜMİNYUM A.Ş. — FİYAT TEKLİFİ
PRG-120 Taşıyıcı profil RAL 7016   20 boy   birim fiyat: 1.250,00 TL   toplam 25.000,00 TL
Kenar kapak profili KK40 eloksal   10 boy   480,00 TL
Teslim süresi: 7 iş günü
Teklif 15 gün süreyle geçerlidir.`, lines, '2026-10-10');
    expect(d.prices[0]).toMatchObject({ lineId: 'l1', unitPrice: 1250, confidence: 'high' });
    expect(d.prices[1]).toMatchObject({ lineId: 'l2', unitPrice: 480, confidence: 'high' });
    expect(d.prices[2]).toMatchObject({ unitPrice: null, confidence: 'low' });
    expect([d.leadTimeDays, d.validUntil, d.currency]).toEqual([7, '2026-10-25', 'TRY']);
    expect(d.unmatched).toEqual(['Motor seti Somfy']);
  });
  it('a line found only by its name words is medium', () => {
    const d = parseSupplierOffer('Somfy motor seti 2 adet 7.400,00 TL', lines.slice(2), '2026-10-10');
    expect(d.prices[0]).toMatchObject({ unitPrice: 7400, confidence: 'medium' });
  });
  it('several prices without "birim" on a line → low (the person picks); an explicit date is read', () => {
    const d = parseSupplierOffer('PRG-120 profil 900,00 TL 950,00 TL\nGeçerlilik: 31.10.2026', lines.slice(0, 1), '2026-10-10');
    expect(d.prices[0].confidence).toBe('low');
    expect(d.validUntil).toBe('2026-10-31');
  });
});
