'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { Card } from '@/components/ui/Card';
import { useOrders } from '@/lib/hooks/useOrders';
import { useAuth } from '@/lib/context/AuthContext';

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

  const statusBreakdown = useMemo(() => {
    const pending = orders?.filter((o) => o.status === 'pending').length || 0;
    const production = orders?.filter((o) => o.status === 'in_production').length || 0;
    const delivered = orders?.filter((o) => o.status === 'delivered').length || 0;
    return [
      { label: 'Beklemede', value: pending, color: 'bg-amber-400' },
      { label: 'Üretimde', value: production, color: 'bg-sky-500' },
      { label: 'Teslim', value: delivered, color: 'bg-emerald-500' },
    ];
  }, [orders]);

  const maxValue = Math.max(...statusBreakdown.map((item) => item.value), 1);

  return (
    <div className="flex-1 flex flex-col">
      <Navbar title="Analitik" showSearch />
      <main className="flex-1 p-4 md:p-8 pt-16 md:pt-8 space-y-6">
        <Card spotlight className="p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Performans</p>
          <h2 className="text-2xl font-bold text-text-light dark:text-text-dark">Sipariş Akışı Analizi</h2>
          <p className="text-sm text-subtle-light dark:text-subtle-dark">
            Üretim hızını ve darboğazları tek bir bakışta görün.
          </p>
        </Card>

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
              <p>• Sipariş başına ortalama üretim süresi hesaplanıyor.</p>
              <p>• Haftalık kapasite kullanımında artış gözlemlendi.</p>
              <p>• Kritik işleri öne almak için üretim sırası önerileri sunulur.</p>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
