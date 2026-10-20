'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import type { LucideIcon } from 'lucide-react';
import { Home, Receipt, PlusCircle, ClipboardList, KanbanSquare, Search, Bell, Wallet, Boxes, BarChart3, Users, Settings, LogOut, PanelLeftClose, PanelLeftOpen, LayoutGrid, FileText, Building2, Truck, ShoppingCart, PackageCheck, Recycle, ScanLine, Warehouse, Factory, ChevronDown, Target, Wrench, LifeBuoy, ScrollText, UserCog, CalendarDays, Calculator, Sparkles, IdCard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/context/AuthContext';
import { useMemberAccess } from '@/lib/hooks/useMemberAccess';
import { activeNavHref, getVisibleNavGroups } from '@/lib/core/dashboard-nav';
import { NavigationGroup } from './NavigationGroup';
import { BrandMark } from '@/components/brand/BrandMark';

const NAV_ICONS: Record<string, LucideIcon> = {
  dashboard: Home, orders: Receipt, 'new-order': PlusCircle, quotations: FileText,
  'work-orders': ClipboardList, kanban: KanbanSquare, search: Search, notifications: Bell,
  finance: Wallet, inventory: Boxes, suppliers: Building2, shipments: Truck,
  crm: Building2, reports: BarChart3, team: Users, settings: Settings,
  production: Factory, factory: Factory, warehouse: Warehouse, scan: ScanLine, purchases: ShoppingCart, receipts: PackageCheck, scrap: Recycle,
  assistant: Sparkles, leads: Target, installations: Wrench, vehicles: Truck, service: LifeBuoy, audit: ScrollText, account: UserCog, calendar: CalendarDays, accounting: Calculator, personnel: IdCard,
};
/** Hover motion per icon, in the spirit of Granola's sidebar. */
const NAV_ANIM: Record<string, string> = {
  shipments: 'drive', settings: 'spin', notifications: 'ring', scan: 'blink', search: 'tilt', 'new-order': 'spin', inventory: 'lift', warehouse: 'lift', receipts: 'lift', reports: 'grow', finance: 'tilt', team: 'nudge', production: 'grow', factory: 'grow', scrap: 'spin',
};
/** RAL 9016, 9006, 7016 and 8017, then the accent colour: the frame colours a pergola shop sells most, in the brand strip. */
const RAL_STRIP = ['#f1f0ea', '#a5a8a6', '#4a5256', '#6b4a3a', 'var(--acc-chrome)'];
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toLocaleUpperCase('tr-TR')).join('');
const ROLE_LABELS = { owner: 'Yönetici', admin: 'Yönetici', accountant: 'Muhasebe', office: 'Ofis', worker: 'Üretim', member: 'Ekip üyesi' };
interface AppleSidebarProps { collapsed: boolean; setCollapsed: (collapsed: boolean) => void; onExpandedChange?: (expanded: boolean) => void }

export function AppleSidebar({ collapsed, setCollapsed, onExpandedChange }: AppleSidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const memberAccess = useMemberAccess();
  const [hovered, setHovered] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expanded = !collapsed || hovered;
  const navGroups = useMemo(() => getVisibleNavGroups(user?.role, memberAccess), [user?.role, memberAccess]);
  const activeHref = activeNavHref(pathname, navGroups);
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
    className={cn('rf-sidebar fixed left-0 top-0 z-50 hidden h-dvh flex-col overflow-hidden md:flex transition-[width] duration-150 motion-reduce:transition-none', expanded ? 'w-[252px]' : 'w-[72px]', collapsed && expanded && 'shadow-xl')}>
    <div aria-hidden className="rf-ral-strip shrink-0">{RAL_STRIP.map(c => <span key={c} style={{ background: c }} />)}</div>
    <div className="sb-line flex h-[60px] shrink-0 items-center justify-between gap-3 border-b px-5">
      <BrandMark href="/dashboard" compact={!expanded} />
      {expanded && <button type="button" onClick={togglePinned} aria-expanded={!collapsed} aria-label={collapsed ? 'Menüyü sabitle' : 'Menüyü daralt'} className="sb-muted sb-hover rounded-md p-1.5">
        {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
      </button>}
    </div>
    <div className="sb-line mx-3 mb-1 mt-3 flex h-12 shrink-0 items-center gap-2.5 border-b px-1.5 pb-3 pt-1">
      <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] bg-[var(--acc-cta)] font-display text-[12px] font-bold text-[var(--acc-cta-fg)] ring-1 ring-white/15">{initials(user?.tenantName || 'Renk Alüminyum')}</span>
      <div className={cn('min-w-0 flex-1', !expanded && 'sr-only')}><p className="truncate text-[13px] font-semibold">{user?.tenantName || 'Renk Alüminyum'}</p><p className="sb-muted mt-0.5 text-[11px]">Üretim operasyonları</p></div>
    </div>
    <nav className="flex-1 overflow-x-hidden overflow-y-auto px-3 pb-4" aria-label="Modüller">
      {navGroups.map(group => <NavigationGroup key={group.id} label={group.label} expanded={expanded}
        active={group.items.some(item => pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href + '/')))}
        initiallyOpen={group.id === 'general' || group.id === 'sales' || (group.id === 'production' && !navGroups.some(g => g.id === 'sales'))}>
        {group.items.filter(item => !item.action).map(item => {
          const Icon = NAV_ICONS[item.id] || LayoutGrid;
          const active = activeHref === item.href;
          return <Link key={item.id} href={item.href} aria-current={active ? 'page' : undefined} title={!expanded ? item.label : undefined} data-anim={NAV_ANIM[item.id] || 'nudge'}
            className={cn('rf-nav-item relative flex h-8 items-center gap-3 whitespace-nowrap px-2.5 text-[13px] font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-[hsl(var(--ring))]', active && 'rf-nav-active')}>
            {active && <motion.span layoutId="rf-nav-pill" aria-hidden className="rf-nav-pill absolute inset-0 rounded-[4px]" transition={{ type: 'spring', stiffness: 520, damping: 40 }} />}
            <Icon size={16} strokeWidth={1.75} className="relative shrink-0" /><span className={cn('relative', !expanded && 'sr-only')}>{item.label}</span>
          </Link>;
        })}
      </NavigationGroup>)}
    </nav>
    <div className="sb-line shrink-0 border-t px-3 py-3">
      <div className="flex items-center gap-2.5 px-1.5 py-1.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold text-[var(--sb-fg)] ring-1 ring-white/15">{user?.name?.[0]?.toLocaleUpperCase('tr-TR') || 'R'}</span>
        <span className={cn('min-w-0 flex-1', !expanded && 'sr-only')}><span className="block truncate text-xs font-medium">{user?.name || 'Kullanıcı'}</span><span className="sb-muted mt-0.5 block text-[11px]">{user ? ROLE_LABELS[user.role] : 'Çalışma alanı'}</span></span>
        {expanded && <button type="button" onClick={() => signOut({ callbackUrl: '/auth/login' })} aria-label="Çıkış yap" title="Çıkış yap" className="sb-muted sb-hover rounded-md p-2"><LogOut size={15} /></button>}
      </div>
      {!expanded && <button type="button" aria-label="Menüyü sabitle" onClick={togglePinned} className="sb-muted sb-hover flex w-full items-center justify-center rounded-md p-2"><PanelLeftOpen size={16} /></button>}
    </div>
  </aside>;
}
