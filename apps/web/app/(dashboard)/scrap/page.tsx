'use client';

import { useEffect, useState } from 'react';
import { AppleNavbar } from '@/components/layout/AppleNavbar';
import { RFListView } from '@/components/shared/views/RFListView';

type Balance = { id: string; sku: string; item_name: string; stock_uom: string; warehouse_code: string; warehouse_name: string; on_hand_qty: string; available_qty: string };
export default function ScrapPage() {
  const [rows, setRows] = useState<Balance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/v1/inventory/balances', { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('Hurda ve artık stoğu yüklenemedi.');
      const data = await response.json();
      setRows((data.items as Balance[]).filter(row => ['SCRAP', 'REUSABLE_REMNANTS'].includes(row.warehouse_code)));
    }).catch(err => { if (err.name !== 'AbortError') setError(err.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);
  return <div className="min-h-screen">
    <AppleNavbar title="Hurda & kullanılabilir artık" showSearch={false} />
    <main className="mx-auto max-w-[1440px] space-y-4 p-4 md:p-6">
      <div className="rf-panel p-4 text-sm text-slate-500">Kullanılabilir profil artıkları yeniden kullanılabilir stoktur. Gerçek hurda ayrı depoda kg olarak tutulur; ağırlık, kaynak metre × profil kg/m katsayısıyla hesaplanır.</div>
      {error && <p role="alert" className="rounded-lg bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
      <RFListView title="Artık ve hurda depo bakiyeleri" data={rows} isLoading={loading}
        columns={[
          { key: 'item_name', label: 'Profil / malzeme' }, { key: 'sku', label: 'Stok kodu' },
          { key: 'warehouse_name', label: 'Depo' },
          { key: 'on_hand_qty', label: 'Fiziksel stok', render: (value, row) => Number(value).toLocaleString('tr-TR', { maximumFractionDigits: 4 }) + ' ' + row.stock_uom },
          { key: 'available_qty', label: 'Kullanılabilir', render: (value, row) => Number(value).toLocaleString('tr-TR', { maximumFractionDigits: 4 }) + ' ' + row.stock_uom },
        ]} emptyState={{ title: 'Henüz artık veya hurda kaydı yok', description: 'Üretimde işlenen gerçek artık ve hurda bakiyeleri burada görünür.' }} />
    </main>
  </div>;
}
