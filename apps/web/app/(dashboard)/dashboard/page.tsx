'use client';

import Link from 'next/link';
import { ClipboardList, DollarSign, PackageCheck, Truck, TrendingUp, Activity, PlusCircle, Wallet } from 'lucide-react';

import { AppleNavbar } from '@/components/layout/AppleNavbar';
import { AppleCard } from '@/components/shared/ui/AppleCard';
import { useOrders } from '@/lib/hooks/useOrders';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/shared/ui/Button';

export default function DashboardPage() {
  const { orders, isLoading } = useOrders();

  const pendingCount = orders.filter((item) => item.status === 'pending').length;
  const productionCount = orders.filter((item) => item.status === 'in_production').length;
  const totalVolume = orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);

  const metrics = [
    { label: 'Toplam Sipariş', value: orders.length.toString(), icon: ClipboardList, trend: '+12%', bg: 'bg-blue-500', text: 'text-blue-500' },
    { label: 'Bekleyen İş', value: pendingCount.toString(), icon: PackageCheck, trend: '-5%', bg: 'bg-orange-500', text: 'text-orange-500' },
    { label: 'Üretim Aşaması', value: productionCount.toString(), icon: Truck, trend: '+8%', bg: 'bg-purple-500', text: 'text-purple-500' },
    { label: 'Toplam Hacim', value: formatCurrency(totalVolume), icon: DollarSign, trend: '+24%', bg: 'bg-green-500', text: 'text-green-500' },
  ];

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-neutral-50/50 dark:bg-black">
      <AppleNavbar title="Kontrol Paneli" />

      <main className="w-full max-w-[1600px] mx-auto flex-1 p-6 md:p-10 space-y-8 animate-fade-in">
        
        {/* Hero Section */}
        <section className="space-y-2">
          <h2 className="text-3xl font-display font-bold tracking-tight text-foreground">
            Hoş geldin, <span className="text-muted-foreground">İşletme Sahibi</span>
          </h2>
          <p className="text-base text-muted-foreground max-w-2xl">
            Bugünün operasyon özeti, finansal durumu ve üretim hattı performansı.
          </p>
        </section>

        {/* Metrics Grid */}
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((item) => {
            const Icon = item.icon;
            return (
              <AppleCard key={item.label} variant="glass" className="relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300">
                 <div className="flex justify-between items-start mb-4">
                    <div className={`p-3 rounded-2xl ${item.bg} bg-opacity-10 text-white`}>
                        <div className={`absolute inset-0 opacity-10 ${item.bg}`} />
                        <Icon size={24} className={item.text} />
                    </div>
                    <span className="flex items-center text-xs font-medium text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400 px-2 py-1 rounded-full">
                      <TrendingUp size={12} className="mr-1" />
                      {item.trend}
                    </span>
                 </div>
                 <div>
                    <p className="text-sm font-medium text-muted-foreground">{item.label}</p>
                    <h3 className="text-3xl font-bold mt-1 tracking-tight text-foreground">
                        {isLoading ? <div className="h-8 w-24 bg-neutral-200 dark:bg-neutral-800 animate-pulse rounded" /> : item.value}
                    </h3>
                 </div>
              </AppleCard>
            );
          })}
        </div>

        {/* Action Cards & Status */}
        <div className="grid gap-6 lg:grid-cols-3">
            {/* Quick Actions */}
            <AppleCard className="lg:col-span-2 space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-semibold text-foreground">Hızlı İşlemler</h3>
                        <p className="text-sm text-muted-foreground">Sık kullanılan operasyon menüsü</p>
                    </div>
                </div>
                
                 <div className="grid gap-4 sm:grid-cols-2">
                    <Link href="/new-order">
                        <Button variant="primary" className="w-full h-auto py-4 justify-start px-6" leftIcon={<PlusCircle size={20} />}>
                            <div className="flex flex-col items-start ml-2">
                                <span className="text-base">Yeni Sipariş Oluştur</span>
                                <span className="text-xs font-normal opacity-80">Müşteri talebi gir</span>
                            </div>
                        </Button>
                    </Link>
                    <Link href="/orders">
                        <Button variant="secondary" className="w-full h-auto py-4 justify-start px-6" leftIcon={<ClipboardList size={20} />}>
                             <div className="flex flex-col items-start ml-2">
                                <span className="text-base text-foreground">Sipariş Yönetimi</span>
                                <span className="text-xs font-normal text-muted-foreground">Tüm listeyi gör</span>
                            </div>
                        </Button>
                    </Link>
                    <Link href="/finance">
                        <Button variant="outline" className="w-full h-auto py-4 justify-start px-6" leftIcon={<Wallet size={20} />}>
                            <div className="flex flex-col items-start ml-2">
                                <span className="text-base text-foreground">Finans Durumu</span>
                                <span className="text-xs font-normal text-muted-foreground">Nakit akışını incele</span>
                            </div>
                        </Button>
                    </Link>
                    <Link href="/inventory">
                        <Button variant="outline" className="w-full h-auto py-4 justify-start px-6" leftIcon={<PackageCheck size={20} />}>
                            <div className="flex flex-col items-start ml-2">
                                <span className="text-base text-foreground">Stok Kontrolü</span>
                                <span className="text-xs font-normal text-muted-foreground">Depo sayımı</span>
                            </div>
                        </Button>
                    </Link>
                </div>
            </AppleCard>

            {/* Live Status */}
            <AppleCard variant="glass-dark" className="bg-gradient-to-br from-neutral-900 to-neutral-800 text-white border-0">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold">Canlı Durum</h3>
                    <div className="flex items-center gap-2">
                       <span className="relative flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                        </span>
                        <span className="text-xs font-medium text-neutral-400">Online</span>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                                <Activity size={18} />
                            </div>
                            <div>
                                <p className="text-sm font-medium">Bekleyen</p>
                                <p className="text-xs text-neutral-400">Onay bekleyen siparişler</p>
                            </div>
                        </div>
                        <span className="text-xl font-bold">{pendingCount}</span>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-500/20 rounded-lg text-purple-400">
                                <Truck size={18} />
                            </div>
                            <div>
                                <p className="text-sm font-medium">Üretimde</p>
                                <p className="text-xs text-neutral-400">Aktif operasyonlar</p>
                            </div>
                        </div>
                        <span className="text-xl font-bold">{productionCount}</span>
                    </div>

                    <div className="pt-4 mt-4 border-t border-white/10">
                         <div className="flex items-center justify-between text-xs text-neutral-400 mb-2">
                            <span>Günlük Hedef</span>
                            <span>%75</span>
                        </div>
                        <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 w-3/4 rounded-full" />
                        </div>
                    </div>
                </div>
            </AppleCard>
        </div>

      </main>
    </div>
  );
}
