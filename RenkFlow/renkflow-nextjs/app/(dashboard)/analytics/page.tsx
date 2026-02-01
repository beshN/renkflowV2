'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { Card } from '@/components/ui/Card';
import { useOrders } from '@/lib/hooks/useOrders';
import { useAuth } from '@/lib/context/AuthContext';
import { ArrowUpRight, TrendingUp, AlertTriangle, Gauge, CalendarClock } from 'lucide-react';

export default function AnalyticsPage() {
  const { orders } = useOrders();
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) return null;

  const metrics = useMemo(() => {
    const totalOrders = orders?.length || 0;
    const pending = orders?.filter((o) => o.status === 'pending').length || 0;
    const production = orders?.filter((o) => o.status === 'in_production').length || 0;
    const delivered = orders?.filter((o) => o.status === 'delivered').length || 0;
    const totalRevenue = orders?.reduce((sum, o) => sum + o.totalAmount, 0) || 0;
    const avgOrderValue = totalOrders ? totalRevenue / totalOrders : 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const overdue = (orders || []).filter((o) => {
      if (!o.deliveryDate || o.status === 'delivered') return false;
      return new Date(o.deliveryDate) < today;
    }).length;

    const completionRate = totalOrders ? Math.round((delivered / totalOrders) * 100) : 0;

    return {
      totalOrders,
      pending,
      production,
      delivered,
      totalRevenue,
      avgOrderValue,
      overdue,
      completionRate,
    };
  }, [orders]);

  const statusBreakdown = useMemo(() => {
    return [
      { label: 'Beklemede', value: metrics.pending, color: 'bg-amber-400', text: 'text-amber-600' },
      { label: 'Üretimde', value: metrics.production, color: 'bg-sky-500', text: 'text-sky-600' },
      { label: 'Teslim', value: metrics.delivered, color: 'bg-emerald-500', text: 'text-emerald-600' },
    ];
  }, [metrics]);

  const maxValue = Math.max(...statusBreakdown.map((item) => item.value), 1);

  return (
    <div className="flex-1 flex flex-col">
      <Navbar title="Analitik" showSearch />
      <main className="flex-1 p-4 md:p-8 pt-16 md:pt-8 space-y-6">
        <Card spotlight className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Performans</p>
              <h2 className="text-2xl font-bold text-text-light dark:text-text-dark">Sipariş Akışı Analizi</h2>
              <p className="text-sm text-subtle-light dark:text-subtle-dark">
                Üretim hızını, darboğazları ve teslimat performansını tek bakışta izleyin.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/reports"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/70 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-300 hover:text-slate-900 dark:border-slate-700/70 dark:bg-slate-900/60 dark:text-slate-200"
              >
                Raporlara geç
                <ArrowUpRight size={16} />
              </Link>
              <button className="inline-flex items-center gap-2 rounded-full bg-slate-900 text-white px-5 py-2.5 text-sm font-semibold shadow-[0_18px_40px_-24px_rgba(15,23,42,0.7)] hover:opacity-90">
                Analiz indir
              </button>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <Card spotlight className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Tamamlama Oranı</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{metrics.completionRate}%</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-300" />
              </div>
            </div>
          </Card>
          <Card spotlight className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Ortalama Sipariş</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">₺{Math.round(metrics.avgOrderValue).toLocaleString('tr-TR')}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-500/15 flex items-center justify-center">
                <Gauge className="w-5 h-5 text-sky-600 dark:text-sky-300" />
              </div>
            </div>
          </Card>
          <Card spotlight className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Geciken İş</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{metrics.overdue}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-500/15 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-300" />
              </div>
            </div>
          </Card>
          <Card spotlight className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Toplam Sipariş</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{metrics.totalOrders}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <CalendarClock className="w-5 h-5 text-slate-600 dark:text-slate-300" />
              </div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card spotlight className="p-6">
            <h3 className="text-lg font-semibold text-text-light dark:text-text-dark mb-4">Durum Dağılımı</h3>
            <div className="space-y-4">
              {statusBreakdown.map((item) => (
                <div key={item.label} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className={`h-3 w-3 rounded-full ${item.color}`} />
                      <span className="text-slate-700 dark:text-slate-200">{item.label}</span>
                    </div>
                    <span className="text-slate-500 dark:text-slate-400">{item.value}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full ${item.color}`}
                      style={{ width: `${(item.value / maxValue) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card spotlight className="p-6">
            <h3 className="text-lg font-semibold text-text-light dark:text-text-dark mb-4">Operasyon Sağlığı</h3>
            <div className="space-y-4 text-sm text-subtle-light dark:text-subtle-dark">
              <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 dark:border-slate-700/60 dark:bg-slate-900/60">
                <p className="font-semibold text-slate-900 dark:text-white">Teslimat disiplini</p>
                <p className="text-xs mt-1">Geciken işler için erken uyarı bildirimleri devrede.</p>
              </div>
              <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 dark:border-slate-700/60 dark:bg-slate-900/60">
                <p className="font-semibold text-slate-900 dark:text-white">Üretim dengesi</p>
                <p className="text-xs mt-1">WIP limitlerini koruyarak darboğazları azaltın.</p>
              </div>
              <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 dark:border-slate-700/60 dark:bg-slate-900/60">
                <p className="font-semibold text-slate-900 dark:text-white">Gelir optimizasyonu</p>
                <p className="text-xs mt-1">Yüksek değerli siparişler için önceliklendirme yapın.</p>
              </div>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
