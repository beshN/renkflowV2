'use client';

import { AppleNavbar } from '@/components/layout/AppleNavbar';
import { PageHeader } from '@/components/kit';
import { SessionsPanel } from '@/components/account/SessionsPanel';
import { NotificationPreferencesPanel } from '@/components/account/NotificationPreferencesPanel';

/** Your account: open sessions and which notifications reach you. */
export default function AccountPage() {
  return <div className="min-h-screen"><AppleNavbar title="Hesabım" showSearch={false} />
    <main className="mx-auto max-w-4xl space-y-5 p-4 md:p-6">
      <PageHeader eyebrow="Hesap" title="Güvenlik ve bildirimler" hint="Açık oturumlarınızı görün ve kapatın; hangi olayların size hangi kanaldan ulaşacağını seçin." />
      <SessionsPanel />
      <NotificationPreferencesPanel />
    </main>
  </div>;
}
