'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FocusEvent, type MouseEvent } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  Activity,
  BarChart3,
  Bell,
  Boxes,
  ClipboardList,
  Home,
  KanbanSquare,
  LogOut,
  Menu,
  PlusCircle,
  Receipt,
  Search,
  Settings,
  UserRound,
  Users,
  Wallet,
  X,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/context/AuthContext';
import { canAccessFinance, hasPermission, type UserRole } from '@/lib/auth/permissions';
import { DASHBOARD_NAV_GROUPS, type DashboardNavItem } from '@/lib/core/dashboard-nav';

interface SidebarProps {
  onDesktopExpandedChange?: (expanded: boolean) => void;
}

const SIDEBAR_PREFERENCE_KEY = 'rf.sidebar.expanded.v2';
const HOVER_OPEN_DELAY_MS = 60;
const HOVER_CLOSE_DELAY_MS = 140;

const NAV_ICONS = {
  dashboard: Home,
  orders: Receipt,
  'new-order': PlusCircle,
  'work-orders': ClipboardList,
  kanban: KanbanSquare,
  search: Search,
  notifications: Bell,
  finance: Wallet,
  inventory: Boxes,
  reports: BarChart3,
  analytics: Activity,
  team: Users,
  members: UserRound,
  settings: Settings,
  logout: LogOut,
} as const;

function isActivePath(pathname: string, href: string): boolean {
  if (href === '#') return false;
  if (href === '/dashboard') {
    return pathname === '/dashboard' || pathname.startsWith('/dashboard/');
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({ onDesktopExpandedChange }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const prefersReducedMotion = useReducedMotion();

  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isPinnedExpanded, setIsPinnedExpanded] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(SIDEBAR_PREFERENCE_KEY) === '1';
  });
  const [isHoverExpanded, setIsHoverExpanded] = useState(false);
  const [showCompactLogoFallback, setShowCompactLogoFallback] = useState(false);
  const [showFullLogoFallback, setShowFullLogoFallback] = useState(false);

  const hoverOpenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sidebarRef = useRef<HTMLElement | null>(null);

  const effectiveDesktopExpanded = isPinnedExpanded || isHoverExpanded;
  const expanded = effectiveDesktopExpanded || isMobileOpen;

  const canRenderItem = useCallback(
    (item: DashboardNavItem) => {
      const role = user?.role as UserRole | undefined;

      if (item.adminOnly && role !== 'owner' && role !== 'admin') {
        return false;
      }
      if (item.requiresFinanceAccess && role && !canAccessFinance(role)) {
        return false;
      }
      if (item.requiresPermission && role && !hasPermission(role, item.requiresPermission)) {
        return false;
      }
      return true;
    },
    [user?.role],
  );

  const groups = useMemo(
    () => DASHBOARD_NAV_GROUPS.map((group) => ({ ...group, items: group.items.filter(canRenderItem) })).filter((group) => group.items.length > 0),
    [canRenderItem],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(SIDEBAR_PREFERENCE_KEY, isPinnedExpanded ? '1' : '0');
  }, [isPinnedExpanded]);

  useEffect(() => {
    onDesktopExpandedChange?.(effectiveDesktopExpanded);
  }, [effectiveDesktopExpanded, onDesktopExpandedChange]);

  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isMobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isMobileOpen]);

  useEffect(() => {
    return () => {
      if (hoverOpenTimerRef.current) clearTimeout(hoverOpenTimerRef.current);
      if (hoverCloseTimerRef.current) clearTimeout(hoverCloseTimerRef.current);
    };
  }, []);

  const canUseDesktopHover = useCallback(() => {
    if (typeof window === 'undefined') return false;
    if (!window.matchMedia('(min-width: 768px)').matches) return false;
    return window.matchMedia('(hover: hover)').matches || window.matchMedia('(any-hover: hover)').matches;
  }, []);

  const clearHoverTimers = useCallback(() => {
    if (hoverOpenTimerRef.current) {
      clearTimeout(hoverOpenTimerRef.current);
      hoverOpenTimerRef.current = null;
    }
    if (hoverCloseTimerRef.current) {
      clearTimeout(hoverCloseTimerRef.current);
      hoverCloseTimerRef.current = null;
    }
  }, []);

  const handleMouseEnter = useCallback(() => {
    if (isMobileOpen || isPinnedExpanded || !canUseDesktopHover()) return;
    clearHoverTimers();
    hoverOpenTimerRef.current = setTimeout(() => setIsHoverExpanded(true), HOVER_OPEN_DELAY_MS);
  }, [canUseDesktopHover, clearHoverTimers, isMobileOpen, isPinnedExpanded]);

  const handleMouseLeave = useCallback(() => {
    if (isMobileOpen || isPinnedExpanded || !canUseDesktopHover()) return;
    clearHoverTimers();
    hoverCloseTimerRef.current = setTimeout(() => setIsHoverExpanded(false), HOVER_CLOSE_DELAY_MS);
  }, [canUseDesktopHover, clearHoverTimers, isMobileOpen, isPinnedExpanded]);

  const handleFocusCapture = useCallback(() => {
    if (isMobileOpen || isPinnedExpanded || !canUseDesktopHover()) return;
    clearHoverTimers();
    setIsHoverExpanded(true);
  }, [canUseDesktopHover, clearHoverTimers, isMobileOpen, isPinnedExpanded]);

  const handleBlurCapture = useCallback(
    (event: FocusEvent<HTMLElement>) => {
      if (isMobileOpen || isPinnedExpanded || !canUseDesktopHover()) return;
      const nextTarget = event.relatedTarget as Node | null;
      if (nextTarget && sidebarRef.current?.contains(nextTarget)) return;
      clearHoverTimers();
      hoverCloseTimerRef.current = setTimeout(() => setIsHoverExpanded(false), HOVER_CLOSE_DELAY_MS);
    },
    [canUseDesktopHover, clearHoverTimers, isMobileOpen, isPinnedExpanded],
  );

  const handleItemClick = useCallback((item: DashboardNavItem, event: MouseEvent<HTMLElement>) => {
    if (item.action === 'logout') {
      event.preventDefault();
      signOut({ callbackUrl: '/auth/login' });
    }
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsMobileOpen((prev) => !prev)}
        className="fixed left-4 top-4 z-[70] inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300/80 bg-white/95 text-slate-700 shadow-sm md:hidden"
        aria-label={isMobileOpen ? 'Menüyü kapat' : 'Menüyü aç'}
      >
        {isMobileOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      <AnimatePresence>
        {isMobileOpen && (
          <motion.button
            type="button"
            aria-label="Kapat"
            className="fixed inset-0 z-[58] bg-slate-950/40 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      <aside
        ref={sidebarRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocusCapture={handleFocusCapture}
        onBlurCapture={handleBlurCapture}
        className={cn(
          'rf-sidebar-shell fixed left-0 top-0 z-[60] flex h-screen -translate-x-full flex-col border-r border-[color-mix(in_srgb,var(--rf-border)_88%,transparent)] rf-panel-soft transition-[width,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]',
          'w-72 md:translate-x-0',
          effectiveDesktopExpanded ? 'md:w-72' : 'md:w-[5.5rem]',
          isMobileOpen && 'translate-x-0',
        )}
      >
        <div className={cn('relative flex h-24 items-center border-b border-[color-mix(in_srgb,var(--rf-border)_84%,transparent)]', expanded ? 'px-5' : 'justify-center px-3')}>
          <button
            type="button"
            onClick={() => {
              setIsPinnedExpanded((prev) => !prev);
              setIsHoverExpanded(false);
            }}
            className="absolute right-3 top-1/2 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md border border-[color-mix(in_srgb,var(--rf-border)_85%,transparent)] bg-[color-mix(in_srgb,var(--rf-surface)_96%,transparent)] text-slate-600 transition hover:text-slate-900 md:inline-flex"
            aria-label={isPinnedExpanded ? 'Sidebarı daralt' : 'Sidebarı genişlet'}
          >
            {isPinnedExpanded ? <X size={14} /> : <Menu size={14} />}
          </button>

          <div className="relative flex h-10 w-full items-center justify-center">
            <motion.div
              initial={false}
              animate={{ opacity: expanded ? 0 : 1, x: expanded ? -8 : 0 }}
              transition={{ duration: prefersReducedMotion ? 0.01 : 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <div className="relative h-11 w-11 overflow-hidden rounded-lg border border-[color-mix(in_srgb,var(--rf-border)_76%,transparent)] bg-[var(--rf-surface)] shadow-sm">
                {showCompactLogoFallback ? (
                  <div className="flex h-full w-full items-center justify-center bg-[var(--rf-brand-600)] text-base font-bold text-white">R</div>
                ) : (
                  <Image
                    src="/logo-r.png"
                    alt="RenkFlow"
                    fill
                    sizes="44px"
                    className="object-contain p-1"
                    onError={() => setShowCompactLogoFallback(true)}
                  />
                )}
              </div>
            </motion.div>

            <motion.div
              initial={false}
              animate={{ clipPath: expanded ? 'inset(0 0 0 0)' : 'inset(0 100% 0 0)', x: expanded ? 0 : -10 }}
              transition={{ duration: prefersReducedMotion ? 0.01 : 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="absolute left-0 top-0 flex h-full w-full items-center"
            >
              <div className="relative h-10 w-[152px] max-w-[calc(100%-2.5rem)] px-2">
                {showFullLogoFallback ? (
                  <div className="flex h-full items-center text-base font-semibold text-slate-900 dark:text-slate-100">RenkFlow</div>
                ) : (
                  <Image
                    src="/logo-full.png"
                    alt="RenkFlow"
                    fill
                    sizes="152px"
                    className="object-contain object-left"
                    onError={() => setShowFullLogoFallback(true)}
                    priority
                  />
                )}
              </div>
            </motion.div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="space-y-4">
            {groups.map((group) => (
              <section key={group.id} className="space-y-1.5">
                <AnimatePresence initial={false}>
                  {expanded && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.18 }}
                      className="space-y-0.5 px-3"
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                        {group.label}
                      </p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500">{group.subtitle}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {group.items.map((item) => {
                  const Icon = NAV_ICONS[item.id as keyof typeof NAV_ICONS] ?? Home;
                  const active = isActivePath(pathname, item.href);

                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      onClick={(event: MouseEvent<HTMLElement>) => handleItemClick(item, event)}
                      aria-current={active ? 'page' : undefined}
                      aria-label={!expanded ? item.label : undefined}
                      title={!expanded ? item.label : undefined}
                      className={cn(
                        'group relative flex rounded-xl border text-sm font-medium transition-all',
                        expanded ? 'items-center gap-3 px-3.5 py-2.5' : 'mx-auto h-10 w-10 items-center justify-center',
                        active
                          ? 'border-[color-mix(in_srgb,var(--rf-brand-600)_36%,var(--rf-border)_64%)] bg-[color-mix(in_srgb,var(--rf-brand-50)_55%,var(--rf-surface)_45%)] text-slate-900 dark:text-slate-100'
                          : 'border-transparent text-slate-600 hover:border-[color-mix(in_srgb,var(--rf-border)_72%,transparent)] hover:bg-[color-mix(in_srgb,var(--rf-surface)_92%,transparent)] hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200',
                        item.action === 'logout' && 'hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/10 dark:hover:text-red-400',
                      )}
                    >
                      {active && (
                        <span
                          className={cn(
                            'absolute rounded-full bg-[var(--rf-brand-600)]/90',
                            expanded ? 'left-1 top-2.5 bottom-2.5 w-0.5' : 'left-1/2 top-0.5 h-0.5 w-5 -translate-x-1/2',
                          )}
                        />
                      )}

                      <Icon size={18} className={cn(active ? 'text-[var(--rf-brand-700)]' : 'text-slate-400')} />

                      <AnimatePresence initial={false}>
                        {expanded && (
                          <motion.span
                            initial={{ opacity: 0, x: -4 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -4 }}
                            transition={{ duration: 0.16 }}
                            className="whitespace-nowrap"
                          >
                            {item.label}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </Link>
                  );
                })}
              </section>
            ))}
          </div>
        </nav>

        <div className="border-t border-[color-mix(in_srgb,var(--rf-border)_84%,transparent)] bg-[color-mix(in_srgb,var(--rf-surface)_88%,transparent)] p-4">
          <div className={cn('flex items-center', expanded ? 'gap-3' : 'justify-center')}>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--rf-brand-600)] text-sm font-bold text-white">
              {(user?.name || 'U').charAt(0).toUpperCase()}
            </div>
            <AnimatePresence initial={false}>
              {expanded && (
                <motion.div
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -6 }}
                  transition={{ duration: 0.16 }}
                  className="min-w-0"
                >
                  <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">{user?.name || 'Kullanıcı'}</p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user?.role || 'member'}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </aside>
    </>
  );
}
