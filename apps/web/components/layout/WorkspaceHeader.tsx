'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { switchThemeWithReveal } from '@/lib/shared/utils/theme-reveal';
import * as Dialog from '@radix-ui/react-dialog';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { signOut } from 'next-auth/react';
import { Bell, Building2, ChevronRight, LogOut, Menu, Moon, Plus, Search, Sun, UserRound, X, ArrowUpRight } from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';
import { useMemberAccess } from '@/lib/hooks/useMemberAccess';
import { DASHBOARD_QUICK_LINKS, activeNavHref, getVisibleNavGroups } from '@/lib/core/dashboard-nav';
import { canAccessRoute, hasPermission } from '@/lib/auth/permissions';
import { BASE_ROLE_LABELS } from '@/lib/security/team-rules';
import { requestJson } from '@/lib/shared/network';
import { useWorkspaceCommands } from './WorkspaceCommands';
import { cn } from '@/lib/utils';
import { NavigationGroup } from './NavigationGroup';
import { BrandMark } from '@/components/brand/BrandMark';
import { BrushLogo } from '@/components/spells/BrushLogo';
import { TeaBreak } from '@/components/spells/TeaBreak';

/** Screens reached without a menu item still need their own breadcrumb. */
const OFF_MENU_SECTIONS: Record<string, string> = { '/search': 'Arama', '/new-order': 'Yeni sipariş', '/notifications': 'Bildirimler' };

/** Sub-pages with their own name in the breadcrumb (others read "Detay"). */
const SUBPAGE_LABELS: Record<string, string> = { '/crm/import': 'İçe aktar' };

/** Unread in-app notifications, refreshed on every screen change (so reading them clears the badge). */
function useUnreadNotifications(enabled: boolean, pathname: string) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!enabled) { setCount(0); return; }
    const ac = new AbortController();
    void requestJson<{ unreadCount?: number }>('/api/notifications?limit=1&unread=true', { signal: ac.signal, cache: 'no-store' })
      .then((r) => { if (!ac.signal.aborted && r.ok) setCount(Math.max(0, Number(r.data?.unreadCount) || 0)); });
    return () => ac.abort();
  }, [enabled, pathname]);
  return count;
}

const MENU_ITEM = 'flex cursor-pointer select-none items-center gap-2 rounded-[9px] px-2.5 py-2 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-foreground';

export function WorkspaceHeader() {
  const pathname = usePathname();
  const { user } = useAuth();
  const memberAccess = useMemberAccess();
  const navGroups = getVisibleNavGroups(user?.role, memberAccess);
  const activeHref = activeNavHref(pathname, navGroups);
  const { resolvedTheme, setTheme } = useTheme();
  const { openCommands } = useWorkspaceCommands();
  const canSeeNotifications = !user || canAccessRoute(user.role, '/notifications');
  const unread = useUnreadNotifications(!!user && canSeeNotifications, pathname);
  const canOpenSettings = !!user && canAccessRoute(user.role, '/settings');
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    const open = () => setMobileOpen(true);
    window.addEventListener('rf:open-navigation', open);
    return () => window.removeEventListener('rf:open-navigation', open);
  }, []);
  // The resolved theme is only known in the browser; render a neutral icon until mounted.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === 'dark';
  const current = [...DASHBOARD_QUICK_LINKS].sort((a, b) => b.href.length - a.href.length).find(item => item.href !== '/dashboard' && (pathname === item.href || pathname.startsWith(item.href + '/')));
  const offMenu = Object.keys(OFF_MENU_SECTIONS).find(href => pathname === href || pathname.startsWith(href + '/'));
  const section = current?.label || (offMenu && OFF_MENU_SECTIONS[offMenu]) || 'Genel bakış';
  const detail = current && pathname !== current.href;
  return <header className="rf-workspace-header sticky top-0 z-40 flex h-16 shrink-0 items-center gap-3 px-4 md:px-7">
    <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
      <Dialog.Trigger asChild><button className="rf-icon-button md:!hidden" aria-label="Ana menüyü aç"><Menu size={21} /></button></Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-[2px] md:hidden" />
        <Dialog.Content className="fixed bottom-2 left-2 top-2 z-[71] flex w-[min(320px,85vw)] flex-col rounded-[20px] rf-sidebar p-5 outline-none md:hidden">
          <div className="mb-6 flex items-center justify-between"><Dialog.Title asChild><span><BrushLogo><BrandMark href="/dashboard" /></BrushLogo></span></Dialog.Title><Dialog.Close aria-label="Ana menüyü kapat" className="rf-icon-button"><X size={20} /></Dialog.Close></div>
          <Dialog.Description className="sr-only">Çalışma alanı modülleri</Dialog.Description>
          <nav className="flex-1 space-y-5 overflow-y-auto" aria-label="Mobil modüller">
            {navGroups.map(group => <NavigationGroup key={group.id} label={group.label}
              active={group.items.some(item => pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href + '/')))}
              initiallyOpen={group.id === 'general' || group.id === 'sales' || user?.role === 'worker'}>
              {group.items.filter(item => !item.action).map(item => <Link key={item.id} href={item.href} onClick={() => setMobileOpen(false)} aria-current={activeHref === item.href ? 'page' : undefined}
                className={cn('rf-nav-item flex items-center justify-between px-3 py-2.5 text-sm', activeHref === item.href && 'rf-nav-active')}>{item.label}<ArrowUpRight size={14} className="opacity-40" /></Link>)}
            </NavigationGroup>)}
          </nav>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
    <div className="flex min-w-0 items-center gap-2 text-xs">
      <Link href="/dashboard" className="hidden text-muted-foreground hover:text-foreground lg:block">Çalışma alanı</Link>
      <ChevronRight size={13} className="hidden text-muted-foreground/60 lg:block" />
      <span className="truncate font-medium text-foreground">{section}</span>
      {detail && <><ChevronRight size={13} className="text-muted-foreground/60" /><span className="text-muted-foreground">{SUBPAGE_LABELS[pathname] ?? 'Detay'}</span></>}
    </div>
    <div className="ml-auto flex shrink-0 items-center gap-1.5 md:gap-3">
      <button type="button" onClick={openCommands} aria-label="Sipariş, müşteri veya modül ara" aria-keyshortcuts="Meta+K Control+K" className="rf-global-search flex h-9 items-center gap-2 border border-border bg-card px-3 text-[12.5px] text-muted-foreground">
        <Search size={15} /><span className="hidden xl:inline">Sipariş, müşteri veya modül ara</span><kbd aria-hidden="true" className="rf-kbd hidden sm:inline-flex">⌘ K</kbd>
      </button>
      {user && hasPermission(user.role, 'orders.create') && <Link href="/new-order" className="rf-primary-button !hidden h-9 items-center gap-1.5 px-3.5 text-[12.5px] sm:!inline-flex"><Plus size={15} /> Yeni sipariş</Link>}
      <div className="hidden h-6 w-px bg-border sm:block" />
      <TeaBreak />
      <button type="button" aria-label="Temayı değiştir" className="rf-icon-button" onClick={(event) => switchThemeWithReveal(isDark ? 'light' : 'dark', setTheme, event.currentTarget)}>
        {isDark ? <Sun size={17} /> : <Moon size={17} />}
      </button>
      {canSeeNotifications && <Link href="/notifications" aria-label={unread ? `Bildirimler, ${unread} okunmamış` : 'Bildirimler'} className="rf-icon-button relative">
        <Bell size={17} />
        {unread > 0 && <span aria-hidden className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-none text-white tabular-nums">{unread > 99 ? '99+' : unread}</span>}
      </Link>}
      <DropdownMenu.Root modal={false}>
        <DropdownMenu.Trigger asChild>
          <button type="button" title={user?.name} aria-label="Kullanıcı menüsü" className="hidden h-9 w-9 items-center justify-center rounded-full bg-[hsl(var(--rf-ink))] text-xs font-semibold text-[hsl(var(--rf-ink-foreground))] transition-opacity hover:opacity-85 sm:flex">{user?.name?.slice(0, 1).toLocaleUpperCase('tr-TR') || 'R'}</button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content align="end" sideOffset={8} className="rf-command-dialog z-[75] w-60 rounded-[14px] border border-border bg-card p-1.5 text-card-foreground shadow-[0_18px_40px_-16px_rgb(0_0_0/0.3)]">
            {user && <DropdownMenu.Label className="px-2.5 py-2">
              <span className="block truncate text-sm font-medium">{user.name || user.email}</span>
              <span className="block truncate text-xs text-muted-foreground">{BASE_ROLE_LABELS[user.role]}</span>
            </DropdownMenu.Label>}
            {user && <DropdownMenu.Separator className="my-1 h-px bg-border" />}
            <DropdownMenu.Item asChild className={MENU_ITEM}><Link href="/account"><UserRound size={15} aria-hidden /> Hesabım</Link></DropdownMenu.Item>
            {canOpenSettings && <DropdownMenu.Item asChild className={MENU_ITEM}><Link href="/settings"><Building2 size={15} aria-hidden /> Firma ayarları</Link></DropdownMenu.Item>}
            <DropdownMenu.Separator className="my-1 h-px bg-border" />
            <DropdownMenu.Item className={MENU_ITEM} onSelect={() => void signOut({ callbackUrl: '/auth/login' })}><LogOut size={15} aria-hidden /> Çıkış yap</DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  </header>;
}
