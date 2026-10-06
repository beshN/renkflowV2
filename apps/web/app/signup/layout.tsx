// Keep signup dynamic to avoid stale auth/session artifacts.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
