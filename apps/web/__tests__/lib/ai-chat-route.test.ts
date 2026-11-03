/** @jest-environment node */
jest.mock('server-only', () => ({}));
jest.mock('@/lib/ai/service', () => ({ getAIService: () => ({ assist: mockAssist }) }));
jest.mock('@/lib/ai/commands/run.server', () => ({ runCommand: jest.fn() }));
jest.mock('@/lib/ai/known-names', () => ({ tenantPersonalNames: async () => [] }));
jest.mock('@/lib/ai/workspace', () => ({ assistantSnapshot: async () => ({ data: {} }), searchAssistant: jest.fn() }));
jest.mock('@/lib/features/work-orders/security', () => ({
  requireWorkOrderActor: jest.fn(async () => ({ tenantId: 't', userId: 'u', role: 'owner' })),
  WorkOrderApiError: class extends Error {
    constructor(message: string, public status: number) { super(message); }
  },
}));
jest.mock('@/lib/security/rate-limit', () => ({ consumeRateLimit: async () => ({ allowed: true }), rateLimitHeaders: () => ({}) }));
jest.mock('@/lib/ai/policy', () => ({ ModelBlockedError: class extends Error {} }));
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/ai/chat/route';
import { AI_CREDIT_MESSAGE } from '@/lib/ai/chat-errors';
const mockAssist = jest.fn();
const request = () => new NextRequest('http://localhost/api/ai/chat', {
  method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost' },
  body: JSON.stringify({ message: 'Bugünkü işleri özetler misin?' }),
});
test.each([
  new Error('400 Your credit balance is too low to access the Anthropic API. request-id secret'),
  { status: 400, error: { error: { message: 'insufficient balance: secret' } } },
])('credit failure is a safe recoverable error, never a fabricated answer', async (error) => {
  mockAssist.mockRejectedValueOnce(error);
  const response = await POST(request());
  expect(response.status).toBe(503);
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  expect(await response.json()).toEqual({ error: AI_CREDIT_MESSAGE, code: 'ai_insufficient_credit', mode: 'ai_unavailable' });
});
test('unrelated provider failures remain generic', async () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    mockAssist.mockRejectedValueOnce(new Error('provider internal secret'));
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toMatch(/secret|success|response/);
  } finally { log.mockRestore(); }
});
test('a subsequent request can succeed after credit failure', async () => {
  mockAssist.mockResolvedValueOnce({ answer: 'Kayıtlı işleriniz.', actions: [], suggestions: [] });
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect((await response.json()).response).toBe('Kayıtlı işleriniz.');
});
