'use client';
import { UnifiedNavbar } from '@/components/landing-new/UnifiedNavbar';

export default function NotificationsPage() {
  return (
    <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Bildirimler</h1>
        <p className="text-slate-500">Henüz yeni bir bildiriminiz yok.</p>
      </div>
    </div>
  );
}
