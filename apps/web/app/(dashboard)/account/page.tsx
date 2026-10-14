'use client';

import { PageHeader } from '@/components/kit';
import { SessionsPanel } from '@/components/account/SessionsPanel';
import { MfaPanel } from '@/components/account/MfaPanel';
import { NotificationPreferencesPanel } from '@/components/account/NotificationPreferencesPanel';

/** Your account: open sessions and which notifications reach you. */
export default function AccountPage() {
  return <div className="rf-page space-y-5">
    <PageHeader eyebrow="Hesabım" title="Güvenlik ve bildirimler" hint="İki adımlı doğrulamayı açın, açık oturumlarınızı görün ve kapatın; hangi olayların size hangi kanaldan ulaşacağını seçin." />
    <MfaPanel />
    <SessionsPanel />
    <NotificationPreferencesPanel />
  </div>;
}
