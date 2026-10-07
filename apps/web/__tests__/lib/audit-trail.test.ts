/** @jest-environment node */
import { recordAudit, changedFields } from '@/lib/audit/audit-log';
import { AuditLogService } from '@/lib/features/analytics/auditLog.service';
import { GET as auditApi } from '@/app/api/audit/route';
import { getServerUserContext, AuthenticationError } from '@/lib/features/auth/serverAuth';
import { sql } from '@/lib/db';

jest.mock('server-only', () => ({}));
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-forwarded-for': '10.0.0.1, 10.0.0.2' }) }));
jest.mock('@/lib/features/auth/serverAuth', () => ({ ...jest.requireActual('@/lib/features/auth/serverAuth'), getServerUserContext: jest.fn() }));

type Query = { text: string; values: unknown[] };
const queries: Query[] = [];
jest.mock('@/lib/db', () => {
  const run = (strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = { text: strings.join('?'), values };
    const result = (async () => {
      queries.push(query);
      if (/COUNT\(\*\)::int AS total/.test(query.text)) return [{ total: 1 }];
      if (/FROM activity_logs a LEFT JOIN users/.test(query.text)) return [{ id: 'a1', action: 'created' }];
      return [];
    })();
    return Object.assign(result, { fragment: query });
  };
  return { sql: jest.fn(run) };
});

const tenantId = '22222222-2222-4222-8222-222222222222';
const userId = '11111111-1111-4111-8111-111111111111';
const insertValues = () => queries.find((q) => /INSERT INTO activity_logs/.test(q.text))?.values;

beforeEach(() => {
  queries.length = 0;
  (sql as unknown as jest.Mock).mockClear();
});

describe('recordAudit', () => {
  it('writes one activity_logs row through the client it is given (the open transaction)', async () => {
    const tx = jest.fn(async () => []);
    await recordAudit(tx, { tenantId, actorId: userId, entityType: 'order', entityId: userId, action: 'created', metadata: { orderNumber: 'RF-1' } });
    expect(tx).toHaveBeenCalledTimes(1);
    expect(sql).not.toHaveBeenCalled();
    const [strings, ...values] = (tx.mock.calls[0] as unknown) as [TemplateStringsArray, ...unknown[]];
    expect(strings.join('?')).toMatch(/INSERT INTO activity_logs/);
    expect(values).toEqual(expect.arrayContaining([tenantId, 'order', 'created', userId, JSON.stringify({ orderNumber: 'RF-1' })]));
  });

  it('records field changes only for keys that actually changed', () => {
    expect(changedFields({ status: 'new', notes: 'a', quantity: 2 }, { status: 'new', notes: 'b', quantity: undefined })).toEqual({ notes: { from: 'a', to: 'b' } });
  });
});

describe('AuditLogService (finance and QR callers)', () => {
  it('now lands in activity_logs, keeping a non-UUID reference in metadata', async () => {
    const ok = await AuditLogService.log({ tenantId, userId, userRole: 'owner', action: 'payment.batch_delete', entityType: 'payment', entityId: 'batch-7', oldValues: { count: 3 } });
    expect(ok).toBe(true);
    const values = insertValues()!;
    expect(values).toEqual(expect.arrayContaining([tenantId, 'payment', tenantId, 'payment.batch_delete', userId]));
    expect(JSON.parse(values.find((v) => typeof v === 'string' && v.includes('entityRef')) as string)).toMatchObject({ entityRef: 'batch-7', role: 'owner', ip: '10.0.0.1' });
  });

  it('keeps the recorded actor email and summarises in camelCase', async () => {
    await AuditLogService.log({ tenantId, userId, userEmail: 'a@example.invalid', action: 'payment.create', entityType: 'payment', entityId: userId });
    expect(JSON.parse(insertValues()!.find((v) => typeof v === 'string' && v.includes('email')) as string)).toMatchObject({ email: 'a@example.invalid' });
  });

  it('does not throw when the write fails', async () => {
    (sql as unknown as jest.Mock).mockImplementationOnce(() => Promise.reject(new Error('db down')));
    await expect(AuditLogService.log({ tenantId, action: 'order.qr_action.execute', entityType: 'order' })).resolves.toBe(false);
  });
});

describe('/api/audit', () => {
  const call = (query = '') => auditApi(new Request('http://x/api/audit' + query));
  it('is limited to owner and admin', async () => {
    for (const role of ['worker', 'office', 'accountant', 'member']) {
      (getServerUserContext as jest.Mock).mockResolvedValue({ userId, tenantId, role, email: '', name: '' });
      expect((await call()).status).toBe(403);
    }
    expect(queries.length).toBe(0);
  });

  it('includes the whole end day for a date-only end date', async () => {
    (getServerUserContext as jest.Mock).mockResolvedValue({ userId, tenantId, role: 'owner', email: '', name: '' });
    await call('?endDate=2026-10-06');
    const read = queries.find((q) => /FROM activity_logs a LEFT JOIN users/.test(q.text))!;
    expect(JSON.stringify(read.values)).toContain('2026-10-07T00:00:00.000Z');
  });

  it('reads the session firm only and validates filters', async () => {
    (getServerUserContext as jest.Mock).mockResolvedValue({ userId, tenantId, role: 'admin', email: '', name: '' });
    const response = await call('?entityType=order&limit=10');
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, total: 1, items: [{ id: 'a1' }] });
    const read = queries.find((q) => /FROM activity_logs a LEFT JOIN users/.test(q.text))!;
    expect(JSON.stringify(read.values)).toContain(tenantId);
    expect((await call('?entityId=not-a-uuid')).status).toBe(400);
  });

  it('returns 401 without a session', async () => {
    (getServerUserContext as jest.Mock).mockRejectedValue(new AuthenticationError());
    expect((await call()).status).toBe(401);
  });
});
