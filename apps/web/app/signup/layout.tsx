import { ExperienceBackdrop } from '@/components/layout/ExperienceBackdrop';
import { RouteTransition } from '@/components/layout/RouteTransition';

// Force dynamic rendering for signup page to prevent Vercel build timeout
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
