/** @jest-environment node */
const statements: Array<{ text: string; values: unknown[] }> = [];
const deleteFile = jest.fn(async () => {});
jest.mock('server-only', () => ({}));
jest.mock('@/lib/db', () => {
  const sql = jest.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join('?');
    statements.push({ text, values });
    if (text.startsWith('SELECT * FROM office_tasks')) return Promise.resolve([{ id: 'task-1', status: 'failed', revisions: 2, decision: {} }]);
    if (text.includes("WHERE tenant_id=? AND id=? AND status='failed' RETURNING revisions")) return Promise.resolve([{ revisions: 2 }]);
    if (text.startsWith('DELETE FROM office_files')) return Promise.resolve([{ storage_key: 'office/t1/task-1/r2-a-yarim.docx' }]);
    return Promise.resolve([]);
  });
  return { sql: Object.assign(sql, { json: (v: unknown) => v }), withTransaction: jest.fn() };
});
jest.mock('@/lib/storage', () => ({ readFile: jest.fn(), deleteFile: (...a: unknown[]) => deleteFile(...(a as [])) }));
jest.mock('@/lib/ai/service', () => ({ aiAvailable: () => true }));
jest.mock('@/lib/ai/gate.server', () => ({ getAiSettings: jest.fn() }));
jest.mock('@/lib/features/office/triage.server', () => ({ triage: jest.fn() }));
jest.mock('@/lib/features/work-orders/security', () => ({
  WorkOrderApiError: class extends Error { constructor(message: string, readonly status: number) { super(message); } },
}));

import { actOnOfficeTask } from '@/lib/features/office/service.server';

const actor = { tenantId: 't1', userId: 'u1', role: 'owner' as const };

it('retries a failed task as the same delivery: no new revision, the failed attempt’s files removed', async () => {
  expect(await actOnOfficeTask(actor, 'task-1', { action: 'retry' })).toEqual({ run: true });
  const update = statements.find(s => s.text.startsWith('UPDATE office_tasks'))!;
  expect(update.text).not.toContain('revisions=revisions+1');
  const removed = statements.find(s => s.text.startsWith('DELETE FROM office_files'))!;
  expect(removed.values).toEqual(['t1', 'task-1', 2]);
  expect(deleteFile).toHaveBeenCalledWith('office/t1/task-1/r2-a-yarim.docx');
});
