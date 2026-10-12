import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Kayıt ol',
  description: 'RenkFlow hesabı oluşturun.',
};

// Keep signup dynamic to avoid stale auth/session artifacts.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
