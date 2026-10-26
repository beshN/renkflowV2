/** @jest-environment node */
import { ONBOARDING_STEP_KEYS } from '@/lib/analytics/event-schema';
import { anySignal, buildChecklist, canSeeChecklist, CHECKLIST_STEPS, dismissKey } from '@/lib/features/onboarding/checklist';

jest.mock('server-only', () => ({}));

const tenantId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
type Query = { text: string; values: unknown[] };
const queries: Query[] = [];
let answer: (text: string) => unknown = () => [{ done: false }];

jest.mock('@/lib/db', () => ({
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join('?');
    queries.push({ text, values });
    return (async () => {
      const result = answer(text);
      if (result instanceof Error) throw result;
      return result;
    })();
  },
}));

const none = { tenant_profile: false, workstation_setup: false, first_order_created: false, first_operator_invited: false, first_work_order_assigned: false };

describe('buildChecklist', () => {
  it('lists every onboarding step in order with a title, reason and link', () => {
    const list = buildChecklist(none)!;
    expect(list.steps.map((s) => s.key)).toEqual([...ONBOARDING_STEP_KEYS]);
    for (const step of list.steps) {
      expect(step.title).toBeTruthy();
      expect(step.why).toBeTruthy();
      expect(step.href.startsWith('/')).toBe(true);
    }
    expect(list).toMatchObject({ completed: 0, total: 5, allDone: false });
  });

  it('counts data-derived and recorded steps as done', () => {
    const list = buildChecklist({ ...none, first_order_created: true }, ['tenant_profile'])!;
    expect(list.steps.filter((s) => s.done).map((s) => s.key)).toEqual(['tenant_profile', 'first_order_created']);
    expect(list.completed).toBe(2);
  });

  it('ignores unknown recorded keys and treats unknown signals as not done', () => {
    const list = buildChecklist({ ...none, workstation_setup: null }, ['something_else'])!;
    expect(list.completed).toBe(0);
  });

  it('is all done when every step is done', () => {
    const all = Object.fromEntries(ONBOARDING_STEP_KEYS.map((k) => [k, true]));
    expect(buildChecklist(all)).toMatchObject({ completed: 5, allDone: true });
  });

  it('returns null when nothing could be read, so no card is shown', () => {
    const unknown = Object.fromEntries(ONBOARDING_STEP_KEYS.map((k) => [k, null]));
    expect(buildChecklist(unknown)).toBeNull();
    expect(buildChecklist({})).toBeNull();
    expect(buildChecklist(unknown, ['first_order_created'])?.completed).toBe(1);
  });
});

describe('helpers', () => {
  it('shows the card to owners and admins only', () => {
    expect(canSeeChecklist('owner')).toBe(true);
    expect(canSeeChecklist('admin')).toBe(true);
    for (const role of ['office', 'worker', 'member', 'accountant', undefined, null]) expect(canSeeChecklist(role)).toBe(false);
  });

  it('combines signals: true wins, unknown only when all are unknown', () => {
    expect(anySignal(false, true)).toBe(true);
    expect(anySignal(null, false)).toBe(false);
    expect(anySignal(null, null)).toBeNull();
  });

  it('keeps dismissal per user and firm', () => {
    expect(dismissKey('u1', 't1')).not.toBe(dismissKey('u2', 't1'));
    expect(dismissKey('u1', 't1')).not.toBe(dismissKey('u1', 't2'));
  });

  it('links each step to an existing page', () => {
    expect(CHECKLIST_STEPS.first_order_created.href).toBe('/new-order');
    expect(CHECKLIST_STEPS.first_operator_invited.href).toBe('/team');
  });
});

describe('getOnboardingChecklist', () => {
  beforeEach(() => { queries.length = 0; });

  it('derives steps from the firm records, scoped to the tenant', async () => {
    const { getOnboardingChecklist } = await import('@/lib/features/onboarding/checklist.server');
    answer = (text) => {
      if (/FROM orders/.test(text)) return [{ done: true }];
      if (/FROM tenant_members/.test(text)) return [{ done: false }];
      if (/FROM invitations/.test(text)) return [{ done: true }];
      if (/FROM onboarding_steps/.test(text)) return [{ step_key: 'tenant_profile' }];
      return [{ done: false }];
    };
    const list = await getOnboardingChecklist(tenantId);
    expect(list?.steps.filter((s) => s.done).map((s) => s.key)).toEqual(['tenant_profile', 'first_order_created', 'first_operator_invited']);
    expect(queries.length).toBeGreaterThan(0);
    for (const q of queries) {
      expect(q.values).toContain(tenantId);
      expect(q.text).not.toMatch(/\b(insert|update|delete)\b/i);
    }
  });

  it('survives missing tables: failed reads count as unknown', async () => {
    const { getOnboardingChecklist } = await import('@/lib/features/onboarding/checklist.server');
    answer = (text) => (/FROM work_orders|FROM onboarding_steps|FROM invitations/.test(text) ? new Error('relation does not exist') : [{ done: false }]);
    const list = await getOnboardingChecklist(tenantId);
    expect(list).toMatchObject({ completed: 0, total: 5 });
  });

  it('returns null when every read fails', async () => {
    const { getOnboardingChecklist } = await import('@/lib/features/onboarding/checklist.server');
    answer = () => new Error('db down');
    await expect(getOnboardingChecklist(tenantId)).resolves.toBeNull();
  });
});
