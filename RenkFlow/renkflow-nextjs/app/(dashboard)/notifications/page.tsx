'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/lib/context/AuthContext';
import { useOrders } from '@/lib/hooks/useOrders';
import { Bell, AlertTriangle, CheckCircle2, CalendarClock } from 'lucide-react';
import Link from 'next/link';

export default function NotificationsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const { orders } = useOrders();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, isLoading, router]);

  const notifications = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const soon = new Date(today);
    soon.setDate(today.getDate() + 3);

    const overdue = (orders || [])
      .filter((o) => o.deliveryDate && o.status !== 'delivered')
      .filter((o) => new Date(o.deliveryDate!) < today)
      .slice(0, 3)
      .map((o) => ({
        id: `overdue-${o.id}`,
        title: 'Geciken teslimat',
        description: `${o.customerName} siparişi teslim tarihini geçti.`,
        icon: AlertTriangle,
        tone: 'text-rose-600',
        href: `/orders/${o.id}`,
      }));

    const dueSoon = (orders || [])
      .filter((o) => o.deliveryDate && o.status !== 'delivered')
      .filter((o) => new Date(o.deliveryDate!) >= today && new Date(o.deliveryDate!) <= soon)
      .slice(0, 3)
      .map((o) => ({
        id: `soon-${o.id}`,
        title: 'Yaklaşan teslimat',
        description: `${o.customerName} için teslimat tarihi yaklaşıyor.`,
        icon: CalendarClock,
        tone: 'text-amber-600',
        href: `/orders/${o.id}`,
      }));

    const delivered = (orders || [])
      .filter((o) => o.status === 'delivered')
      .slice(0, 2)
      .map((o) => ({
        id: `done-${o.id}`,
        title: 'Teslimat tamamlandı',
        description: `${o.customerName} siparişi teslim edildi.`,
        icon: CheckCircle2,
        tone: 'text-emerald-600',
        href: `/orders/${o.id}`,
      }));

    return [...overdue, ...dueSoon, ...delivered];
  }, [orders]);

  if (isLoading || !user) return null;

  return (
    <div className="flex-1 flex flex-col">
      <Navbar title="Bildirimler" showSearch />
      <main className="flex-1 p-4 md:p-8 pt-16 md:pt-8 space-y-6">
        <Card spotlight className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Bildirim Merkezi</p>
              <h2 className="text-2xl font-bold text-text-light dark:text-text-dark">Tüm güncellemeleri tek yerde takip edin</h2>
              <p className="text-sm text-subtle-light dark:text-subtle-dark">
                Sipariş, üretim ve teslimat olaylarını gerçek zamanlı izleyin.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/70 px-4 py-2 text-xs font-semibold text-slate-600 dark:border-slate-700/60 dark:bg-slate-900/60 dark:text-slate-200">
              <Bell size={14} />
              {notifications.length} yeni bildirim
            </div>
          </div>
        </Card>

        <Card spotlight className="p-6">
          {notifications.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              Henüz yeni bir bildiriminiz yok. Sipariş akışında hareket olduğunda burada görünecek.
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((notification) => (
                <Link
                  key={notification.id}
                  href={notification.href}
                  className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white/70 px-4 py-3 text-sm transition hover:border-slate-300 dark:border-slate-700/60 dark:bg-slate-900/60"
                >
                  <notification.icon className={`w-5 h-5 ${notification.tone}`} />
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900 dark:text-white">{notification.title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{notification.description}</p>
                  </div>
                  <span className="text-xs text-slate-400">Şimdi</span>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
