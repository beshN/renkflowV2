'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import type { LucideIcon } from 'lucide-react';
import {
  Home,
  Receipt,
  PlusCircle,
  ClipboardList,
  KanbanSquare,
  Search,
  Bell,
  Wallet,
  Boxes,
  BarChart3,
  Users,
  Settings,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  LayoutGrid,
  FileText,
  Building2,
  Truck,
  ShoppingCart,
  PackageCheck,
  Recycle,
  ScanLine,
  Warehouse,
  Factory,
  Target,
  Wrench,
  LifeBuoy,
  ScrollText,
  UserCog,
  CalendarDays,
  Calculator,
  Sparkles,
  IdCard,
  BookOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, useReducedMotion } from 'framer-motion';
import { useAuth } from '@/lib/context/AuthContext';
import { useMemberAccess } from '@/lib/hooks/useMemberAccess';
import { activeNavHref, getVisibleNavGroups } from '@/lib/core/dashboard-nav';
import { NavigationGroup } from './NavigationGroup';
import { BrandMark } from '@/components/brand/BrandMark';
import { BrushLogo } from '@/components/spells/BrushLogo';

const NAV_ICONS: Record<string, LucideIcon> = {
  knowledge: BookOpen,
  dashboard: Home,
  orders: Receipt,
  'new-order': PlusCircle,
  quotations: FileText,
  'work-orders': ClipboardList,
  kanban: KanbanSquare,
  search: Search,
  notifications: Bell,
  finance: Wallet,
  inventory: Boxes,
  suppliers: Building2,
  shipments: Truck,
  crm: Building2,
  reports: BarChart3,
  team: Users,
  settings: Settings,
  production: Factory,
  factory: Factory,
  warehouse: Warehouse,
  scan: ScanLine,
  purchases: ShoppingCart,
  receipts: PackageCheck,
  scrap: Recycle,
  assistant: Sparkles,
  leads: Target,
  installations: Wrench,
  vehicles: Truck,
  service: LifeBuoy,
  audit: ScrollText,
  account: UserCog,
  calendar: CalendarDays,
  accounting: Calculator,
  personnel: IdCard,
};
const ROLE_LABELS = {
  owner: 'Yönetici',
  admin: 'Yönetici',
  accountant: 'Muhasebe',
  office: 'Ofis',
  worker: 'Üretim',
  member: 'Ekip üyesi',
};
interface AppleSidebarProps {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  onExpandedChange?: (expanded: boolean) => void;
}

export function AppleSidebar({
  collapsed,
  setCollapsed,
  onExpandedChange,
}: AppleSidebarProps) {
  const pathname = usePathname();
  const reducedMotion = useReducedMotion();
  const { user } = useAuth();
  const memberAccess = useMemberAccess();
  const [hovered, setHovered] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expanded = !collapsed || hovered;
  const navGroups = useMemo(
    () => getVisibleNavGroups(user?.role, memberAccess),
    [user?.role, memberAccess],
  );
  const activeHref = activeNavHref(pathname, navGroups);
  useEffect(() => {
    onExpandedChange?.(!collapsed);
  }, [collapsed, onExpandedChange]);
  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );
  function openPreview() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setHovered(true);
  }
  function closePreview() {
    closeTimer.current = setTimeout(() => setHovered(false), 80);
  }
  function togglePinned() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setCollapsed(!collapsed);
    setHovered(false);
    try {
      localStorage.setItem('rf.sidebar.pinned', String(collapsed));
    } catch {
      /* Menu remains usable without storage. */
    }
  }
  return (
    <aside
      aria-label="RenkFlow ana menüsü"
      data-expanded={expanded}
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') openPreview();
      }}
      onPointerLeave={closePreview}
      onFocusCapture={openPreview}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          closePreview();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') setHovered(false);
      }}
      className={cn(
        'rf-sidebar fixed left-0 top-0 z-50 hidden h-dvh flex-col overflow-hidden md:flex transition-[width] duration-200 motion-reduce:transition-none',
        expanded ? 'rf-sidebar-expanded' : 'rf-sidebar-collapsed',
        collapsed && expanded && 'rf-sidebar-preview',
      )}
    >
      <div className="rf-sidebar-brand sb-line flex h-[60px] shrink-0 items-center justify-between gap-3 border-b px-5">
        <BrushLogo><BrandMark href="/dashboard" compact={!expanded} /></BrushLogo>
        {expanded && (
          <button
            type="button"
            onClick={togglePinned}
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Menüyü sabitle' : 'Menüyü daralt'}
            className="sb-muted sb-hover rounded-md p-1.5"
          >
            {collapsed ? (
              <PanelLeftOpen size={16} />
            ) : (
              <PanelLeftClose size={16} />
            )}
          </button>
        )}
      </div>
      <div className={cn('rf-sidebar-company', !expanded && 'sr-only')} title={user?.tenantName || 'Çalışma alanı'}>{user?.tenantName || 'Çalışma alanı'}</div>
      <nav
        className="flex-1 overflow-x-hidden overflow-y-auto px-3 pb-4"
        aria-label="Modüller"
      >
        {navGroups.map((group) => (
          <NavigationGroup
            key={group.id}
            label={group.label}
            expanded={expanded}
            storageKey={
              user?.tenantId && user?.id
                ? `rf.nav.${user.tenantId}.${user.id}.${group.id}`
                : undefined
            }
            active={group.items.some(
              (item) =>
                pathname === item.href ||
                (item.href !== '/dashboard' &&
                  pathname.startsWith(item.href + '/')),
            )}
            initiallyOpen={
              group.id === 'general' ||
              group.id === 'sales' ||
              (group.id === 'production' &&
                !navGroups.some((g) => g.id === 'sales'))
            }
          >
            {group.items
              .filter((item) => !item.action)
              .map((item) => {
                const Icon = NAV_ICONS[item.id] || LayoutGrid;
                const active = activeHref === item.href;
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    title={!expanded ? item.label : undefined}
                    className={cn(
                      'rf-nav-item relative flex h-8 items-center gap-3 whitespace-nowrap px-2.5 text-[13px] font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-[hsl(var(--ring))]',
                      active && 'rf-nav-active',
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId="rf-nav-pill"
                        aria-hidden
                        className="rf-nav-pill absolute inset-0 rounded-[4px]"
                        transition={
                          reducedMotion
                            ? { duration: 0 }
                            : { type: 'spring', stiffness: 520, damping: 40 }
                        }
                      />
                    )}
                    <Icon
                      size={16}
                      strokeWidth={1.5}
                      aria-hidden
                      className="relative shrink-0"
                    />
                    <span className="rf-sidebar-label relative">
                      {item.label}
                    </span>
                  </Link>
                );
              })}
          </NavigationGroup>
        ))}
      </nav>
      <div className="sb-line shrink-0 border-t px-3 py-3">
        <div className="flex items-center gap-2.5 px-1.5 py-1.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold text-[var(--sb-fg)] ring-1 ring-white/15">
            {user?.name?.[0]?.toLocaleUpperCase('tr-TR') || 'R'}
          </span>
          <span className={cn('min-w-0 flex-1', !expanded && 'sr-only')}>
            <span className="block truncate text-xs font-medium">
              {user?.name || 'Kullanıcı'}
            </span>
            <span className="sb-muted mt-0.5 block text-[11px]">
              {user ? ROLE_LABELS[user.role] : 'Çalışma alanı'}
            </span>
          </span>
          {expanded && (
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: '/auth/login' })}
              aria-label="Çıkış yap"
              title="Çıkış yap"
              className="sb-muted sb-hover rounded-md p-2"
            >
              <LogOut size={15} />
            </button>
          )}
        </div>
        {!expanded && (
          <button
            type="button"
            aria-label="Menüyü sabitle"
            onClick={togglePinned}
            className="sb-muted sb-hover flex w-full items-center justify-center rounded-md p-2"
          >
            <PanelLeftOpen size={16} />
          </button>
        )}
      </div>
    </aside>
  );
}
