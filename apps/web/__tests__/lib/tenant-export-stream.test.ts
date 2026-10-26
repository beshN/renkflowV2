/** @jest-environment node */
jest.mock('server-only', () => ({}));

import { strFromU8, unzipSync } from 'fflate';
import { tenantExportStream } from '@/lib/features/account/export.server';

const catalog = [
  ['tenants', 'id', 'uuid'], ['tenants', 'name', 'text'],
  ['users', 'id', 'uuid'], ['users', 'password', 'text'],
  ['tenant_members', 'tenant_id', 'uuid'], ['tenant_members', 'user_id', 'uuid'],
  ['customers', 'id', 'uuid'], ['customers', 'tenant_id', 'uuid'], ['customers', 'full_name', 'text'],
  ['invitations', 'id', 'uuid'], ['invitations', 'tenant_id', 'uuid'], ['invitations', 'token', 'text'],
  ['office_files', 'id', 'uuid'], ['office_files', 'tenant_id', 'uuid'], ['office_files', 'file_name', 'text'], ['office_files', 'storage_key', 'text'], ['office_files', 'size_bytes', 'bigint'],
  ['user_sessions', 'id', 'uuid'], ['user_sessions', 'tenant_id', 'uuid'],
].map(([table_name, column_name, data_type]) => ({ table_name, column_name, data_type }));

function fakeDb() {
  const unsafeCalls: Array<{ text: string; params: unknown[] }> = [];
  const rowsFor = (text: string): Array<Record<string, unknown>> => {
    if (text.includes('FROM tenants')) return [{ id: 't1', name: 'Acme' }];
    if (text.includes('"customers"')) return Array.from({ length: 1200 }, (_, i) => ({ id: `c${i}`, tenant_id: 't1', full_name: i === 0 ? 'Virgül, "tırnak"' : `Müşteri ${i}` }));
    if (text.includes('"invitations"')) return [{ id: 'i1', tenant_id: 't1' }];
    if (text.includes('"office_files"') && text.includes('AS ref')) return [{ id: 'f1', name: 'plan.pdf', ref: 'office/t1/plan.pdf', size: 42 }];
    if (text.includes('"office_files"')) return [{ id: 'f1', tenant_id: 't1', file_name: 'plan.pdf', storage_key: 'office/t1/plan.pdf', size_bytes: 42 }];
    return [];
  };
  const tx = (strings: TemplateStringsArray) => {
    const text = strings.join('?');
    if (text.includes('information_schema.columns')) return Promise.resolve(catalog);
    if (text.includes('FROM tenants')) return Promise.resolve([{ name: 'Acme' }]);
    if (text.includes('FROM tenant_members')) return Promise.resolve([{ user_id: 'u1', name: 'Sahip', email: 'o@acme.test', role: 'owner' }]);
    return Promise.resolve([]);
  };
  tx.unsafe = (text: string, params: unknown[]) => {
    unsafeCalls.push({ text, params });
    const rows = rowsFor(text);
    const p: Promise<unknown[]> & { cursor?: unknown } = Promise.resolve(rows);
    p.cursor = async (size: number, fn: (batch: unknown[]) => Promise<void>) => {
      for (let i = 0; i < rows.length; i += size) await fn(rows.slice(i, i + size));
    };
    return p;
  };
  const db = { begin: async (mode: string, fn: (t: typeof tx) => Promise<unknown>) => { expect(mode).toContain('read only'); return fn(tx); } };
  return { db, unsafeCalls };
}

it('streams a ZIP of the firm tables, binding every read to the firm', async () => {
  const { db, unsafeCalls } = fakeDb();
  const done = jest.fn();
  const zip = new Uint8Array(await new Response(tenantExportStream(db, 't1', { now: new Date('2026-10-26T00:00:00Z'), onDone: done })).arrayBuffer());
  const files = unzipSync(zip);
  expect(Object.keys(files).sort()).toEqual(['README.txt', 'files.csv', 'members.csv', 'tables/customers.csv', 'tables/invitations.csv', 'tables/office_files.csv', 'tenant.csv']);

  const customers = strFromU8(files['tables/customers.csv']).split('\r\n');
  expect(customers[0]).toBe('id,tenant_id,full_name');
  expect(customers[1]).toBe('c0,t1,"Virgül, ""tırnak"""');
  expect(customers.filter(Boolean)).toHaveLength(1201);
  expect(strFromU8(files['tables/invitations.csv']).split('\r\n')[0]).toBe('id,tenant_id');
  expect(strFromU8(files['files.csv'])).toContain('office_files,f1,plan.pdf,office/t1/plan.pdf,42');
  expect(strFromU8(files['members.csv'])).not.toContain('password');
  expect(strFromU8(files['README.txt'])).toContain('customers.csv (1200 satır)');

  for (const call of unsafeCalls) {
    expect(call.params).toEqual(['t1']);
    expect(call.text).toMatch(/WHERE (x\.)?(tenant_id|id) = \$1/);
  }
  expect(unsafeCalls.some((c) => c.text.includes('user_sessions'))).toBe(false);
  expect(done).toHaveBeenCalledWith(expect.objectContaining({ fileCount: 1, rowCounts: { customers: 1200, invitations: 1, office_files: 1 } }));
});

it('errors the download instead of returning a truncated ZIP', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  const failing = { begin: async () => { throw new Error('connection lost'); } };
  const done = jest.fn();
  await expect(new Response(tenantExportStream(failing, 't1', { onDone: done })).arrayBuffer()).rejects.toBeTruthy();
  expect(done).toHaveBeenCalledWith(null, expect.any(Error));
});
