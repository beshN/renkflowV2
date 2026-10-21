/** @jest-environment node */
jest.mock('server-only', () => ({}));
const parse = jest.fn();
jest.mock('@anthropic-ai/sdk', () => ({ __esModule: true, default: jest.fn().mockImplementation(() => ({ messages: { parse } })) }));
jest.mock('@/lib/ai/usage', () => ({ withUsage: (_meta: unknown, _provider: unknown, _model: unknown, call: () => unknown) => call(), costUsd: () => 0.002 }));
import { reviewDelivery } from '@/lib/features/office/review.server';
import type { TaskInput } from '@/lib/features/office/work';
const task: TaskInput = { category: 'spreadsheet', title: 'Giderler', brief: 'Kira 20000, maaş 9000, internet 600. Toplam?', agentId: 'murat', answers: [], notes: [], revision: 0 };
const files = [{ name: 'gider.csv', contentType: 'text/csv', bytes: Buffer.from('Kalem,Tutar\nToplam,29000') }];
beforeEach(() => { delete process.env.OFFICE_PROVIDER; process.env.ANTHROPIC_API_KEY = 'test'; parse.mockReset(); });
it('passes actual content and the brief to the independent checker', async () => {
  parse.mockResolvedValue({ parsed_output: { approve: false, score: 5, note: 'Toplam 29600 olmalı.', issues: ['İnternet eksik.'], suggestions: [] } });
  const result = await reviewDelivery(task, files, { feature: 'office_review' }, AbortSignal.timeout(1000));
  expect(result.review.status).toBe('changes_requested');
  expect(parse.mock.calls[0][0].messages[0].content[0].text).toContain('29000');
  expect(parse.mock.calls[0][0].messages[0].content[0].text).toContain('internet 600');
});
it.each([
  { approve: true, score: 6, note: 'Eksik.', issues: [], suggestions: [] },
  { approve: true, score: 9, note: 'Kontrol.', issues: ['Eksik.'], suggestions: [] },
])('does not accept inconsistent approval: %p', async verdict => {
  parse.mockResolvedValue({ parsed_output: verdict });
  expect((await reviewDelivery(task, files, { feature: 'office_review' }, AbortSignal.timeout(1000))).review.status).toBe('changes_requested');
});
it('shows unavailable review rather than a false approval', async () => {
  parse.mockRejectedValue(new Error('offline'));
  expect((await reviewDelivery(task, files, { feature: 'office_review' }, AbortSignal.timeout(1000))).review.status).toBe('needs_human');
});
it('accepts a complete, valid approval while leaving final approval to the user', async () => {
  parse.mockResolvedValue({ parsed_output: { approve: true, score: 9, note: 'Doğru.', issues: [], suggestions: [] } });
  expect((await reviewDelivery(task, files, { feature: 'office_review' }, AbortSignal.timeout(1000))).review.status).toBe('approved');
});

it('passes good work with small suggestions instead of sending it back', async () => {
  parse.mockResolvedValue({ parsed_output: { approve: true, score: 7, note: 'Doğru, kullanılabilir.', issues: [], suggestions: ['Başlık kalın olabilir.'] } });
  const { review } = await reviewDelivery(task, files, { feature: 'office_review' }, AbortSignal.timeout(1000));
  expect(review).toMatchObject({ status: 'approved', issues: [], suggestions: ['Başlık kalın olabilir.'] });
});

it('reads a verdict that leaves out suggestions as having none', async () => {
  parse.mockResolvedValue({ parsed_output: { approve: false, score: 5, note: 'Toplam yanlış.', issues: ['Toplam 29600 olmalı.'] } });
  const { review } = await reviewDelivery(task, files, { feature: 'office_review' }, AbortSignal.timeout(1000));
  expect(review).toMatchObject({ status: 'changes_requested', suggestions: [] });
});
