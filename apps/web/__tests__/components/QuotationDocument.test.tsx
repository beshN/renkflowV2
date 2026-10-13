import { render, screen } from '@testing-library/react';
import { QuotationDocument } from '@/components/sales/QuotationDocument';
import { QuotationSchema } from '@/lib/features/quotations/types';
import { defaultVisualization } from '@/lib/features/product-3d/catalog';

const quote = QuotationSchema.parse({
  id: '11111111-1111-4111-8111-111111111111', tenantId: '22222222-2222-4222-8222-222222222222', quotationNumber: 'TEK-2026-014', customerName: 'Yükselen Yapı', status: 'draft', currency: 'TRY', validUntil: '2027-01-01', createdAt: '2026-10-13T09:00:00Z', updatedAt: '2026-10-13T09:00:00Z',
  subtotal: 352800, taxAmount: 70560, totalAmount: 423360, internalNotes: 'Gizli maliyet ve kâr', notes: 'Montaj hariçtir.', termsAndConditions: 'Teslimat: 30 gün.',
  items: [{ productName: 'Motorlu Giyotin Cam', quantity: 15, unitPrice: 24000, discountPercent: 2, totalPrice: 352800, productVisualization: { configuration: defaultVisualization('giyotin'), image: 'data:image/jpeg;base64,dGVzdA==' } }],
});
test('prints persisted prices, formatted dates and visuals without redundant headings or internal notes', () => {
  render(<QuotationDocument quote={quote} firmName="Test Firma" />);
  expect(screen.getByRole('heading', { name: 'Fiyat teklifi' })).toBeInTheDocument();
  expect(screen.getByText('Test Firma')).toBeInTheDocument();
  expect(screen.getByText('01.01.2027')).toBeInTheDocument();
  expect(screen.getByRole('img', { name: 'Motorlu Giyotin Cam ürün görünümü' })).toBeInTheDocument();
  expect(screen.getByText('₺423.360,00')).toBeInTheDocument();
  expect(screen.getByText('Montaj hariçtir.')).toBeInTheDocument();
  expect(screen.queryByText(/TİCARİ TEKLİF|SUNULAN FİRMA|Gizli maliyet/)).not.toBeInTheDocument();
  expect(screen.getAllByText('İndirim')).toHaveLength(1);
});
