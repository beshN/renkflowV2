import { measurementSummary } from '@/lib/features/orders/measurement-summary';
test('a PDF line with width and projection shows both without an empty height placeholder', () => {
  expect(measurementSummary({widthMm:7010,projectionMm:4000})).toBe('En 7.010 mm · Açılım 4.000 mm');
});
test('height and mounting height retain their separate meanings; identical legacy copy is not repeated', () => {
  expect(measurementSummary({heightMm:2000,mountingHeightMm:3000})).toBe('Yükseklik 2.000 mm · Montaj yüksekliği 3.000 mm');
  expect(measurementSummary({heightMm:3000,mountingHeightMm:3000})).toBe('Montaj yüksekliği 3.000 mm');
  expect(measurementSummary({widthMm:null,heightMm:NaN,projectionMm:0})).toBe('');
});
