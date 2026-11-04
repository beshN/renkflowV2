/**
 * @jest-environment node
 *
 * recordError: one error shape for the record APIs.
 *  - ZodError -> 400, keeps `error: 'Geçersiz istek'`, adds first message and unique field paths,
 *    never echoes the submitted value,
 *  - SyntaxError (broken JSON) -> 400 with no fields,
 *  - WorkOrderApiError keeps its own status and code.
 */
jest.mock('server-only', () => ({}));
jest.mock('@/lib/db', () => ({ sql: jest.fn() }));
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/security/member-access.server', () => ({ resolveMemberAccess: jest.fn(), mfaSetupPending: jest.fn() }));

import { z } from 'zod';
import { recordError } from '@/lib/features/records/http';
import { WorkOrderApiError } from '@/lib/features/work-orders/security';

describe('recordError', () => {
  it('returns 400 with field paths for a ZodError', async () => {
    const schema = z.object({ name: z.string().min(2), lines: z.array(z.object({ qty: z.number() })) });
    const parsed = schema.safeParse({ name: 'x', lines: [{ qty: 'gizli-deger' }] });
    expect(parsed.success).toBe(false);
    const res = recordError(parsed.error, 'test');
    expect(res.status).toBe(400);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    const body = await res.json();
    expect(body.error).toBe('Geçersiz istek');
    expect(typeof body.message).toBe('string');
    expect(body.fields).toEqual(expect.arrayContaining(['name', 'lines.0.qty']));
    expect(new Set(body.fields).size).toBe(body.fields.length);
    expect(JSON.stringify(body)).not.toContain('gizli-deger');
  });

  it('deduplicates repeated paths', async () => {
    const schema = z.object({ code: z.string().min(3).regex(/^[A-Z]+$/) });
    const parsed = schema.safeParse({ code: 'a' });
    expect(parsed.success).toBe(false);
    const body = await recordError(parsed.error, 'test').json();
    expect(body.fields).toEqual(['code']);
  });

  it('keeps SyntaxError at 400 without fields', async () => {
    const res = recordError(new SyntaxError('Unexpected token'), 'test');
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Geçersiz istek' });
  });

  it('keeps the WorkOrderApiError status and code', async () => {
    const res = recordError(new WorkOrderApiError('Yetkiniz yok', 403, 'forbidden'), 'test');
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Yetkiniz yok', code: 'forbidden' });
  });
});
