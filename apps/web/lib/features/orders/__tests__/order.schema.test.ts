import { createOrderSchema } from '@/lib/features/orders/order.schema';

describe('createOrderSchema', () => {
  const basePayload = {
    customerName: 'Acme Tekstil',
    productName: 'Numune Baski',
    quantity: '10',
    totalAmount: '1500',
    currency: 'TRY',
  };

  it('accepts null optional fields from FormData safely', () => {
    const result = createOrderSchema.safeParse({
      ...basePayload,
      email: null,
      phone: null,
      deliveryDate: null,
      notes: null,
    });

    expect(result.success).toBe(true);
  });

  it('rejects delivery dates in the past', () => {
    const result = createOrderSchema.safeParse({
      ...basePayload,
      deliveryDate: '2000-01-01',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((issue) => issue.message);
      expect(messages).toContain('Teslimat tarihi geçmiş olamaz');
    }
  });
});
