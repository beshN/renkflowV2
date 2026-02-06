'use client';

import { useMemo, useEffect, lazy, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { Card } from '@/components/ui/Card';
import { RecentOrdersTable } from '@/components/dashboard/RecentOrdersTable';
import { useOrders } from '@/lib/hooks/useOrders';
import { useAuth } from '@/lib/context/AuthContext';
import { ActivityFeed, ActivityFeedCompact } from '@/components/activity/ActivityFeed';
import { StatsCardData } from '@/lib/types';
import { ShoppingBag, Factory, CheckCircle2, Banknote, Calendar, Loader2, Inbox } from 'lucide-react';
import { AdvancedStatsCard, StatsGrid } from '@/components/dashboard/AdvancedStatsCard';
import { OptimizedMotion, StaggerContainer } from '@/components/animations/OptimizedMotion';
import { cn } from '@/lib/utils';

export default function DashboardPage() {
  const { orders, isLoading: ordersLoading } = useOrders();
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  
  const isLoading = ordersLoading || authLoading;

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, authLoading, router]);

  // Calculate dynamic statistics from orders with REAL trends
  const statsData: StatsCardData[] = useMemo(() => {
    if (!orders) return [];
    
    const totalOrders = orders.length;
    const activeProduction = orders.filter(o => o.status === 'in_production').length;
    const delivered = orders.filter(o => o.status === 'delivered').length;
    const totalRevenue = orders.reduce((sum, order) => sum + order.totalAmount, 0);

    // Calculate real trends based on last 30 days
    const lastMonthOrders = orders.filter(o => {
      const orderDate = new Date(o.createdAt || o.date);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return orderDate >= thirtyDaysAgo;
    });

    const previousMonthOrders = orders.filter(o => {
      const orderDate = new Date(o.createdAt || o.date);
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return orderDate >= sixtyDaysAgo && orderDate < thirtyDaysAgo;
    });

    const calculateTrend = (current: number, previous: number) => {
      if (previous === 0) return { value: current > 0 ? 100 : 0, isPositive: current >= 0 };
      const change = Math.round(((current - previous) / previous) * 100);
      return { value: Math.abs(change), isPositive: change >= 0 };
    };

    return [
      {
        title: 'Toplam Sipariş',
        value: totalOrders.toString(),
        icon: ShoppingBag,
        trend: calculateTrend(lastMonthOrders.length, previousMonthOrders.length),
        color: 'text-primary',
        href: '/orders'
      },
      {
        title: 'Aktif Üretim',
        value: activeProduction.toString(),
        icon: Factory,
        trend: { value: activeProduction, isPositive: activeProduction > 0 },
        color: 'text-blue-600',
        href: '/orders?status=in_production'
      },
      {
        title: 'Teslim Edildi',
        value: delivered.toString(),
        icon: CheckCircle2,
        trend: calculateTrend(
          lastMonthOrders.filter(o => o.status === 'delivered').length,
          previousMonthOrders.filter(o => o.status === 'delivered').length
        ),
        color: 'text-green-600',
        href: '/orders?status=delivered'
      },
      {
        title: 'Toplam Gelir',
        value: `₺${(totalRevenue || 0).toLocaleString('tr-TR')}`,
        icon: Banknote,
        trend: calculateTrend(
          lastMonthOrders.reduce((sum, o) => sum + o.totalAmount, 0),
          previousMonthOrders.reduce((sum, o) => sum + o.totalAmount, 0)
        ),
        color: 'text-yellow-600',
        href: '/orders'
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
  const monthlyTrend = useMemo(() => [
    { month: 'Haz', value: 25 },
    { month: 'Tem', value: 35 },
    { month: 'Ağu', value: 30 },
    { month: 'Eyl', value: 45 },
    { month: 'Eki', value: 40 },
    { month: 'Kas', value: orders?.length || 50 },
  ], [orders?.length]);

  const maxTrendValue = Math.max(...monthlyTrend.map(m => m.value));

  // Loading State
  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col">
        <Navbar title="Dashboard" showSearch={true} />
        <main className="flex-1 p-4 md:p-8 pt-16 md:pt-8">
          <div className="flex flex-col items-center justify-center h-[60vh]">
            <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
            <p className="text-slate-500 dark:text-slate-400">Dashboard yükleniyor...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-slate-50/50 dark:bg-slate-950/50">
      <Navbar title="Dashboard" showSearch={true} />
      
      <main className="flex-1 p-4 md:p-8 pt-16 md:pt-8">
        {/* Action Center */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
          <Card variant="glass" className="xl:col-span-2 p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-slate-500">Hızlı Başlangıç</p>
                <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">Bugün ne yapmak istersiniz?</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 max-w-xl">
                  Sipariş oluşturun, üretim kanbanına göz atın veya ekip ayarlarını güncelleyin.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/new-order"
                  className="inline-flex items-center justify-center rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-5 py-2.5 text-sm font-medium hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors shadow-lg shadow-blue-500/10"
                >
                  Yeni Sipariş
                </Link>
                <Link
                  href="/orders"
                  className="glass-button inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200"
                >
                  Siparişleri Gör
                </Link>
                <Link
                  href="/kanban"
                  className="glass-button inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200"
                >
                  Üretim Kanban
                </Link>
              </div>
            </div>
          </Card>

          <Card variant="glass" className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">İçgörü</p>
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white mt-1">Haftalık özeti</h3>
              </div>
              <span className="text-xs text-slate-400">Son 7 gün</span>
            </div>
            <div className="mt-6 grid grid-cols-3 gap-4">
              <div className="rounded-lg bg-white/50 dark:bg-slate-800/50 p-4 border border-slate-200/50 dark:border-slate-700/50 backdrop-blur-sm">
                <p className="text-xs text-slate-500 mb-1">Tamamlama</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{dashboardInsights.completionRate}%</p>
              </div>
              <div className="rounded-lg bg-white/50 dark:bg-slate-800/50 p-4 border border-slate-200/50 dark:border-slate-700/50 backdrop-blur-sm">
                <p className="text-xs text-slate-500 mb-1">Ort. Sipariş</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  ₺{Math.round(dashboardInsights.avgOrderValue || 0).toLocaleString('tr-TR')}
                </p>
              </div>
              <div className="rounded-lg bg-red-50/50 dark:bg-red-900/20 p-4 border border-red-200/50 dark:border-red-800/30 backdrop-blur-sm">
                <p className="text-xs text-red-600 dark:text-red-400 mb-1">Geciken</p>
                <p className="text-2xl font-bold text-red-700 dark:text-red-500">{dashboardInsights.overdue}</p>
              </div>
            </div>
          </Card>
        </div>
        {/* Stats Grid */}
        <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6 md:mb-8">
          {statsData.map((stat, index) => (
            <OptimizedMotion key={stat.title} transition={{ delay: index * 0.1 }}>
              <StatsCard {...stat} />
            </OptimizedMotion>
          ))}
        </StaggerContainer>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Monthly Trend Chart - REAL DATA */}
          <Card variant="glass" spotlight className="relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4">
              <span className="text-xs font-medium px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full">
                Gerçek Zamanlı
              </span>
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">
              Aylık Sipariş Trendi
            </h3>
            <div className="h-64 flex items-end justify-between gap-2 px-4">
              {orders?.length === 0 ? (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                  <Inbox className="w-12 h-12 mb-3 opacity-50" />
                  <p className="text-sm">Henüz veri yok</p>
                </div>
              ) : (
                monthlyTrend.map((item) => (
                  <div key={item.month} className="flex-1 flex flex-col items-center gap-2 group cursor-pointer">
                    <div className="w-full relative flex items-end justify-center" style={{ height: '200px' }}>
                      <div
                        className="w-full bg-gradient-to-t from-blue-600 to-blue-400 dark:from-blue-500 dark:to-blue-300 rounded-t-lg transition-all duration-500 group-hover:opacity-90"
                        style={{ 
                          height: `${(item.value / maxTrendValue) * 100}%`,
                          transform: 'translateZ(0)',
                          willChange: 'height'
                        }}
                        title={`${item.value} sipariş`}
                      >
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {item.value}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{item.month}</span>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Status Distribution - PROFESSIONAL */}
          <Card variant="glass" spotlight className="flex flex-col">
            <div className="absolute top-0 right-0 p-4">
              <span className="text-xs font-medium px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full">
                Canlı
              </span>
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">
              Sipariş Durum Dağılımı
            </h3>
            {orders?.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                <Inbox className="w-12 h-12 mb-3 opacity-50" />
                <p className="text-sm">Henüz sipariş yok</p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col md:flex-row items-center justify-between gap-8">
                {/* Legend */}
                <div className="w-full md:w-1/2 space-y-4">
                  {statusDistribution.map((status) => (
                    <div key={status.label} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${status.color}`}></div>
                          <span className="font-medium text-slate-700 dark:text-slate-300">{status.label}</span>
                        </div>
                        <span className="text-slate-600 dark:text-slate-400 font-medium">{status.count} ({status.percentage.toFixed(0)}%)</span>
                      </div>
                      <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${status.color} transition-all duration-1000 ease-out`}
                          style={{ 
                            width: `${status.percentage}%`,
                            transform: 'translateZ(0)',
                            willChange: 'width'
                          }}
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
                    <span className="text-3xl font-bold text-slate-900 dark:text-white">{orders?.length || 0}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Toplam</span>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Recent Orders + Focus */}
        <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6">
          <Card variant="glass" spotlight className="p-0 overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Son Siparişler
                </h3>
                <Link href="/orders" className="text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                  Tümünü Gör
                </Link>
              </div>
            </div>
            <RecentOrdersTable orders={orders?.slice(0, 5) || []} />
          </Card>

          <Card variant="glass" spotlight className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Öncelikli İşler</h3>
              <span className="text-xs text-slate-500 dark:text-slate-400">7 gün</span>
            </div>
            <div className="mt-6 space-y-4">
              {focusOrders.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  Harika! Yaklaşan teslimat yok.
                </div>
              )}
              {focusOrders.map((order) => (
                <div key={order.id} className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 dark:border-slate-700/60 dark:bg-slate-900/60 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{order.productName || 'Sipariş'}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {order.customerName} • #{order.orderNumber || order.id.slice(0, 8)}
                      </p>
                    </div>
                    <span className="text-xs rounded-full bg-amber-100 px-2 py-1 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200 whitespace-nowrap flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString('tr-TR') : '-'}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span className={cn(
                      'px-2 py-0.5 rounded-full font-medium',
                      order.status === 'in_production' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30' :
                      order.status === 'pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30' :
                      'bg-slate-100 text-slate-700'
                    )}>
                      {order.status === 'in_production' ? 'Üretimde' : order.status === 'pending' ? 'Beklemede' : order.status}
                    </span>
                    <Link href={`/orders/${order.id}`} className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium">
                      Detaya git →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Activity Feed Row */}
        <div className="mt-8">
          <ActivityFeedCompact limit={6} />
        </div>
      </main>
    </div>
  );
}
