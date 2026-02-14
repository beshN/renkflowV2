'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, RefreshCw, Search } from 'lucide-react';

import { Navbar } from '@/components/layout/Navbar';
import { Button } from '@/components/ui/Button';
import { useOrders } from '@/lib/hooks/useOrders';
import { useToast } from '@/lib/context/ToastContext';
import { formatCurrency, formatDate } from '@/lib/utils';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Beklemede',
  in_production: 'Üretimde',
  delivered: 'Teslim Edildi',
};

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  in_production: 'bg-sky-50 text-sky-700 border-sky-200',
  delivered: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export default function OrdersPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { orders, isLoading, refresh, deleteOrder } = useOrders();

  const [query, setQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);

  const filteredOrders = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return orders;

    return orders.filter((order) => {
      const fields = [order.orderNumber, order.customerName, order.productName || '', order.email || ''];
      return fields.some((field) => field.toLowerCase().includes(keyword));
    });
  }, [orders, query]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refresh();
      showToast('Siparis listesi guncellendi.', 'success');
    } catch {
      showToast('Siparisler yenilenemedi.', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-slate-50/50 dark:bg-slate-950/50">
      <Navbar title="Sipariş Operasyonları" showSearch={false} />

      <main className="w-full flex-1 p-4 md:p-8">
        <section className="rf-panel rounded-2xl p-5 md:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Sipariş Yönetim Masası</h1>
              <p className="mt-1 text-sm text-slate-500">Kayıtlı toplam sipariş: {orders.length}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={handleRefresh} isLoading={isRefreshing}>
                <RefreshCw size={14} />
                Listeyi yenile
              </Button>
              <Link href="/new-order">
                <Button type="button" variant="primary" size="sm">
                  <Plus size={14} />
                  Yeni sipariş
                </Button>
              </Link>
            </div>
          </div>

          <div className="mt-4 relative max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Sipariş no, müşteri veya ürün ara"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100/80 dark:bg-slate-900/70">
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3">Sipariş No</th>
                    <th className="px-4 py-3">Müşteri ve Ürün</th>
                    <th className="px-4 py-3">Tarih</th>
                    <th className="px-4 py-3">Durum</th>
                    <th className="px-4 py-3 text-right">Toplam</th>
                    <th className="px-4 py-3 text-right">Aksiyon</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-950">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">Siparişler yükleniyor...</td>
                    </tr>
                  ) : filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">Arama kriterine uygun kayıt bulunamadı.</td>
                    </tr>
                  ) : (
                    filteredOrders.map((order) => (
                      <tr
                        key={order.id}
                        className="cursor-pointer transition hover:bg-slate-50 dark:hover:bg-slate-900/40"
                        onClick={() => router.push(`/orders/${order.id}`)}
                      >
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">#{order.orderNumber}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-800 dark:text-slate-200">{order.customerName}</p>
                          {order.productName ? <p className="text-xs text-slate-500">{order.productName}</p> : null}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{formatDate(order.date)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_BADGE[order.status] || STATUS_BADGE.pending}`}>
                            {STATUS_LABELS[order.status] || order.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-slate-100">
                          {formatCurrency(order.totalAmount, order.currency)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                router.push(`/orders/${order.id}`);
                              }}
                              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                              Görüntüle
                            </button>
                            <button
                              type="button"
                              onClick={async (event) => {
                                event.stopPropagation();
                                if (!window.confirm('Bu siparis kaydini silmek istediginize emin misiniz?')) return;

                                try {
                                  setDeletingOrderId(order.id);
                                  await deleteOrder(order.id);
                                  showToast('Siparis kaydi kaldirildi.', 'success');
                                } catch {
                                  showToast('Siparis kaydi kaldirilamadi.', 'error');
                                } finally {
                                  setDeletingOrderId(null);
                                }
                              }}
                              disabled={deletingOrderId === order.id}
                              className="rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-50 dark:border-rose-900/40 dark:text-rose-400 dark:hover:bg-rose-900/20"
                            >
                              {deletingOrderId === order.id ? 'Siliniyor...' : 'Kaldır'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
