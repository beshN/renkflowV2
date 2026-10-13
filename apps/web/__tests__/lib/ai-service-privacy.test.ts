/** @jest-environment node */
const sent: unknown[] = [];
const ECHO = { echo: true };
let reply: Record<string, unknown> = {};
jest.mock('server-only', () => ({}));
jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: {
      parse: jest.fn(async (request: { messages?: Array<{ role?: string; content?: unknown }> }) => {
        // Serialized now: the service keeps appending to the same messages array.
        sent.push(JSON.parse(JSON.stringify(request)));
        // Echo mode: the "model" answers with the (masked) user message it received.
        const lastUser = [...(request.messages ?? [])].reverse().find((item) => item.role === 'user')?.content;
        const parsed = reply === ECHO ? { answer: lastUser, suggestions: [], actions: [] } : reply;
        return { stop_reason: 'end_turn', content: [], parsed_output: parsed, usage: { input_tokens: 1200, output_tokens: 300 } };
      }),
    },
  })),
}));
jest.mock('@anthropic-ai/sdk/helpers/zod', () => ({ zodOutputFormat: () => ({ type: 'json_schema' }) }));
const usageRows: unknown[][] = [];
jest.mock('@/lib/db', () => ({ sql: jest.fn((_s: TemplateStringsArray, ...values: unknown[]) => { usageRows.push(values); return Promise.resolve([]); }) }));

import { AIService } from '@/lib/ai/service';

const PII = ['Örnek Yapı', 'ÖRNEK YAPI', 'Ayşe Demir', 'ayse@ornek.com', '532 111 22 33', 'Atatürk Cad. No:5'];

beforeEach(() => {
  sent.length = 0;
  usageRows.length = 0;
  process.env.ANTHROPIC_API_KEY = 'test-key';
  delete process.env.AI_PROVIDER;
  delete process.env.ANTHROPIC_MODEL;
  process.env.AI_MODEL_PRICES_USD_PER_MTOK = JSON.stringify({ 'claude-sonnet-5-5': { input: 1, output: 10 } });
});

it('sends the assistant no customer names, contacts or addresses, and restores them in the reply', async () => {
  reply = ECHO;
  const data = { orders: [{ orderNumber: 'RF-1042', customerName: 'Örnek Yapı', contactName: 'Ayşe Demir', email: 'ayse@ornek.com', phone: '0532 111 22 33', address: 'Atatürk Cad. No:5', product: 'Pergola 5400 mm' }] };
  const message = 'ÖRNEK YAPI siparişi ne durumda? Ayşe Demir aradı, numarası 0532 111 22 33';
  const result = await new AIService().assist(message, { currentPath: '/orders' }, data, [{ role: 'user', content: 'ayse@ornek.com adresine yazdım' }], undefined, { tenantId: 't', userId: 'u', feature: 'assistant.chat' });

  const request = JSON.stringify(sent);
  for (const value of PII) expect(request).not.toContain(value);
  expect(request).toContain('RF-1042');
  expect(request).toContain('Pergola 5400 mm');
  // The model saw only placeholders; the reply it built from them reads correctly again here.
  expect(request).toMatch(/\[KİŞİ_\d+\] siparişi ne durumda\? \[KİŞİ_\d+\] aradı, numarası \[TELEFON_\d+\]/);
  expect(result.answer).toBe(message.replace('ÖRNEK YAPI', 'Örnek Yapı'));
});

it('masks e-mails and phones in inbound text and restores extracted fields', async () => {
  reply = { orderData: { customerName: '[E-POSTA_1]' }, items: [], warnings: [], fieldEvidence: [] } as Record<string, unknown>;
  await new AIService().analyzeText('Gönderen: +905321112233\nMerhaba, 2 adet pergola. Mail: ayse@ornek.com', [{ orderData: { customerName: 'Örnek Yapı' } }]).catch(() => undefined);
  const request = JSON.stringify(sent);
  for (const value of ['+905321112233', 'ayse@ornek.com', 'Örnek Yapı']) expect(request).not.toContain(value);
});

it('records tokens, latency and the configured cost for each model call', async () => {
  reply = { answer: 'Tamam', suggestions: [], actions: [] };
  await new AIService().assist('Merhaba', {}, {}, [], undefined, { tenantId: 't', userId: 'u', feature: 'assistant.chat' });
  const row = usageRows.find((values) => values.includes('assistant.chat'))!;
  expect(row).toEqual(expect.arrayContaining(['t', 'u', 'assistant.chat', 'anthropic', 'claude-sonnet-5-5', 1200, 300, 0.0042, 'ok']));
});

it('prices Claude Sonnet 5.5 by default, counting prompt-cache reads and writes', async () => {
  const { costUsd, inputTokens } = await import('@/lib/ai/usage');
  delete process.env.AI_MODEL_PRICES_USD_PER_MTOK;
  const usage = { input_tokens: 1000, cache_read_input_tokens: 10000, cache_creation_input_tokens: 2000, output_tokens: 400 };
  expect(inputTokens(usage)).toBe(13000);
  // (1000 + 10000 × 0.1 + 2000 × 1.25) × $2 + 400 × $10, per million tokens.
  expect(costUsd('claude-sonnet-5-5', usage)).toBe(0.0130);
  expect(costUsd('unknown-model', usage)).toBeNull();
});

it('masks a name restored into chat history in an earlier turn when the firm knows it', async () => {
  reply = { answer: 'Tamam', suggestions: [], actions: [] };
  await new AIService().assist('Onun siparişi ne oldu?', {}, {}, [{ role: 'assistant', content: 'Mehmet Demir için 2 sipariş var.' }], undefined, undefined, ['Mehmet Demir']);
  expect(JSON.stringify(sent)).not.toContain('Mehmet Demir');
});
