'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import type { LucideIcon } from 'lucide-react';
import {
  Home, Receipt, PlusCircle, ClipboardList, KanbanSquare, Search, Bell,
  Wallet, Boxes, BarChart3, Users, Settings, LogOut, ChevronLeft, ChevronRight,
  LayoutGrid, FileText, Building2, Truck, ShoppingCart, PackageCheck, Recycle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/context/AuthContext';
import { DASHBOARD_NAV_GROUPS } from '@/lib/core/dashboard-nav';
import { canAccessFinance, hasPermission, type UserRole } from '@/lib/auth/permissions';

const NAV_ICONS: Record<string, LucideIcon> = {
  dashboard: Home, orders: Receipt, 'new-order': PlusCircle, quotations: FileText,
  'work-orders': ClipboardList, kanban: KanbanSquare, search: Search, notifications: Bell,
  finance: Wallet, inventory: Boxes, suppliers: Building2, shipments: Truck,
  crm: ShoppingCart, reports: BarChart3, team: Users, settings: Settings,
  purchases: ShoppingCart, receipts: PackageCheck, scrap: Recycle, logout: LogOut,
};

interface AppleSidebarProps {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  onExpandedChange?: (expanded: boolean) => void;
}

export function AppleSidebar({ collapsed, setCollapsed, onExpandedChange }: AppleSidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [hovered, setHovered] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expanded = !collapsed || hovered;
  const navGroups = useMemo(() => DASHBOARD_NAV_GROUPS.map(group => ({
    ...group,
    items: group.items.filter(item => {
      const role = user?.role as UserRole | undefined;
      if (!role) return !item.requiresPermission && !item.requiresFinanceAccess;
      if (item.adminOnly && role !== 'owner' && role !== 'admin') return false;
      if (item.requiresFinanceAccess && !canAccessFinance(role)) return false;
      return !item.requiresPermission || hasPermission(role, item.requiresPermission);
    }),
  })).filter(group => group.items.length > 0), [user?.role]);

  // Hover opens over the page; only pinning changes the content offset.
  useEffect(() => { onExpandedChange?.(!collapsed); }, [collapsed, onExpandedChange]);
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);
  function openPreview() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setHovered(true);
  }
  function closePreview() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setHovered(false), 60);
  }
  function togglePinned() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    const next = !collapsed;
    setCollapsed(next);
    setHovered(false);
    localStorage.setItem('rf.sidebar.pinned', String(!next));
  }

  return (
    <aside aria-label="Renk Alüminyum ana menüsü" data-expanded={expanded}
      onPointerEnter={(event) => { if (event.pointerType === 'mouse') openPreview(); }}
      onPointerLeave={closePreview} onFocusCapture={openPreview}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) closePreview();
      }}
      onKeyDown={(event) => { if (event.key === 'Escape') setHovered(false); }}
      className={cn(
        'fixed left-0 top-0 z-50 hidden h-dvh flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 md:flex',
        'transition-[width] duration-150 ease-out motion-reduce:transition-none',
        expanded ? 'w-[280px]' : 'w-20',
        collapsed && expanded && 'shadow-xl shadow-slate-900/10',
      )}>
      <div className="relative flex h-16 shrink-0 items-center gap-3 border-b border-slate-100 px-5 dark:border-slate-800">
        <Link href="/dashboard" aria-label="Renk Alüminyum kontrol paneli" className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-lg font-bold text-white dark:bg-blue-600">R</span>
          <span className={cn('whitespace-nowrap', !expanded && 'sr-only')}>
            <span className="block text-sm font-bold text-slate-900 dark:text-white">Renk Alüminyum</span>
            <span className="block text-[11px] text-slate-500">RenkFlow · Üretim yönetimi</span>
          </span>
        </Link>
        <button type="button" onClick={togglePinned} aria-expanded={!collapsed}
          aria-label={collapsed ? 'Menüyü sabitle' : 'Menüyü daralt'}
          className="absolute -right-3 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:text-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:border-slate-700 dark:bg-slate-900">
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>
      <nav className="flex-1 overflow-x-hidden overflow-y-auto px-3 py-3" aria-label="Modüller">
        {navGroups.map(group => (
          <div key={group.id} className="mb-3">
            <div className="h-7 overflow-hidden px-3 pt-2">
              <span className={cn('whitespace-nowrap text-[10px] font-semibold uppercase tracking-wider text-slate-400', !expanded && 'invisible')}>{group.label}</span>
            </div>
            <div className="space-y-0.5">
              {group.items.map(item => {
                const Icon = NAV_ICONS[item.id] || LayoutGrid;
                const active = item.href === '/dashboard' ? pathname === item.href : pathname.startsWith(item.href);
                const classes = cn('flex h-10 items-center gap-3 overflow-hidden whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-colors duration-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500',
                  active ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white');
                const content = <><Icon size={19} className="shrink-0" /><span className={!expanded ? 'sr-only' : ''}>{item.label}</span></>;
                return item.action === 'logout' ? (
                  <button key={item.id} type="button" className={cn(classes, 'w-full')} title={item.label}
                    onClick={() => signOut({ callbackUrl: '/auth/login' })}>{content}</button>
                ) : (
                  <Link key={item.id} href={item.href} aria-current={active ? 'page' : undefined} title={!expanded ? item.label : undefined} className={classes}>{content}</Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <Link href="/settings" aria-label="Kullanıcı ayarları" className="flex h-16 shrink-0 items-center gap-3 overflow-hidden border-t border-slate-100 px-5 dark:border-slate-800">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{user?.name?.[0]?.toUpperCase() || 'R'}</span>
        <span className={cn('min-w-0', !expanded && 'sr-only')}>
          <span className="block truncate text-sm font-medium">{user?.name || 'Kullanıcı'}</span>
          <span className="block truncate text-xs text-slate-500">{user?.email}</span>
        </span>
      </Link>
    </aside>
  );
}
