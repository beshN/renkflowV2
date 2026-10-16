import type { Metadata } from 'next';
import { StationWorkspace } from '@/components/features/stations/StationWorkspace';
export const metadata: Metadata = {
  title: 'İstasyon',
  robots: { index: false, follow: false },
};
export default function StationPage() {
  return <StationWorkspace />;
}
