/** @jest-environment node */
import { createMasker, maskPersonalData, personalValues, stripPersonalFields } from '@/lib/ai/privacy';

it('masks e-mails, phone numbers, TC kimlik, IBAN and known names, and restores them', () => {
  const input = 'Ahmet Yılmaz (ahmet@ornek.com, +90 532 123 45 67 / 0212 555 00 00) TC 10000000146 IBAN TR33 0006 1005 1978 6457 8413 26. AHMET YILMAZ tekrar yazdı.';
  const masked = maskPersonalData(input, ['Ahmet Yılmaz']);
  for (const leak of ['Ahmet', 'AHMET', 'ahmet@ornek.com', '532 123 45 67', '555 00 00', '10000000146', 'TR33']) expect(masked.text).not.toContain(leak);
  expect(masked.text).toContain('[KİŞİ_1]');
  expect(masked.text.match(/\[KİŞİ_1\]/g)).toHaveLength(2);
  expect(masked.counts).toMatchObject({ 'E-POSTA': 1, TELEFON: 2, KİMLİK: 1, IBAN: 1, KİŞİ: 1 });
  // One person, one placeholder: case variants come back in the first spelling seen.
  expect(masked.restore(masked.text)).toBe(input.replace('AHMET YILMAZ', 'Ahmet Yılmaz'));
  expect(masked.restore({ answer: '[KİŞİ_1] siparişi', items: ['[TELEFON_1]'] })).toEqual({ answer: 'Ahmet Yılmaz siparişi', items: ['+90 532 123 45 67'] });
});

it('masks landline formats too', () => {
  for (const phone of ['(0212) 555 00 00', '0212-555-00-00', '5321234567', '+90 212 555 00 00', '+905321234567', '(532) 123 45 67']) expect(maskPersonalData('Tel: ' + phone).text).toBe('Tel: [TELEFON_1]');
});

it('keeps measurements, order numbers and amounts intact', () => {
  const text = 'RF-1042 pergola 5400 x 4200 mm, 2 adet, toplam 125.000 TL, teslim 14.10.2026, SKU 6017-100150, stok 2.500 m';
  expect(maskPersonalData(text).text).toBe(text);
});

it('collects personal values from payloads and strips personal keys', () => {
  const payload = { order: { orderNumber: 'RF-1', customerName: 'Örnek Yapı', items: [{ product: 'Pergola', contact_name: 'Ali Usta' }] }, phone: '0532 000 00 00' };
  // Phones and e-mails are left to the patterns (their own placeholder labels); names come from keys.
  expect([...personalValues(payload)].sort()).toEqual(['Ali Usta', 'Örnek Yapı']);
  expect(stripPersonalFields(payload)).toEqual({ order: { orderNumber: 'RF-1', items: [{ product: 'Pergola' }] } });
});

it('masks names only as whole words, so ordinary words and the restored text stay intact', () => {
  const masker = createMasker(['Ali', 'Renk']);
  const text = 'Kalite sorunu Ali ile, RenkFlow kaydı ALİ adına; scan tamam.';
  const masked = masker.mask(text);
  expect(masked).toBe('Kalite sorunu [KİŞİ_1] ile, RenkFlow kaydı [KİŞİ_1] adına; scan tamam.');
  expect(masker.restore(masked)).toBe('Kalite sorunu Ali ile, RenkFlow kaydı Ali adına; scan tamam.');
});

it('leaves dimension lists, order codes and UUID digits readable', () => {
  const text = 'ürün 300 120 15 20 mm; sipariş RF-2026001234 ve RF-20260012345; id 3f2a1b9c-4d5e-4f60-8a7b-532123456789';
  expect(maskPersonalData(text).text).toBe(text);
});

it('treats supplier and assignee names as personal, but not material or operation names', () => {
  const snapshot = { purchases: [{ supplier_name: 'Hasan Kaya', items: [{ name: 'Alüminyum Profil 40x40' }] }], operations: [{ name: 'Kesim', assignee_name: 'Veli Usta' }] };
  expect([...personalValues(snapshot)].sort()).toEqual(['Hasan Kaya', 'Veli Usta']);
});
