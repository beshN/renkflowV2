import type { Metadata } from 'next';
import { MarketingShell } from '@/components/app-core/MarketingShell';
import { COMPANY } from '@/lib/core/company';
import { careers } from '@/lib/core/marketing-content';

// Not linked from the site and left out of the sitemap while no position is open; the route stays
// so old links land on a friendly page with an open-application address instead of a 404.
export const metadata: Metadata = {
  title: 'Kariyer',
  description: 'RenkFlow ekibiyle tanışın; üretim yazılımına ilgi duyuyorsanız bize yazın.',
  alternates: { canonical: '/careers' },
  robots: careers.length ? undefined : { index: false, follow: true },
};

export default function CareersPage() {
  return (
    <MarketingShell
      badge="Kariyer"
      title="Şu anda açık pozisyonumuz yok."
      description="RenkFlow, Renk Alüminyum bünyesinde küçük bir ekiple geliştiriliyor. Üretim yazılımına ilgi duyuyorsanız özgeçmişinizi ve kısa bir notunuzu gönderin; uygun bir pozisyon açıldığında sizinle iletişime geçelim."
      actions={[
        { href: `mailto:${COMPANY.email}?subject=${encodeURIComponent('Genel başvuru')}`, label: 'Genel başvuru gönderin' },
        { href: '/about', label: 'Hakkımızda', variant: 'secondary' },
      ]}
      hideClosing
    />
  );
}
