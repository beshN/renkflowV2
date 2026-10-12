import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { HomeLanding } from '@/components/site/HomeLanding';
import { COMPANY, socialLinks } from '@/lib/core/company';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

/**
 * Signed-in users go straight to their workspace; everyone else sees the public
 * product site.
 */
export default async function HomePage() {
  const session = await auth().catch(() => null);
  if (session?.user) redirect('/dashboard');
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd()).replace(/</g, '\\u003c') }} />
      <HomeLanding />
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
