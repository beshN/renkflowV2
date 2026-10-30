import type { Metadata } from 'next';
import { auth } from '@/auth';
import { LandingV2 } from '@/components/site/v2/LandingV2';
import { COMPANY, socialLinks } from '@/lib/core/company';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

/**
 * The public product site is shown to everyone, signed in or not: opening renkflow.com must never
 * throw a person into a work screen they did not ask for. A signed-in visitor gets a "Panele git"
 * link where others see "Giriş yap".
 */
export default async function HomePage() {
  const session = await auth().catch(() => null);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd()).replace(/</g, '\\u003c') }} />
      <LandingV2 signedIn={Boolean(session?.user)} />
    </>
  );
}

/** schema.org Organization for search engines; empty company fields are omitted. */
function organizationJsonLd() {
  const url = process.env.NEXT_PUBLIC_APP_URL || 'https://renkflow.com';
  const sameAs = socialLinks().map((link) => link.url);
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: COMPANY.brand,
    legalName: COMPANY.legalName || undefined,
    url,
    logo: `${url}/logo.png`,
    email: COMPANY.email,
    telephone: COMPANY.phone || undefined,
    address: COMPANY.address ? { '@type': 'PostalAddress', streetAddress: COMPANY.address, addressCountry: 'TR' } : undefined,
    sameAs: sameAs.length ? sameAs : undefined,
  };
}
