// Force dynamic rendering for all auth pages to prevent Vercel build timeout
// This layout applies to all routes under /auth/*
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
