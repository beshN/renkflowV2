/** @jest-environment node */
const clients: Array<{ options: Record<string, unknown> }> = [];
const requests: Array<Record<string, any>> = [];
let completion: { content: string | null; finish: string } = { content: null, finish: 'stop' };
jest.mock('server-only', () => ({}));
jest.mock('openai', () => jest.fn().mockImplementation((options: Record<string, unknown>) => {
  clients.push({ options });
  return {
    chat: {
      completions: {
        create: jest.fn(async (request: Record<string, any>) => {
          requests.push(request);
          return { choices: [{ finish_reason: completion.finish, message: { content: completion.content } }], usage: { prompt_tokens: 900, completion_tokens: 200 } };
        }),
      },
    },
  };
}));
const usageRows: unknown[][] = [];
jest.mock('@/lib/db', () => ({ sql: jest.fn((_s: TemplateStringsArray, ...values: unknown[]) => { usageRows.push(values); return Promise.resolve([]); }) }));

import { AIService } from '@/lib/ai/service';
import { activeProvider, providerConfig, providerUnavailable } from '@/lib/ai/providers';

const EXTRACTION = {
  customerName: '[KİŞİ_1]', email: '[E-POSTA_1]', phone: null, deliveryDate: null, notes: null, warnings: [], fieldEvidence: [],
  items: [{ productName: 'Pergola', quantity: 2, widthMm: 5400, heightMm: null, projectionMm: 3000, mountingHeightMm: null, color: 'Antrasit', motorType: null, ledType: null, fabricType: null, notes: null, sourcePage: null, evidence: '2 adet pergola 5400x3000', uncertainFields: [], unit: 'adet', customParameters: [], fieldEvidence: [] }],
};
const TEXT = 'Örnek Yapı adına 2 adet pergola 5400x3000 antrasit. İletişim: ayse@ornek.com, 0532 111 22 33';
const ATTACHMENTS = [{ customerName: 'Örnek Yapı' }];

const saved = { ...process.env };
beforeEach(() => {
  clients.length = 0; requests.length = 0; usageRows.length = 0;
  process.env = { ...saved };
  for (const key of ['AI_PROVIDER', 'ANTHROPIC_API_KEY', 'ANTHROPIC_MODEL', 'OPENAI_API_KEY', 'GEMINI_API_KEY', 'GEMINI_BASE_URL', 'GEMINI_MODEL', 'ZAI_API_KEY', 'ZAI_BASE_URL', 'ZAI_MODEL']) delete process.env[key];
  completion = { content: JSON.stringify(EXTRACTION), finish: 'stop' };
});
afterAll(() => { process.env = saved; });

describe('provider selection', () => {
  it('stays on Anthropic unless chosen, and refuses an unknown provider instead of guessing', () => {
    expect(activeProvider()).toBe('anthropic');
    expect(providerConfig('anthropic')).toMatchObject({ model: 'claude-sonnet-5-5', apiKey: null });
    expect(providerUnavailable('anthropic')).toMatch(/ANTHROPIC_API_KEY/);
    process.env.AI_PROVIDER = 'Gemini';
    expect(activeProvider()).toBe('gemini');
    process.env.AI_PROVIDER = 'claude';
    expect(() => activeProvider()).toThrow(/AI_PROVIDER geçersiz/);
  });

  it('takes keys, addresses and model ids from the environment', () => {
    expect(providerConfig('gemini')).toMatchObject({ baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/', model: 'gemini-3.8-flash', apiKey: null });
    expect(providerConfig('glm')).toMatchObject({ baseURL: 'https://api.z.ai/api/paas/v4/', model: 'glm-5.3-flash', structuredOutput: 'json_object' });
    process.env.ZAI_BASE_URL = 'https://open.bigmodel.cn/api/paas/v4/';
    process.env.ZAI_MODEL = 'glm-5.3-flash-0930';
    expect(providerConfig('glm')).toMatchObject({ baseURL: 'https://open.bigmodel.cn/api/paas/v4/', model: 'glm-5.3-flash-0930' });
    expect(providerUnavailable('gemini')).toMatch(/GEMINI_API_KEY/);
  });
});

describe('order extraction on Gemini and GLM', () => {
  it('sends Gemini the same masked text with a JSON schema, records usage and restores the answer', async () => {
    process.env.GEMINI_API_KEY = 'gemini-test-key';
    process.env.AI_MODEL_PRICES_USD_PER_MTOK = JSON.stringify({ 'gemini-3.8-flash': { input: 0.5, output: 3 } });
    const result = await new AIService().analyzeText(TEXT, ATTACHMENTS, { tenantId: 't', feature: 'eval.order-extraction' }, 'gemini');
    expect(clients[0].options).toMatchObject({ apiKey: 'gemini-test-key', baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/' });
    expect(requests[0].model).toBe('gemini-3.8-flash');
    expect(requests[0].response_format.type).toBe('json_schema');
    expect(requests[0].reasoning_effort).toBe('low');
    const sent = JSON.stringify(requests);
    for (const value of ['Örnek Yapı', 'ayse@ornek.com', '0532 111 22 33']) expect(sent).not.toContain(value);
    expect(sent).toContain('5400x3000');
    expect(result.customerName).toBe('Örnek Yapı');
    expect(result.email).toBe('ayse@ornek.com');
    expect(result.items[0]).toMatchObject({ widthMm: 5400, projectionMm: 3000, quantity: 2 });
    const row = usageRows.find((values) => values.includes('eval.order-extraction'))!;
    expect(row).toEqual(expect.arrayContaining(['t', 'eval.order-extraction', 'gemini', 'gemini-3.8-flash', 900, 200, 0.00105, 'ok']));
  });

  it('asks GLM for a JSON object and tells it the schema', async () => {
    process.env.ZAI_API_KEY = 'zai-test-key';
    await new AIService().analyzeText(TEXT, ATTACHMENTS, undefined, 'glm');
    expect(clients[0].options).toMatchObject({ apiKey: 'zai-test-key', baseURL: 'https://api.z.ai/api/paas/v4/' });
    expect(requests[0].response_format).toEqual({ type: 'json_object' });
    expect(requests[0].messages[0].content).toContain('JSON şemasına uyan');
    expect(requests[0].thinking).toEqual({ type: 'disabled' });
  });

  it('accepts a JSON object wrapped in a markdown fence', async () => {
    process.env.ZAI_API_KEY = 'zai-test-key';
    completion = { content: '```json\n' + JSON.stringify(EXTRACTION) + '\n```', finish: 'stop' };
    await expect(new AIService().analyzeText(TEXT, ATTACHMENTS, undefined, 'glm')).resolves.toMatchObject({ customerName: 'Örnek Yapı' });
  });

  it('uses the provider chosen in AI_PROVIDER when none is given', async () => {
    process.env.AI_PROVIDER = 'glm';
    process.env.ZAI_API_KEY = 'zai-test-key';
    await new AIService().analyzeText(TEXT, ATTACHMENTS);
    expect(requests[0].model).toBe('glm-5.3-flash');
  });

  it('never fills in an answer: no key, cut-off, non-JSON or off-schema output is an error', async () => {
    await expect(new AIService().analyzeText(TEXT, [], undefined, 'gemini')).rejects.toThrow(/GEMINI_API_KEY/);
    expect(requests).toHaveLength(0);
    process.env.GEMINI_API_KEY = 'gemini-test-key';
    completion = { content: JSON.stringify(EXTRACTION), finish: 'length' };
    await expect(new AIService().analyzeText(TEXT, [], undefined, 'gemini')).rejects.toThrow(/okunamadı/);
    completion = { content: 'Elbette! İşte sipariş:', finish: 'stop' };
    await expect(new AIService().analyzeText(TEXT, [], undefined, 'gemini')).rejects.toThrow(/JSON değil/);
    completion = { content: JSON.stringify({ customerName: 'X', items: 'yok' }), finish: 'stop' };
    let reported: unknown = null;
    await expect(new AIService().analyzeText(TEXT, [], { tenantId: 't', feature: 'inbound.text', onUsage: (u) => { reported = u; } }, 'gemini')).rejects.toThrow(/şemaya uymuyor/);
    // The unusable answer is logged as an error, with the tokens it used.
    const row = usageRows.find((values) => values.includes('inbound.text'))!;
    expect(row).toEqual(expect.arrayContaining(['gemini', 900, 200, 'error', 'invalid_output']));
    expect(reported).toMatchObject({ inputTokens: 900, outputTokens: 200 });
  });
});
