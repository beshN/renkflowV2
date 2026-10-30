import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { CutGame } from '@/components/spells/CutGame';

/** The 404 body: shared by the standalone page and the one shown inside the public site layout. */
export function NotFoundBody() {
  return (
    <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-14 px-5 py-16 sm:px-8 lg:grid-cols-[1fr_1.05fr]">
        <div>
          <p className="x-display x-rise text-[clamp(72px,12vw,160px)] leading-none text-[var(--x-line-strong)]" aria-hidden="true">404</p>
          <h1 className="x-display x-rise x-rise-2 mt-6 text-[clamp(28px,3.4vw,44px)] leading-[1.05]">Bu ölçü çizimde yok.</h1>
          <p className="x-rise x-rise-3 mt-4 max-w-md text-[15.5px] leading-7 text-[var(--x-muted)]">Aradığınız sayfa taşınmış ya da hiç var olmamış olabilir. Beklerken bir kesim yapmaya ne dersiniz?</p>
          <div className="x-rise x-rise-4 mt-8 flex flex-wrap gap-3">
            <Link href="/" className="x-btn x-btn-primary"><ArrowLeft size={15} aria-hidden="true" /> Ana sayfa</Link>
            <Link href="/dashboard" className="x-btn x-btn-quiet">Panele git</Link>
            <Link href="/contact" className="x-link inline-flex h-10 items-center px-2 text-[13.5px] text-[var(--x-muted)] hover:text-[var(--x-ink)]">Destek</Link>
          </div>
        </div>
        <CutGame />
      </main>
  );
}
