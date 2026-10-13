import { missingInfo, missingInfoMessage } from '@/lib/ai/extract/missing-info';

const item = (over: Record<string, unknown> = {}) => ({
  productName: 'Pergola', quantity: 1, widthMm: 4000, heightMm: null, projectionMm: 3000, mountingHeightMm: null, color: 'RAL 7016', motorType: null, ledType: null, fabricType: null, notes: null,
  sourcePage: null, evidence: '', uncertainFields: [] as string[], ...over,
}) as any;
const draft = (items: any[], over: Record<string, unknown> = {}) => ({ customerName: 'Mehmet Kaya', deliveryDate: '2026-11-20', items, ...over }) as any;

describe('missing information for the customer', () => {
  it('asks nothing when the draft has everything the customer can tell us', () => {
    expect(missingInfoMessage(draft([item()]))).toBeNull();
  });
  it('does not chase optional details such as motor, LED or fabric', () => {
    expect(missingInfo(draft([item({ motorType: null, ledType: null, fabricType: null, mountingHeightMm: null })])).lines).toEqual([]);
  });
  it('asks for what is missing per product and for the delivery date', () => {
    const m = missingInfoMessage(draft([item({ color: null }), item({ productName: null, quantity: 0, widthMm: null, projectionMm: null, color: '' })], { deliveryDate: null }), 'Renk Alüminyum')!;
    expect(m).toContain('Merhaba Mehmet Kaya,');
    expect(m).toContain('• Pergola: renk (RAL kodu varsa yazın)');
    expect(m).toContain('• 2. ürün: adet, genişlik (en), açılım (çıkma) ya da yükseklik, renk');
    expect(m).toContain('• Teslim almak istediğiniz tarih');
    expect(m.trim().endsWith('İyi çalışmalar,\nRenk Alüminyum')).toBe(true);
  });
  it('accepts a height instead of a projection (zip, giyotin)', () => {
    expect(missingInfo(draft([item({ projectionMm: null, heightMm: 2800 })])).lines).toEqual([]);
  });
  it('asks the customer to confirm a size the reader was unsure about', () => {
    const lines = missingInfo(draft([item({ uncertainFields: ['widthMm'] })])).lines;
    expect(lines[0]).toContain('4000 × 3000 mm');
    expect(lines[0]).toContain('ilk sayı genişlik mi');
  });
  it('greets without a name and without guessing Bey/Hanım', () => {
    const m = missingInfoMessage(draft([item({ color: null })], { customerName: null }))!;
    expect(m.startsWith('Merhaba,')).toBe(true);
    expect(m).not.toMatch(/Bey|Hanım/);
  });
});
