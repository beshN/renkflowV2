import 'server-only';

import { searchAssistant } from '@/lib/ai/workspace';
import { smallTalk, searchWords } from './smalltalk';
import type { WorkOrderActor } from '@/lib/features/work-orders/security';

type Row = Record<string, any>;

const OFFLINE = { source: 'rules' as const, label: 'Kayıt araması · model kullanılmadı' };
const day = (v: unknown) => (v ? (v instanceof Date ? v.toISOString() : String(v)).slice(0, 10).split('-').reverse().join('.') : '—');

type OfflineAnswer =
  | { type: 'answer'; title: string; lines: Array<{ label: string; value: string }>; note: string; processing: typeof OFFLINE }
  | { type: 'list'; title: string; columns: string[]; rows: Array<{ cells: string[]; href?: string }>; empty: string; processing: typeof OFFLINE; note?: undefined };

/**
 * What the command box answers when the assistant model cannot be used (off, rules-only, no KVKK
 * confirmation, budget spent), so a question is not met with a refusal alone: everyday talk gets a
 * reply, and the words in the text are searched in the firm's own records (orders, customers,
 * materials, within the person's permissions). Null when there is nothing to say beyond the
 * "model is off" notice.
 */
export async function offlineAnswer(actor: WorkOrderActor, text: string): Promise<OfflineAnswer | null> {
  const chat = smallTalk(text);
  if (chat) return { type: 'answer', title: 'Asistan', lines: [], note: chat, processing: OFFLINE };

  for (const word of searchWords(text)) {
    const orders = (await searchAssistant(actor, 'orders', word).catch(() => null)) as Row[] | null;
    if (Array.isArray(orders) && orders.length)
      return { type: 'list', title: `"${word}" için siparişler`, columns: ['Sipariş', 'Müşteri', 'Ürün', 'Teslim'], empty: '', processing: OFFLINE, rows: orders.slice(0, 10).map((o) => ({ cells: [String(o.order_number), String(o.customer_name ?? ''), String(o.product_name ?? ''), day(o.delivery_date)], href: `/orders/${o.id}` })) };
    const customers = (await searchAssistant(actor, 'customers', word).catch(() => null)) as Row[] | null;
    if (Array.isArray(customers) && customers.length)
      return { type: 'list', title: `"${word}" için müşteriler`, columns: ['Müşteri', 'Firma'], empty: '', processing: OFFLINE, rows: customers.slice(0, 10).map((c) => ({ cells: [String(c.full_name ?? ''), String(c.company_name ?? '')], href: `/crm/${c.id}` })) };
    const materials = (await searchAssistant(actor, 'materials', word).catch(() => null)) as Row[] | null;
    if (Array.isArray(materials) && materials.length)
      return { type: 'list', title: `"${word}" için malzemeler`, columns: ['Malzeme', 'Kod', 'Eldeki'], empty: '', processing: OFFLINE, rows: materials.slice(0, 10).map((m) => ({ cells: [String(m.name ?? ''), String(m.sku ?? ''), `${Number(m.on_hand_qty ?? 0).toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ${m.stock_uom ?? ''}`.trim()] })) };
  }
  return null;
}
