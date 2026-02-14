'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';

type AuthFrameProps = {
  title: string;
  description: string;
  asideTitle?: string;
  asideDescription?: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function AuthFrame({
  title,
  description,
  asideTitle = 'RenkFlow Kimlik Merkezi',
  asideDescription =
    'Tüm giriş ve hesap yönetimi akışları tek standartla yönetilir. Bu yapı, ürünün bir sonraki sürümünde SSO ve rol tabanlı onboarding adımlarını genişletmeye hazırdır.',
  children,
  footer,
}: AuthFrameProps) {
  return (
    <div className="mx-auto grid min-h-screen w-full max-w-7xl grid-cols-1 gap-6 px-4 py-24 sm:px-6 lg:grid-cols-2 lg:px-8">
      <section className="flex items-center justify-center">
        <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white/95 p-8 shadow-sm dark:border-slate-800 dark:bg-slate-950/90">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">Erişim</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100">{title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{description}</p>

          <div className="mt-6 space-y-4">{children}</div>

          {footer ? (
            <div className="mt-6 border-t border-slate-200 pt-4 text-sm dark:border-slate-800">{footer}</div>
          ) : null}
        </div>
      </section>

      <aside className="hidden rounded-[28px] border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950 p-10 text-slate-100 shadow-sm lg:block dark:border-slate-800">
        <Link href="/" className="inline-flex items-center gap-3 rounded-xl border border-white/20 bg-white/5 px-4 py-2">
          <Image src="/logo-r.png" alt="RenkFlow" width={28} height={28} />
          <span className="text-sm font-semibold">RenkFlow</span>
        </Link>

        <h2 className="mt-8 text-3xl font-bold leading-tight">{asideTitle}</h2>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-300">{asideDescription}</p>

        <ul className="mt-8 space-y-3 text-sm text-slate-200">
          <li className="rounded-xl border border-white/15 bg-white/5 px-4 py-3">Tek tip hata mesajı standardı</li>
          <li className="rounded-xl border border-white/15 bg-white/5 px-4 py-3">API ile uyumlu doğrulama akışı</li>
          <li className="rounded-xl border border-white/15 bg-white/5 px-4 py-3">Bir sonraki faz için SSO genişleme uyumu</li>
        </ul>
      </aside>
    </div>
  );
}
