/** @jest-environment node */
const events: string[] = [];
const reserve = jest.fn();
const release = jest.fn();
jest.mock('@/lib/ai/gate.server', () => ({
  reserveModelCall: (...args: unknown[]) => reserve(...args),
  releaseModelReservation: (...args: unknown[]) => release(...args),
}));
jest.mock('@/lib/db', () => ({
  sql: jest.fn(async (strings: TemplateStringsArray) => {
    if (strings.join('?').includes('INSERT INTO ai_usage')) events.push('usage');
    return [];
  }),
}));

import { ModelBlockedError } from '@/lib/ai/policy';
import { approxInputTokens, defaultEstimate, estimateCallCostUsd, UNKNOWN_MODEL_PRICE, withUsage } from '@/lib/ai/usage';

const meta = { tenantId: 't1', userId: 'u1', feature: 'assistant' };

beforeEach(() => {
  events.length = 0;
  reserve.mockReset().mockImplementation(async () => { events.push('reserve'); return { id: 'r1', tenantId: 't1' }; });
  release.mockReset().mockImplementation(async () => { events.push('release'); });
});

describe('call cost estimate (reserved before the call)', () => {
  it('max output tokens × output price + input × input price', () => {
    // claude-sonnet-5-5: 2 / 10 USD per Mtok.
    expect(estimateCallCostUsd('claude-sonnet-5-5', { maxOutputTokens: 8000, inputTokens: 10_000 })).toBeCloseTo(0.1, 6);
    expect(estimateCallCostUsd('glm-5.3-flash-free', { maxOutputTokens: 16_000 })).toBe(0);
  });
  it('an unknown price uses the conservative default instead of zero', () => {
    const cost = estimateCallCostUsd('gpt-unknown', { maxOutputTokens: 1000, inputTokens: 1000 });
    expect(cost).toBeCloseTo((1000 * UNKNOWN_MODEL_PRICE.input + 1000 * UNKNOWN_MODEL_PRICE.output) / 1e6, 6);
    expect(cost).toBeGreaterThan(0);
  });
  it('defaults when the caller gives no sizes; web searches add their price', () => {
    expect(estimateCallCostUsd('claude-sonnet-5-5')).toBeGreaterThan(0.05);
    expect(estimateCallCostUsd('claude-sonnet-5-5', { maxOutputTokens: 0, inputTokens: 0, webSearches: 5 })).toBeCloseTo(0.05, 6);
    expect(defaultEstimate('office').maxOutputTokens).toBe(32_000);
    expect(defaultEstimate('unknown')).toEqual({});
  });
  it('base64 bodies count a fixed amount, not their length', () => {
    const doc = { type: 'document', source: { type: 'base64', data: 'A'.repeat(3_000_000) } };
    expect(approxInputTokens(doc)).toBeLessThan(10_000);
    expect(approxInputTokens('x'.repeat(3000))).toBeGreaterThanOrEqual(1000);
  });
});

describe('withUsage reserves before the provider and reconciles after it', () => {
  it('reserve → call → usage row → release, with the estimate', async () => {
    const result = await withUsage(meta, 'anthropic', 'claude-sonnet-5-5', async () => {
      events.push('call');
      return { usage: { input_tokens: 10, output_tokens: 5 } };
    }, { maxOutputTokens: 1000, inputTokens: 0 });
    expect(result.usage?.output_tokens).toBe(5);
    expect(events).toEqual(['reserve', 'call', 'usage', 'release']);
    expect(reserve).toHaveBeenCalledWith(meta, { model: 'claude-sonnet-5-5', estimateUsd: 0.01 });
    expect(release).toHaveBeenCalledWith({ id: 'r1', tenantId: 't1' });
  });
  it('a provider error still records the usage and releases the reservation', async () => {
    await expect(withUsage(meta, 'anthropic', 'claude-sonnet-5-5', async () => {
      events.push('call');
      throw Object.assign(new Error('boom'), { status: 529 });
    })).rejects.toThrow('boom');
    expect(events).toEqual(['reserve', 'call', 'usage', 'release']);
  });
  it('a refused reservation never reaches the provider', async () => {
    reserve.mockImplementation(async () => { throw new ModelBlockedError('AI_USER_LIMIT'); });
    const call = jest.fn();
    await expect(withUsage(meta, 'anthropic', 'claude-sonnet-5-5', call)).rejects.toBeInstanceOf(ModelBlockedError);
    expect(call).not.toHaveBeenCalled();
    expect(release).not.toHaveBeenCalled();
  });
  it('calls without a firm are not gated', async () => {
    await withUsage({ feature: 'eval' }, 'anthropic', 'claude-sonnet-5-5', async () => ({ usage: null }));
    expect(reserve).not.toHaveBeenCalled();
  });
  it('the office runner gets its own, larger default estimate', async () => {
    await withUsage({ ...meta, feature: 'office' }, 'anthropic', 'claude-sonnet-5-5', async () => ({ usage: null }));
    expect(reserve.mock.calls[0][1].estimateUsd).toBeCloseTo(estimateCallCostUsd('claude-sonnet-5-5', { maxOutputTokens: 32_000, inputTokens: 60_000 }), 6);
  });
});
