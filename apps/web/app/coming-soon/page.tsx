import { ComingSoonPage } from '@/components/landing-new/ComingSoonPage';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'RenkFlow - Çok Yakında | Üretim Yönetiminin Geleceği',
  description: 'RenkFlow, üretim yönetiminde yeni bir çağ başlatıyor. Modern, güçlü ve kullanıcı dostu platform ile tanışmaya hazır olun. Bekleme listesine katılın!',
  openGraph: {
    title: 'RenkFlow - Çok Yakında',
    description: 'Üretim yönetiminde devrim niteliğinde bir platform geliyor.',
    type: 'website',
  },
};

export default function TeaserPage() {
  return <ComingSoonPage />;
}
