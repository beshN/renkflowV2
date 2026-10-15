/** @jest-environment node */
import { answerCommand } from '@/lib/ai/commands/conversation.server';
import { getAiSettings } from '@/lib/ai/gate.server';
import { aiAvailable, getAIService } from '@/lib/ai/service';
import { assistantSnapshot, searchAssistant } from '@/lib/ai/workspace';

jest.mock('@/lib/ai/gate.server', () => ({ getAiSettings: jest.fn() }));
jest.mock('@/lib/ai/service', () => ({ aiAvailable: jest.fn(), getAIService: jest.fn() }));
jest.mock('@/lib/ai/workspace', () => ({ assistantSnapshot: jest.fn(), searchAssistant: jest.fn() }));
jest.mock('@/lib/ai/known-names', () => ({ tenantPersonalNames: jest.fn().mockResolvedValue(['Sentetik Müşteri']) }));

const actor = { tenantId: 'tenant', userId: 'user', role: 'office' as const };
beforeEach(() => {
  jest.clearAllMocks();
  (getAiSettings as jest.Mock).mockResolvedValue({ mode: 'assist', kvkkAckAt: '2026-10-15' });
  (aiAvailable as jest.Mock).mockReturnValue(true);
});

it('uses the real model service for open questions and reports its returned model identity', async () => {
  const assist = jest.fn().mockResolvedValue({ answer: 'Kayıtlara göre öncelik verin.', suggestions: ['Neden?'], modelUsed: 'claude-sonnet-5-5', actions: [] });
  (getAIService as jest.Mock).mockReturnValue({ assist });
  (assistantSnapshot as jest.Mock).mockResolvedValue({ data: { jobs: [{ id: 'scoped-job' }] } });
  const answer = await answerCommand(actor, 'Üretimi nasıl iyileştirebilirim?');
  expect(answer.processing).toEqual({ source: 'model', label: 'Claude Sonnet 5.5 ile yanıtlandı' });
  expect(answer.note).toBe('Kayıtlara göre öncelik verin.');
  expect(assistantSnapshot).toHaveBeenCalledWith(actor, '/assistant');
  expect(assist.mock.calls[0][2]).toEqual({ jobs: [{ id: 'scoped-job' }], commandReadOnly: true });
  expect(assist.mock.calls[0][5]).toEqual({ tenantId: 'tenant', userId: 'user', feature: 'command.conversation' });
  await assist.mock.calls[0][4]('orders', 'RF-1');
  expect(searchAssistant).toHaveBeenCalledWith(actor, 'orders', 'RF-1');
});

it.each(['rules', 'off'])('does not call a provider in %s mode or pretend its answer came from AI', async (mode) => {
  (getAiSettings as jest.Mock).mockResolvedValue({ mode, kvkkAckAt: null });
  const answer = await answerCommand(actor, 'Merhaba');
  expect(answer.processing.source).toBe('rules');
  expect(getAIService).not.toHaveBeenCalled();
  expect(assistantSnapshot).not.toHaveBeenCalled();
});

it('keeps provider failures visible instead of disguising them as a successful rule response', async () => {
  (assistantSnapshot as jest.Mock).mockResolvedValue({ data: {} });
  (getAIService as jest.Mock).mockReturnValue({ assist: jest.fn().mockRejectedValue(new Error('Provider unavailable')) });
  await expect(answerCommand(actor, 'Merhaba')).rejects.toThrow('Provider unavailable');
});
