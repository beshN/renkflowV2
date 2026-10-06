/** @jest-environment node */
import { createWorkOrder, updateWorkOrder, CreateWorkOrderInputSchema, UpdateWorkOrderInputSchema } from '@/lib/features/work-orders/service';
import { sql, withTransaction } from '@/lib/db';

jest.mock('server-only', () => ({}));
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/features/manufacturing/manufacturing.service', () => ({ createProductionWorkOrder: jest.fn() }));
// The pooled client is a separate connection: it only ever sees the committed (old) row.
jest.mock('@/lib/db', () => ({ sql: jest.fn(), withTransaction: jest.fn() }));

const actor = { userId: '11111111-1111-4111-8111-111111111111', tenantId: '22222222-2222-4222-8222-222222222222', role: 'owner' as const };
const workOrderId = '33333333-3333-4333-8333-333333333333';

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: workOrderId, tenant_id: actor.tenantId, title: 'Eski başlık', description: null, category: 'cutting',
    status: 'open', priority: 'medium', location: null, asset_tag: null, due_at: null, completed_at: null,
    estimated_minutes: null, actual_minutes: null, blocked_reason_category: null, blocked_reason_detail: null, blocked_at: null,
    source: 'manual', created_by: actor.userId, assigned_to: null, assignee_name: null, creator_name: 'Test',
    checklist_total: 0, checklist_completed: 0, comment_total: 0, bom_id: null, revision: 1,
    created_at: new Date('2026-10-06T10:00:00Z'), updated_at: new Date('2026-10-06T10:00:00Z'), ...overrides,
  };
}

/** Transaction client that sees its own writes; the pooled `sql` only sees what existed before it. */
function openTransaction(options: { existing?: boolean; maxChecklistPosition?: number } = {}) {
  let current: ReturnType<typeof row> | null = options.existing ? row() : null;
  const checklistPositions: unknown[] = [];
  const tx = jest.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join('?');
    if (/INSERT INTO work_orders/.test(text)) { current = row({ title: values[1] }); return [{ id: workOrderId }]; }
    if (/UPDATE work_orders/.test(text)) { current = row({ title: 'Yeni başlık' }); return [{ id: workOrderId }]; }
    if (/MAX\(position\)/.test(text)) return [{ max_position: options.maxChecklistPosition ?? -1 }];
    if (/INSERT INTO work_order_checklist_items/.test(text)) { checklistPositions.push(values[4]); return []; }
    if (/FROM work_orders/.test(text)) return current ? [current] : [];
    return [];
  });
  (withTransaction as jest.Mock).mockImplementation((fn) => fn(tx));
  (sql as unknown as jest.Mock).mockResolvedValue(options.existing ? [row()] : []);
  return { tx, checklistPositions };
}

beforeEach(() => jest.clearAllMocks());

it('returns the created work order by reading it inside the same transaction', async () => {
  openTransaction();
  const created = await createWorkOrder(actor, CreateWorkOrderInputSchema.parse({ title: '200 adet 108 profil kesimi', category: 'cutting' }));
  expect(created).toMatchObject({ id: workOrderId, title: '200 adet 108 profil kesimi', status: 'open' });
  expect(sql).not.toHaveBeenCalled();
});

it('returns the updated work order, not the version committed before the update', async () => {
  openTransaction({ existing: true });
  const updated = await updateWorkOrder(actor, workOrderId, UpdateWorkOrderInputSchema.parse({ title: 'Yeni başlık' }));
  expect(updated.title).toBe('Yeni başlık');
});

it('appends checklist items after an existing item at position 0', async () => {
  const { checklistPositions } = openTransaction({ existing: true, maxChecklistPosition: 0 });
  await updateWorkOrder(actor, workOrderId, UpdateWorkOrderInputSchema.parse({ appendChecklistItems: [{ title: 'Delik kontrolü' }, { title: 'Ölçü kontrolü' }] }));
  expect(checklistPositions).toEqual([1, 2]);
});
