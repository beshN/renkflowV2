import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fairTenantId } from '@/lib/features/fair/config';
import { TOKEN_PATTERN } from '@/lib/features/fair/design';
import { getDesign } from '@/lib/features/fair/designs.server';
import { firmName, privacyController } from '@/lib/features/fair/fairs.server';
import { DesignApp } from '@/components/features/fair/DesignApp';
import { browserLocale } from '../../locale.server';

export const dynamic = 'force-dynamic';
type Params = { params: Promise<{ token: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const firm = fairTenantId() ? await firmName() : '';
  return { title: { absolute: `${firm || 'Renk Alüminyum'} · 3D Configurator` }, robots: { index: false, follow: false }, referrer: 'no-referrer' };
}

/**
 * A design link. Unknown tokens still render: a kiosk design made offline is in the QR code's
 * fragment and reaches the server only once the phone (or the kiosk, back online) sends it.
 */
export default async function DesignPage({ params }: Params) {
  const { token } = await params;
  if (!fairTenantId() || !TOKEN_PATTERN.test(token)) notFound();
  const design = await getDesign(token);
  return (
    <DesignApp
      mode="mobile"
      controller={await privacyController()}
      token={token}
      initial={design ? { items: design.items, locale: design.locale, version: design.version, fair: design.fair } : null}
      defaultLocale={design?.locale ?? (await browserLocale())}
    />
  );
}
