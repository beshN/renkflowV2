'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { Card } from '@/components/ui/Card';
import { useOrders } from '@/lib/hooks/useOrders';
import { useAuth } from '@/lib/context/AuthContext';

export default function ReportsPage() {
  const { orders } = useOrders();
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) return null;

  const totalRevenue = orders?.reduce((sum, o) => sum + o.totalAmount, 0) || 0;
  const delivered = orders?.filter((o) => o.status === 'delivered').length || 0;
  const pending = orders?.filter((o) => o.status === 'pending').length || 0;

  return (
    <div className="flex-1 flex flex-col">
      <Navbar title="Raporlar" showSearch />
      <main className="flex-1 p-4 md:p-8 pt-16 md:pt-8 space-y-6">
        <Card spotlight className="p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Genel Özet</p>
              <h2 className="text-2xl font-bold text-text-light dark:text-text-dark">Operasyon Raporu</h2>
              <p className="text-sm text-subtle-light dark:text-subtle-dark">
                Sipariş hacmi, teslimat performansı ve gelir görünümü.
              </p>
            </div>
            <button className="inline-flex items-center justify-center rounded-full bg-slate-900 text-white px-5 py-2.5 text-sm font-semibold shadow-[0_18px_40px_-24px_rgba(15,23,42,0.7)] hover:opacity-90">
              Raporu İndir
            </button>
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card spotlight className="p-6">
            <p className="text-xs text-slate-500 dark:text-slate-400">Toplam Gelir</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">₺{totalRevenue.toLocaleString('tr-TR')}</p>
          </Card>
          <Card spotlight className="p-6">
            <p className="text-xs text-slate-500 dark:text-slate-400">Teslim Edildi</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{delivered}</p>
          </Card>
          <Card spotlight className="p-6">
            <p className="text-xs text-slate-500 dark:text-slate-400">Beklemede</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{pending}</p>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card spotlight className="p-6">
            <h3 className="text-lg font-semibold text-text-light dark:text-text-dark mb-4">Aylık Özet</h3>
            <div className="space-y-3 text-sm text-subtle-light dark:text-subtle-dark">
              <p>• Son 30 günde {orders?.length || 0} sipariş oluşturuldu.</p>
              <p>• Teslimat oranı %{orders && orders.length ? Math.round((delivered / orders.length) * 100) : 0}.</p>
              <p>• Ortalama sipariş tutarı ₺{orders && orders.length ? Math.round(totalRevenue / orders.length).toLocaleString('tr-TR') : 0}.</p>
            </div>
          </Card>
          <Card spotlight className="p-6">
            <h3 className="text-lg font-semibold text-text-light dark:text-text-dark mb-4">Önerilen Aksiyonlar</h3>
            <ul className="space-y-3 text-sm text-subtle-light dark:text-subtle-dark">
              <li>• Beklemedeki siparişleri üretime alın.</li>
              <li>• Geciken teslimatlar için bildirim gönderin.</li>
              <li>• Yüksek tutarlı müşterilere teklif paketi hazırlayın.</li>
            </ul>
          </Card>
        </div>
      </main>
    </div>
  );
}
