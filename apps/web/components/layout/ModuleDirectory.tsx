'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowUpRight, Search, X } from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';
import { useMemberAccess } from '@/lib/hooks/useMemberAccess';
import { activeNavHref, getVisibleNavGroups } from '@/lib/core/dashboard-nav';
import { foldText } from '@/lib/shared/text/fold';
import { cn } from '@/lib/utils';

// Search tolerates keyboards without Turkish characters; identity matching keeps its own rules.
const searchText = (value: string) => foldText(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export function ModuleDirectory({ close }: { close: () => void }) {
  const { user } = useAuth();
  const access = useMemberAccess();
  const pathname = usePathname();
  const [query, setQuery] = useState('');
  const groups = getVisibleNavGroups(user?.role, access);
  const active = activeNavHref(pathname, groups);
  const keyword = searchText(query);
  const matches = groups.map(group => ({ ...group, items: group.items.filter(item =>
    !item.action && (!keyword || searchText(item.label + ' ' + group.label).includes(keyword)),
  ) })).filter(group => group.items.length);

  return <>
    <div className="flex items-center justify-between border-b border-border p-5">
      <div><Dialog.Title className="text-lg font-semibold">Tüm bölümler</Dialog.Title>
        <Dialog.Description className="mt-1 text-sm text-muted-foreground">Yapmak istediğiniz işi seçin.</Dialog.Description></div>
      <Dialog.Close aria-label="Bölümleri kapat" className="rf-icon-button"><X size={20} /></Dialog.Close>
    </div>
    <div className="px-5 pt-4"><label className="flex items-center gap-2 rounded-md border border-border px-3">
      <Search size={16} aria-hidden className="text-muted-foreground" />
      <input autoFocus value={query} onChange={event => setQuery(event.target.value)} aria-label="Bölüm ara" placeholder="Örn. stok, teklif, montaj…" className="min-h-11 w-full min-w-0 bg-transparent text-sm outline-none" />
    </label></div>
    <nav aria-label="Tüm bölümler" className="grid max-h-[60dvh] gap-5 overflow-y-auto p-5 sm:grid-cols-2">
      {matches.map(group => <section key={group.id}>
        <h2 className="mb-2 text-xs font-semibold text-muted-foreground">{group.label}</h2>
        <div className="space-y-1">{group.items.map(item => <Link key={item.id} href={item.href} onClick={close} aria-current={active === item.href ? 'page' : undefined}
          className={cn('flex min-h-11 items-center justify-between gap-2 rounded-md px-3 text-sm font-medium hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring', active === item.href && 'bg-primary/10 text-primary')}>
          {item.label}<ArrowUpRight size={14} aria-hidden className="shrink-0 opacity-40" />
        </Link>)}</div>
      </section>)}
      {!matches.length && <p role="status" className="py-6 text-sm text-muted-foreground sm:col-span-2">Bölüm bulunamadı. Başka bir adla arayın.</p>}
    </nav>
    <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3 text-xs text-muted-foreground">
      <span className="truncate">{user?.tenantName || 'Çalışma alanı'}</span>
      <button type="button" className="min-h-11 shrink-0 px-2 hover:text-foreground" onClick={() => signOut({ callbackUrl: '/auth/login' })}>Çıkış yap</button>
    </div>
  </>;
}
