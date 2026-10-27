import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { sql } from '@/lib/db';
import { fairEventName, fairTenantId } from '@/lib/features/fair/config';
import { FairConfigurator } from '@/components/features/fair/FairConfigurator';

export const dynamic = 'force-dynamic';

async function firmName(tenantId: string): Promise<string> {
  const [firm] = await sql`SELECT name FROM tenants WHERE id = ${tenantId}`.catch(() => []);
  return firm?.name ? String(firm.name) : '';
}

export async function generateMetadata(): Promise<Metadata> {
  const tenantId = fairTenantId();
  const firm = tenantId ? await firmName(tenantId) : '';
  return {
    title: { absolute: `${firm ? `${firm} · ` : ''}Ürününüzü tasarlayın` },
    description: 'Ürünü seçin, ölçü ve rengini 3D olarak ayarlayın; fiyat teklifiniz size iletilsin.',
    robots: { index: false, follow: false },
  };
}

/** Fair site: QR → choose a product → size and colour it in 3D → leave contact details → priced later. */
export default async function FairPage() {
  const tenantId = fairTenantId();
  if (!tenantId) notFound();
  return <FairConfigurator firm={await firmName(tenantId)} event={fairEventName()} />;
}
