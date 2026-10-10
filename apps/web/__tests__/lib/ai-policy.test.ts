import { modelDecision } from '@/lib/ai/policy';

const base = { mode: 'assist' as const, kvkkAck: true, dailyBudgetUsd: 5, userDailyCalls: 10, spentTodayUsd: 1, userCallsToday: 2 };

describe('model gate', () => {
  it('assist within caps → allowed', () => expect(modelDecision(base)).toEqual({ ok: true }));
  it('off and rules-only never call a model', () => {
    expect(modelDecision({ ...base, mode: 'off' })).toEqual({ ok: false, block: 'AI_OFF' });
    expect(modelDecision({ ...base, mode: 'rules' })).toEqual({ ok: false, block: 'AI_RULES_ONLY' });
  });
  it('no model without the recorded KVKK confirmation', () => {
    expect(modelDecision({ ...base, kvkkAck: false })).toEqual({ ok: false, block: 'AI_KVKK' });
  });
  it('firm budget and personal daily calls', () => {
    expect(modelDecision({ ...base, spentTodayUsd: 5 })).toEqual({ ok: false, block: 'AI_BUDGET' });
    expect(modelDecision({ ...base, dailyBudgetUsd: null, spentTodayUsd: 999 })).toEqual({ ok: true });
    expect(modelDecision({ ...base, userCallsToday: 10 })).toEqual({ ok: false, block: 'AI_USER_LIMIT' });
  });
});
