jest.mock('server-only', () => ({}));
let settings: Record<string, unknown> | null;
let usage: Record<string, number>;
let schema = true;
jest.mock('@/lib/db/schema-guard', () => ({ tableExists: jest.fn(async () => schema) }));
jest.mock('@/lib/db', () => ({ sql: jest.fn(async (parts: TemplateStringsArray) => parts.join(' ').includes('FROM ai_settings') ? (settings ? [settings] : []) : [usage]) }));

import { assertModelAllowed, forgetAiSettings, getAiSettings } from '@/lib/ai/gate.server';
import { withUsage } from '@/lib/ai/usage';

beforeEach(() => {
  forgetAiSettings('consent-test');
  schema = true;
  settings = { mode: 'assist', kvkk_ack_at: '2026-10-12T00:00:00Z', daily_budget_usd: 5, user_daily_calls: 10, detectors: {}, features: {} };
  usage = { spent: 0, mine: 0, unknown: 0 };
});
const actor = { tenantId: 'consent-test', userId: 'user-test' };

it('missing schema and missing settings never imply consent', async () => {
  schema = false;
  await expect(assertModelAllowed(actor)).rejects.toMatchObject({ block: 'AI_RULES_ONLY' });
  forgetAiSettings(actor.tenantId); schema = true; settings = null;
  await expect(assertModelAllowed(actor)).rejects.toMatchObject({ block: 'AI_RULES_ONLY' });
});
it('requires recorded consent and enforces daily spend and user limits', async () => {
  settings!.kvkk_ack_at = null;
  await expect(assertModelAllowed(actor)).rejects.toMatchObject({ block: 'AI_KVKK' });
  forgetAiSettings(actor.tenantId); settings!.kvkk_ack_at = '2026-10-12T00:00:00Z'; usage.spent = 5;
  await expect(assertModelAllowed(actor)).rejects.toMatchObject({ block: 'AI_BUDGET' });
  usage.spent = 0; usage.mine = 10;
  await expect(assertModelAllowed(actor)).rejects.toMatchObject({ block: 'AI_USER_LIMIT' });
});
it('does not silently ignore usage records whose cost is unknown', async () => {
  usage.unknown = 1;
  await expect(assertModelAllowed(actor)).rejects.toMatchObject({ block: 'AI_PRICE_UNKNOWN' });
});
it('never calls a provider with an unpriced model when a spend budget is configured', async () => {
  const call = jest.fn(async () => ({ usage: { input_tokens: 1, output_tokens: 1 } }));
  await expect(withUsage({ ...actor, feature: 'test' }, 'openai', 'unpriced-test-model', call)).rejects.toMatchObject({ block: 'AI_PRICE_UNKNOWN' });
  expect(call).not.toHaveBeenCalled();
});

it('rechecks a switched-off firm even when the UI recently cached assist mode', async () => {
  await getAiSettings(actor.tenantId);
  settings!.mode = 'off';
  await expect(assertModelAllowed(actor)).rejects.toMatchObject({ block: 'AI_OFF' });
});
