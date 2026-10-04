'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Printer, TriangleAlert } from 'lucide-react';
import { requestJson } from '@/lib/shared/network';
import type { Order } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { StatusBadge } from '@/components/shared/ui/StatusStepper';

export default function OrderDocumentPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    requestJson<{ data: Order }>(`/api/v1/orders/${id}`, { signal: controller.signal, cache: 'no-store' }, { timeoutMs: 20000 }).then(result => {
      if (controller.signal.aborted) return;
      if (result.ok && result.data?.data) setOrder(result.data.data);
      else setError(result.error || 'Sipariş dökümü alınamadı.');
      setLoading(false);
    });
    return () => controller.abort();
  }, [id, attempt]);

  return <div className="rf-page max-w-[1100px]">
    {order?.financialHidden && <p role="alert" className="rf-panel p-5 text-sm">Ticari sipariş dökümüne erişim yetkiniz yok. Teknik bilgiler için sipariş detayını kullanın.</p>}
    <div className="mb-6 flex items-center justify-between gap-3 print:hidden">
      <Link href={`/orders/${id}`} className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft size={14} /> Sipariş detayına dön</Link>
      <button type="button" disabled={loading || !order || Boolean(error) || order.financialHidden} onClick={() => window.print()} className="rf-primary-button h-9 items-center gap-2 px-4 text-xs disabled:opacity-50"><Printer size={15} /> Yazdır / PDF olarak kaydet</button>
    </div>
    {error && <div className="rf-alert mb-5" role="alert"><TriangleAlert size={18} /><p className="flex-1 text-sm">{error}</p><button type="button" onClick={() => setAttempt(value => value + 1)} className="text-xs underline">Tekrar dene</button></div>}
    {loading ? <div className="rf-panel h-[550px] animate-pulse border border-border" aria-label="Sipariş dökümü yükleniyor" /> : order && !order.financialHidden && !error && <article className="rf-panel rf-print-document border border-border p-6 sm:p-10">
      <header className="flex flex-wrap items-start justify-between gap-6 border-b border-border pb-8">
        <div><p className="text-xl font-semibold tracking-tight">RENK ALÜMİNYUM</p><p className="mt-2 text-xs text-muted-foreground">Sipariş ve üretim bilgileri</p></div>
        <div className="text-right"><p className="rf-eyebrow">Sipariş dökümü</p><h1 className="mt-3 text-2xl font-semibold tracking-tight">{order.orderNumber}</h1><p className="mt-2 text-xs text-muted-foreground">{formatDate(order.date || order.createdAt)}</p></div>
      </header>
      <div className="grid gap-6 border-b border-border py-7 sm:grid-cols-2">
        <div><h2 className="rf-eyebrow">Müşteri bilgileri</h2><p className="mt-3 text-sm font-semibold">{order.customerName}</p>{order.email && <p className="mt-2 text-xs text-muted-foreground">{order.email}</p>}{order.phone && <p className="mt-2 text-xs text-muted-foreground">{order.phone}</p>}</div>
        <dl className="space-y-3 text-xs"><div className="flex justify-between gap-4"><dt className="text-muted-foreground">Sipariş durumu</dt><dd><StatusBadge status={order.status} /></dd></div><div className="flex justify-between gap-4"><dt className="text-muted-foreground">Termin</dt><dd>{order.deliveryDate ? formatDate(order.deliveryDate) : 'Belirlenmedi'}</dd></div><div className="flex justify-between gap-4"><dt className="text-muted-foreground">Para birimi</dt><dd>{order.currency}</dd></div></dl>
      </div>
      <table className="my-8 w-full text-sm"><caption className="sr-only">Sipariş ürün özeti</caption><thead><tr className="border-y border-border bg-accent text-left text-[10px] uppercase tracking-wider text-muted-foreground"><th scope="col" className="px-3 py-3 font-medium">Ürün / sistem</th><th scope="col" className="px-3 py-3 text-right font-medium">Adet</th><th scope="col" className="px-3 py-3 text-right font-medium">Toplam</th></tr></thead><tbody><tr className="border-b border-border"><td className="px-3 py-5">{order.productName}</td><td className="px-3 py-5 text-right tabular-nums">{order.quantity}</td><td className="px-3 py-5 text-right tabular-nums">{order.totalAmount > 0 ? formatCurrency(order.totalAmount, order.currency) : 'Fiyatlandırılmadı'}</td></tr></tbody></table>
      {order.notes && <section className="mb-8"><h2 className="rf-eyebrow">Üretim ve sevkiyat notları</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-7">{order.notes}</p></section>}
      <footer className="mt-12 flex flex-wrap justify-between gap-4 border-t border-border pt-5 text-[10px] text-muted-foreground"><p>RenkFlow · {order.orderNumber}</p><p>Operasyon amaçlı sipariş dökümü. Mali fatura yerine geçmez.</p></footer>
    </article>}
  </div>;
}
