import { scoreCommand, scoreQuoteRequest, summarizeAssistant } from '../../evals/assistant-core';

describe('assistant eval scoring', () => {
  it('a value where none was expected is counted as made up', () => {
    const s = scoreQuoteRequest({ id: 'x', task: 'quote_request', input: '', expected: { lines: [{ family: 'awning', widthMm: 4000, projectionMm: 3000, color: null, quantity: 2 }] } },
      { customer: null, lines: [{ family: 'awning', widthMm: 4000, projectionMm: 3000, color: 'RAL 7016', quantity: 2 }] });
    expect([s.pass, s.fabricated]).toEqual([false, 1]);
  });
  it('an ambiguous command passes only when the reader asks back', () => {
    const c = { id: 'y', task: 'command' as const, input: 'teklif hazırla', expected: { ask: true } };
    expect(scoreCommand(c, { command: { intent: 'quote_draft' }, missing: ['ölçü'] }).pass).toBe(true);
    expect(scoreCommand(c, { command: { intent: 'quote_draft' }, missing: [] }).pass).toBe(false);
  });
  it('names compare case-insensitively (Turkish)', () => {
    const c = { id: 'z', task: 'command' as const, input: '', expected: { intent: 'quote_draft', customer: 'Selin' } };
    expect(scoreCommand(c, { command: { intent: 'quote_draft', customer: 'SELİN' }, missing: [] }).pass).toBe(true);
    expect(summarizeAssistant('rules', [scoreCommand(c, { command: { intent: 'quote_draft', customer: 'selin' }, missing: [] })]).total).toBe('1/1');
  });
});
