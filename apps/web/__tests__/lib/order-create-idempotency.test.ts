/** @jest-environment node */
import { orderCreateRequestHash } from '@/lib/features/orders/create-idempotency';
import type { NewOrderFormData } from '@/lib/types';
const data: NewOrderFormData = { customerName: 'Test customer', productName: 'Profil', quantity: 1, totalAmount: 100, currency: 'TRY' };
it('compares object keys canonically and keeps line order meaningful', async () => {
  expect(await orderCreateRequestHash(data)).toBe(await orderCreateRequestHash({ currency: 'TRY', totalAmount: 100, quantity: 1, productName: 'Profil', customerName: 'Test customer' }));
  const a = { productName: 'Profil A', quantity: 1, totalPrice: 50 };
  const b = { productName: 'Profil B', quantity: 1, totalPrice: 50 };
  expect(await orderCreateRequestHash({ ...data, items: [a,b] })).not.toBe(await orderCreateRequestHash({ ...data, items: [b,a] }));
});
it('compares file bytes, not just names and sizes, and ignores upload timestamps', async () => {
  const file = (bytes: string, lastModified: number) => new File([bytes], 'test.pdf', { type: 'application/pdf', lastModified });
  expect(await orderCreateRequestHash(data, [file('abc', 1)])).toBe(await orderCreateRequestHash(data, [file('abc', 2)]));
  expect(await orderCreateRequestHash(data, [file('abc', 1)])).not.toBe(await orderCreateRequestHash(data, [file('def', 1)]));
});
