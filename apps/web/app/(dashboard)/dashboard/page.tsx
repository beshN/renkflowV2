'use client';

import Link from 'next/link';
import { ArrowUpRight, ClipboardList, DollarSign, PackageCheck, Truck } from 'lucide-react';

import { Navbar } from '@/components/layout/Navbar';
import { useOrders } from '@/lib/hooks/useOrders';
import { formatCurrency } from '@/lib/utils';

export default function DashboardPage() {
  const { orders, isLoading } = useOrders();

  const pendingCount = orders.filter((item) => item.status === 'pending').length;
  const productionCount = orders.filter((item) => item.status === 'in_production').length;
  const deliveredCount = orders.filter((item) => item.status === 'delivered').length;
  const totalVolume = orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);

  const metrics = [
    { label: 'Toplam Sipariş', value: orders.length.toString(), icon: ClipboardList },
    { label: 'Bekleyen İş', value: pendingCount.toString(), icon: PackageCheck },
    { label: 'Üretim Aşaması', value: productionCount.toString(), icon: Truck },
    { label: 'Toplam Hacim', value: formatCurrency(totalVolume), icon: DollarSign },
  ];

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-slate-50/50 dark:bg-slate-950/50">
      <Navbar title="Kontrol Paneli" showSearch={false} />

      <main className="w-full flex-1 p-4 md:p-8">
        <section className="rf-panel rounded-2xl p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Operasyon Kontrol Merkezi</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100">Günün kararlarını tek ekrandan yönet</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            Bu panel, sipariş durumu, üretim yoğunluğu ve finans hacmini tek bakışta gösterir. Bir sonraki fazda rol bazlı KPI setleri aynı yapıya eklenecek.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.label} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
                    <Icon size={16} className="text-slate-500" />
                  </div>
                  <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{isLoading ? '-' : item.value}</p>
                </article>
              );
            })}
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Link href="/new-order" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
              Yeni Sipariş Aç
            </Link>
            <Link href="/orders" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
              Sipariş Operasyonları
            </Link>
            <Link href="/finance" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
              Finans Kontrolü
            </Link>
            <Link href="/inventory" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
              Envanter Yönetimi
            </Link>
          </div>

          <article className="mt-6 rounded-xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold text-slate-800 dark:text-slate-100">Operasyon Dağılımı</p>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                Güncel görünüm
                <ArrowUpRight size={14} />
              </span>
            </div>
            <p className="mt-2 text-slate-600 dark:text-slate-400">
              Bekleyen: {pendingCount} • Üretimde: {productionCount} • Teslim edilen: {deliveredCount}
            </p>
          </article>
        </section>
      </main>
    </div>
  );
}
