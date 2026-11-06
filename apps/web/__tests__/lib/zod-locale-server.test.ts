/** @jest-environment node */
// Sunucu tarafı: Türkçe yerel, sunucu kodunun ortak girişi '@/lib/db' yüklenince
// geçerli olmalı. zod-locale doğrudan import edilmez; her senaryo ayrı modül kaydında
// çalışır, böylece global zod ayarı senaryolar ve test dosyaları arasında sızmaz.
jest.mock('postgres', () => jest.fn(() => {
  const client: any = jest.fn(async () => []);
  client.unsafe = jest.fn(async () => []);
  client.begin = jest.fn(async (cb: (tx: unknown) => unknown) => cb(client));
  return client;
}));

type Zod = typeof import('zod');

function isolated<T>(load: () => T): T {
  let result: T;
  jest.isolateModules(() => {
    result = load();
  });
  return result!;
}

function minMessage(zod: Zod, schema?: (z: Zod['z']) => any): string {
  const parsed = (schema ? schema(zod.z) : zod.z.string().min(3)).safeParse('ab');
  if (parsed.success) throw new Error('Şema beklenmedik şekilde geçti');
  return parsed.error.issues[0].message;
}

describe('Zod Türkçe yereli — sunucu ortak girişi (lib/db)', () => {
  it('lib/db yüklenmeden zod varsayılan (Türkçe olmayan) mesaj üretir', () => {
    const message = isolated(() => minMessage(require('zod') as Zod));
    expect(message).not.toMatch(/Çok küçük/);
  });

  it('lib/db yüklenince aynı modül kaydındaki zod Türkçe mesaj üretir', () => {
    const message = isolated(() => {
      require('@/lib/db');
      return minMessage(require('zod') as Zod);
    });
    expect(message).toBe('Çok küçük: beklenen string >=3 karakter');
  });

  it('lib/db yüklense de elle yazılmış mesajlar korunur', () => {
    const message = isolated(() => {
      require('@/lib/db');
      return minMessage(require('zod') as Zod, (z) => z.string().min(3, 'Müşteri adı en az 3 karakter olmalı'));
    });
    expect(message).toBe('Müşteri adı en az 3 karakter olmalı');
  });
});
