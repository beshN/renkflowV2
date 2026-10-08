import 'server-only';

import { createHash } from 'node:crypto';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { groupReorder, thresholdStatus, type ReorderOrder } from '@/lib/features/inventory/reorder';
import { thresholdRows } from '@/lib/features/inventory/thresholds';
import { unitLabel } from '@/lib/features/inventory/vocabulary';
import { executeProcurement } from '@/lib/features/manufacturing/purchasing.service';
import { WorkOrderApiError } from '@/lib/features/work-orders/security';
import { registerSuggestionKind, type SuggestionActor } from '../kinds';

export const PURCHASE_DRAFT_KIND = 'procurement.purchase_draft';

/** A purchase order takes at most this many lines. */
const LINES_PER_ORDER = 100;

const PayloadSchema = z.object({
  /** The drafts the card described; approval refuses when today's need differs in any way. */
  fingerprint: z.string().length(40),
  orders: z.array(z.object({ supplierId: z.string().uuid(), currency: z.string().max(3), lines: z.array(z.object({ itemId: z.string().uuid() }).passthrough()).min(1) })).min(1),
});
type Payload = z.infer<typeof PayloadSchema>;

function split(orders: ReorderOrder[]) {
  return orders.flatMap((order) => {
    const parts: ReorderOrder[] = [];
    for (let i = 0; i < order.lines.length; i += LINES_PER_ORDER) parts.push({ ...order, lines: order.lines.slice(i, i + LINES_PER_ORDER) });
    return parts;
  });
}

export function reorderFingerprint(orders: ReorderOrder[]) {
  const shape = orders.map((o) => [o.supplierId, o.currency, o.lines.map((l) => [l.itemId, l.warehouseId, l.quantity, l.unitPrice, l.lengthMm ?? null, l.color])]);
  return createHash('sha256').update(JSON.stringify(shape)).digest('hex').slice(0, 40);
}

const qty = (n: number) => n.toLocaleString('tr-TR', { maximumFractionDigits: 3 });

/**
 * The purchase draft suggestion: items under their minimum stock, not covered by what is already
 * ordered, drafted from each item's last purchase line (supplier, warehouse, price, bar length,
 * colour). Items never bought, or bought without what a draft needs, are named and left out. No
 * model is involved and nothing is sent to a supplier: approval only creates draft orders.
 */
export async function refreshPurchaseDraftSuggestion(actor: SuggestionActor) {
  const { fileSuggestion, expireOtherPending } = await import('../service');
  const rows = await thresholdRows(sql, actor.tenantId);
  const orders = split(groupReorder(rows));
  if (!orders.length) {
    await expireOtherPending(sql, actor.tenantId, PURCHASE_DRAFT_KIND, null);
    return;
  }
  const fingerprint = reorderFingerprint(orders);
  await expireOtherPending(sql, actor.tenantId, PURCHASE_DRAFT_KIND, fingerprint);
  const byId = new Map(rows.map((r) => [r.itemId, r]));
  const unknown = rows.flatMap((r) => {
    const s = thresholdStatus(r);
    return s.state === 'unknown' ? [`${r.name}: ${s.reason}`] : [];
  });
  const lineCount = orders.reduce((n, o) => n + o.lines.length, 0);
  const describe = (o: ReorderOrder) =>
    `${o.supplierName} (${o.currency}): ` +
    o.lines
      .map((l) => {
        const item = byId.get(l.itemId)!;
        return l.lengthMm ? `${item.name} ${l.quantity} çubuk × ${qty(l.lengthMm / 1000)} m, ${l.color}` : `${item.name} ${qty(l.quantity)} ${unitLabel(item.uom)}`;
      })
      .join('; ');
  await fileSuggestion(
    sql,
    actor.tenantId,
    null,
    {
      kind: PURCHASE_DRAFT_KIND,
      title: `${lineCount} malzeme minimum stok altında: ${orders.length} taslak satın alma siparişi`,
      rationale: [
        `Kullanılabilir stok (hammadde ve artık depoları, ayrılanlar düşülerek), yoldaki ve taslaktaki siparişlerle birlikte minimumun altında kalan ${lineCount} malzeme için eksik kadar alım önerilir.`,
        ...orders.slice(0, 10).map(describe),
        ...(orders.length > 10 ? [`… ve ${orders.length - 10} sipariş daha.`] : []),
        'Tedarikçi, depo, birim fiyat, çubuk boyu ve renk her malzemenin son satın alma satırından alındı; fiyatı tedarikçiden teyit edin.',
        ...(unknown.length ? [`Taslağa alınmayan ${unknown.length} malzeme: ${unknown.slice(0, 10).join('; ')}${unknown.length > 10 ? '; …' : ''}.`] : []),
        'Onaylarsanız siparişler taslak olarak açılır; tedarikçiye hiçbir şey gönderilmez, Satın alma ekranından gözden geçirip onaylarsınız.',
      ].join('\n'),
      payload: { fingerprint, orders: orders.map((o) => ({ supplierId: o.supplierId, currency: o.currency, lines: o.lines })) },
      affected: orders.flatMap((o) => o.lines).slice(0, 50).map((l) => ({ entityType: 'inventory_item', entityId: l.itemId, label: byId.get(l.itemId)!.name.slice(0, 200), href: `/inventory/${l.itemId}` })),
      uncertain: unknown.length > 0,
      uncertaintyNote: unknown.length ? `${unknown.length} malzeme için tedarikçi veya alış bilgisi yok; emin değilim, bunlar taslağa alınmadı.` : null,
      source: 'system',
      dedupeKey: fingerprint,
    },
    { notAgainAfterRejection: true },
  );
}

registerSuggestionKind<Payload>({
  kind: PURCHASE_DRAFT_KIND,
  label: 'Satın alma taslağı',
  payloadSchema: PayloadSchema,
  // The same roles that may create a purchase order by hand.
  roles: ['owner', 'admin', 'office'],
  refresh: refreshPurchaseDraftSuggestion,
  apply: async (tx, actor, payload, suggestion) => {
    // Today's need, read in the approval transaction: anything changed refuses rather than drafts a different order.
    const orders = split(groupReorder(await thresholdRows(tx, actor.tenantId)));
    if (!orders.length || reorderFingerprint(orders) !== payload.fingerprint)
      throw new WorkOrderApiError('Stok, siparişler veya son alışlar değişti; öneri yenilenecek. Listeyi yenileyin.', 409);
    const created: Array<{ id: string; number: string }> = [];
    for (const order of orders) {
      const po = await executeProcurement(
        tx,
        actor as any,
        'procurement.purchase.create',
        {
          supplierId: order.supplierId,
          currency: order.currency,
          notes: `Stok eşik önerisinden taslak (${suggestion.title})`.slice(0, 1000),
          lines: order.lines,
        },
        `ai-suggestion:${suggestion.id}:${created.length}`,
      );
      created.push({ id: po.id, number: po.purchase_order_number });
    }
    return { orders: created, href: '/purchases' };
  },
});
