'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/lib/context/AuthContext';
import { useOrders } from '@/lib/hooks/useOrders';
import { useToast } from '@/lib/context/ToastContext';
import { KanbanBoard } from '@/components/orders/KanbanBoard';
import { OrderStatus } from '@/lib/types';
import { Plus, ArrowUpRight, Workflow } from 'lucide-react';

export default function KanbanPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const { orders, isLoading, updateOrderStatus, deleteOrder } = useOrders();
  const { showToast } = useToast();

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, isAuthLoading, router]);

  const totals = useMemo(() => {
    const pending = orders?.filter((o) => o.status === 'pending').length || 0;
    const production = orders?.filter((o) => o.status === 'in_production').length || 0;
    const delivered = orders?.filter((o) => o.status === 'delivered').length || 0;
    return { pending, production, delivered };
  }, [orders]);

  const handleStatusChange = async (orderId: string, status: OrderStatus) => {
    try {
      await updateOrderStatus(orderId, status);
      showToast('Sipariş durumu güncellendi', 'success');
    } catch (error) {
      showToast('Durum güncellenirken hata oluştu', 'error');
    }
  };

  const handleDelete = async (orderId: string) => {
    try {
      await deleteOrder(orderId);
      showToast('Sipariş silindi', 'success');
    } catch (error) {
      showToast('Sipariş silinirken hata oluştu', 'error');
    }
  };

  if (isAuthLoading || !user) return null;

  return (
    <div className="flex-1 flex flex-col">
      <Navbar title="Üretim Kanban" showSearch />
      <main className="flex-1 p-4 md:p-8 pt-16 md:pt-8 space-y-6">
        <Card spotlight className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Üretim Akışı</p>
              <h2 className="text-2xl font-bold text-text-light dark:text-text-dark">Kanban ile gerçek zamanlı takip</h2>
              <p className="text-sm text-subtle-light dark:text-subtle-dark max-w-2xl">
                Siparişleri durumlara göre sürükleyip bırakarak ilerleyişi yönetin. WIP limitleri ve ekip görünürlüğü ile darboğazları anında görün.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/new-order"
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 text-white px-5 py-2.5 text-sm font-semibold shadow-[0_18px_40px_-24px_rgba(15,23,42,0.7)] hover:opacity-90"
              >
                <Plus size={18} />
                Yeni Sipariş
              </Link>
              <Link
                href="/orders"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/70 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-300 hover:text-slate-900 dark:border-slate-700/70 dark:bg-slate-900/60 dark:text-slate-200"
              >
                Tüm Siparişler
                <ArrowUpRight size={16} />
              </Link>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-amber-200/70 bg-amber-50/70 p-4 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              <p className="text-xs">Beklemede</p>
              <p className="text-2xl font-bold">{totals.pending}</p>
            </div>
            <div className="rounded-2xl border border-sky-200/70 bg-sky-50/70 p-4 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200">
              <p className="text-xs">Üretimde</p>
              <p className="text-2xl font-bold">{totals.production}</p>
            </div>
            <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/70 p-4 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
              <p className="text-xs">Teslim</p>
              <p className="text-2xl font-bold">{totals.delivered}</p>
            </div>
          </div>
        </Card>

        <Card spotlight className="p-4 md:p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-[480px] text-sm text-subtle-light dark:text-subtle-dark">
              Kanban yükleniyor...
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 h-[420px] text-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <Workflow className="w-7 h-7 text-slate-500 dark:text-slate-300" />
              </div>
              <div>
                <p className="text-lg font-semibold text-text-light dark:text-text-dark">Henüz sipariş yok</p>
                <p className="text-sm text-subtle-light dark:text-subtle-dark">İlk siparişi ekleyerek üretim akışını başlatın.</p>
              </div>
              <Link
                href="/new-order"
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 text-white px-5 py-2.5 text-sm font-semibold shadow-[0_18px_40px_-24px_rgba(15,23,42,0.7)] hover:opacity-90"
              >
                Yeni Sipariş Oluştur
              </Link>
            </div>
          ) : (
            <div className="kanban-scroll">
              <KanbanBoard
                orders={orders}
                onOrderStatusChange={handleStatusChange}
                onOrderDelete={handleDelete}
              />
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
