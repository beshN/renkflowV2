import { SiteHeader } from '@/components/site/SiteHeader';
import { SiteFooter } from '@/components/site/SiteFooter';
import { RouteTransition } from '@/components/layout/RouteTransition';

// Keep landing pages dynamic so locale/theme and launch state stay current.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="rf-app-shell relative flex min-h-screen flex-col overflow-x-clip">
      <SiteHeader />
      <main className="relative flex-grow">
        <RouteTransition>{children}</RouteTransition>
      </main>
      <SiteFooter />
    </div>
  );
}
