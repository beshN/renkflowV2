import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { HomeLanding } from '@/components/site/HomeLanding';

/**
 * Signed-in users go straight to their workspace; everyone else sees the public
 * product site.
 */
export default async function HomePage() {
  const session = await auth().catch(() => null);
  if (session?.user) redirect('/dashboard');
  return <HomeLanding />;
}
