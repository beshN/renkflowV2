'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/lib/context/AuthContext';

export default function NotificationsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) return null;

  return (
    <div className="flex-1 flex flex-col">
      <Navbar title="Bildirimler" showSearch />
      <main className="flex-1 p-4 md:p-8 pt-16 md:pt-8 space-y-6">
        <Card spotlight className="p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Bildirim Merkezi</p>
          <h2 className="text-2xl font-bold text-text-light dark:text-text-dark">Tüm güncellemeleri tek yerde takip edin</h2>
          <p className="text-sm text-subtle-light dark:text-subtle-dark">
            Sipariş, üretim ve ekip hareketleri burada listelenir.
          </p>
        </Card>

        <Card spotlight className="p-6">
          <div className="rounded-xl border border-dashed border-slate-200 p-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            Henüz yeni bir bildiriminiz yok.
          </div>
        </Card>
      </main>
    </div>
  );
}
