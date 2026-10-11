'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Boxes } from 'lucide-react';
import { HintTip, StatusChip } from '@/components/kit';
import { requestJson } from '@/lib/shared/network';

type Line = { itemId: string; name: string; uom: string; quantity: number; free: number; incoming: number; missing: number; coveredByIncoming: boolean };
const num = (n: number) => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(n);

/** What the order's configured products need against free stock (not counting other jobs' holds). */
export function OrderMaterials({ orderId }: { orderId: string }) {
  const [data, setData] = useState<{ configured: number; lines: Line[] } | null>(null);
  useEffect(() => { requestJson<{ configured: number; lines: Line[] }>(`/api/v1/orders/${orderId}/materials`, { cache: 'no-store' }).then((r) => { if (r.ok && r.data) setData(r.data); }); }, [orderId]);
  if (!data || !data.lines.length) return null;
  const short = data.lines.filter((l) => l.missing > 0);
  return (
    <section className="rf-panel space-y-2" aria-label="Malzeme durumu">
      <div className="flex items-center gap-2">
        <Boxes size={16} aria-hidden />
        <h3 className="text-sm font-semibold">Malzeme durumu</h3>
        <HintTip text="Reçeteli kalemlerin ihtiyacı, eldeki stoktan başka işlerin ayırdığı düşülerek karşılaştırılır. Yoldaki satın almalar gösterilir ama sayılmaz." />
        <StatusChip className="ml-auto" tone={short.length ? 'warning' : 'success'} label={short.length ? `${short.length} eksik` : 'Yeterli'} />
      </div>
      <ul className="space-y-1 text-sm">
        {data.lines.map((l) => (
          <li key={l.itemId} className="flex flex-wrap items-center gap-2">
            <span className="min-w-0 flex-1 truncate">{l.name}</span>
            <span className="text-xs tabular-nums text-muted-foreground">gerek {num(l.quantity)} · serbest {num(l.free)} {l.uom}</span>
            {l.missing > 0 && <StatusChip tone={l.coveredByIncoming ? 'info' : 'danger'} label={`−${num(l.missing)}${l.coveredByIncoming ? ' · yolda' : ''}`} />}
          </li>
        ))}
      </ul>
      {short.length > 0 && <Link href="/purchases" className="text-xs font-medium text-primary hover:underline">Satın almaya git</Link>}
    </section>
  );
}
