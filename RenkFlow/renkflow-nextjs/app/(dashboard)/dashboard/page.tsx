'use client';

import { useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { Card } from '@/components/ui/Card';
import { RecentOrdersTable } from '@/components/dashboard/RecentOrdersTable';
import { useOrders } from '@/lib/hooks/useOrders';
import { useAuth } from '@/lib/context/AuthContext';
import { StatsCardData } from '@/lib/types';
import { ShoppingBag, Factory, CheckCircle2, Banknote } from 'lucide-react';
import { AdvancedStatsCard, StatsGrid } from '@/components/dashboard/AdvancedStatsCard';

export default function DashboardPage() {
  const { orders } = useOrders();
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, isLoading, router]);

  // Calculate dynamic statistics from orders
  const statsData: StatsCardData[] = useMemo(() => {
    if (!orders) return [];
    
    const totalOrders = orders.length;
    const activeProduction = orders.filter(o => o.status === 'in_production').length;
    const delivered = orders.filter(o => o.status === 'delivered').length;
    const totalRevenue = orders.reduce((sum, order) => sum + order.totalAmount, 0);

    return [
      {
        title: 'Toplam Sipariş',
        value: totalOrders.toString(),
        icon: ShoppingBag,
        trend: { value: 12, isPositive: true },
        color: 'text-primary',
        href: '/orders'
      },
      {
        title: 'Aktif Üretim',
        value: activeProduction.toString(),
        icon: Factory,
        trend: { value: 3, isPositive: true },
        color: 'text-blue-600',
        href: '/orders?status=in_production'
      },
      {
        title: 'Teslim Edildi',
        value: delivered.toString(),
        icon: CheckCircle2,
        trend: { value: 8, isPositive: true },
        color: 'text-green-600',
        href: '/orders?status=delivered'
      },
      {
        title: 'Toplam Gelir',
        value: `₺${(totalRevenue || 0).toLocaleString('tr-TR')}`,
        icon: Banknote,
        trend: { value: 15, isPositive: true },
        color: 'text-yellow-600',
        href: '/orders' // Could go to a finance/reports page later
      },
    ];
  }, [orders]);

  // Status distribution
  const statusDistribution = useMemo(() => {
    if (!orders || orders.length === 0) return [];
    const pending = orders.filter(o => o.status === 'pending').length;
    const production = orders.filter(o => o.status === 'in_production').length;
    const delivered = orders.filter(o => o.status === 'delivered').length;
    const total = orders.length;
    
    return [
      { label: 'Beklemede', count: pending, percentage: (pending / total) * 100, color: 'bg-yellow-500' },
      { label: 'Üretimde', count: production, percentage: (production / total) * 100, color: 'bg-blue-500' },
      { label: 'Teslim Edildi', count: delivered, percentage: (delivered / total) * 100, color: 'bg-green-500' },
    ];
  }, [orders]);

  const dashboardInsights = useMemo(() => {
    const totalOrders = orders?.length || 0;
    const delivered = orders?.filter((o) => o.status === 'delivered').length || 0;
    const completionRate = totalOrders > 0 ? Math.round((delivered / totalOrders) * 100) : 0;
    const totalRevenue = orders?.reduce((sum, order) => sum + order.totalAmount, 0) || 0;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const overdue = (orders || []).filter((o) => {
      if (!o.deliveryDate) return false;
      if (o.status === 'delivered') return false;
      const due = new Date(o.deliveryDate);
      return due < today;
    }).length;

    return {
      completionRate,
      avgOrderValue,
      overdue,
    };
  }, [orders]);

  const focusOrders = useMemo(() => {
    if (!orders || orders.length === 0) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const soon = new Date(today);
    soon.setDate(today.getDate() + 7);
    return orders
      .filter((o) => o.deliveryDate && o.status !== 'delivered')
      .map((o) => ({ ...o, deliveryDateObj: new Date(o.deliveryDate!) }))
      .filter((o) => o.deliveryDateObj <= soon)
      .sort((a, b) => a.deliveryDateObj.getTime() - b.deliveryDateObj.getTime())
      .slice(0, 4);
  }, [orders]);

  // Monthly trend (last 6 months simulation)
  const monthlyTrend = useMemo(() => {
    return [
      { month: 'Haz', value: 25 },
      { month: 'Tem', value: 35 },
      { month: 'Ağu', value: 30 },
      { month: 'Eyl', value: 45 },
      { month: 'Eki', value: 40 },
      { month: 'Kas', value: orders?.length || 50 },
    ];
  }, [orders]);

  const maxTrendValue = Math.max(...monthlyTrend.map(m => m.value));

  return (
    <div className="flex-1 flex flex-col">
      <Navbar title="Dashboard" showSearch={true} />
      
      <main className="flex-1 p-4 md:p-8 pt-16 md:pt-8">
        {/* Action Center */}
        <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_1fr] gap-6 mb-8">
          <Card spotlight className="p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Hızlı Başlangıç</p>
                <h2 className="text-2xl md:text-3xl font-bold text-text-light dark:text-text-dark">Bugün ne yapmak istersiniz?</h2>
                <p className="text-sm md:text-base text-subtle-light dark:text-subtle-dark max-w-xl">
                  Sipariş oluşturun, üretim kanbanına göz atın veya ekip ayarlarını güncelleyin.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/new-order"
                  className="inline-flex items-center justify-center rounded-full bg-slate-900 text-white px-5 py-2.5 text-sm font-semibold shadow-[0_18px_40px_-24px_rgba(15,23,42,0.7)] hover:opacity-90"
                >
                  Yeni Sipariş
                </Link>
                <Link
                  href="/orders"
                  className="inline-flex items-center justify-center rounded-full border border-slate-200/70 bg-white/70 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:border-sky-200 hover:text-slate-900 dark:border-slate-700/70 dark:bg-slate-900/60 dark:text-slate-200"
                >
                  Siparişleri Gör
                </Link>
                <Link
                  href="/kanban"
                  className="inline-flex items-center justify-center rounded-full border border-slate-200/70 bg-white/70 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:border-emerald-200 hover:text-slate-900 dark:border-slate-700/70 dark:bg-slate-900/60 dark:text-slate-200"
                >
                  Üretim Kanban
                </Link>
                <Link
                  href="/settings"
                  className="inline-flex items-center justify-center rounded-full border border-slate-200/70 bg-white/70 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-300 hover:text-slate-900 dark:border-slate-700/70 dark:bg-slate-900/60 dark:text-slate-200"
                >
                  Ayarlar
                </Link>
              </div>
            </div>
          </Card>

          <Card spotlight className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">İçgörü</p>
                <h3 className="text-xl font-semibold text-text-light dark:text-text-dark mt-2">Haftalık sağlık özeti</h3>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400">Son 7 gün</span>
            </div>
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 dark:border-slate-700/60 dark:bg-slate-900/60">
                <p className="text-xs text-slate-500 dark:text-slate-400">Tamamlama Oranı</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{dashboardInsights.completionRate}%</p>
              </div>
              <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 dark:border-slate-700/60 dark:bg-slate-900/60">
                <p className="text-xs text-slate-500 dark:text-slate-400">Ortalama Sipariş</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  ₺{Math.round(dashboardInsights.avgOrderValue || 0).toLocaleString('tr-TR')}
                </p>
              </div>
              <div className="rounded-2xl border border-rose-200/70 bg-rose-50/60 p-4 text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                <p className="text-xs">Geciken</p>
                <p className="text-2xl font-bold">{dashboardInsights.overdue}</p>
              </div>
            </div>
          </Card>
        </div>
        {/* Stats Grid */}
        <StatsGrid columns={4} className="mb-6 md:mb-8">
          <AdvancedStatsCard
            title="Toplam Sipariş"
            value={orders?.length || 0}
            icon={ShoppingBag}
            iconColor="text-blue-600"
            trend={{ value: 12, isPositive: true }}
            format="number"
            href="/orders"
          />
          <AdvancedStatsCard
            title="Aktif Üretim"
            value={orders?.filter(o => o.status === 'in_production').length || 0}
            icon={Factory}
            iconColor="text-amber-600"
            trend={{ value: 3, isPositive: true }}
            format="number"
            href="/orders?status=in_production"
          />
          <AdvancedStatsCard
            title="Teslim Edildi"
            value={orders?.filter(o => o.status === 'delivered').length || 0}
            icon={CheckCircle2}
            iconColor="text-green-600"
            trend={{ value: 8, isPositive: true }}
            format="number"
            href="/orders?status=delivered"
          />
          <AdvancedStatsCard
            title="Toplam Gelir"
            value={orders?.reduce((sum, order) => sum + order.totalAmount, 0) || 0}
            icon={Banknote}
            iconColor="text-yellow-600"
            trend={{ value: 15, isPositive: true }}
            format="currency"
            currency="₺"
            href="/orders"
          />
        </StatsGrid>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Monthly Trend Chart */}
          <Card spotlight>
            <h3 className="text-lg font-semibold text-text-light dark:text-text-dark mb-6">
              Aylık Sipariş Trendi
            </h3>
            <div className="h-64 flex items-end justify-between gap-2 px-4">
              {monthlyTrend.map((item) => (
                <div key={item.month} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full relative flex items-end justify-center" style={{ height: '200px' }}>
                    <div
                      className="w-full bg-gradient-to-t from-primary to-primary/50 rounded-t-lg transition-all hover:opacity-80"
                      style={{ height: `${(item.value / maxTrendValue) * 100}%` }}
                      title={`${item.value} sipariş`}
                    ></div>
                  </div>
                  <span className="text-xs font-medium text-subtle-light dark:text-subtle-dark">{item.month}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Status Distribution */}
          <Card spotlight className="flex flex-col">
            <h3 className="text-lg font-semibold text-text-light dark:text-text-dark mb-6">
              Sipariş Durum Dağılımı
            </h3>
            <div className="flex-1 flex flex-col md:flex-row items-center justify-between gap-8">
              {/* Legend */}
              <div className="w-full md:w-1/2 space-y-4">
                {statusDistribution.map((status) => (
                  <div key={status.label} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${status.color}`}></div>
                        <span className="font-medium text-text-light dark:text-text-dark">{status.label}</span>
                      </div>
                      <span className="text-subtle-light dark:text-subtle-dark font-medium">{status.count} ({status.percentage.toFixed(0)}%)</span>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${status.color} transition-all duration-1000 ease-out`}
                        style={{ width: `${status.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Donut Chart */}
              <div className="relative w-48 h-48 flex-shrink-0">
                <svg viewBox="0 0 100 100" className="transform -rotate-90 w-full h-full drop-shadow-xl">
                  {/* Background Circle */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="12"
                    className="text-slate-100 dark:text-slate-800"
                  />
                  {statusDistribution.reduce((acc, status, index) => {
                    const prevPercentage = statusDistribution.slice(0, index).reduce((sum, s) => sum + s.percentage, 0);
                    const strokeDasharray = `${status.percentage} ${100 - status.percentage}`;
                    const strokeDashoffset = -prevPercentage;
                    
                    // Convert tailwind classes to hex colors for SVG stroke
                    let strokeColor = '#EAB308'; // yellow-500 default
                    if (status.color.includes('blue')) strokeColor = '#3B82F6';
                    if (status.color.includes('green')) strokeColor = '#10B981';
                    
                    return [...acc, (
                      <circle
                        key={status.label}
                        cx="50"
                        cy="50"
                        r="40"
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth="12"
                        strokeDasharray={strokeDasharray}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                        className="transition-all duration-1000 ease-out hover:opacity-80 cursor-pointer"
                      />
                    )];
                  }, [] as JSX.Element[])}
                </svg>
                {/* Center Text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-3xl font-bold text-text-light dark:text-text-dark">{orders?.length || 0}</span>
                  <span className="text-xs text-subtle-light dark:text-subtle-dark font-medium">Toplam</span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Recent Orders + Focus */}
        <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6">
          <Card spotlight className="p-0">
            <div className="p-6 border-b border-border-light dark:border-border-dark">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-text-light dark:text-text-dark">
                  Son Siparişler
                </h3>
                <Link href="/orders" className="text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                  Tümünü Gör
                </Link>
              </div>
            </div>
            <RecentOrdersTable orders={orders?.slice(0, 5) || []} />
          </Card>

          <Card spotlight className="p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-text-light dark:text-text-dark">Öncelikli İşler</h3>
              <span className="text-xs text-slate-500 dark:text-slate-400">7 gün</span>
            </div>
            <div className="mt-6 space-y-4">
              {focusOrders.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  Harika! Yaklaşan teslimat yok.
                </div>
              )}
              {focusOrders.map((order) => (
                <div key={order.id} className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 dark:border-slate-700/60 dark:bg-slate-900/60">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{order.productName || 'Sipariş'}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {order.customerName} • {order.orderNumber || String(order.id).slice(0, 8)}
                      </p>
                    </div>
                    <span className="text-xs rounded-full bg-amber-100 px-2 py-1 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200">
                      {order.deliveryDate}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>{order.status === 'in_production' ? 'Üretimde' : 'Beklemede'}</span>
                    <Link href={`/orders/${order.id}`} className="text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">
                      Detaya git →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
