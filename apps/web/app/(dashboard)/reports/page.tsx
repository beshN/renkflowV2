'use client';

import { ProductionReport } from '@/components/features/manufacturing/ProductionReport';
import { useAuth } from '@/lib/context/AuthContext';
import { hasPermission } from '@/lib/auth/permissions';
import { normalizeOrderStatus } from '@/lib/features/orders/workspace';
import { useMemo } from 'react';
import { Download } from 'lucide-react';
import { AppleNavbar } from '@/components/layout/AppleNavbar';
import { AppleCard } from '@/components/shared/ui/AppleCard';
import { useOrders } from '@/lib/hooks/useOrders';
import { StatusBadge } from '@/components/shared/ui/StatusStepper';

function csvCell(value: unknown) {
  const text = String(value ?? '');
  const safe = /^[=+@-]/.test(text) ? "'" + text : text;
  return '"' + safe.replaceAll('"', '""') + '"';
}
export default function ReportsPage() {
  const { orders, isLoading,error,refresh } = useOrders();
  const {user}=useAuth();
  const stats = useMemo(() => ({
    pending: orders.filter(order => order.status === 'pending').length,
    production: orders.filter(order => order.status === 'in_production').length,
    delivered: orders.filter(order => normalizeOrderStatus(order.status) === 'completed').length,
  }), [orders]);
  function downloadCsv() {
    const rows = [['Sipariş', 'Müşteri', 'Ürün', 'Adet', 'Durum', 'Termin', 'Tutar', 'Para birimi'],
      ...orders.map(order => [order.orderNumber, order.customerName, order.productName || '', order.quantity || 0, order.status, order.deliveryDate || '', order.totalAmount, order.currency])];
    const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.map(row => row.map(csvCell).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a'); link.href = url; link.download = 'renk-aluminyum-siparisler.csv'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div className="min-h-screen">
    <AppleNavbar title="Operasyon raporu" showSearch={false} />
    <main className="mx-auto max-w-[1440px] space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-xl font-semibold">Renk Alüminyum sipariş özeti</h2><p className="mt-1 text-sm text-slate-500">Aşağıdaki değerler kayıtlı siparişlerden hesaplanır.</p></div>
        <button type="button" disabled={isLoading || !!error || !orders.length || !user || !hasPermission(user.role,'reports.export')} onClick={downloadCsv} className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm disabled:opacity-40 dark:bg-slate-900"><Download size={16} /> CSV indir</button>
      </div>
      {error && <p role="alert" className="rounded border border-red-300 p-4 text-sm text-red-700">Sipariş raporu alınamadı.<button className="ml-3 underline" onClick={()=>void refresh()}>Tekrar dene</button></p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[['Toplam sipariş', orders.length], ['Planlama bekliyor', stats.pending], ['Üretimde', stats.production], ['Teslim edildi', stats.delivered]].map(([label, value]) => <AppleCard key={label}><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-semibold">{isLoading ? '…' : value}</p></AppleCard>)}
      </div>
      <AppleCard>
        <h3 className="font-semibold">Sipariş durum dağılımı</h3>
        <div className="mt-4 space-y-4">{(['pending', 'in_production', 'delivered'] as const).map(status => {
          const count = orders.filter(order => status==='delivered'?normalizeOrderStatus(order.status)==='completed':order.status === status).length;
          return <div key={status}><div className="mb-2 flex justify-between text-sm"><StatusBadge status={status} /><span>{count} sipariş</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full bg-blue-600" style={{ width: orders.length ? count / orders.length * 100 + '%' : '0%' }} /></div></div>;
        })}</div>
      </AppleCard>
      <ProductionReport/>
    </main>
  </div>;
}
