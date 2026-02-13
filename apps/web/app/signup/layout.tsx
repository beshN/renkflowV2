import { ExperienceBackdrop } from '@/components/layout/ExperienceBackdrop';
import { RouteTransition } from '@/components/layout/RouteTransition';

// Keep signup dynamic to avoid stale auth/session artifacts.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default function SignupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="rf-app-shell relative min-h-screen overflow-hidden">
      <ExperienceBackdrop variant="auth" />
      <div className="relative z-10">
        <RouteTransition>{children}</RouteTransition>
      </div>
    </div>
  );
}
