'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, FileText, RefreshCw, Wallet } from 'lucide-react';

import { Navbar } from '@/components/layout/Navbar';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/context/AuthContext';
import { useToast } from '@/lib/context/ToastContext';
import { canAccessFinance, type UserRole } from '@/lib/auth/permissions';
import { getOrdersWithPayments } from '@/app/actions/finance.payments.actions';
import { formatCurrency } from '@/lib/utils';
import { type OrderWithPayments } from '@/lib/types/finance';

export default function FinanceOverviewPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [currency,setCurrency]=useState('TRY');
  const [loadError,setLoadError]=useState('');
  const [orders, setOrders] = useState<OrderWithPayments[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const requestSequence=useRef(0);

  const hasAccess = Boolean(user?.role && canAccessFinance(user.role as UserRole));

  const totals = useMemo(() => {
    const currencyOrders=orders.filter(order=>order.currency===currency);
    const totalAmount = currencyOrders.reduce((sum, order) => sum + order.totalAmount, 0);
    const paidAmount = currencyOrders.reduce((sum, order) => sum + order.paidAmount, 0);
    const remainingAmount = Math.max(0, totalAmount - paidAmount);
    const closedOrderCount = currencyOrders.filter((order) => order.remainingAmount <= 0).length;

    return {
      totalAmount,
      paidAmount,
      remainingAmount,
      closedOrderCount,
      orderCount: currencyOrders.length,
    };
  }, [orders,currency]);

  const load = async (silent = false) => {
    const requestId=++requestSequence.current;
    try {
      if (silent) setIsRefreshing(true);
      else setIsLoading(true);

      const data = await getOrdersWithPayments();
      if(requestId!==requestSequence.current)return;
      setOrders(data);setLoadError('');
    } catch (error) {
      if(requestId!==requestSequence.current)return;
      console.error('Finance load error:', error);
      setLoadError('Finans verileri alınamadı. Listeyi yenileyin.');
      showToast('Finans verileri alınamadı.', 'error');
    } finally {
      if(requestId===requestSequence.current){setIsLoading(false);setIsRefreshing(false);}
    }
  };

  useEffect(() => {
    setOrders([]);setLoadError('');
    if (!hasAccess) {
      setIsLoading(false);
      return;
    }
    void load(false);
    return()=>{requestSequence.current++;};
  }, [hasAccess,user?.tenantId,user?.id]);

  if (!hasAccess) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="rf-panel rounded-2xl p-8 text-center">
          <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">Finans modülüne erişim yetkin bulunmuyor.</p>
          <Link href="/dashboard" className="mt-4 inline-block text-sm font-medium text-sky-600 hover:underline">
            Kontrol paneline dön
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-slate-50/50 dark:bg-slate-950/50">
      <Navbar title="Finans Kontrolü" showSearch={false} />

      <main className="w-full flex-1 p-4 md:p-8">
        {loadError && <p role="alert" className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">{loadError}</p>}
        <section className="rf-panel rounded-2xl p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Finans Komuta Ekranı</h2>
              <p className="mt-1 text-sm text-slate-500">Tahsilat ve açık bakiye görünümü sipariş kayıtlarıyla senkronize çalışır.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => void load(true)} isLoading={isRefreshing}>
                <RefreshCw size={14} />
                Veriyi yenile
              </Button>
              <Link href="/finance/receivables">
                <Button type="button" variant="secondary" size="sm">
                  <Wallet size={14} />
                  Alacaklar
                </Button>
              </Link>
              <Link href="/finance/invoices">
                <Button type="button" variant="primary" size="sm">
                  <FileText size={14} />
                  Faturalar
                </Button>
              </Link>
            </div>
          </div>

          <label className="mt-4 flex items-center gap-3 text-xs">Özet para birimi<select value={currency} onChange={e=>setCurrency(e.target.value)} className="rf-input">{[...new Set(['TRY',...orders.map(order=>order.currency)])].map(value=><option key={value}>{value}</option>)}</select><span className="text-muted-foreground">Farklı para birimleri birbiriyle toplanmaz.</span></label>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Toplam işlem hacmi</p>
              <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
                {isLoading || loadError ? '-' : formatCurrency(totals.totalAmount,currency)}
              </p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tahsil edilen</p>
              <p className="mt-2 text-2xl font-bold text-emerald-600">
                {isLoading || loadError ? '-' : formatCurrency(totals.paidAmount,currency)}
              </p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Kalan bakiye</p>
              <p className="mt-2 text-2xl font-bold text-amber-600">
                {isLoading || loadError ? '-' : formatCurrency(totals.remainingAmount,currency)}
              </p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tam kapanan sipariş</p>
              <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
                {isLoading || loadError ? '-' : totals.closedOrderCount}
              </p>
            </article>
          </div>

          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Hızlı Finans Aksiyonları</h2>
              <Wallet size={16} className="text-slate-500" />
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <Link href="/finance/payments" className="group rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                Ödeme hareketleri
                <ArrowRight size={14} className="ml-2 inline-block opacity-60 transition group-hover:translate-x-0.5" />
              </Link>
              <Link href="/finance/documents" className="group rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                Finans belge arşivi
                <ArrowRight size={14} className="ml-2 inline-block opacity-60 transition group-hover:translate-x-0.5" />
              </Link>
              <Link href="/finance/employees" className="group rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                Personel maliyet ekranı
                <ArrowRight size={14} className="ml-2 inline-block opacity-60 transition group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
