import { LandingContainer } from '@/components/landing-new/LandingContainer';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Renkflow - Çok Yakında',
  description: 'Renkflow üretim yönetiminde yeni bir çağ başlatıyor. Bekleme listesine katılın ve ilk siz haberdar olun.',
};

export default function TeaserPage() {
  return (
    <main className="min-h-screen bg-background">
      <LandingContainer />
    </main>
  );
}
