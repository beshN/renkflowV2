import { createOrderSchema, orderItemSchema, validateFiles } from '@/lib/features/orders/order.schema';
import { ORDER_MAX_UPLOAD_COUNT, ORDER_MAX_UPLOAD_SIZE_BYTES } from '@/lib/features/orders/constants';

describe('createOrderSchema', () => {
  const basePayload = {
    customerName: 'Örnek Yapı A.Ş.',
    productName: 'Alüminyum profil',
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

  it('preserves legal company names and digits', () => {
    const result = createOrderSchema.parse({ ...basePayload, customerName: '4040 Yapı A.Ş.' });
    expect(result.customerName).toBe('4040 Yapı A.Ş.');
  });

  it('accepts an unpriced incoming aluminum order', () => {
    const result = createOrderSchema.safeParse({ ...basePayload, totalAmount: 0, items: [
      { productName: '40×40 alüminyum profil', quantity: 2, unitPrice: 0, totalPrice: 0, widthMm: 1000 },
    ] });
    expect(result.success).toBe(true);
  });

  it.each([-1, 0, Infinity, NaN])('rejects invalid dimensions: %s', widthMm => {
    expect(orderItemSchema.safeParse({ productName: 'Profil', quantity: 1, widthMm }).success).toBe(false);
  });

  it('rejects negative line prices', () => {
    expect(orderItemSchema.safeParse({ productName: 'Profil', quantity: 1, unitPrice: -1 }).success).toBe(false);
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

  it('parses localized currency values correctly', () => {
    const result = createOrderSchema.safeParse({
      ...basePayload,
      totalAmount: '33.329,97',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.totalAmount).toBeCloseTo(33329.97, 2);
    }
  });

  it('rejects invalid totalAmount values', () => {
    const result = createOrderSchema.safeParse({
      ...basePayload,
      totalAmount: 'abc',
    });

    expect(result.success).toBe(false);
  });
});

describe('validateFiles', () => {
  it('returns valid for accepted files', () => {
    const file = new File(['test'], 'sample.pdf', { type: 'application/pdf' });
    const result = validateFiles([file]);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects files over max size', () => {
    const content = 'a'.repeat(ORDER_MAX_UPLOAD_SIZE_BYTES + 1);
    const file = new File([content], 'big.pdf', { type: 'application/pdf' });
    const result = validateFiles([file]);

    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('boyutu');
  });

  it('rejects files with unsupported mime types', () => {
    const file = new File(['hello'], 'script.sh', { type: 'text/x-shellscript' });
    const result = validateFiles([file]);

    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('Desteklenmeyen dosya türü');
  });

  it('rejects file lists that exceed count limit', () => {
    const files = Array.from({ length: ORDER_MAX_UPLOAD_COUNT + 1 }).map(
      (_, idx) => new File(['ok'], `file-${idx}.pdf`, { type: 'application/pdf' }),
    );

    const result = validateFiles(files);
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('En fazla');
  });
});
