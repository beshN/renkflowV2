import { Suspense } from 'react';
import { PersonnelOverview } from '@/components/features/personnel/PersonnelOverview';

export const metadata = { title: 'Personel' };

export default function Page() {
  return <Suspense><PersonnelOverview /></Suspense>;
}
