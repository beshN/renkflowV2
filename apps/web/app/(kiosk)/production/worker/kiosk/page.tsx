import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { requireKioskAccess } from '@/lib/features/kiosk/service.server';
import { KioskStation } from '@/components/features/kiosk/KioskStation';
export const metadata = { title: 'İstasyon · Usta', robots: { index: false, follow: false } };
export default async function KioskStationPage() {
  await requireKioskAccess(await requireWorkOrderActor());
  return <KioskStation />;
}
