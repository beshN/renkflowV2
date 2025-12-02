'use client';

import { useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { Card } from '@/components/ui/Card';
import { RecentOrdersTable } from '@/components/dashboard/RecentOrdersTable';
import { useOrders } from '@/lib/hooks/useOrders';
import { useAuth } from '@/lib/context/AuthContext';
import { StatsCardData } from '@/lib/types';

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
    const totalRevenue = orders.reduce((sum, order) => sum + order.amount, 0);

    return [
      {
        title: 'Toplam Sipariş',
        value: totalOrders.toString(),
        icon: 'shopping_bag',
        trend: { value: 12, isPositive: true },
        color: 'text-primary',
      },
      {
        title: 'Aktif Üretim',
        value: activeProduction.toString(),
        icon: 'factory',
        trend: { value: 3, isPositive: true },
        color: 'text-blue-600',
      },
      {
        title: 'Teslim Edildi',
        value: delivered.toString(),
        icon: 'check_circle',
        trend: { value: 8, isPositive: true },
        color: 'text-green-600',
      },
      {
        title: 'Toplam Gelir',
        value: `₺${totalRevenue.toLocaleString('tr-TR')}`,
        icon: 'payments',
        trend: { value: 15, isPositive: true },
        color: 'text-yellow-600',
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
      
      <main className="flex-1 p-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {statsData.map((stat) => (
            <StatsCard key={stat.title} {...stat} />
          ))}
        </div>

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

        {/* Recent Orders */}
        <Card spotlight className="p-0">
          <div className="p-6 border-b border-border-light dark:border-border-dark">
            <h3 className="text-lg font-semibold text-text-light dark:text-text-dark">
              Son Siparişler
            </h3>
          </div>
          <RecentOrdersTable orders={orders?.slice(0, 5) || []} />
        </Card>
      </main>
    </div>
  );
}
