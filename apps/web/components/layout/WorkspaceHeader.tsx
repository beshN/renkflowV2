'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { switchThemeWithReveal } from '@/lib/shared/utils/theme-reveal';
import { Bell, ChevronRight, Menu, Moon, Plus, Search, Sun } from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';
import { DASHBOARD_QUICK_LINKS, canUseWorkspaceAction } from '@/lib/core/dashboard-nav';
import { hasPermission } from '@/lib/auth/permissions';
import { useWorkspaceCommands } from './WorkspaceCommands';
import { useMemberAccess } from '@/lib/hooks/useMemberAccess';

/** Screens reached without a menu item still need their own breadcrumb. */
const OFF_MENU_SECTIONS: Record<string, string> = { '/search': 'Arama', '/new-order': 'Yeni sipariş', '/kanban': 'Sipariş panosu' };

export function WorkspaceHeader() {
  const pathname = usePathname();
  const { user } = useAuth();
  const access = useMemberAccess();
  const { resolvedTheme, setTheme } = useTheme();
  const { openCommands, openModules } = useWorkspaceCommands();
  // The resolved theme is only known in the browser; render a neutral icon until mounted.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === 'dark';
  const current = [...DASHBOARD_QUICK_LINKS].sort((a, b) => b.href.length - a.href.length).find(item => item.href !== '/dashboard' && (pathname === item.href || pathname.startsWith(item.href + '/')));
  const offMenu = Object.keys(OFF_MENU_SECTIONS).find(href => pathname === href || pathname.startsWith(href + '/'));
  const section = current?.label || (offMenu && OFF_MENU_SECTIONS[offMenu]) || 'Genel bakış';
  const detail = current && pathname !== current.href;
  const detailLabel = pathname.endsWith('/count-import') ? 'Sayım aktarımı' : pathname.endsWith('/opening-count') ? 'Çubuk sayımı' : pathname.endsWith('/import') ? 'İçe aktar' : 'Detay';
  return <header className="rf-workspace-header sticky top-0 z-40 flex h-16 shrink-0 items-center gap-3 px-4 md:px-7">
    <button type="button" className="rf-icon-button md:!hidden" aria-label="Tüm bölümleri aç" onClick={openModules}><Menu size={21} /></button>
    <div className="flex min-w-0 items-center gap-2 text-xs">
      <Link href="/dashboard" className="hidden text-muted-foreground hover:text-foreground lg:block">Çalışma alanı</Link>
      <ChevronRight size={13} className="hidden text-muted-foreground/60 lg:block" />
      <span className="truncate font-medium text-foreground">{section}</span>
      {detail && <><ChevronRight size={13} className="text-muted-foreground/60" /><span className="text-muted-foreground">{detailLabel}</span></>}
    </div>
    <div className="ml-auto flex shrink-0 items-center gap-1.5 md:gap-3">
      <button type="button" onClick={openCommands} aria-label="Sipariş, müşteri veya modül ara" aria-keyshortcuts="Meta+K Control+K" className="rf-global-search flex h-8 items-center gap-2 border border-border bg-card px-2.5 text-xs text-muted-foreground">
        <Search size={15} /><span className="hidden xl:inline">Sipariş, müşteri veya modül ara</span><kbd aria-hidden="true" className="rf-kbd hidden sm:inline-flex">⌘ K</kbd>
      </button>
      {user && hasPermission(user.role, 'orders.create') && canUseWorkspaceAction(user.role, access, { module: 'orders', action: 'create' }) && <Link href="/new-order" className="rf-primary-button !hidden h-8 items-center gap-1.5 px-3 text-xs sm:!inline-flex"><Plus size={15} /> Yeni sipariş</Link>}
      <div className="hidden h-6 w-px bg-border sm:block" />
      <button type="button" aria-label="Temayı değiştir" className="rf-icon-button" onClick={(event) => switchThemeWithReveal(isDark ? 'light' : 'dark', setTheme, event.currentTarget)}>
        {isDark ? <Sun size={17} /> : <Moon size={17} />}
      </button>
      <Link href="/notifications" aria-label="Bildirimler" className="rf-icon-button"><Bell size={17} /></Link>
      <Link href="/account" title={user?.name} aria-label="Hesabım" className="hidden h-8 w-8 items-center justify-center rounded-full bg-[hsl(var(--rf-ink))] text-xs font-semibold text-[hsl(var(--rf-ink-foreground))] transition-opacity hover:opacity-85 sm:flex">{user?.name?.slice(0, 1).toLocaleUpperCase('tr-TR') || 'R'}</Link>
    </div>
  </header>;
}
