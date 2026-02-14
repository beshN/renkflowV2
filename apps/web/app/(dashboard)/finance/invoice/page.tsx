'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Eye, FileText, Printer, Search } from 'lucide-react';

import { Navbar } from '@/components/layout/Navbar';
import { useAuth } from '@/lib/context/AuthContext';
import { useToast } from '@/lib/context/ToastContext';
import { canAccessFinance, type UserRole } from '@/lib/auth/permissions';
import { getOrdersWithPayments } from '@/app/actions/finance.payments.actions';
import { type OrderWithPayments } from '@/lib/types/finance';
import { formatCurrency } from '@/lib/utils';

type InvoiceStatus = 'paid' | 'partial' | 'unpaid';

function getInvoiceStatus(order: OrderWithPayments): InvoiceStatus {
  if (order.remainingAmount <= 0) return 'paid';
  if (order.paidAmount > 0) return 'partial';
  return 'unpaid';
}

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  paid: 'Kapandı',
  partial: 'Kısmi Tahsil',
  unpaid: 'Açık Bakiye',
};

const STATUS_CLASS: Record<InvoiceStatus, string> = {
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  partial: 'bg-amber-50 text-amber-700 border-amber-200',
  unpaid: 'bg-rose-50 text-rose-700 border-rose-200',
};

export default function FinanceInvoicePage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [orders, setOrders] = useState<OrderWithPayments[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState('');

  const hasAccess = Boolean(user?.role && canAccessFinance(user.role as UserRole));

  useEffect(() => {
    if (!hasAccess) {
      setIsLoading(false);
      return;
    }

    const load = async () => {
      try {
        setIsLoading(true);
        const data = await getOrdersWithPayments();
        setOrders(data);
      } catch (error) {
        console.error('Invoice list error:', error);
        showToast('Fatura kayıtları alınamadı.', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, [hasAccess]);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return orders;

    return orders.filter((order) => {
      const fields = [order.orderNumber, order.customerName];
      return fields.some((field) => field.toLowerCase().includes(keyword));
    });
  }, [orders, query]);

  if (!hasAccess) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="rf-panel rounded-2xl p-8 text-center">
          <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">Fatura ekranına erişim yetkin bulunmuyor.</p>
          <Link href="/finance" className="mt-4 inline-block text-sm font-medium text-sky-600 hover:underline">
            Finans ekranına dön
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-slate-50/50 dark:bg-slate-950/50">
      <Navbar title="Fatura Listesi" showSearch={false} />

      <main className="w-full flex-1 p-4 md:p-8">
        <section className="rf-panel rounded-2xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Fatura ve Tahsilat Takibi</h1>
              <p className="mt-1 text-sm text-slate-500">Sipariş bazlı finans kapanış durumunu tek listede yönetin.</p>
            </div>

            <Link href="/finance" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900">
              <ArrowLeft size={16} />
              Finans özetine dön
            </Link>
          </div>

          <div className="mt-4 relative max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Müşteri veya sipariş numarası ara"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100/80 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900/70">
                  <tr>
                    <th className="px-4 py-3">Fatura No</th>
                    <th className="px-4 py-3">Müşteri</th>
                    <th className="px-4 py-3">Toplam</th>
                    <th className="px-4 py-3">Tahsil Edilen</th>
                    <th className="px-4 py-3">Durum</th>
                    <th className="px-4 py-3 text-right">Aksiyon</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-950">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">Fatura kayıtları yükleniyor...</td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">Filtreye uygun kayıt bulunamadı.</td>
                    </tr>
                  ) : (
                    filtered.map((order) => {
                      const status = getInvoiceStatus(order);
                      return (
                        <tr key={order.id}>
                          <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">FAT-{order.orderNumber}</td>
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{order.customerName}</td>
                          <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{formatCurrency(order.totalAmount, order.currency)}</td>
                          <td className="px-4 py-3 font-medium text-emerald-600">{formatCurrency(order.paidAmount, order.currency)}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_CLASS[status]}`}>
                              {STATUS_LABEL[status]}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <Link
                                href={`/finance/invoice/print?orderId=${order.id}`}
                                className="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                title="Önizleme"
                              >
                                <Eye size={14} />
                              </Link>
                              <Link
                                href={`/finance/invoice/print?orderId=${order.id}&print=true`}
                                target="_blank"
                                className="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                title="Yazdır"
                              >
                                <Printer size={14} />
                              </Link>
                              <Link
                                href={`/orders/${order.id}`}
                                className="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                title="Sipariş detay"
                              >
                                <FileText size={14} />
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })
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
