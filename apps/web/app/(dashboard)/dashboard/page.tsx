'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { 
  ClipboardList, Package, Truck, AlertTriangle, Activity, 
  PlusCircle, Boxes, ArrowRight, TrendingUp, Clock, CheckCircle2,
  Factory, ShoppingCart, ChevronRight, BarChart3
} from 'lucide-react';

import { AppleNavbar } from '@/components/layout/AppleNavbar';
import { AppleCard } from '@/components/shared/ui/AppleCard';
import { useOrders } from '@/lib/hooks/useOrders';
import { useAuth } from '@/lib/context/AuthContext';
import { formatCurrency, formatDate } from '@/lib/utils';
import { StatusBadge } from '@/components/shared/ui/StatusStepper';
import { cn } from '@/lib/utils';

// ============================================
// Types
// ============================================

interface DashboardSummary {
  orders: {
    active_count: string;
    pending_count: string;
    ready_for_shipment: string;
    today_deliveries: string;
  };
  production: {
    in_progress: string;
    open: string;
    blocked: string;
  };
  criticalStock: { critical_count: string };
  overdue: { overdue_count: string };
}

// ============================================
// Metric Card
// ============================================

function MetricCard({
  label,
  value,
  subLabel,
  icon: Icon,
  color,
  href,
  alert,
}: {
  label: string;
  value: string | number;
  subLabel?: string;
  icon: any;
  color: string;
  href?: string;
  alert?: boolean;
}) {
  const content = (
    <AppleCard
      variant="glass"
      className={cn(
        'relative overflow-hidden group transition-all duration-300 hover:scale-[1.02] hover:shadow-lg cursor-pointer',
        alert ? 'ring-1 ring-rose-500/30' : ''
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={cn('p-2.5 rounded-xl', color)}>
          <Icon size={20} className="text-white" />
        </div>
        {href && (
          <ChevronRight size={16} className="text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
        )}
      </div>
      <div>
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <h3 className={cn('text-3xl font-bold mt-1 tracking-tight', alert ? 'text-rose-600 dark:text-rose-400' : 'text-foreground')}>
          {value}
        </h3>
        {subLabel && <p className="text-xs text-muted-foreground mt-1">{subLabel}</p>}
      </div>
      {alert && (
        <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-rose-500 animate-ping" />
      )}
    </AppleCard>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

// ============================================
// Recent Orders Widget
// ============================================

function RecentOrdersWidget({ orders }: { orders: any[] }) {
  if (orders.length === 0) {
    return (
      <div className="py-8 text-center">
        <ClipboardList size={28} className="mx-auto text-muted-foreground/30 mb-2" />
        <p className="text-sm text-muted-foreground">Henüz sipariş yok</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {orders.slice(0, 6).map((order) => (
        <Link key={order.id} href={`/orders/${order.id}`}>
          <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors group cursor-pointer">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
              #{order.orderNumber?.slice(-3) || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{order.customerName}</p>
              <p className="text-xs text-muted-foreground truncate">{order.productName || 'Ürün belirtilmedi'}</p>
            </div>
            <div className="flex-shrink-0 text-right">
              <StatusBadge status={order.status} />
              <p className="text-xs text-muted-foreground mt-1">{formatDate(order.date || order.createdAt)}</p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

// ============================================
// Dashboard Page
// ============================================

export default function DashboardPage() {
  const { user } = useAuth();
  const { orders, isLoading } = useOrders();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(true);

  // Load live dashboard summary
  useEffect(() => {
    async function loadSummary() {
      try {
        // Use the AI tools endpoint to get dashboard summary
        const res = await fetch('/api/v1/dashboard/summary');
        if (res.ok) {
          const data = await res.json();
          setSummary(data.summary);
        }
      } catch {
        // Fallback to client-side calculation from orders
      } finally {
        setIsSummaryLoading(false);
      }
    }
    loadSummary();
  }, []);

  // Fallback stats from client orders
  const pendingCount = orders.filter((o) => ['pending', 'new', 'pending_approval'].includes(o.status)).length;
  const productionCount = orders.filter((o) => o.status === 'in_production').length;
  const readyCount = orders.filter((o) => ['ready_for_shipment', 'ready'].includes(o.status)).length;
  const totalVolume = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  const overdueOrders = orders.filter((o) => {
    if (!o.deliveryDate && !o.date) return false;
    const date = new Date(o.deliveryDate || o.date);
    return date < new Date() && !['completed', 'delivered', 'shipped', 'cancelled'].includes(o.status);
  });

  const activeCount = parseInt(summary?.orders?.active_count || '') || orders.filter((o) => !['completed', 'delivered', 'cancelled'].includes(o.status)).length;
  const overdueCount = parseInt(summary?.overdue?.overdue_count || '') || overdueOrders.length;
  const blockedCount = parseInt(summary?.production?.blocked || '') || 0;
  const criticalStockCount = parseInt(summary?.criticalStock?.critical_count || '') || 0;

  const metrics = [
    {
      label: 'Aktif Sipariş',
      value: isLoading ? '...' : activeCount,
      subLabel: 'Açık operasyonlar',
      icon: ClipboardList,
      color: 'bg-blue-500',
      href: '/orders',
    },
    {
      label: 'Geciken Sipariş',
      value: isLoading ? '...' : overdueCount,
      subLabel: overdueCount > 0 ? 'Acil müdahale gerekiyor' : 'Her şey yolunda',
      icon: Clock,
      color: overdueCount > 0 ? 'bg-rose-500' : 'bg-emerald-500',
      href: '/orders',
      alert: overdueCount > 0,
    },
    {
      label: 'Üretimde',
      value: isLoading ? '...' : productionCount + (parseInt(summary?.production?.in_progress || '') || 0),
      subLabel: blockedCount > 0 ? `${blockedCount} bloke` : 'Aktif üretim',
      icon: Factory,
      color: blockedCount > 0 ? 'bg-amber-500' : 'bg-purple-500',
      href: '/work-orders',
      alert: blockedCount > 0,
    },
    {
      label: 'Kritik Stok',
      value: isLoading ? '...' : criticalStockCount,
      subLabel: criticalStockCount > 0 ? 'Satın alma gerekiyor' : 'Stok seviyeleri normal',
      icon: Boxes,
      color: criticalStockCount > 0 ? 'bg-orange-500' : 'bg-teal-500',
      href: '/inventory',
      alert: criticalStockCount > 0,
    },
  ];

  // Quick actions
  const quickActions = [
    { label: 'Yeni Sipariş', desc: 'Müşteri talebi gir', href: '/new-order', icon: PlusCircle, primary: true },
    { label: 'Sipariş Listesi', desc: 'Tüm siparişleri gör', href: '/orders', icon: ClipboardList, primary: false },
    { label: 'Envanter', desc: 'Stok durumunu kontrol et', href: '/inventory', icon: Boxes, primary: false },
    { label: 'Üretim Emirleri', desc: 'İş emirlerini yönet', href: '/work-orders', icon: Factory, primary: false },
    { label: 'Müşteriler', desc: 'CRM ve iletişim', href: '/crm', icon: ShoppingCart, primary: false },
    { label: 'Raporlar', desc: 'Analiz ve raporlama', href: '/reports', icon: BarChart3, primary: false },
  ];

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Günaydın';
    if (hour < 18) return 'İyi öğleden sonralar';
    return 'İyi akşamlar';
  };

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-neutral-50/50 dark:bg-black">
      <AppleNavbar title="Kontrol Paneli" />

      <main className="w-full max-w-[1600px] mx-auto flex-1 p-5 md:p-8 space-y-8 animate-fade-in">

        {/* Hero */}
        <section className="space-y-1">
          <h2 className="text-3xl font-display font-bold tracking-tight text-foreground">
            {greeting()}, <span className="text-muted-foreground">{user?.name?.split(' ')[0] || 'Hoş geldiniz'}</span>
          </h2>
          <p className="text-base text-muted-foreground max-w-2xl">
            Bugünün operasyon özeti — {new Date().toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </section>

        {/* Metric Cards */}
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((m) => (
            <MetricCard key={m.label} {...m} />
          ))}
        </div>

        {/* Overdue Alert */}
        {overdueOrders.length > 0 && (
          <div className="flex items-start gap-3 rounded-2xl border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-900/10 p-4">
            <AlertTriangle size={18} className="text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-rose-700 dark:text-rose-400">
                {overdueOrders.length} sipariş gecikmiş!
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {overdueOrders.slice(0, 5).map((o) => (
                  <Link key={o.id} href={`/orders/${o.id}`}>
                    <span className="text-xs rounded-lg bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 px-2 py-1 hover:bg-rose-200 transition-colors">
                      #{o.orderNumber} · {o.customerName}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
            <Link href="/orders" className="text-xs text-rose-600 dark:text-rose-400 underline underline-offset-2 flex-shrink-0">
              Tümünü gör
            </Link>
          </div>
        )}

        {/* Main Grid */}
        <div className="grid gap-6 lg:grid-cols-3">

          {/* Quick Actions */}
          <AppleCard className="lg:col-span-1">
            <h3 className="text-base font-semibold text-foreground mb-4">Hızlı Erişim</h3>
            <div className="space-y-1.5">
              {quickActions.map(({ label, desc, href, icon: Icon, primary }) => (
                <Link key={label} href={href}>
                  <div className={cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer',
                    primary
                      ? 'bg-primary text-white shadow-md shadow-primary/20 hover:bg-primary/90'
                      : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  )}>
                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', primary ? 'bg-white/20' : 'bg-primary/10')}>
                      <Icon size={16} className={primary ? 'text-white' : 'text-primary'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm font-semibold', primary ? 'text-white' : 'text-foreground')}>{label}</p>
                      <p className={cn('text-xs', primary ? 'text-white/70' : 'text-muted-foreground')}>{desc}</p>
                    </div>
                    <ArrowRight size={14} className={primary ? 'text-white/70' : 'text-muted-foreground'} />
                  </div>
                </Link>
              ))}
            </div>
          </AppleCard>

          {/* Recent Orders */}
          <AppleCard className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-foreground">Son Siparişler</h3>
              <Link href="/orders" className="text-xs text-primary hover:underline flex items-center gap-1">
                Tümünü gör <ArrowRight size={12} />
              </Link>
            </div>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-14 rounded-xl bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
                ))}
              </div>
            ) : (
              <RecentOrdersWidget orders={orders} />
            )}
          </AppleCard>
        </div>

        {/* Status Overview */}
        <AppleCard>
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-semibold text-foreground">Sipariş Durum Özeti</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { status: 'new', label: 'Yeni', count: orders.filter(o => ['new', 'pending'].includes(o.status)).length, color: 'bg-blue-500' },
              { status: 'approved', label: 'Onaylı', count: orders.filter(o => ['approved', 'pending_approval'].includes(o.status)).length, color: 'bg-emerald-500' },
              { status: 'preparing_materials', label: 'Malzeme', count: orders.filter(o => String(o.status) === 'preparing_materials').length, color: 'bg-purple-500' },
              { status: 'in_production', label: 'Üretim', count: productionCount, color: 'bg-sky-500' },
              { status: 'quality_check', label: 'Kalite KT.', count: orders.filter(o => String(o.status) === 'quality_check').length, color: 'bg-orange-500' },
              { status: 'ready_for_shipment', label: 'Sevkiyat', count: readyCount, color: 'bg-teal-500' },
            ].map(({ status, label, count, color }) => (
              <Link key={status} href={`/orders?status=${status}`}>
                <div className="flex flex-col items-center gap-2 p-3 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer group">
                  <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white shadow-md', color)}>
                    {count}
                  </div>
                  <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors text-center">{label}</span>
                </div>
              </Link>
            ))}
          </div>
        </AppleCard>

      </main>
    </div>
  );
}
