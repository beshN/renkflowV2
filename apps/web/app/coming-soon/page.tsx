import { ComingSoonPage } from '@/components/landing-new/ComingSoonPage';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'RenkFlow - Private Beta',
  description:
    'RenkFlow private beta sürecinde. Üretim operasyonları için erken erişim talebi bırakabilir ve ürün güncellemelerini takip edebilirsiniz.',
  openGraph: {
    title: 'RenkFlow - Private Beta',
    description: 'Private beta doğrulama sürecindeki üretim operasyon platformu.',
    type: 'website',
  },
};

export default function TeaserPage() {
  return <ComingSoonPage />;
}
