'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import type { LucideIcon } from 'lucide-react';
import { Home, Receipt, PlusCircle, ClipboardList, KanbanSquare, Search, Bell, Wallet, Boxes, BarChart3, Users, Settings, LogOut, PanelLeftClose, PanelLeftOpen, LayoutGrid, FileText, Building2, Truck, ShoppingCart, PackageCheck, Recycle, ScanLine, Warehouse, Factory, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/context/AuthContext';
import { getVisibleNavGroups } from '@/lib/core/dashboard-nav';

const NAV_ICONS: Record<string, LucideIcon> = {
  dashboard: Home, orders: Receipt, 'new-order': PlusCircle, quotations: FileText,
  'work-orders': ClipboardList, kanban: KanbanSquare, search: Search, notifications: Bell,
  finance: Wallet, inventory: Boxes, suppliers: Building2, shipments: Truck,
  crm: Building2, reports: BarChart3, team: Users, settings: Settings,
  production: Factory, factory: Factory, warehouse: Warehouse, scan: ScanLine, purchases: ShoppingCart, receipts: PackageCheck, scrap: Recycle,
};
const ROLE_LABELS = { owner: 'Yönetici', admin: 'Yönetici', accountant: 'Muhasebe', office: 'Ofis', worker: 'Üretim', member: 'Ekip üyesi' };
interface AppleSidebarProps { collapsed: boolean; setCollapsed: (collapsed: boolean) => void; onExpandedChange?: (expanded: boolean) => void }

export function AppleSidebar({ collapsed, setCollapsed, onExpandedChange }: AppleSidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [hovered, setHovered] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expanded = !collapsed || hovered;
  const navGroups = useMemo(() => getVisibleNavGroups(user?.role), [user?.role]);
  useEffect(() => { onExpandedChange?.(!collapsed); }, [collapsed, onExpandedChange]);
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);
  function openPreview() { if (closeTimer.current) clearTimeout(closeTimer.current); setHovered(true); }
  function closePreview() { closeTimer.current = setTimeout(() => setHovered(false), 80); }
  function togglePinned() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setCollapsed(!collapsed); setHovered(false);
    try { localStorage.setItem('rf.sidebar.pinned', String(collapsed)); } catch { /* Menu remains usable without storage. */ }
  }
  return <aside aria-label="Renk Alüminyum ana menüsü" data-expanded={expanded}
    onPointerEnter={event => { if (event.pointerType === 'mouse') openPreview(); }} onPointerLeave={closePreview}
    onFocusCapture={openPreview} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) closePreview(); }}
    onKeyDown={event => { if (event.key === 'Escape') setHovered(false); }}
    className={cn('rf-sidebar fixed left-0 top-0 z-50 hidden h-dvh flex-col overflow-hidden md:flex transition-[width] duration-150 motion-reduce:transition-none', expanded ? 'w-[252px]' : 'w-[72px]', collapsed && expanded && 'shadow-2xl')}>
    <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-white/[0.07] px-5">
      <Link href="/dashboard" aria-label="Renk Alüminyum kontrol paneli" className="flex min-w-0 items-center gap-3">
        <span className="rf-brand-mark flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-base font-bold text-white">R</span>
        <span className={cn('whitespace-nowrap text-sm font-semibold tracking-[0.07em] text-white', !expanded && 'sr-only')}>RENKFLOW</span>
      </Link>
      {expanded && <button type="button" onClick={togglePinned} aria-expanded={!collapsed} aria-label={collapsed ? 'Menüyü sabitle' : 'Menüyü daralt'} className="rounded p-1.5 text-slate-400 hover:bg-white/5 hover:text-white">
        {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
      </button>}
    </div>
    <div className="mx-3 mb-1 mt-4 flex h-12 shrink-0 items-center gap-2.5 rounded-md border border-white/10 px-2.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-white/10 text-slate-300"><Building2 size={15} /></span>
      <div className={cn('min-w-0 flex-1', !expanded && 'sr-only')}><p className="truncate text-xs font-medium text-slate-100">{user?.tenantName || 'Renk Alüminyum'}</p><p className="mt-0.5 text-[10px] text-slate-400">Üretim operasyonları</p></div>
    </div>
    <nav className="flex-1 overflow-x-hidden overflow-y-auto px-3 pb-4" aria-label="Modüller">
      {navGroups.map(group => <div key={group.id} className="mt-5">
        <div className="mb-2 h-3 px-3"><span className={cn('whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400', !expanded && 'invisible')}>{group.label}</span></div>
        <div className="space-y-0.5">{group.items.filter(item => !item.action).map(item => {
          const Icon = NAV_ICONS[item.id] || LayoutGrid;
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'));
          return <Link key={item.id} href={item.href} aria-current={active ? 'page' : undefined} title={!expanded ? item.label : undefined}
            className={cn('rf-nav-item relative flex h-9 items-center gap-3 overflow-hidden whitespace-nowrap rounded-md px-3 text-[12px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400', active ? 'rf-nav-active' : 'text-slate-400 hover:bg-white/5 hover:text-slate-100')}>
            <Icon size={17} strokeWidth={1.7} className="shrink-0" /><span className={!expanded ? 'sr-only' : ''}>{item.label}</span>
          </Link>;
        })}</div>
      </div>)}
    </nav>
    <div className="shrink-0 border-t border-white/[0.07] px-3 py-3">
      <div className="flex items-center gap-2.5 px-2 py-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs font-medium text-white">{user?.name?.[0]?.toLocaleUpperCase('tr-TR') || 'R'}</span>
        <span className={cn('min-w-0 flex-1', !expanded && 'sr-only')}><span className="block truncate text-xs font-medium text-white">{user?.name || 'Kullanıcı'}</span><span className="mt-0.5 block text-[10px] text-slate-400">{user ? ROLE_LABELS[user.role] : 'Çalışma alanı'}</span></span>
        {expanded && <button type="button" onClick={() => signOut({ callbackUrl: '/auth/login' })} aria-label="Çıkış yap" title="Çıkış yap" className="rounded p-2 text-slate-400 hover:bg-white/5 hover:text-white"><LogOut size={16} /></button>}
      </div>
      {!expanded && <button type="button" aria-label="Menüyü sabitle" onClick={togglePinned} className="flex w-full items-center justify-center rounded-md p-2 text-slate-400 hover:bg-white/5"><PanelLeftOpen size={16} /></button>}
    </div>
  </aside>;
}
