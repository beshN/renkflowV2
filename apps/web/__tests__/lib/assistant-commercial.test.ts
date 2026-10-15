import { quoteCommercialTerms } from '@/lib/ai/commands/commercial';

it('preserves the explicitly requested 300,000 TRY, five percent discount and zero VAT', () => {
  expect(quoteCommercialTerms('10x5 makaslı tente 300.000tl üzerinden yüzde 5 iskonto 0 kdv')).toEqual({ unitPrice: 300000, currency: 'TRY', discountPercent: 5, vatPercent: 0 });
});
it('reads Turkish decimals, currencies and zero discount without using truthy defaults', () => {
  expect(quoteCommercialTerms('1.250,50 EUR, indirim %0, KDV %20')).toEqual({ unitPrice: 1250.5, currency: 'EUR', discountPercent: 0, vatPercent: 20 });
});
it('does not mistake dimensions, quantities or a RAL code for a price', () => {
  expect(quoteCommercialTerms('3x4 pergola, 2 adet, RAL 7016')).toEqual({});
});
it('asks for correction instead of silently replacing invalid VAT and discounts with defaults', () => {
  expect(quoteCommercialTerms('KDV %18, indirim %105').issues).toHaveLength(2);
});
