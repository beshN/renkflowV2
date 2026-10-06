import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { BrandMark } from '@/components/brand/BrandMark';
import { CutGame } from '@/components/spells/CutGame';

export default function NotFound() {
  return (
    <div className="rf-on-dark rf-blueprint flex min-h-screen flex-col text-white">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 sm:px-8">
        <BrandMark href="/" tone="light" />
        <span className="rf-mono-label text-zinc-500">Hata 404</span>
      </header>
      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-14 px-5 py-16 sm:px-8 lg:grid-cols-[1fr_1.05fr]">
        <div>
          <p className="font-mono text-[clamp(72px,12vw,160px)] font-medium leading-none tracking-[-0.06em] text-zinc-700">404</p>
          <h1 className="mt-6 text-[clamp(28px,3.4vw,44px)] font-semibold leading-[1.05] tracking-[-0.045em]">Bu ölçü çizimde yok.</h1>
          <p className="mt-4 max-w-md text-[15.5px] leading-7 text-zinc-400">Aradığınız sayfa taşınmış ya da hiç var olmamış olabilir. Beklerken bir kesim yapmaya ne dersiniz?</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/" className="inline-flex h-10 items-center gap-2 rounded-lg bg-white px-4 text-[13.5px] font-medium text-zinc-900 transition-opacity hover:opacity-90"><ArrowLeft size={15} /> Ana sayfa</Link>
            <Link href="/dashboard" className="inline-flex h-10 items-center rounded-lg border border-white/15 px-4 text-[13.5px] font-medium text-white transition-colors hover:bg-white/5">Panele git</Link>
            <Link href="/contact" className="inline-flex h-10 items-center px-2 text-[13.5px] text-zinc-400 hover:text-white">Destek</Link>
          </div>
        </div>
        <CutGame />
      </main>
    </div>
  );
}
