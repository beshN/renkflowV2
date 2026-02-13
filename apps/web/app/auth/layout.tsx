import { ExperienceBackdrop } from '@/components/layout/ExperienceBackdrop';
import { RouteTransition } from '@/components/layout/RouteTransition';

// Keep auth pages dynamic to prevent stale cache/session artifacts.
// This layout applies to all routes under /auth/*
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default function AuthLayout({
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
