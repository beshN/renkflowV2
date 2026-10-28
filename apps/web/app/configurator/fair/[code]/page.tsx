import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { activeFair } from '@/lib/features/fair/fairs.server';
import { KioskApp } from '@/components/features/fair/KioskApp';

export const dynamic = 'force-dynamic';
type Params = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const fair = await activeFair((await params).code);
  return { title: { absolute: fair ? `${fair.name} · 3D Configurator` : '3D Configurator' }, robots: { index: false, follow: false } };
}

/** Fair kiosk: /fair/<code> of an active fair. */
export default async function FairKioskPage({ params }: Params) {
  const fair = await activeFair((await params).code);
  if (!fair) notFound();
  return <KioskApp fair={{ code: fair.code, name: fair.name, defaultLocale: fair.defaultLocale, campaign: fair.campaign }} release={(process.env.VERCEL_GIT_COMMIT_SHA || 'local').slice(0, 12)} />;
}
