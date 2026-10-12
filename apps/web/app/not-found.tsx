import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { BrandMark } from '@/components/brand/BrandMark';
import { CutGame } from '@/components/spells/CutGame';

export const metadata: Metadata = {
  title: 'Sayfa bulunamadı',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="rf-app-shell flex min-h-screen flex-col bg-gradient-to-b from-background to-muted/50">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 sm:px-8">
        <BrandMark href="/" />
        <span className="text-[13px] text-muted-foreground">Hata 404</span>
      </header>
      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-14 px-5 py-16 sm:px-8 lg:grid-cols-[1fr_1.05fr]">
        <div>
          <p className="text-[clamp(72px,12vw,160px)] font-semibold tabular-nums leading-none tracking-[-0.06em] text-foreground/15" aria-hidden="true">404</p>
          <h1 className="mt-6 text-[clamp(28px,3.4vw,44px)] font-semibold leading-[1.05] tracking-[-0.045em]">Bu ölçü çizimde yok.</h1>
          <p className="mt-4 max-w-md text-[15.5px] leading-7 text-muted-foreground">Aradığınız sayfa taşınmış ya da hiç var olmamış olabilir. Beklerken bir kesim yapmaya ne dersiniz?</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/" className="rf-ink-button h-10 px-4 text-[13.5px]"><ArrowLeft size={15} aria-hidden="true" /> Ana sayfa</Link>
            <Link href="/dashboard" className="rf-secondary-button h-10 px-4 text-[13.5px]">Panele git</Link>
            <Link href="/contact" className="inline-flex h-10 items-center px-2 text-[13.5px] text-muted-foreground hover:text-foreground">Destek</Link>
          </div>
        </div>
        <CutGame />
      </main>
    </div>
  );
}
