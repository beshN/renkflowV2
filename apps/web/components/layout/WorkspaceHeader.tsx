'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import * as Dialog from '@radix-ui/react-dialog';
import { Bell, ChevronRight, Menu, Moon, Plus, Search, Sun, X, ArrowUpRight } from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';
import { DASHBOARD_QUICK_LINKS, getVisibleNavGroups } from '@/lib/core/dashboard-nav';
import { hasPermission } from '@/lib/auth/permissions';
import { useWorkspaceCommands } from './WorkspaceCommands';
import { cn } from '@/lib/utils';

export function WorkspaceHeader() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const { openCommands } = useWorkspaceCommands();
  const [mobileOpen, setMobileOpen] = useState(false);
  const current = DASHBOARD_QUICK_LINKS.find(item => item.href !== '/dashboard' && (pathname === item.href || pathname.startsWith(item.href + '/')));
  const section = current?.label || 'Genel bakış';
  const detail = current && pathname !== current.href;
  return <header className="rf-workspace-header sticky top-0 z-40 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-card px-4 md:px-7">
    <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
      <Dialog.Trigger asChild><button className="rf-icon-button md:!hidden" aria-label="Ana menüyü aç"><Menu size={21} /></button></Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-slate-950/50 md:hidden" />
        <Dialog.Content className="fixed bottom-0 left-0 top-0 z-[71] flex w-[min(320px,85vw)] flex-col bg-[#13212e] p-5 text-white outline-none md:hidden">
          <div className="mb-6 flex items-center justify-between"><Dialog.Title className="font-semibold">Renk Alüminyum</Dialog.Title><Dialog.Close aria-label="Ana menüyü kapat" className="rf-icon-button text-white"><X size={20} /></Dialog.Close></div>
          <Dialog.Description className="sr-only">Çalışma alanı modülleri</Dialog.Description>
          <nav className="flex-1 space-y-5 overflow-y-auto" aria-label="Mobil modüller">
            {getVisibleNavGroups(user?.role).map(group => <div key={group.id}><p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">{group.label}</p>
              {group.items.filter(item => !item.action).map(item => <Link key={item.id} href={item.href} onClick={() => setMobileOpen(false)} aria-current={pathname === item.href ? 'page' : undefined}
                className={cn('flex items-center justify-between rounded-md px-3 py-2.5 text-sm', pathname === item.href ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5')}>{item.label}<ArrowUpRight size={14} className="opacity-40" /></Link>)}
            </div>)}
          </nav>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
    <div className="flex min-w-0 items-center gap-2 text-xs">
      <Link href="/dashboard" className="hidden text-muted-foreground hover:text-foreground lg:block">Çalışma alanı</Link>
      <ChevronRight size={13} className="hidden text-muted-foreground/60 lg:block" />
      <span className="truncate font-medium text-foreground">{section}</span>
      {detail && <><ChevronRight size={13} className="text-muted-foreground/60" /><span className="text-muted-foreground">Detay</span></>}
    </div>
    <div className="ml-auto flex shrink-0 items-center gap-1.5 md:gap-3">
      <button type="button" onClick={openCommands} aria-label="Çalışma alanında ara" className="rf-global-search flex h-9 items-center gap-2 rounded-md border border-border bg-background px-2.5 text-xs text-muted-foreground hover:border-slate-400">
        <Search size={15} /><span className="hidden xl:inline">Sipariş, müşteri veya modül ara</span><kbd className="rf-kbd hidden sm:inline-flex">⌘ K</kbd>
      </button>
      {user && hasPermission(user.role, 'orders.create') && <Link href="/new-order" className="rf-primary-button !hidden h-9 items-center gap-1.5 px-3 text-xs sm:!inline-flex"><Plus size={15} /> Yeni sipariş</Link>}
      <div className="hidden h-6 w-px bg-border sm:block" />
      <button type="button" aria-label="Temayı değiştir" className="rf-icon-button" onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}>
        {resolvedTheme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
      </button>
      <Link href="/notifications" aria-label="Bildirimler" className="rf-icon-button"><Bell size={17} /></Link>
      <span title={user?.name} className="hidden h-8 w-8 items-center justify-center rounded-full border border-border bg-accent text-xs font-semibold sm:flex">{user?.name?.slice(0, 1).toLocaleUpperCase('tr-TR') || 'R'}</span>
    </div>
  </header>;
}
