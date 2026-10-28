/**
 * @jest-environment node
 *
 * /api/storage/content serves a stored file only to someone who may see a record that owns it,
 * with the narrowed matrix and hidden fields of their role, like the record's own screen.
 */
import { NextRequest } from 'next/server';
import { effectiveAccess, presetFor, DEFAULT_PRESET, type Access } from '@/lib/security/access-matrix';
import { storageContentAllowed, type ContentActor, type FileOwner } from '@/lib/features/storage/content-access';
import type { UserRole } from '@/lib/auth/permissions';

const tenantId = 't1';
function actorFor(base: UserRole, preset?: string, userId = 'u1'): ContentActor {
  const access = effectiveAccess(base, preset ? presetFor(preset) : null);
  const narrowed = access.roleKey !== DEFAULT_PRESET[base];
  return { userId, tenantId, role: base, narrowed: narrowed ? { permissions: access.permissions, hidden: access.hidden } : null, hidden: narrowed ? access.hidden : [] };
}
const orderDoc: FileOwner = { kind: 'order_document' };
const invoice: FileOwner = { kind: 'finance_document' };
const drawing = (assigned = false): FileOwner => ({ kind: 'production_file', assignedToActor: assigned });

describe('storage content policy', () => {
  it('order and finance papers need the orders module and visible prices; never the worker', () => {
    for (const [base, preset, allowed] of [
      ['owner', undefined, true], ['admin', undefined, true], ['office', undefined, true], ['accountant', undefined, true],
      ['office', 'sales', true], // sees prices (hides cost and profit)
      ['office', 'planning', false], ['office', 'warehouse', false], // prices hidden
      ['member', 'readonly', false], ['member', undefined, false], ['worker', undefined, false],
    ] as Array<[UserRole, string | undefined, boolean]>) {
      for (const owner of [orderDoc, invoice])
        expect([base, preset, owner.kind, storageContentAllowed(actorFor(base, preset), 'orders/o1/x-invoice-a.pdf', [owner])]).toEqual([base, preset, owner.kind, allowed]);
    }
  });

  it('technical drawings need production view; a worker only those of their own jobs', () => {
    expect(storageContentAllowed(actorFor('worker'), 'production/t1/d', [drawing(true)])).toBe(true);
    expect(storageContentAllowed(actorFor('worker'), 'production/t1/d', [drawing(false)])).toBe(false);
    expect(storageContentAllowed(actorFor('office', 'planning'), 'production/t1/d', [drawing()])).toBe(true);
    expect(storageContentAllowed(actorFor('office', 'warehouse'), 'production/t1/d', [drawing()])).toBe(true);
    expect(storageContentAllowed(actorFor('accountant'), 'production/t1/d', [drawing()])).toBe(true); // today's answer kept
    // A custom role without production cannot open drawings even with the key.
    const custom: ContentActor = { userId: 'u1', tenantId, role: 'office', narrowed: { permissions: { inventory: ['view'] }, hidden: [] }, hidden: [] };
    expect(storageContentAllowed(custom, 'production/t1/d', [drawing()])).toBe(false);
    expect(storageContentAllowed(custom, 'orders/o1/a.pdf', [orderDoc])).toBe(false);
  });

  it('a drawing that is also attached to the order opens through the record the person may see', () => {
    expect(storageContentAllowed(actorFor('office', 'planning'), 'uploads/t1/u9/f', [orderDoc, drawing()])).toBe(true);
    expect(storageContentAllowed(actorFor('office', 'planning'), 'uploads/t1/u9/f', [orderDoc])).toBe(false);
  });

  it('a person always reads their own uploads; nobody else does without a record', () => {
    expect(storageContentAllowed(actorFor('office', 'warehouse', 'u9'), 'uploads/t1/u9/abc', [])).toBe(true);
    expect(storageContentAllowed(actorFor('owner', undefined, 'u1'), 'uploads/t1/u9/abc', [])).toBe(false);
    expect(storageContentAllowed(actorFor('owner', undefined, 'u1'), 'uploads/t2/u1/abc', [])).toBe(false);
  });

  it('an unknown prefix is refused to a narrowed role, owners keep today\'s record-based answer', () => {
    expect(storageContentAllowed(actorFor('office', 'sales'), 'exports/t1/report.csv', [orderDoc])).toBe(false);
    expect(storageContentAllowed(actorFor('owner'), 'exports/t1/report.csv', [orderDoc])).toBe(true);
    expect(storageContentAllowed(actorFor('owner'), 'backups/2026/x.gz', [])).toBe(false);
  });
});

// The route: the records it finds decide, refusal reads like a missing file.
const rows: Record<string, unknown[]> = {};
let access: (Access & { userId: string; tenantId: string; deactivated: boolean }) | null = null;
jest.mock('server-only', () => ({}));
jest.mock('@/lib/db', () => ({
  sql: jest.fn(async (strings: TemplateStringsArray) => {
    const text = strings.join('?');
    if (text.includes('FROM documents')) return rows.documents ?? [{ found: false }];
    if (text.includes('FROM order_documents')) return rows.order_documents ?? [{ found: false }];
    if (text.includes('FROM production_files')) return rows.production_files ?? [];
    return [];
  }),
}));
jest.mock('@/lib/db/schema-guard', () => ({ tableExists: jest.fn(async () => true) }));
jest.mock('@/lib/storage', () => ({
  validateStorageKey: (k: string) => { if (!k || k.startsWith('/')) throw new Error('bad'); return k; },
  readFile: jest.fn(async () => ({ body: new Blob(['%PDF']).stream(), contentType: 'application/pdf', size: 4 })),
}));
jest.mock('@/lib/features/work-orders/security', () => {
  class WorkOrderApiError extends Error { constructor(message: string, readonly status: number) { super(message); } }
  return { WorkOrderApiError, requireWorkOrderActor: jest.fn(async () => {
    if (!access) throw new WorkOrderApiError('Unauthorized', 401);
    return { userId: access.userId, tenantId: access.tenantId, role: access.base, access };
  }) };
});
jest.mock('@/lib/security/member-access.server', () => {
  const { DEFAULT_PRESET } = jest.requireActual('@/lib/security/access-matrix');
  return {
    resolveMemberAccess: jest.fn(async () => access),
    hiddenFieldsOf: (a: Access) => (a.roleKey === DEFAULT_PRESET[a.base] ? [] : a.hidden),
  };
});

import { GET } from '@/app/api/storage/content/route';

const fetchKey = (key: string) => GET(new NextRequest('https://renkflow.com/api/storage/content?key=' + encodeURIComponent(key)));
function signIn(base: UserRole, preset?: string) {
  access = { ...effectiveAccess(base, preset ? presetFor(preset) : null), userId: 'u1', tenantId, deactivated: false };
}

describe('GET /api/storage/content', () => {
  beforeEach(() => { for (const k of Object.keys(rows)) delete rows[k]; });

  it('serves an order document to the office and refuses it (404) to a role that hides prices', async () => {
    rows.documents = [{ found: true }];
    signIn('office');
    expect((await fetchKey('orders/o1/a.pdf')).status).toBe(200);
    signIn('office', 'planning');
    expect((await fetchKey('orders/o1/a.pdf')).status).toBe(404);
    signIn('office', 'warehouse');
    expect((await fetchKey('orders/o1/a.pdf')).status).toBe(404);
  });

  it('serves a finance document only with visible prices', async () => {
    rows.order_documents = [{ found: true }];
    signIn('accountant');
    expect((await fetchKey('orders/o1/invoice-a.pdf')).status).toBe(200);
    signIn('worker');
    expect((await fetchKey('orders/o1/invoice-a.pdf')).status).toBe(404);
  });

  it('keeps technical drawings working for production roles and the assigned worker', async () => {
    rows.production_files = [{ assigned: true }];
    signIn('worker');
    expect((await fetchKey('production/t1/d')).status).toBe(200);
    signIn('office', 'planning');
    expect((await fetchKey('production/t1/d')).status).toBe(200);
    rows.production_files = [{ assigned: false }];
    signIn('worker');
    expect((await fetchKey('production/t1/d')).status).toBe(404);
  });

  it('answers 401 without a session', async () => {
    access = null;
    expect((await fetchKey('orders/o1/a.pdf')).status).toBe(401);
  });
});
