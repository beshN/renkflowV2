'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { switchThemeWithReveal } from '@/lib/shared/utils/theme-reveal';
import * as Dialog from '@radix-ui/react-dialog';
import { Bell, ChevronRight, Menu, Moon, Plus, Search, Sun, X, ArrowUpRight } from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';
import { useMemberAccess } from '@/lib/hooks/useMemberAccess';
import { DASHBOARD_QUICK_LINKS, getVisibleNavGroups } from '@/lib/core/dashboard-nav';
import { hasPermission } from '@/lib/auth/permissions';
import { useWorkspaceCommands } from './WorkspaceCommands';
import { cn } from '@/lib/utils';
import { BrandMark } from '@/components/brand/BrandMark';

/** Screens reached without a menu item still need their own breadcrumb. */
const OFF_MENU_SECTIONS: Record<string, string> = { '/search': 'Arama' };

export function WorkspaceHeader() {
  const pathname = usePathname();
  const { user } = useAuth();
  const memberAccess = useMemberAccess();
  const { resolvedTheme, setTheme } = useTheme();
  const { openCommands } = useWorkspaceCommands();
  const [mobileOpen, setMobileOpen] = useState(false);
  // The resolved theme is only known in the browser; render a neutral icon until mounted.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === 'dark';
  const current = DASHBOARD_QUICK_LINKS.find(item => item.href !== '/dashboard' && (pathname === item.href || pathname.startsWith(item.href + '/')));
  const offMenu = Object.keys(OFF_MENU_SECTIONS).find(href => pathname === href || pathname.startsWith(href + '/'));
  const section = current?.label || (offMenu && OFF_MENU_SECTIONS[offMenu]) || 'Genel bakış';
  const detail = current && pathname !== current.href;
  return <header className="rf-workspace-header sticky top-0 z-40 flex h-16 shrink-0 items-center gap-3 px-4 md:px-7">
    <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
      <Dialog.Trigger asChild><button className="rf-icon-button md:!hidden" aria-label="Ana menüyü aç"><Menu size={21} /></button></Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-slate-950/50 md:hidden" />
        <Dialog.Content className="fixed bottom-0 left-0 top-0 z-[71] flex w-[min(320px,85vw)] flex-col rf-sidebar p-5 outline-none md:hidden">
          <div className="mb-6 flex items-center justify-between"><Dialog.Title asChild><span><BrandMark href="/dashboard" /></span></Dialog.Title><Dialog.Close aria-label="Ana menüyü kapat" className="rf-icon-button"><X size={20} /></Dialog.Close></div>
          <Dialog.Description className="sr-only">Çalışma alanı modülleri</Dialog.Description>
          <nav className="flex-1 space-y-5 overflow-y-auto" aria-label="Mobil modüller">
            {getVisibleNavGroups(user?.role, memberAccess).map(group => <div key={group.id}><p className="sb-muted mb-2 px-3 text-[11px] font-medium">{group.label}</p>
              {group.items.filter(item => !item.action).map(item => <Link key={item.id} href={item.href} onClick={() => setMobileOpen(false)} aria-current={pathname === item.href ? 'page' : undefined}
                className={cn('rf-nav-item flex items-center justify-between px-3 py-2.5 text-sm', pathname === item.href && 'rf-nav-active')}>{item.label}<ArrowUpRight size={14} className="opacity-40" /></Link>)}
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
      <button type="button" onClick={openCommands} aria-label="Sipariş, müşteri veya modül ara" aria-keyshortcuts="Meta+K Control+K" className="rf-global-search flex h-8 items-center gap-2 border border-border bg-card px-2.5 text-xs text-muted-foreground">
        <Search size={15} /><span className="hidden xl:inline">Sipariş, müşteri veya modül ara</span><kbd aria-hidden="true" className="rf-kbd hidden sm:inline-flex">⌘ K</kbd>
      </button>
      {user && hasPermission(user.role, 'orders.create') && <Link href="/new-order" className="rf-primary-button !hidden h-8 items-center gap-1.5 px-3 text-xs sm:!inline-flex"><Plus size={15} /> Yeni sipariş</Link>}
      <div className="hidden h-6 w-px bg-border sm:block" />
      <button type="button" aria-label="Temayı değiştir" className="rf-icon-button" onClick={(event) => switchThemeWithReveal(isDark ? 'light' : 'dark', setTheme, event.currentTarget)}>
        {isDark ? <Sun size={17} /> : <Moon size={17} />}
      </button>
      <Link href="/notifications" aria-label="Bildirimler" className="rf-icon-button"><Bell size={17} /></Link>
      <Link href="/settings" title={user?.name} aria-label="Hesap ayarları" className="hidden h-8 w-8 items-center justify-center rounded-full bg-[hsl(var(--rf-ink))] text-xs font-semibold text-[hsl(var(--rf-ink-foreground))] transition-opacity hover:opacity-85 sm:flex">{user?.name?.slice(0, 1).toLocaleUpperCase('tr-TR') || 'R'}</Link>
    </div>
  </header>;
}
