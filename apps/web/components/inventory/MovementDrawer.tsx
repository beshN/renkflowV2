'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, X } from 'lucide-react';
import { movementSourceLabel, formatQty } from '@/lib/features/inventory/vocabulary';
import { EmptyState, SkeletonRows, Timeline } from '@/components/kit';

type Movement = { id: string; created_at: string; reference_type: string; order_number?: string | null; receipt_number?: string | null; lines: Array<{ item_id: string; quantity_delta: string; uom: string; warehouse_name: string }> | null };

/** One material's stock movements as a timeline: in green arrow down, out red arrow up. */
export function MovementDrawer({ item, onClose }: { item: { id: string; name: string } | null; onClose: () => void }) {
  const [rows, setRows] = useState<Movement[] | null>(null);
  useEffect(() => {
    if (!item) return;
    setRows(null);
    void fetch('/api/v1/inventory/movements?itemId=' + item.id, { cache: 'no-store' })
      .then(async (r) => setRows(r.ok ? (await r.json()).data : []))
      .catch(() => setRows([]));
  }, [item]);
  return (
    <Dialog.Root open={Boolean(item)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-slate-950/40" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-[81] w-full max-w-md overflow-y-auto border-l border-border bg-card p-5 shadow-xl outline-none">
          <div className="mb-4 flex items-center justify-between gap-2">
            <Dialog.Title className="truncate text-lg font-semibold">{item?.name}</Dialog.Title>
            <Dialog.Close aria-label="Kapat" className="grid h-10 w-10 place-items-center rounded-md border border-border"><X size={18} /></Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">Stok hareketleri, en yeni üstte</Dialog.Description>
          {!rows ? <SkeletonRows rows={6} /> : !rows.length ? <EmptyState title="Hareket yok" /> : (
            <Timeline items={rows.flatMap((m) => (m.lines ?? []).filter((l) => l.item_id === item?.id).map((l, i) => {
              const delta = Number(l.quantity_delta);
              return {
                id: m.id + i,
                icon: delta >= 0 ? ArrowDownLeft : ArrowUpRight,
                tone: delta >= 0 ? 'in' as const : 'out' as const,
                title: `${delta >= 0 ? '+' : '−'}${formatQty(Math.abs(delta), l.uom)}`,
                when: new Date(m.created_at).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
                detail: [movementSourceLabel(m.reference_type), m.order_number, m.receipt_number, l.warehouse_name].filter(Boolean).join(' · '),
              };
            }))} />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
