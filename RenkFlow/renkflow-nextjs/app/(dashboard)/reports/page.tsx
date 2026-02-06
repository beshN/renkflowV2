'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { Card } from '@/components/ui/Card';
import { useOrders } from '@/lib/hooks/useOrders';
import { useAuth } from '@/lib/context/AuthContext';
import { Download, Filter, ArrowUpRight, BadgeCheck, CalendarClock } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

const ranges = [
  { label: '7 Gün', value: '7d' },
  { label: '30 Gün', value: '30d' },
  { label: '90 Gün', value: '90d' },
];

export default function ReportsPage() {
  const { orders } = useOrders();
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [range, setRange] = useState('30d');

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return (
      <div className="flex-1 flex flex-col">
        <Navbar title="Raporlar" showSearch={false} />
        <main className="flex-1 p-4 md:p-8 pt-16 md:pt-8 space-y-6">
          <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-48 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse" />
            <div className="h-48 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse" />
          </div>
        </main>
      </div>
    );
  }

  const reportData = useMemo(() => {
    const totalRevenue = orders?.reduce((sum, o) => sum + o.totalAmount, 0) || 0;
    const delivered = orders?.filter((o) => o.status === 'delivered').length || 0;
    const pending = orders?.filter((o) => o.status === 'pending').length || 0;
    const production = orders?.filter((o) => o.status === 'in_production').length || 0;

    const customerTotals = new Map<string, number>();
    orders?.forEach((o) => {
      const key = o.customerName || 'Bilinmeyen Müşteri';
      customerTotals.set(key, (customerTotals.get(key) || 0) + o.totalAmount);
    });

    const topCustomers = Array.from(customerTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([name, total]) => ({ name, total }));

    const avgOrder = orders?.length ? totalRevenue / orders.length : 0;

    return {
      totalRevenue,
      delivered,
      pending,
      production,
      avgOrder,
      topCustomers,
    };
  }, [orders]);

  return (
    <div className="flex-1 flex flex-col">
      <Navbar title="Raporlar" showSearch />
      <main className="flex-1 p-4 md:p-8 pt-16 md:pt-8 space-y-6">
        <Card spotlight className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Genel Özet</p>
              <h2 className="text-2xl font-bold text-text-light dark:text-text-dark">Operasyon Raporu</h2>
              <p className="text-sm text-subtle-light dark:text-subtle-dark">
                Sipariş hacmi, teslimat performansı ve finansal görünüm.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/70 px-4 py-2 text-xs font-semibold text-slate-600 dark:border-slate-700/60 dark:bg-slate-900/60 dark:text-slate-200">
                <Filter size={14} />
                {range.toUpperCase()}
              </div>
              <button className="inline-flex items-center gap-2 rounded-full bg-slate-900 text-white px-5 py-2.5 text-sm font-semibold shadow-[0_18px_40px_-24px_rgba(15,23,42,0.7)] hover:opacity-90">
                <Download size={16} />
                Raporu indir
              </button>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {ranges.map((item) => (
              <button
                key={item.value}
                onClick={() => setRange(item.value)}
                className={`rounded-full px-4 py-2 text-xs font-semibold transition-all ${
                  range === item.value
                    ? 'bg-slate-900 text-white'
                    : 'bg-white/70 text-slate-600 border border-slate-200/70 dark:bg-slate-900/60 dark:text-slate-200 dark:border-slate-700/60'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card spotlight className="p-6">
            <p className="text-xs text-slate-500 dark:text-slate-400">Toplam Gelir</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(reportData.totalRevenue, 'TRY')}</p>
          </Card>
          <Card spotlight className="p-6">
            <p className="text-xs text-slate-500 dark:text-slate-400">Teslim Edildi</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{reportData.delivered}</p>
          </Card>
          <Card spotlight className="p-6">
            <p className="text-xs text-slate-500 dark:text-slate-400">Üretimde / Beklemede</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{reportData.production} / {reportData.pending}</p>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card spotlight className="p-6">
            <h3 className="text-lg font-semibold text-text-light dark:text-text-dark mb-4">Özet Trend</h3>
            <div className="space-y-3 text-sm text-subtle-light dark:text-subtle-dark">
              <p>• Ortalama sipariş tutarı {formatCurrency(Math.round(reportData.avgOrder), 'TRY')} seviyesinde.</p>
              <p>• Toplam {orders?.length || 0} sipariş bu dönemde işlendi.</p>
              <p>• Üretim yoğunluğu dengede; teslimat oranı yükseliyor.</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 px-3 py-1 text-xs font-semibold dark:bg-emerald-500/10 dark:text-emerald-300">
                <BadgeCheck size={12} />
                Teslimat istikrarı
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 text-sky-700 px-3 py-1 text-xs font-semibold dark:bg-sky-500/10 dark:text-sky-300">
                <CalendarClock size={12} />
                Planlama görünürlüğü
              </span>
            </div>
          </Card>
          <Card spotlight className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-text-light dark:text-text-dark">En iyi müşteriler</h3>
              <Link
                href="/orders"
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300"
              >
                Siparişlere git
                <ArrowUpRight size={14} />
              </Link>
            </div>
            <div className="space-y-3">
              {reportData.topCustomers.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  Henüz müşteri verisi yok.
                </div>
              ) : (
                reportData.topCustomers.map((customer) => (
                  <div key={customer.name} className="flex items-center justify-between rounded-2xl border border-slate-200/70 bg-white/70 px-4 py-3 text-sm dark:border-slate-700/60 dark:bg-slate-900/60">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">{customer.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Toplam satış</p>
                    </div>
                    <p className="font-semibold text-slate-900 dark:text-white">{formatCurrency(customer.total, 'TRY')}</p>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
