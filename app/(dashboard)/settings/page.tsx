'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { SettingsForm } from '@/components/forms/SettingsForm';
import { useSettings } from '@/lib/context/SettingsContext';
import { useAuth } from '@/lib/context/AuthContext';

export default function SettingsPage() {
  const { user, isLoading } = useAuth();
  const { settings, updateSettings } = useSettings();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return null;
  }

  return (
    <div className="flex-1 flex flex-col">
      <Navbar title="Ayarlar" showSearch={false} />
      
      <main className="flex-1 p-8">
        <div className="max-w-3xl">
          <SettingsForm initialSettings={settings} onSave={updateSettings} />
        </div>
      </main>
    </div>
  );
}
