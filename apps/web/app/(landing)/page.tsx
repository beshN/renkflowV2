import { FullLandingContent } from '@/components/landing-new/FullLandingContent';
import { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'RenkFlow - Modern Üretim için Operasyon Sistemi',
  description:
    'RenkFlow ile üretim akışınızı, stok görünürlüğünü ve ekip koordinasyonunu tek platformda yönetin. Fabrikalar için tasarlanmış operasyon yazılımı.',
  alternates: {
    canonical: 'https://renkflow.com',
  },
};

export default function LandingPage() {
  return <FullLandingContent />;
}
