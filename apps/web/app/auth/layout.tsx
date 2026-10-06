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
  return <RouteTransition>{children}</RouteTransition>;
}
