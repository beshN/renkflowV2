/**
 * @jest-environment node
 *
 * AI office deliveries carry what the task giver could see: a narrowed colleague does not get the
 * task (brief, summary, files) unless cleared for every marker the task carries.
 */
import { briefSensitivity, foundSensitivity, mergeSensitivity, officeTaskVisible } from '@/lib/features/office/sensitivity';

describe('office task sensitivity', () => {
  it('marks finance work and finance words in the brief', () => {
    expect(briefSensitivity('spreadsheet', 'Gider tablosu')).toEqual(['finance']);
    expect(briefSensitivity('data', 'x')).toEqual(['finance']);
    expect(briefSensitivity('document', 'Bu ayın kâr ve maliyet raporu')).toEqual(['finance']);
    expect(briefSensitivity('correspondence', 'Müşteriye teşekkür mektubu')).toEqual([]);
  });

  it('marks the kinds of fields the lookups returned', () => {
    expect(foundSensitivity('orders', [{ order_number: 'S-1', total_amount: 1200 }])).toEqual(['finance', 'price']);
    expect(foundSensitivity('jobs', [{ title: 'Kesim', unit_cost: 3 }])).toEqual(['finance', 'cost']);
    expect(foundSensitivity('customers', [{ full_name: 'A', phone: '0555' }])).toEqual(['customer_contact']);
    expect(foundSensitivity('employees', [{ name: 'A' }])).toEqual(['finance']);
    expect(foundSensitivity('materials', { items: [{ name: 'Profil', phone: null }], total: 3 })).toEqual([]);
    expect(mergeSensitivity(['price'], null, ['finance', 'price'])).toEqual(['finance', 'price']);
  });

  const ownerTask = { createdBy: 'owner', sensitivity: ['finance', 'price', 'profit'] };
  it('shows a finance delivery to its giver, owners and admins, and members who see all money fields', () => {
    expect(officeTaskVisible({ userId: 'owner', role: 'owner', hidden: [] }, ownerTask)).toBe(true);
    expect(officeTaskVisible({ userId: 'a', role: 'admin', hidden: [] }, ownerTask)).toBe(true);
    expect(officeTaskVisible({ userId: 'o', role: 'office', hidden: [] }, ownerTask)).toBe(true);
    expect(officeTaskVisible({ userId: 'o', role: 'office', hidden: ['cost', 'profit'] }, ownerTask)).toBe(false); // sales
    expect(officeTaskVisible({ userId: 'o', role: 'office', hidden: ['price', 'profit'] }, ownerTask)).toBe(false); // planning
    // The giver sees their own task even with a narrowed role.
    expect(officeTaskVisible({ userId: 'o', role: 'office', hidden: ['price'] }, { createdBy: 'o', sensitivity: null })).toBe(true);
  });

  it('shows a task without sensitive markers to everyone, and an unknown one only to roles hiding nothing', () => {
    expect(officeTaskVisible({ userId: 'o', role: 'office', hidden: ['price', 'cost', 'profit', 'customer_contact'] }, { createdBy: 'x', sensitivity: [] })).toBe(true);
    expect(officeTaskVisible({ userId: 'o', role: 'office', hidden: ['cost'] }, { createdBy: 'x', sensitivity: null })).toBe(false);
    expect(officeTaskVisible({ userId: 'o', role: 'office', hidden: [] }, { createdBy: 'x', sensitivity: null })).toBe(true);
    expect(officeTaskVisible({ userId: 'o', role: 'office', hidden: ['customer_contact'] }, { createdBy: 'x', sensitivity: ['finance'] })).toBe(true);
    expect(officeTaskVisible({ userId: 'o', role: 'office', hidden: ['customer_contact'] }, { createdBy: 'x', sensitivity: ['customer_contact'] })).toBe(false);
  });
});

// The service: list and file download apply the same rule.
const tasks = [
  { id: 'task-own', number: 1, created_by: 'sales-user', sensitivity: ['finance'], brief: 'kendi', summary: 's', decision: {}, revisions: 0, notes: [], created_at: new Date() },
  { id: 'task-fin', number: 2, created_by: 'owner-user', sensitivity: ['finance', 'profit'], brief: 'Kâr analizi', summary: 'gizli', decision: {}, revisions: 0, notes: [], created_at: new Date() },
  { id: 'task-plain', number: 3, created_by: 'owner-user', sensitivity: [], brief: 'Mektup', summary: 'ok', decision: {}, revisions: 0, notes: [], created_at: new Date() },
  { id: 'task-old', number: 4, created_by: 'owner-user', brief: 'eski', summary: 'eski', decision: {}, revisions: 0, notes: [], created_at: new Date() },
];
const fileRows: Record<string, Record<string, unknown>> = {
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1': { file_name: 'kar.xlsx', content_type: 'x', storage_key: 'office/t1/task-fin/a', created_by: 'owner-user', sensitivity: ['finance', 'profit'] },
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2': { file_name: 'mektup.txt', content_type: 'text/plain', storage_key: 'office/t1/task-plain/b', created_by: 'owner-user', sensitivity: [] },
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3': { file_name: 'eski.docx', content_type: 'x', storage_key: 'office/t1/task-old/c', created_by: 'owner-user', sensitivity: null },
};
jest.mock('server-only', () => ({}));
jest.mock('@/lib/db', () => ({
  sql: Object.assign(jest.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join('?');
    if (text.startsWith('SELECT * FROM office_tasks WHERE tenant_id=? ORDER BY')) return [...tasks];
    if (text.startsWith('SELECT * FROM office_tasks WHERE tenant_id=? AND id=?')) return tasks.filter((t) => t.id === values[1]);
    if (text.includes('FROM office_files f JOIN office_tasks t')) return fileRows[String(values[1])] ? [fileRows[String(values[1])]] : [];
    return [];
  }), { json: (v: unknown) => v }),
  withTransaction: jest.fn(),
}));
jest.mock('@/lib/db/schema-guard', () => ({ tableExists: jest.fn(async () => true), columnExists: jest.fn(async () => true) }));
jest.mock('@/lib/storage', () => ({ readFile: jest.fn(async () => ({ body: null, size: 1 })), deleteFile: jest.fn() }));
jest.mock('@/lib/ai/service', () => ({ aiAvailable: () => true }));
jest.mock('@/lib/ai/gate.server', () => ({ getAiSettings: jest.fn() }));
jest.mock('@/lib/ai/policy', () => ({ modelConfigurationBlock: () => null, modelUnavailableMessage: () => '' }));
jest.mock('@/lib/features/office/triage.server', () => ({ triage: jest.fn() }));
jest.mock('@/lib/security/member-access.server', () => ({ resolveMemberAccess: jest.fn(async () => null) }));
jest.mock('@/lib/features/work-orders/security', () => ({
  WorkOrderApiError: class extends Error { constructor(message: string, readonly status: number) { super(message); } },
}));

import { actOnOfficeTask, listOfficeTasks, readOfficeFile } from '@/lib/features/office/service.server';
import { effectiveAccess, presetFor } from '@/lib/security/access-matrix';

const sales = { tenantId: 't1', userId: 'sales-user', role: 'office' as const, access: effectiveAccess('office', presetFor('sales')) };
const office = { tenantId: 't1', userId: 'office-user', role: 'office' as const, access: effectiveAccess('office', null) };
const owner = { tenantId: 't1', userId: 'owner-user', role: 'owner' as const };

describe('office service visibility', () => {
  it('lists to a narrowed member only their own tasks and tasks without sensitive markers', async () => {
    expect((await listOfficeTasks(sales)).tasks.map((t) => t.id).sort()).toEqual(['task-own', 'task-plain']);
    expect((await listOfficeTasks(office)).tasks.map((t) => t.id).sort()).toEqual(['task-fin', 'task-old', 'task-own', 'task-plain']);
    expect((await listOfficeTasks(owner)).tasks).toHaveLength(4);
  });

  it('refuses the files and actions of a hidden task as if they did not exist', async () => {
    await expect(readOfficeFile(sales, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1')).rejects.toMatchObject({ status: 404 });
    await expect(readOfficeFile(sales, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3')).rejects.toMatchObject({ status: 404 });
    await expect(readOfficeFile(sales, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2')).resolves.toMatchObject({ name: 'mektup.txt' });
    await expect(readOfficeFile(owner, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1')).resolves.toMatchObject({ name: 'kar.xlsx' });
    await expect(actOnOfficeTask(sales, 'task-fin', { action: 'approve' })).rejects.toMatchObject({ status: 404 });
  });

  it('treats a member whose access cannot be read as hiding everything', async () => {
    const unknown = { tenantId: 't1', userId: 'someone', role: 'office' as const };
    expect((await listOfficeTasks(unknown)).tasks.map((t) => t.id)).toEqual(['task-plain']);
  });
});
