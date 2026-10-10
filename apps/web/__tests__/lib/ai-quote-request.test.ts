import { extractQuoteRequest, needsReview } from '@/lib/ai/extract/quote-request';

describe('quote request from a pasted message', () => {
  it('WhatsApp style: two products, colour, phone, address, signature', () => {
    const r = extractQuoteRequest(`Merhaba, bahçe için 3x4 bioklimatik pergola antrasit istiyoruz. Bir de 2 adet 2,5x2 zip perde beyaz.
Adres: Bağdat Cad. No 12 Kadıköy
0532 123 45 67
Selin Aydın`);
    expect(r.customer).toMatchObject({ value: 'Selin Aydın', confidence: 'medium' });
    expect(r.phone?.value).toBe('05321234567');
    expect(r.address?.value).toBe('Bağdat Cad. No 12 Kadıköy');
    expect(r.lines).toHaveLength(2);
    expect(r.lines[0]).toMatchObject({ family: { value: 'pergola', confidence: 'high' }, widthMm: { value: 3000, confidence: 'medium' }, projectionMm: { value: 4000 }, color: { value: 'RAL 7016' }, quantity: { value: 1 } });
    expect(r.lines[1]).toMatchObject({ family: { value: 'zip' }, widthMm: { value: 2500 }, projectionMm: { value: 2000 }, color: { value: 'RAL 9016' }, quantity: { value: 2, confidence: 'high' } });
  });
  it('e-mail style with units and "ben X"', () => {
    const r = extractQuoteRequest('İyi günler, ben Murat Koç. 450x350 cm pergola için RAL 9005 mat fiyat rica ederim. murat@ornek.com');
    expect(r.customer).toMatchObject({ value: 'Murat Koç', confidence: 'high' });
    expect(r.email?.value).toBe('murat@ornek.com');
    expect(r.lines[0]).toMatchObject({ widthMm: { value: 4500, confidence: 'high' }, color: { value: 'RAL 9005 Mat' } });
  });
  it('slang and abbreviations: "3,5a4" is not a measure; missing parts are marked, not guessed', () => {
    const r = extractQuoteRequest('abi pergola fiyatı ne kadar ölçü sonra atarım');
    expect(r.lines).toEqual([]);
    expect(r.notes[0]).toMatch(/ölçü bulunamadı/);
    const s = extractQuoteRequest('slm 4x3 tente lazım 2 tane');
    expect(s.lines[0]).toMatchObject({ family: { value: 'awning' }, quantity: { value: 2 } });
    expect(s.lines[0].color).toBeNull();
    expect(needsReview(s)).toBeGreaterThan(0);
  });
});

describe('quote request: written forms people use', () => {
  it('"3 m x 2,2 m", "5,5a4", and "genişlik … çıkma …"', () => {
    expect(extractQuoteRequest('ben Ayşe Kılıç, balkon için 3 m x 2,2 m giyotin cam istiyorum').lines[0]).toMatchObject({ family: { value: 'guillotine' }, widthMm: { value: 3000, confidence: 'high' }, projectionMm: { value: 2200 } });
    expect(extractQuoteRequest('Hocam 5,5a4 olcu pergola').lines[0]).toMatchObject({ widthMm: { value: 5500 }, projectionMm: { value: 4000 } });
    expect(extractQuoteRequest('ölçüler: genişlik 4200 mm, çıkma 3000 mm. Pergola').lines[0]).toMatchObject({ widthMm: { value: 4200 }, projectionMm: { value: 3000 } });
  });
  it('"ayrıca" starts a second product; one colour is not spread to another product', () => {
    const r = extractQuoteRequest('6x4 metre pergola antrasit, ayrıca yanlara zip perde 4x2,5 iki adet');
    expect(r.lines).toHaveLength(2);
    expect(r.lines[1]).toMatchObject({ family: { value: 'zip' }, quantity: { value: 2 } });
    expect(r.lines[1].color).toBeNull();
  });
});
