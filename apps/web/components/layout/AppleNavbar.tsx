'use client';

import { type ReactNode, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Search, Bell, Sun, Moon } from 'lucide-react';

interface AppleNavbarProps {
  title: string;
  showSearch?: boolean;
  action?: ReactNode;
}

export function AppleNavbar({ title, showSearch = true, action }: AppleNavbarProps) {
  const { setTheme, resolvedTheme } = useTheme();
  const router = useRouter();
  const [query, setQuery] = useState('');
  return (
    <header className="sticky top-0 z-40 flex min-h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-950 md:px-6">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 md:hidden">Renk Alüminyum</p>
        <h1 className="truncate text-lg font-semibold tracking-tight">{title}</h1>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {action}
        {showSearch && (
          <form className="relative hidden lg:block" role="search"
            onSubmit={(event) => { event.preventDefault(); if (query.trim()) router.push('/search?q=' + encodeURIComponent(query.trim())); }}>
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input aria-label="Sipariş ve müşteri ara" placeholder="Sipariş, ürün, müşteri ara…" value={query}
              onChange={event => setQuery(event.target.value)}
              className="h-9 w-64 rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-slate-800 dark:bg-slate-900" />
          </form>
        )}
        <button type="button" onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          aria-label="Temayı değiştir" className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:hover:bg-slate-900">
          {resolvedTheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <Link href="/notifications" aria-label="Bildirimler" className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900"><Bell size={18} /></Link>
      </div>
    </header>
  );
}
