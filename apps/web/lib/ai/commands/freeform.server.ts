import 'server-only';

import { getAiSettings } from '@/lib/ai/gate.server';
import { assistantSnapshot, searchAssistant } from '@/lib/ai/workspace';
import { tenantPersonalNames } from '@/lib/ai/known-names';
import { smallTalk, searchWords } from './smalltalk';
import type { WorkOrderActor } from '@/lib/features/work-orders/security';

type Row = Record<string, any>;

export type FreeformResult =
  | { type: 'text'; text: string; suggestions: string[]; source: 'model' }
  | { type: 'need'; message: string; missing: string[]; examples: string[] }
  | { type: 'list'; title: string; columns: string[]; rows: Array<{ cells: string[]; href?: string }>; empty: string };

const day = (v: unknown) => (v ? (v instanceof Date ? v.toISOString() : String(v)).slice(0, 10).split('-').reverse().join('.') : '—');

/**
 * What the command box does with text no command rule recognised, so the person is not left with
 * "anlayamadım": everyday talk gets an answer, a question goes to the assistant model when the firm
 * allows it, otherwise the firm's records are searched for the words in it, and only when nothing
 * is found does the answer say so (with what can be asked).
 */
export async function freeformAnswer(actor: WorkOrderActor, text: string, examples: string[]): Promise<FreeformResult> {
  const chat = smallTalk(text);
  if (chat) return { type: 'need', message: chat, missing: [], examples: examples.slice(0, 6) };

  const ai = await getAiSettings(actor.tenantId);
  if (ai.mode === 'assist' && ai.kvkkAckAt) {
    try {
      const { getAIService, aiAvailable } = await import('@/lib/ai/service');
      if (aiAvailable()) {
        const query = text.match(/\bRF[-\s]?\d+\b/i)?.[0] ?? '';
        const [snapshot, knownNames] = await Promise.all([assistantSnapshot(actor, '/assistant', query), tenantPersonalNames(actor.tenantId)]);
        const answer = await getAIService().assist(text, { currentPath: '/assistant' }, snapshot.data, [], (category, q) => searchAssistant(actor, category, q), { tenantId: actor.tenantId, userId: actor.userId, feature: 'assistant.chat' }, knownNames);
        if (answer.answer?.trim()) return { type: 'text', text: answer.answer.trim(), suggestions: answer.suggestions.slice(0, 4), source: 'model' };
      }
    } catch {
      // Budget, KVKK, a model error: the record search below still answers what it can.
    }
  }

  for (const word of searchWords(text)) {
    const orders = (await searchAssistant(actor, 'orders', word).catch(() => null)) as Row[] | null;
    if (Array.isArray(orders) && orders.length)
      return { type: 'list', title: `"${word}" için siparişler`, columns: ['Sipariş', 'Müşteri', 'Ürün', 'Teslim'], empty: '', rows: orders.slice(0, 10).map((o) => ({ cells: [String(o.order_number), String(o.customer_name ?? ''), String(o.product_name ?? ''), day(o.delivery_date)], href: `/orders/${o.id}` })) };
    const customers = (await searchAssistant(actor, 'customers', word).catch(() => null)) as Row[] | null;
    if (Array.isArray(customers) && customers.length)
      return { type: 'list', title: `"${word}" için müşteriler`, columns: ['Müşteri', 'Firma'], empty: '', rows: customers.slice(0, 10).map((c) => ({ cells: [String(c.full_name ?? ''), String(c.company_name ?? '')], href: `/crm/${c.id}` })) };
    const materials = (await searchAssistant(actor, 'materials', word).catch(() => null)) as Row[] | null;
    if (Array.isArray(materials) && materials.length)
      return { type: 'list', title: `"${word}" için malzemeler`, columns: ['Malzeme', 'Kod', 'Eldeki'], empty: '', rows: materials.slice(0, 10).map((m) => ({ cells: [String(m.name ?? ''), String(m.sku ?? ''), `${Number(m.on_hand_qty ?? 0).toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ${m.stock_uom ?? ''}`.trim()] })) };
  }

  const modelHint = ai.mode === 'assist' && ai.kvkkAckAt ? '' : ' Serbest sorulara tam cevap için Ayarlar › Asistan bölümünden model kullanımını açabilirsiniz.';
  return { type: 'need', message: `Bunun için kayıtlarda bir şey bulamadım. Bir sipariş numarası, müşteri adı ya da malzeme yazarsanız aramaya devam ederim.${modelHint}`, missing: [], examples: examples.slice(0, 6) };
}
