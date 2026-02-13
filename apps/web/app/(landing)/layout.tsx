import { UnifiedNavbar } from '@/components/landing-new/UnifiedNavbar';
import { Footer } from '@/components/landing-new/Footer';
import { ExperienceBackdrop } from '@/components/layout/ExperienceBackdrop';
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
      <ExperienceBackdrop variant="landing" />
      <UnifiedNavbar />
      <main className="relative z-10 flex-grow">
        <RouteTransition>{children}</RouteTransition>
      </main>
      <Footer />
    </div>
  );
}
