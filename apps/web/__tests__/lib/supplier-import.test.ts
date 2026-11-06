/** @jest-environment node */
jest.mock('server-only', () => ({}));
import { importSuppliers } from '@/lib/features/suppliers/import.server';
import { parseSupplierImport } from '@/lib/features/suppliers/import';
function database(cards: Record<string, unknown>[] = []) {
  const writes: string[] = [];
  const scopes: unknown[] = [];
  const db: any = (parts: TemplateStringsArray | string, ...values: unknown[]) => {
    if (typeof parts === 'string') return parts;
    const query = parts.join('?');
    if (query.includes('SELECT *')) { scopes.push(values[0]); return Promise.resolve(cards.filter(c => !c.tenant_id || c.tenant_id === values[0]).map(c => ({ ...c }))); }
    writes.push(query);
    return Promise.resolve(query.includes('RETURNING id') ? [{ id: 'created' }] : []);
  };
  db.begin = jest.fn((run: (tx: any) => unknown) => run(db));
  return { db, writes, scopes };
}
const actor = { tenantId: 'tenant-a', userId: 'user-a' };
const text = 'Ad;VKN;E-posta;Telefon;Not;Vade\nAd;1234567890;A@b.com;05551112233;Yeni;0';
const cards = [
  { id: 'name', name: 'Ad', notes: 'Dolu' },
  { id: 'phone', name: 'Telefon', phone: '+90 555 111 22 33' },
  { id: 'email', name: 'Posta', email: 'a@b.com' },
  { id: 'tax', name: 'Vergi', tax_number: '1234567890', notes: 'Dolu', payment_terms: 0 },
];
test.each([[4, 'tax'], [3, 'email'], [2, 'phone'], [1, 'name']])('matching priority with %i candidates', async (n, id) => {
  const { db, writes } = database(cards.slice(0, Number(n)));
  const result = await importSuppliers(db, actor, { text, fillEmpty: true });
  expect(result.rows[0].matchedId).toBe(id);
  if (id === 'tax' || id === 'name') expect(result.rows[0].filled || []).not.toContain('notes');
  if (id === 'tax') expect(result.rows[0].filled || []).not.toContain('payment_terms');
  expect(writes).toEqual([]);
  expect(db.begin).not.toHaveBeenCalled();
});
test.each(['-1', '366', 'abc', '1.5', 'Infinity'])('rejects payment terms %s', value => {
  expect(parseSupplierImport(`Ad;Vade\nFirma;${value}`).rows[0].errors).toHaveLength(1);
});
test.each(['0', '365', ''])('accepts payment terms %s', value => {
  expect(parseSupplierImport(`Ad;Vade\nFirma;${value}`).rows[0].errors).toEqual([]);
});
test('simulates repeats consistently and writes in one transaction', async () => {
  const { db, writes } = database();
  const file = 'Ad;E-posta\nFirma;a@b.com\nFirma;a@b.com';
  const dry = await importSuppliers(db, actor, { text: file });
  expect(dry.rows.map(r => r.outcome)).toEqual(['new', 'exists']);
  expect(writes).toEqual([]);
  const real = await importSuppliers(db, actor, { text: file, dryRun: false });
  expect(real.summary).toEqual(dry.summary);
  expect(db.begin).toHaveBeenCalledTimes(1);
  expect(writes.filter(q => q.includes('INSERT INTO suppliers'))).toHaveLength(1);
});

test('does not match a supplier in another tenant', async () => {
  const { db, scopes } = database([{ ...cards[3], tenant_id: 'tenant-b' }]);
  const result = await importSuppliers(db, actor, { text });
  expect(result.rows[0].outcome).toBe('new');
  expect(scopes).toEqual(['tenant-a']);
});
test('real fill updates only empty fields and preserves zero days', async () => {
  const { db, writes } = database([cards[3]]);
  const result = await importSuppliers(db, actor, { text, dryRun: false, fillEmpty: true });
  expect(result.rows[0].outcome).toBe('fill');
  expect(result.rows[0].filled).toEqual(['phone', 'email']);
  expect(writes.filter(q => q.includes('UPDATE suppliers'))).toHaveLength(2);
  expect(writes.filter(q => q.includes('INSERT INTO production_events'))).toHaveLength(1);
});
