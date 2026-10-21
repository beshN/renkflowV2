import { auth } from '@/auth';
import { SiteHeader } from '@/components/site/SiteHeader';
import { SiteFooter } from '@/components/site/SiteFooter';
import { RouteTransition } from '@/components/layout/RouteTransition';

// Keep landing pages dynamic so locale/theme and launch state stay current.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth().catch(() => null);
  return (
    <div className="rf-app-shell relative flex min-h-screen flex-col overflow-x-clip">
      <SiteHeader signedIn={Boolean(session?.user)} />
      <main className="relative flex-grow">
        <RouteTransition>{children}</RouteTransition>
      </main>
      <SiteFooter />
    </div>
  );
}
