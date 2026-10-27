import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { activeFair } from '@/lib/features/fair/fairs.server';
import { KioskSimulator } from '@/components/features/fair/KioskSimulator';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: { absolute: 'Fuar kiosku simülatörü · Renk Alüminyum' },
  robots: { index: false, follow: false },
};

export default async function SimulatorPage({ searchParams }: { searchParams: Promise<{ fair?: string }> }) {
  const { fair: code = 'rt2027' } = await searchParams;
  const fair = await activeFair(code);
  if (!fair) notFound();
  return <KioskSimulator fairCode={fair.code} fairName={fair.name} />;
}
