'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
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

  const [orders, setOrders] = useState<OrderWithPayments[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const hasAccess = Boolean(user?.role && canAccessFinance(user.role as UserRole));

  const totals = useMemo(() => {
    const totalAmount = orders.reduce((sum, order) => sum + order.totalAmount, 0);
    const paidAmount = orders.reduce((sum, order) => sum + order.paidAmount, 0);
    const remainingAmount = Math.max(0, totalAmount - paidAmount);
    const closedOrderCount = orders.filter((order) => order.remainingAmount <= 0).length;

    return {
      totalAmount,
      paidAmount,
      remainingAmount,
      closedOrderCount,
      orderCount: orders.length,
    };
  }, [orders]);

  const load = async (silent = false) => {
    try {
      if (silent) setIsRefreshing(true);
      else setIsLoading(true);

      const data = await getOrdersWithPayments();
      setOrders(data);
    } catch (error) {
      console.error('Finance load error:', error);
      showToast('Finans verileri alınamadı.', 'error');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!hasAccess) {
      setIsLoading(false);
      return;
    }
    void load(false);
  }, [hasAccess]);

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
        <section className="rf-panel rounded-2xl p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Finans Komuta Ekranı</h1>
              <p className="mt-1 text-sm text-slate-500">Tahsilat ve açık bakiye görünümü sipariş kayıtlarıyla senkronize çalışır.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => void load(true)} isLoading={isRefreshing}>
                <RefreshCw size={14} />
                Veriyi yenile
              </Button>
              <Link href="/finance/invoice">
                <Button type="button" variant="primary" size="sm">
                  <FileText size={14} />
                  Fatura listesi
                </Button>
              </Link>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Toplam işlem hacmi</p>
              <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
                {isLoading ? '-' : formatCurrency(totals.totalAmount)}
              </p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tahsil edilen</p>
              <p className="mt-2 text-2xl font-bold text-emerald-600">
                {isLoading ? '-' : formatCurrency(totals.paidAmount)}
              </p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Kalan bakiye</p>
              <p className="mt-2 text-2xl font-bold text-amber-600">
                {isLoading ? '-' : formatCurrency(totals.remainingAmount)}
              </p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tam kapanan sipariş</p>
              <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
                {isLoading ? '-' : totals.closedOrderCount}
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
