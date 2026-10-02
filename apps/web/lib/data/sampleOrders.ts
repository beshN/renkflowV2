import { type Order, createOrderId } from '../types';

// Explicit demo records, used only by the mock order service.
export const sampleOrders: Order[] = [
  {
    id: createOrderId('ORD1732123456789'), orderNumber: 'RF-DEMO-001',
    customerName: 'Örnek Yapı A.Ş.', productName: 'Alüminyum sürme doğrama',
    date: '2026-10-01', deliveryDate: '2026-10-12', totalAmount: 15000, currency: 'TRY',
    status: 'pending', priority: 'medium', quantity: 1,
    notes: 'DEMO · 2400 × 2100 mm · RAL 7016 mat. Teknik çizim onayı bekleniyor.',
    documents: [], createdAt: '2026-10-01T09:00:00Z', updatedAt: '2026-10-01T09:00:00Z',
  },
  {
    id: createOrderId('ORD1732123456790'), orderNumber: 'RF-DEMO-002',
    customerName: 'Örnek Cephe Ltd.', productName: 'Alüminyum pencere sistemi',
    date: '2026-10-01', deliveryDate: '2026-10-15', totalAmount: 8500, currency: 'TRY',
    status: 'in_production', priority: 'high', quantity: 2,
    notes: 'DEMO · 1200 × 1500 mm · RAL 9016. Aksesuar seti montaj öncesinde kontrol edilecek.',
    documents: [], createdAt: '2026-10-01T10:00:00Z', updatedAt: '2026-10-02T09:00:00Z',
  },
  {
    id: createOrderId('ORD1732123456791'), orderNumber: 'RF-DEMO-003',
    customerName: 'Örnek Proje', productName: '40×40 alüminyum profil çerçeve',
    date: '2026-10-01', deliveryDate: '2026-10-02', totalAmount: 25000, currency: 'TRY',
    status: 'delivered', priority: 'medium', quantity: 1,
    notes: 'DEMO · 1000 × 1000 mm. Paketleme ve sevkiyat kontrolü tamamlandı.',
    documents: [], createdAt: '2026-10-01T11:00:00Z', updatedAt: '2026-10-02T09:00:00Z',
  },
];
