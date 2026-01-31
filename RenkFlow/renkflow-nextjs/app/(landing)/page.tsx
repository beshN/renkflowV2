import { FullLandingContent } from '@/components/landing-new/FullLandingContent';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Renkflow - İş Akışınızı Dönüştürün',
  description: 'Proje yönetimi, ekip iş birliği ve otomasyon için hepsi bir arada platform. Ücretsiz başlayın.',
  alternates: {
    canonical: 'https://renkflow.com',
  },
};

export default function LandingPage() {
  return <FullLandingContent />;
}
