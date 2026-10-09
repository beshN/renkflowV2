'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { requestJson } from '@/lib/shared/network';
import { formatQty } from '@/lib/features/inventory/vocabulary';

type Warning = {
  itemId: string; sku: string; name: string; uom: string; minStock: number; reorderPoint?: number; target?: number; available: number; incoming: number; drafted: number;
  state: 'covered' | 'draftable' | 'unknown'; shortfall: number; reason: string | null; supplierName: string | null;
};

const qty = (n: number, uom: string) => formatQty(n, uom);

function status(w: Warning, canDraft: boolean) {
  if (w.state === 'covered') return { text: 'Yoldaki / taslaktaki siparişle karşılanıyor', tone: 'text-muted-foreground' };
  if (w.state === 'draftable')
    return { text: `Eksik ${qty(w.shortfall, w.uom)} · son tedarikçiden (${w.supplierName}) taslak sipariş ${canDraft ? "Önerilenler'de" : 'önerilebilir (satın alma yetkisiyle)'}`, tone: 'text-amber-700 dark:text-amber-300' };
  return { text: `Eksik ${qty(w.shortfall, w.uom)} · emin değilim: ${w.reason}`, tone: 'text-rose-700 dark:text-rose-300' };
}

/** Items under their minimum stock: usable stock less reservations, with orders already placed. */
export function StockThresholdPanel() {
  const [items, setItems] = useState<Warning[] | null>(null);
  const [canDraft, setCanDraft] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    void requestJson<{ items: Warning[]; canDraft: boolean }>('/api/v1/inventory/thresholds').then((r) => {
      if (r.ok && r.data) {
        setItems(r.data.items);
        setCanDraft(r.data.canDraft);
      }
      else setError(r.error || 'Stok eşikleri alınamadı');
    });
  }, []);
  if (error) return <p role="alert" className="mb-4 text-sm text-rose-600">{error}</p>;
  if (!items || !items.length) return null;
  return (
    <section className="rf-panel mb-6 space-y-3" aria-label="Sipariş noktası altındaki malzemeler">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Sipariş noktası altında: {items.length} malzeme</h2>
        {canDraft && <Link href="/dashboard" className="text-sm underline">Önerilenler</Link>}
      </div>
      <p className="text-xs text-muted-foreground">Kullanılabilir = hammadde ve artık depolarındaki stok − ayrılanlar. Yolda = gönderilmiş siparişlerin gelmeyen kısmı. Sipariş noktası = minimum (+ tanımlıysa tedarik süresi boyunca tüketim).</p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead><tr>{['Malzeme', 'Kullanılabilir', 'Sipariş noktası', 'Yolda', 'Taslakta', 'Durum'].map((h) => <th key={h} className="p-2 text-xs text-muted-foreground">{h}</th>)}</tr></thead>
          <tbody>
            {items.map((w) => {
              const s = status(w, canDraft);
              return (
                <tr key={w.itemId} className="border-t border-border align-top">
                  <td className="p-2"><Link className="hover:underline" href={`/inventory/${w.itemId}`}>{w.name}</Link> <span className="text-xs text-muted-foreground">{w.sku}</span></td>
                  <td className={`p-2 whitespace-nowrap font-semibold ${w.state === 'covered' ? '' : 'text-rose-600 dark:text-rose-400'}`}>{qty(w.available, w.uom)}</td>
                  <td className="p-2 whitespace-nowrap">{qty(w.reorderPoint ?? w.minStock, w.uom)}</td>
                  <td className="p-2 whitespace-nowrap">{w.incoming ? qty(w.incoming, w.uom) : '—'}</td>
                  <td className="p-2 whitespace-nowrap">{w.drafted ? qty(w.drafted, w.uom) : '—'}</td>
                  <td className={`p-2 text-xs ${s.tone}`}>{s.text}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
