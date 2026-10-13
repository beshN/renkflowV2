import { Suspense } from 'react';
import { EmployeeDetail } from '@/components/features/personnel/EmployeeDetail';

export const metadata = { title: 'Personel' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Suspense><EmployeeDetail id={id} /></Suspense>;
}
