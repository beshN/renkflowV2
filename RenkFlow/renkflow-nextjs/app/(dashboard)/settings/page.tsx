'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { SettingsForm } from '@/components/forms/SettingsForm';
import { useSettings } from '@/lib/context/SettingsContext';
import { useAuth } from '@/lib/context/AuthContext';
import { TenantSettings } from '@/components/settings/TenantSettings';
import { Card } from '@/components/ui/Card';

export default function SettingsPage() {
  const { user, isLoading } = useAuth();
  const { settings, updateSettings } = useSettings();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return null;
  }

  return (
    <div className="flex-1 flex flex-col">
      <Navbar title="Ayarlar" showSearch={false} />
      
      <main className="flex-1 p-4 md:p-8 pt-16 md:pt-8 space-y-6">
        <Card spotlight className="p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Ayarlar</p>
          <h2 className="text-2xl font-bold text-text-light dark:text-text-dark">Hesap ve şirket yapılandırması</h2>
          <p className="text-sm text-subtle-light dark:text-subtle-dark">
            Marka görünümü, ekip rolleri ve operasyon detaylarını buradan yönetin.
          </p>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6">
          <Card spotlight className="p-6">
            <h3 className="text-lg font-semibold text-text-light dark:text-text-dark mb-4">Profil & Tercihler</h3>
            <SettingsForm initialSettings={settings} onSave={updateSettings} />
          </Card>

          <Card spotlight className="p-6">
            <h3 className="text-lg font-semibold text-text-light dark:text-text-dark mb-4">Şirket Bilgileri</h3>
            <TenantSettings />
          </Card>
        </div>
      </main>
    </div>
  );
}
