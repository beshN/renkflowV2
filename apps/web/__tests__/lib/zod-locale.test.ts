import { z } from 'zod';
import '@/lib/shared/validation/zod-locale';
import { updateOrderSchema } from '@/lib/features/orders/order.schema';

describe('Zod Türkçe Yereli (zod-locale)', () => {
  it('mesajsız bir şema (z.string().min(3)) Türkçe hata mesajı üretir', () => {
    const schema = z.string().min(3);
    const result = schema.safeParse('ab');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Çok küçük: beklenen string >=3 karakter');
    }
  });

  it('mesajsız z.string().max(5) Türkçe hata mesajı üretir', () => {
    const schema = z.string().max(5);
    const result = schema.safeParse('123456');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Çok büyük: beklenen string <=5 karakter');
    }
  });

  it('mesajsız z.number().min(10) Türkçe hata mesajı üretir', () => {
    const schema = z.number().min(10);
    const result = schema.safeParse(5);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Çok küçük: beklenen number >=10');
    }
  });

  it('geçersiz tip kontrolünde Türkçe hata mesajı üretir', () => {
    const schema = z.string();
    const result = schema.safeParse(123);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Geçersiz değer: beklenen string, alınan number');
    }
  });

  it('updateOrderSchema içindeki mesajsız alanlar (customerName min(2)) Türkçe hata mesajı üretir', () => {
    const result = updateOrderSchema.safeParse({ customerName: 'a' });

    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes('customerName'));
      expect(issue).toBeDefined();
      expect(issue?.message).toBe('Çok küçük: beklenen string >=2 karakter');
    }
  });

  it('özel elle yazılmış hata mesajları korunur ve değişmez', () => {
    const customMessage = 'Lütfen geçerli bir sipariş adı giriniz';
    const schemaWithCustomMessage = z.string().min(3, customMessage);
    const result = schemaWithCustomMessage.safeParse('a');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(customMessage);
    }
  });
});
