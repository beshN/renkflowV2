import { Order } from '../types';

// Mock orders for development without backend
export const mockOrders: Order[] = [
  {
    id: '1',
    orderNumber: 'ORD-2024-001',
    customerName: 'Ahmet Yılmaz',
    customerEmail: 'ahmet@email.com',
    customerPhone: '+90 532 123 4567',
    productName: 'Modern Yemek Masası',
    quantity: 1,
    status: 'pending',
    totalAmount: 15000,
    currency: '₺',
    deliveryDate: '2024-12-20',
    notes: 'Meşe ağacı, mat vernik isteniyor.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '2',
    orderNumber: 'ORD-2024-002',
    customerName: 'Fatma Demir',
    customerEmail: 'fatma@email.com',
    customerPhone: '+90 533 234 5678',
    productName: 'L Koltuk Takımı',
    quantity: 1,
    status: 'in_production',
    totalAmount: 45000,
    currency: '₺',
    deliveryDate: '2024-12-25',
    notes: 'Gri kadife kumaş, sol köşe.',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '3',
    orderNumber: 'ORD-2024-003',
    customerName: 'Mehmet Kaya',
    customerPhone: '+90 534 345 6789',
    productName: 'Oda Yatak Başlığı',
    quantity: 2,
    status: 'delivered',
    totalAmount: 8500,
    currency: '₺',
    deliveryDate: '2024-12-15',
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '4',
    orderNumber: 'ORD-2024-004',
    customerName: 'Ayşe Çelik',
    customerEmail: 'ayse@email.com',
    customerPhone: '+90 535 456 7890',
    productName: 'TV Ünitesi',
    quantity: 1,
    status: 'pending',
    totalAmount: 12000,
    currency: '₺',
    deliveryDate: '2024-12-22',
    notes: 'Beyaz lake, LED ışıklı.',
    createdAt: new Date(Date.now() - 259200000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '5',
    orderNumber: 'ORD-2024-005',
    customerName: 'Ali Öztürk',
    customerPhone: '+90 536 567 8901',
    productName: 'Mutfak Dolabı Seti',
    quantity: 1,
    status: 'in_production',
    totalAmount: 55000,
    currency: '₺',
    deliveryDate: '2024-12-28',
    notes: 'Antrasit membran kapak, soft close menteşe.',
    createdAt: new Date(Date.now() - 345600000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Helper to get orders
export function getMockOrders(): Order[] {
  return [...mockOrders];
}

// Helper to get order by ID
export function getMockOrderById(id: string): Order | undefined {
  return mockOrders.find(order => order.id === id);
}

// Helper to update order status
export function updateMockOrderStatus(id: string, status: Order['status']): Order | undefined {
  const order = mockOrders.find(o => o.id === id);
  if (order) {
    order.status = status;
    order.updatedAt = new Date().toISOString();
  }
  return order;
}
