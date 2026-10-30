import type { Metadata } from 'next';
import { auth } from '@/auth';
import { LandingV2 } from '@/components/site/v2/LandingV2';

// Design prototype of the next home page; kept out of search until it replaces "/".
export const metadata: Metadata = {
  title: 'Yeni ana sayfa (prototip)',
  robots: { index: false, follow: false },
};

export default async function LandingV2Page() {
  const session = await auth().catch(() => null);
  return <LandingV2 signedIn={Boolean(session?.user)} />;
}
