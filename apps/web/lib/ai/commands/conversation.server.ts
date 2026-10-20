import 'server-only';

import { getAIService, aiAvailable } from '@/lib/ai/service';
import { getAiSettings } from '@/lib/ai/gate.server';
import { modelConfigurationBlock, modelUnavailableMessage, ModelBlockedError } from '@/lib/ai/policy';
import { assistantSnapshot, searchAssistant } from '@/lib/ai/workspace';
import { tenantPersonalNames } from '@/lib/ai/known-names';
import { assistantModelInfo } from '@/lib/ai/model-info';
import { offlineAnswer } from './freeform.server';
import type { WorkOrderActor } from '@/lib/features/work-orders/security';

/** Free questions use the same masked, permission-scoped model service as the chat window. */
export async function answerCommand(actor: WorkOrderActor, text: string) {
  const block = modelConfigurationBlock(await getAiSettings(actor.tenantId), aiAvailable());
  // Without the model, everyday talk and the firm's own records can still answer.
  if (block) return (await offlineAnswer(actor, text)) ?? {
    type: 'answer' as const, title: 'Asistan', lines: [],
    note: `${modelUnavailableMessage(block)} Sipariş, teslimat ve stok sorgularını kayıtlarınız üzerinden kullanabilirsiniz.`,
    processing: { source: 'rules' as const, label: 'AI kullanılamıyor · kayıt desteği' },
  };
  try {
    const [snapshot, names] = await Promise.all([assistantSnapshot(actor, '/assistant'), tenantPersonalNames(actor.tenantId)]);
    const reply = await getAIService().assist(text, { currentPath: '/assistant' }, { ...snapshot.data, commandReadOnly: true }, [],
      (category, query) => searchAssistant(actor, category, query),
      { tenantId: actor.tenantId, userId: actor.userId, feature: 'command.conversation' }, names);
    const actual = assistantModelInfo(reply.modelUsed);
    return { type: 'answer' as const, title: 'Asistan yanıtı', lines: [], note: reply.answer,
      suggestions: reply.suggestions.slice(0, 3), processing: { source: 'model' as const, label: actual.verifiedResponse ? `${actual.label} ile yanıtlandı` : 'AI ile yanıtlandı' } };
  } catch (error) {
    if (error instanceof ModelBlockedError) return (await offlineAnswer(actor, text)) ?? { type: 'answer' as const, title: 'Asistan', lines: [], note: error.message, processing: { source: 'rules' as const, label: 'Model kullanım sınırı' } };
    // Do not replace a failed provider call with a convincing, fabricated rule-engine answer.
    throw error;
  }
}
