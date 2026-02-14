import Link from 'next/link';

import { MarketingShell } from '@/components/app-core/MarketingShell';

export default function ComingSoonPage() {
  return (
    <MarketingShell
      badge="Launch Gate"
      title="Bu alan yakında açılacak"
      description="Canlıya alınacak sonraki modüller için erişim kontrollü olarak açılacaktır. Güncel ürün deneyimi dashboard ve landing akışlarında kullanılabilir durumdadır."
      actions={[
        { href: '/', label: 'Ana Sayfa' },
        { href: '/contact', label: 'Erken Erişim Talebi', variant: 'secondary' },
      ]}
    >
      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Durum Notu</h2>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
          Bu sayfa yalnızca kontrollü lansman senaryosu için korunur. Ürün sayfalarında "coming soon" kalıntıları kaldırılmıştır.
        </p>
        <Link href="/dashboard" className="mt-4 inline-flex text-sm font-semibold text-slate-900 hover:underline dark:text-slate-100">
          Dashboard'a dön
        </Link>
      </section>
    </MarketingShell>
  );
}
