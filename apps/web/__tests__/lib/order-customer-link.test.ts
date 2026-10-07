/** @jest-environment node */
import { AmbiguousCustomerError, resolveOrderCustomer, phoneKey, nameKey } from '@/lib/features/customers/link';

jest.mock('server-only', () => ({}));
jest.mock('@/auth', () => ({ auth: jest.fn() }));

const tenantId = '22222222-2222-4222-8222-222222222222';
const chosen = '33333333-3333-4333-8333-333333333333';

/** The SQL prefilter is broad; the deciding rules run in JS, so the mock returns every card. */
function db(cards: Array<Record<string, unknown>>) {
  const queries: Array<{ text: string; values: unknown[] }> = [];
  const tx = jest.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join('?');
    queries.push({ text, values });
    const result = (async () => {
      if (/WHERE tenant_id = \? AND id = \?/.test(text)) return cards.filter((c) => c.id === values[1] && c.tenant_id === values[0]);
      if (/FROM customers/.test(text)) return cards;
      if (/INSERT INTO customers/.test(text)) return [{ id: 'new-card', full_name: values[1] }];
      return [];
    })();
    return Object.assign(result, { fragment: true });
  });
  return { tx, queries };
}
const card = (id: string, full_name: string, email: string | null = null, phone = '', company_name: string | null = null) => ({ id, full_name, company_name, email, phone_key: phoneKey(phone) });

it('normalizes phones to the last 10 digits and names to single spaces', () => {
  expect(phoneKey('+90 532 000 00 00')).toBe(phoneKey('0532 000 00 00'));
  expect(nameKey('  Örnek   Yapı ')).toBe(nameKey('örnek yapı'));
  expect(nameKey('IŞIK YAPI')).toBe(nameKey('Işık Yapı'));
  expect(nameKey('İNŞAAT')).toBe(nameKey('inşaat'));
});

it('uses the chosen customer card when it belongs to the firm', async () => {
  const { tx } = db([{ id: chosen, tenant_id: tenantId, full_name: 'Örnek Yapı A.Ş.' }]);
  await expect(resolveOrderCustomer(tx, tenantId, { customerId: chosen, customerName: 'yazılan ad' })).resolves.toEqual({ id: chosen, name: 'Örnek Yapı A.Ş.', created: false });
});

it('rejects a chosen card from another firm', async () => {
  const { tx } = db([{ id: chosen, tenant_id: 'other-firm', full_name: 'Başka Firma' }]);
  await expect(resolveOrderCustomer(tx, tenantId, { customerId: chosen, customerName: 'x' })).rejects.toMatchObject({ status: 400 });
});

it('prefers an e-mail or phone match over a name match, across phone formats', async () => {
  const { tx } = db([card('by-name', 'Ahmet Usta'), card('by-phone', 'A. Usta', null, '0532 000 00 00')]);
  await expect(resolveOrderCustomer(tx, tenantId, { customerName: 'Ahmet Usta', phone: '+90 532 000 00 00' })).resolves.toMatchObject({ id: 'by-phone' });
});

it('matches a name regardless of case and extra spaces', async () => {
  const { tx, queries } = db([card('card', 'Örnek Yapı')]);
  await expect(resolveOrderCustomer(tx, tenantId, { customerName: '  ÖRNEK   yapı ' })).resolves.toMatchObject({ id: 'card', created: false });
  expect(queries.some((q) => /pg_advisory_xact_lock/.test(q.text))).toBe(false);
});

it('does not link a same-name card whose phone or e-mail contradicts the order', async () => {
  const { tx } = db([card('other-person', 'Ahmet Yılmaz', 'a@x.com', '0532 111 11 11')]);
  await expect(resolveOrderCustomer(tx, tenantId, { customerName: 'Ahmet Yılmaz', phone: '0555 222 22 22' })).resolves.toMatchObject({ id: 'new-card', created: true });
});

it('creates and audits a new card under a firm-level lock, re-checking after the lock', async () => {
  const { tx, queries } = db([]);
  await expect(resolveOrderCustomer(tx, tenantId, { customerName: 'Yeni Müşteri', email: 'A@B.COM' }, 'actor')).resolves.toEqual({ id: 'new-card', name: 'Yeni Müşteri', created: true });
  const lockIndex = queries.findIndex((q) => /pg_advisory_xact_lock/.test(q.text));
  expect(lockIndex).toBeGreaterThan(0);
  expect(queries.slice(lockIndex).some((q) => /FROM customers/.test(q.text) && !/INSERT/.test(q.text))).toBe(true);
  expect(queries.find((q) => /INSERT INTO customers/.test(q.text))!.values).toEqual([tenantId, 'Yeni Müşteri', 'a@b.com', null]);
  expect(queries.some((q) => /INSERT INTO activity_logs/.test(q.text) && q.values.includes('new-card'))).toBe(true);
});

it('matches the typed name against the card\'s company name too', async () => {
  const { tx } = db([card('firm-card', 'Ahmet Yılmaz', null, '', 'Yılmaz Yapı')]);
  await expect(resolveOrderCustomer(tx, tenantId, { customerName: 'YILMAZ YAPI' })).resolves.toMatchObject({ id: 'firm-card', created: false });
});

it('refuses to guess when several cards share the name, instead of linking the oldest', async () => {
  const { tx, queries } = db([card('older', 'Ahmet Yılmaz'), card('newer', 'Ahmet Yılmaz')]);
  await expect(resolveOrderCustomer(tx, tenantId, { customerName: 'Ahmet Yılmaz' })).rejects.toBeInstanceOf(AmbiguousCustomerError);
  expect(queries.some((q) => /INSERT INTO customers/.test(q.text))).toBe(false);
});

it('still resolves same-name cards when the phone picks one out', async () => {
  const { tx } = db([card('older', 'Ahmet Yılmaz', null, '0532 111 11 11'), card('newer', 'Ahmet Yılmaz', null, '0555 222 22 22')]);
  await expect(resolveOrderCustomer(tx, tenantId, { customerName: 'Ahmet Yılmaz', phone: '0555 222 22 22' })).resolves.toMatchObject({ id: 'newer' });
});

it('rejects an empty name without querying', async () => {
  const { tx, queries } = db([card('blank-company', 'Biri')]);
  await expect(resolveOrderCustomer(tx, tenantId, { customerName: '   ' })).rejects.toMatchObject({ status: 400 });
  expect(queries).toHaveLength(0);
});
