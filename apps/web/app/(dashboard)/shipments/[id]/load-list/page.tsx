'use client';
import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { requestJson } from '@/lib/shared/network';
import { shipmentQuantity } from '@/lib/features/shipments/format';

type LoadList = {
  shipment_number: string; customer_name: string; carrier: string; tracking_number: string;
  items: { id: string; product_name: string; quantity: string; uom: string | null;
    order_number: string | null; order_item_id: string | null; work_order_id: string | null }[];
};
export default function ShipmentLoadListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<LoadList | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setData(null); setError('');
    void requestJson<{ success: boolean; data: LoadList }>(`/api/v1/shipments/${encodeURIComponent(id)}/load-list`,
      { signal: controller.signal, cache: 'no-store' }).then(result => {
      if (controller.signal.aborted) return;
      if (result.ok && result.data?.success) setData(result.data.data);
      else setError('Yükleme listesi alınamadı veya erişim yetkiniz yok.');
    });
    return () => controller.abort();
  }, [id]);
  return <main className="p-4 md:p-8">
    <div className="mb-4 flex gap-4 print:hidden">
      <Link href="/shipments">Sevkiyatlara dön</Link>
      <Button disabled={!data} onClick={() => window.print()}>Yazdır / PDF kaydet</Button>
    </div>
    {error ? <p role="alert">{error}</p> : !data ? <p role="status">Yükleniyor…</p> :
      <section id="shipment-load-list" className="rf-panel border border-border p-6">
        <h1 className="text-xl font-semibold">Yükleme listesi · {data.shipment_number}</h1>
        <p>{data.customer_name}</p><p>Taşıyıcı: {data.carrier || '—'} · Takip: {data.tracking_number || '—'}</p>
        <div className="overflow-x-auto"><table className="mt-6 w-full text-left text-sm">
          <thead><tr><th>Sipariş / kalem</th><th>Ürün / paket</th><th>Miktar / birim</th></tr></thead>
          <tbody>{data.items.map(item => <tr key={item.id} className="border-t border-border">
            <td className="py-3">{item.order_number || '—'}<br />{item.order_item_id || '—'}</td>
            <td>{item.product_name}{item.work_order_id && <p className="text-xs">İş emri: {item.work_order_id}</p>}</td>
            <td>{shipmentQuantity(item.quantity, item.uom)}</td>
          </tr>)}</tbody>
        </table></div>
        {!data.items.length && <p>Bu sevkiyata kayıtlı kalem yok.</p>}
      </section>}
    <style>{`@media print {
      body * { visibility: hidden; }
      #shipment-load-list, #shipment-load-list * { visibility: visible; }
      #shipment-load-list { position: absolute; inset: 0 auto auto 0; width: 100%; color: black; background: white; border: 0; }
      #shipment-load-list .overflow-x-auto { overflow: visible; }
      #shipment-load-list tr { break-inside: avoid; }
      #shipment-load-list thead { display: table-header-group; }
      @page { size: A4; margin: 15mm; }
    }`}</style>
  </main>;
}
