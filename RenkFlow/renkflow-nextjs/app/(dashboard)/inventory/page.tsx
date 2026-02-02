'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { ActivityFeed } from '@/components/activity/ActivityFeed';
import { 
  Package, 
  AlertTriangle, 
  TrendingDown,
  Warehouse,
  Plus,
  Search,
  Filter,
  ArrowRight,
  BarChart3
} from 'lucide-react';
import { 
  getInventorySummary, 
  getStockAlerts, 
  getInventoryItems 
} from '@/app/actions/inventory.actions';
import { 
  InventorySummary, 
  StockAlert, 
  InventoryItem,
  INVENTORY_CATEGORY_LABELS 
} from '@/lib/types/inventory';
import { useToast } from '@/lib/context/ToastContext';
import { cn, formatCurrency } from '@/lib/utils';

export default function InventoryDashboardPage() {
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [recentItems, setRecentItems] = useState<InventoryItem[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [summaryData, alertsData, itemsData] = await Promise.all([
        getInventorySummary(),
        getStockAlerts(),
        getInventoryItems({ limit: 5 }),
      ]);
      
      setSummary(summaryData);
      setAlerts(alertsData.slice(0, 5));
      setRecentItems(itemsData.items);
    } catch (error) {
      console.error('Error loading inventory data:', error);
      showToast('Veriler yüklenirken hata oluştu', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      <Navbar title="Stok & Envanter" showSearch={false} />
      
      <main className="flex-1 p-4 md:p-8 pt-16 md:pt-8 space-y-6">
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Stok Yönetimi</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Ham madde, yarı mamul ve bitmiş ürün takibi
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/inventory/alerts"
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors",
                alerts.length > 0
                  ? "bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
              )}
            >
              <AlertTriangle className="w-4 h-4" />
              {alerts.length > 0 ? `${alerts.length} Uyarı` : 'Uyarılar'}
            </Link>
            <Link
              href="/inventory/new"
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Yeni Ürün
            </Link>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Toplam Ürün"
            value={summary?.totalItems || 0}
            icon={<Package className="w-5 h-5" />}
            color="blue"
            isLoading={isLoading}
          />
          <StatCard
            title="Stok Değeri"
            value={formatCurrency(summary?.totalValue || 0)}
            icon={<BarChart3 className="w-5 h-5" />}
            color="green"
            isLoading={isLoading}
          />
          <StatCard
            title="Kritik Stok"
            value={summary?.lowStockItems || 0}
            icon={<TrendingDown className="w-5 h-5" />}
            color="orange"
            href="/inventory/alerts"
            isLoading={isLoading}
            alert={summary?.lowStockItems ? `${summary.lowStockItems} ürün kritik seviyede` : undefined}
          />
          <StatCard
            title="Stok Bitti"
            value={summary?.outOfStockItems || 0}
            icon={<Warehouse className="w-5 h-5" />}
            color="red"
            href="/inventory/alerts"
            isLoading={isLoading}
          />
        </div>

        {/* Category Distribution */}
        {!isLoading && summary && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {Object.entries(INVENTORY_CATEGORY_LABELS).map(([key, label]) => {
              const count = summary.categoryBreakdown[key as keyof typeof summary.categoryBreakdown] || 0;
              return (
                <Link
                  key={key}
                  href={`/inventory?category=${key}`}
                  className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
                >
                  <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
                  <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">{count}</p>
                </Link>
              );
            })}
          </div>
        )}

        {/* Recent Items & Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Items */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-semibold text-slate-900 dark:text-white">Son Eklenenler</h3>
              <Link 
                href="/inventory/items" 
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                Tümü <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <div className="p-6 space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-12 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : recentItems.length === 0 ? (
                <div className="p-6 text-center text-slate-500">
                  Henüz stok kalemi eklenmemiş
                </div>
              ) : (
                recentItems.map((item) => (
                  <Link
                    key={item.id}
                    href={`/inventory/items/${item.id}`}
                    className="flex items-center justify-between px-6 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white text-sm">{item.name}</p>
                      <p className="text-xs text-slate-500">{item.sku}</p>
                    </div>
                    <div className="text-right">
                      <p className={cn(
                        "text-sm font-medium",
                        item.currentStock <= item.minStockLevel && item.currentStock > 0
                          ? "text-orange-600"
                          : item.currentStock === 0
                          ? "text-red-600"
                          : "text-green-600"
                      )}>
                        {item.currentStock} {item.unit}
                      </p>
                      <p className="text-xs text-slate-400">
                        {INVENTORY_CATEGORY_LABELS[item.category]}
                      </p>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* Stock Alerts */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-500" />
                Stok Uyarıları
              </h3>
              {alerts.length > 0 && (
                <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded-full">
                  {alerts.length} uyarı
                </span>
              )}
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <div className="p-6 space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-12 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : alerts.length === 0 ? (
                <div className="p-6 text-center text-slate-500">
                  Harika! Stok uyarısı bulunmuyor
                </div>
              ) : (
                alerts.map((alert) => (
                  <Link
                    key={alert.itemId}
                    href={`/inventory/items/${alert.itemId}`}
                    className="flex items-center justify-between px-6 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white text-sm">{alert.itemName}</p>
                      <p className="text-xs text-slate-500">{alert.sku}</p>
                    </div>
                    <div className="text-right">
                      <p className={cn(
                        "text-sm font-medium",
                        alert.severity === 'critical' ? 'text-red-600' : 'text-orange-600'
                      )}>
                        {alert.currentStock} / {alert.minStockLevel}
                      </p>
                      <p className="text-xs text-slate-400">
                        Eksik: {alert.shortageAmount}
                      </p>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <QuickActionCard
            title="Stok Girişi"
            description="Yeni stok girişi kaydet"
            icon={<Package className="w-6 h-6" />}
            href="/inventory/movements/in"
            color="green"
          />
          <QuickActionCard
            title="Stok Çıkışı"
            description="Stok çıkışı kaydet"
            icon={<TrendingDown className="w-6 h-6" />}
            href="/inventory/movements/out"
            color="orange"
          />
          <QuickActionCard
            title="Sayım Düzeltme"
            description="Stok sayımı güncelle"
            icon={<BarChart3 className="w-6 h-6" />}
            href="/inventory/count"
            color="blue"
          />
          <QuickActionCard
            title="Transfer"
            description="Depolar arası transfer"
            icon={<Warehouse className="w-6 h-6" />}
            href="/inventory/transfer"
            color="purple"
          />
        </div>
      </main>
    </div>
  );
}

function StatCard({ 
  title, 
  value, 
  icon, 
  color, 
  href,
  isLoading,
  alert 
}: { 
  title: string; 
  value: string | number; 
  icon: React.ReactNode; 
  color: 'blue' | 'green' | 'orange' | 'red';
  href?: string;
  isLoading?: boolean;
  alert?: string;
}) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
    green: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400',
    orange: 'bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400',
    red: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400',
  };

  const content = (
    <div className={cn(
      "bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800",
      href && "hover:border-blue-300 dark:hover:border-blue-700 transition-colors cursor-pointer"
    )}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>
          {isLoading ? (
            <div className="h-8 w-24 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mt-1" />
          ) : (
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{value}</p>
          )}
          {alert && (
            <p className="text-xs text-orange-600 mt-1">{alert}</p>
          )}
        </div>
        <div className={cn("p-3 rounded-xl", colorClasses[color])}>
          {icon}
        </div>
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}

function QuickActionCard({ 
  title, 
  description, 
  icon, 
  href, 
  color 
}: { 
  title: string; 
  description: string; 
  icon: React.ReactNode; 
  href: string;
  color: 'green' | 'orange' | 'blue' | 'purple';
}) {
  const colorClasses = {
    green: 'hover:border-green-300 hover:bg-green-50 dark:hover:border-green-700 dark:hover:bg-green-900/10',
    orange: 'hover:border-orange-300 hover:bg-orange-50 dark:hover:border-orange-700 dark:hover:bg-orange-900/10',
    blue: 'hover:border-blue-300 hover:bg-blue-50 dark:hover:border-blue-700 dark:hover:bg-blue-900/10',
    purple: 'hover:border-purple-300 hover:bg-purple-50 dark:hover:border-purple-700 dark:hover:bg-purple-900/10',
  };

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-4 p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 transition-all",
        colorClasses[color]
      )}
    >
      <div className="text-slate-600 dark:text-slate-400">{icon}</div>
      <div>
        <p className="font-medium text-slate-900 dark:text-white">{title}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
      </div>
    </Link>
  );
}
