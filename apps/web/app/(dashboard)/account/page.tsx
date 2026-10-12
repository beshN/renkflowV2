'use client';

import Link from 'next/link';
import { PageHeader } from '@/components/kit';
import { SessionsPanel } from '@/components/account/SessionsPanel';
import { NotificationPreferencesPanel } from '@/components/account/NotificationPreferencesPanel';

/** Your account: open sessions and which notifications reach you. */
export default function AccountPage() {
  return <div className="rf-page space-y-5">
    <PageHeader eyebrow="Hesabım" title="Güvenlik ve bildirimler" hint="Açık oturumlarınızı görün ve kapatın; hangi olayların size hangi kanaldan ulaşacağını seçin." />
    <Link href="/mobile-devices" className="rf-panel block transition-colors hover:bg-accent">
      <span className="rf-section-title">Mobil cihazlarım</span>
      <span className="mt-1 block text-sm text-muted-foreground">iPhone ve Android oturumlarınızı görün; kayıp veya kullanmadığınız cihazların erişimini kapatın.</span>
    </Link>
    <SessionsPanel />
    <NotificationPreferencesPanel />
  </div>;
}
