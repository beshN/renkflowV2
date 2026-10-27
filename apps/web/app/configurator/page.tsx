import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fairTenantId } from '@/lib/features/fair/config';
import { firmName } from '@/lib/features/fair/fairs.server';
import { DesignApp } from '@/components/features/fair/DesignApp';
import { browserLocale } from './locale.server';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const firm = fairTenantId() ? await firmName() : '';
  return { title: { absolute: `${firm || 'Renk Alüminyum'} · 3D Configurator` }, description: 'Discover, customize and experience our products in 3D.' };
}

/** Web mode: the same products and 3D configurators, without a fair. */
export default async function ConfiguratorPage() {
  if (!fairTenantId()) notFound();
  return <DesignApp mode="web" firm={await firmName()} token={null} initial={null} defaultLocale={await browserLocale()} />;
}
