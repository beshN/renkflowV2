import type { Metadata } from 'next';
import { BrandMark } from '@/components/brand/BrandMark';
import { NotFoundBody } from '@/components/site/NotFoundBody';
import '@/components/site/v2/landing-v2.css';

export const metadata: Metadata = {
  title: 'Sayfa bulunamadı',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="rf-app-shell rfx flex min-h-screen flex-col">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 sm:px-8">
        <BrandMark href="/" />
        <span className="x-mono text-[12.5px] text-[var(--x-muted)]">404</span>
      </header>
      <NotFoundBody />
    </div>
  );
}
