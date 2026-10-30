import type { Metadata } from 'next';
import Link from 'next/link';

import { MarketingShell } from '@/components/app-core/MarketingShell';
import '@/components/site/v2/landing-v2.css';

export const metadata: Metadata = {
  title: 'Yakında',
  robots: { index: false, follow: false },
};

export default function ComingSoonPage() {
  return (
    <div className="rfx min-h-screen">
    <MarketingShell
      badge="Yakında"
      title="Bu alan yakında açılacak"
      description="Canlıya alınacak sonraki modüller için erişim kontrollü olarak açılacaktır. Güncel ürün deneyimi çalışma alanında ve tanıtım sayfalarında kullanılabilir durumdadır."
      actions={[
        { href: '/', label: 'Ana sayfa' },
        { href: '/contact', label: 'Erken erişim talebi', variant: 'secondary' },
      ]}
    >
      <section className="max-w-xl rounded-[var(--x-r-window)] bg-[var(--x-surface)] p-6 shadow-[var(--x-shadow-raise)]">
        <h2 className="text-[17px] font-semibold">Durum notu</h2>
        <p className="mt-2 text-[14.5px] leading-6 text-[var(--x-muted)]">
          Bu sayfa yalnızca kontrollü lansman senaryosu için korunur. Ürün sayfalarındaki "yakında" ibareleri kaldırılmıştır.
        </p>
        <Link href="/dashboard" className="x-link mt-4 inline-flex text-[14px] font-medium">
          Panele dön
        </Link>
      </section>
    </MarketingShell>
    </div>
  );
}
