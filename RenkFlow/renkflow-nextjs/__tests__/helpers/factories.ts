/**
 * Test Factories — reusable mock data generators for unit & integration tests.
 *
 * Usage:
 *   import { createOrder, createPayment } from '../helpers/factories';
 *   const order = createOrder({ status: 'delivered' });
 */

import type { Order } from '@/lib/types';
import { createOrderId } from '@/lib/types';

// ============================================
// Counters (deterministic IDs)
// ============================================

let _seq = 0;
function nextId(prefix = 'test'): string {
  _seq += 1;
  return `${prefix}-${String(_seq).padStart(6, '0')}`;
}

/** Reset the auto-increment counter (call in beforeEach if needed). */
export function resetFactorySeq(): void {
  _seq = 0;
}

// ============================================
// Order Factory
// ============================================

const ORDER_DEFAULTS: Order = {
  id: createOrderId(''),
  orderNumber: '',
  customerName: 'Test Müşteri',
  email: 'test@example.com',
  phone: '05551234567',
  date: '2024-06-01',
  deliveryDate: '2024-06-15',
  totalAmount: 1000,
  currency: 'TRY',
  status: 'pending',
  productName: 'Test Ürün',
  quantity: 10,
  notes: '',
  documents: [],
  createdAt: '2024-06-01T00:00:00Z',
  updatedAt: '2024-06-01T00:00:00Z',
};

/** Create a mock Order with sensible defaults. Override any field via `overrides`. */
export function createOrder(overrides: Partial<Order> = {}): Order {
  const rawId = overrides.id ? String(overrides.id) : nextId('ord');
  const brandedId = createOrderId(rawId);
  const { id: _discardId, ...restOverrides } = overrides;
  return {
    ...ORDER_DEFAULTS,
    ...restOverrides,
    id: brandedId,
    orderNumber: overrides.orderNumber ?? `ORD-${rawId}`,
  };
}

/** Create an array of mock Orders. */
export function createOrders(count: number, overrides: Partial<Order> = {}): Order[] {
  return Array.from({ length: count }, () => createOrder(overrides));
}

// ============================================
// Payment Factory (lightweight — no full type import needed)
// ============================================

export interface MockPayment {
  id: string;
  orderId: string;
  amount: number;
  currency: string;
  method: string;
  paidAt: string;
}

export function createPayment(overrides: Partial<MockPayment> = {}): MockPayment {
  return {
    id: nextId('pay'),
    orderId: nextId('ord'),
    amount: 500,
    currency: 'TRY',
    method: 'bank_transfer',
    paidAt: '2024-06-01T12:00:00Z',
    ...overrides,
  };
}

// ============================================
// Session / Auth Factory
// ============================================

export interface MockSession {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    tenantId: string;
  };
}

export function createSession(overrides: Partial<MockSession['user']> = {}): MockSession {
  return {
    user: {
      id: nextId('usr'),
      email: 'admin@test.com',
      name: 'Test Admin',
      role: 'admin',
      tenantId: nextId('tnt'),
      ...overrides,
    },
  };
}
