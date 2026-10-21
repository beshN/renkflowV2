/** @jest-environment node */
jest.mock('server-only', () => ({}));
jest.mock('@/lib/ai/usage', () => ({ withUsage: (_meta: unknown, _provider: unknown, _model: unknown, call: () => unknown) => call() }));
import { produceOpenCode, openCodeCall } from '@/lib/features/office/opencode.server';
import { OPENCODE_MODELS, decide, openCodeDecision } from '@/lib/features/office/routing';
const task = { category: 'correspondence' as const, title: 'E-posta', brief: 'ali@example.com adresine yaz', agentId: 'selin', answers: [], notes: [], revision: 0 };
const originalFetch = global.fetch;
beforeEach(() => { process.env.OPENCODE_API_KEY = 'test'; });
afterEach(() => { global.fetch = originalFetch; delete process.env.OPENCODE_API_KEY; });
function response(value: unknown) { global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ finish_reason: 'tool_calls', message: { tool_calls: [{ function: { name: 'teslim_et', arguments: JSON.stringify(value) } }] } }], usage: { prompt_tokens: 10, completion_tokens: 20 } }) }); }
it('uses the requested specialist and preserves the free-model allowlist', () => {
  const d = decide({ category: 'spreadsheet', title: 'Gider', brief: '', revisions: 0 });
  expect(openCodeDecision(d, 'spreadsheet').model.id).toBe(OPENCODE_MODELS.finance.id);
  expect(openCodeDecision(d, 'document').model.id).toBe(OPENCODE_MODELS.documents.id);
});
it('masks input, restores actual placeholders, and returns real bytes', async () => {
  response({ question: '', summary: 'Hazır.', files: [{ name: 'posta.txt', format: 'txt', content: 'Alıcı: [E-POSTA_1]' }] });
  const result = await produceOpenCode(task, OPENCODE_MODELS.reviewer.id, { feature: 'office' }, AbortSignal.timeout(1000));
  expect(result.files[0].bytes.toString()).toContain('ali@example.com');
  const request = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
  expect(request.messages[1].content).not.toContain('ali@example.com');
});
it('rejects missing delivery instead of claiming success', async () => {
  response({ question: '', summary: 'Bitti', files: [] });
  await expect(produceOpenCode(task, OPENCODE_MODELS.reviewer.id, { feature: 'office' }, AbortSignal.timeout(1000))).rejects.toThrow();
});
it('rejects active SVG content', async () => {
  response({ question: '', summary: 'Hazır.', files: [{ name: 'x.svg', format: 'svg', content: '<svg onload="alert(1)"></svg>' }] });
  await expect(produceOpenCode(task, OPENCODE_MODELS.reviewer.id, { feature: 'office' }, AbortSignal.timeout(1000))).rejects.toThrow('statik SVG');
});
it('does not silently switch to a paid or arbitrary model', async () => {
  await expect(openCodeCall('', '', { name: 'x', description: '', parameters: {} }, 'unapproved', { feature: 'office' }, AbortSignal.timeout(1000))).rejects.toThrow('izin listesinde');
});
