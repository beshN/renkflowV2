'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/context/AuthContext';
import { useState, useEffect, useCallback, useMemo, useRef, type MouseEvent } from 'react';
import { signOut } from 'next-auth/react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import {
  Home,
  Receipt,
  PlusCircle,
  KanbanSquare,
  Settings,
  LogOut,
  Menu,
  X,
  BarChart3,
  Users,
  UserRound,
  Search,
  Activity,
  Bell,
  Wallet,
  Boxes,
  ClipboardList,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronRight,
} from 'lucide-react';
import { canAccessFinance, hasPermission, Permission, UserRole } from '@/lib/auth/permissions';

interface NavItem {
  icon: LucideIcon;
  label: string;
  href: string;
  adminOnly?: boolean;
  action?: string;
  requiresPermission?: Permission;
  requiresFinanceAccess?: boolean;
}

interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

interface SidebarProps {
  onDesktopExpandedChange?: (expanded: boolean) => void;
}

const SIDEBAR_PREFERENCE_KEY = 'rf.sidebar.expanded.v1';

const navGroups: NavGroup[] = [
  {
    id: 'operations',
    label: 'Operasyon',
    items: [
      { icon: Home, label: 'Ana Sayfa', href: '/dashboard' },
      { icon: Receipt, label: 'Siparişler', href: '/orders', requiresPermission: 'orders.view' },
      { icon: ClipboardList, label: 'İş Emirleri', href: '/work-orders', requiresPermission: 'orders.view' },
      { icon: PlusCircle, label: 'Yeni Sipariş', href: '/new-order', requiresPermission: 'orders.create' },
      { icon: KanbanSquare, label: 'Üretim Kanban', href: '/kanban', requiresPermission: 'kanban.view' },
      { icon: Search, label: 'Arama', href: '/search' },
      { icon: Bell, label: 'Bildirimler', href: '/notifications' },
    ],
  },
  {
    id: 'management',
    label: 'Yönetim',
    items: [
      { icon: Wallet, label: 'Finans', href: '/finance', requiresFinanceAccess: true },
      { icon: Boxes, label: 'Envanter', href: '/inventory', requiresPermission: 'inventory.view' },
      { icon: BarChart3, label: 'Raporlar', href: '/reports', requiresPermission: 'reports.view' },
      { icon: Activity, label: 'Analitik', href: '/analytics', requiresPermission: 'analytics.view' },
    ],
  },
  {
    id: 'team',
    label: 'Ekip ve Hesap',
    items: [
      { icon: Users, label: 'Ekip', href: '/team', requiresPermission: 'team.view' },
      { icon: UserRound, label: 'Üyeler', href: '/members' },
      { icon: Settings, label: 'Ayarlar', href: '/settings', requiresPermission: 'settings.view' },
      { icon: LogOut, label: 'Çıkış Yap', href: '#', action: 'logout' },
    ],
  },
];

export function Sidebar({ onDesktopExpandedChange }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const prefersReducedMotion = useReducedMotion();

  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isDesktopExpanded, setIsDesktopExpanded] = useState(false);
  const [markLogoFailed, setMarkLogoFailed] = useState(false);
  const [fullLogoFailed, setFullLogoFailed] = useState(false);
  const [hoveredItemKey, setHoveredItemKey] = useState<string | null>(null);
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showExpandedContent = isDesktopExpanded || isMobileOpen;

  const canRenderItem = useCallback(
    (item: NavItem) => {
      if (item.adminOnly && user?.role !== 'owner' && user?.role !== 'admin') {
        return false;
      }

      if (item.requiresFinanceAccess && user?.role && !canAccessFinance(user.role as UserRole)) {
        return false;
      }

      if (item.requiresPermission && user?.role && !hasPermission(user.role as UserRole, item.requiresPermission)) {
        return false;
      }

      return true;
    },
    [user?.role],
  );

  const visibleGroups = useMemo(
    () =>
      navGroups
        .map((group) => ({
          ...group,
          items: group.items.filter(canRenderItem),
        }))
        .filter((group) => group.items.length > 0),
    [canRenderItem],
  );

  const activeGroupId = useMemo(() => {
    const isItemActive = (item: NavItem) => {
      const isDashboardItem = item.href === '/dashboard';
      return (
        pathname === item.href ||
        (isDashboardItem && pathname.startsWith('/dashboard/')) ||
        (!isDashboardItem && item.href !== '#' && pathname.startsWith(`${item.href}/`))
      );
    };

    return visibleGroups.find((group) => group.items.some(isItemActive))?.id ?? visibleGroups[0]?.id ?? null;
  }, [visibleGroups, pathname]);

  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedValue = window.localStorage.getItem(SIDEBAR_PREFERENCE_KEY);
    if (storedValue === '1') {
      setIsDesktopExpanded(true);
      return;
    }
    if (storedValue === '0') {
      setIsDesktopExpanded(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(SIDEBAR_PREFERENCE_KEY, isDesktopExpanded ? '1' : '0');
  }, [isDesktopExpanded]);

  useEffect(() => {
    onDesktopExpandedChange?.(isDesktopExpanded);
  }, [isDesktopExpanded, onDesktopExpandedChange]);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      const isToggleCombo = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'b';
      if (!isToggleCombo || event.altKey || event.shiftKey) return;

      const target = event.target as HTMLElement | null;
      if (
        target?.isContentEditable ||
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT'
      ) {
        return;
      }

      if (!window.matchMedia('(min-width: 768px)').matches) return;

      event.preventDefault();
      setIsDesktopExpanded((prev) => !prev);
    };

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, []);

  useEffect(() => {
    return () => {
      if (tooltipTimerRef.current) {
        clearTimeout(tooltipTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileOpen]);

  const handleItemClick = useCallback((item: NavItem, e: MouseEvent) => {
    if (item.action === 'logout') {
      e.preventDefault();
      signOut({ callbackUrl: '/auth/login' });
    }
  }, []);

  const handleCollapsedItemHoverStart = useCallback((itemKey: string) => {
    if (tooltipTimerRef.current) {
      clearTimeout(tooltipTimerRef.current);
    }
    tooltipTimerRef.current = setTimeout(() => {
      setHoveredItemKey(itemKey);
    }, 120);
  }, []);

  const handleCollapsedItemHoverEnd = useCallback(() => {
    if (tooltipTimerRef.current) {
      clearTimeout(tooltipTimerRef.current);
      tooltipTimerRef.current = null;
    }
    setHoveredItemKey(null);
  }, []);

  return (
    <>
      <button
        onClick={() => setIsMobileOpen((prev) => !prev)}
        aria-label={isMobileOpen ? 'Menüyü Kapat' : 'Menüyü Aç'}
        className="fixed left-4 top-4 z-[60] rounded-lg border border-slate-300/80 bg-white/95 p-2.5 text-slate-700 shadow-sm transition-all active:scale-95 dark:border-slate-700/80 dark:bg-slate-900/90 dark:text-slate-200 md:hidden"
      >
        {isMobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[55] bg-slate-950/45 md:hidden"
            onClick={() => setIsMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      <aside
        className={cn(
          'fixed left-0 top-0 z-[58] flex h-screen -translate-x-full flex-col border-r border-[color-mix(in_srgb,var(--rf-border)_88%,transparent)] rf-panel-soft transition-[width,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]',
          'w-72 md:translate-x-0',
          isDesktopExpanded ? 'md:w-72' : 'md:w-[5.5rem]',
          isMobileOpen && 'translate-x-0',
        )}
      >
        <div className={cn('relative flex h-24 items-center border-b border-[color-mix(in_srgb,var(--rf-border)_84%,transparent)]', showExpandedContent ? 'px-5' : 'justify-center px-3')}>
          <motion.button
            type="button"
            onClick={() => setIsDesktopExpanded((prev) => !prev)}
            className="absolute right-3 top-1/2 hidden h-8 w-8 -translate-y-1/2 items-center justify-center overflow-hidden rounded-md border border-[color-mix(in_srgb,var(--rf-border)_85%,transparent)] bg-[color-mix(in_srgb,var(--rf-surface)_96%,transparent)] text-slate-600 md:inline-flex"
            aria-label={isDesktopExpanded ? 'Sidebarı daralt' : 'Sidebarı genişlet'}
            aria-expanded={isDesktopExpanded}
            title={isDesktopExpanded ? 'Sidebarı daralt (Ctrl/Cmd+B)' : 'Sidebarı genişlet (Ctrl/Cmd+B)'}
            whileHover={{
              scale: 1.06,
              borderColor: 'color-mix(in srgb, var(--rf-brand-600) 38%, var(--rf-border) 62%)',
              boxShadow: '0 0 0 1px color-mix(in srgb, var(--rf-brand-100) 40%, transparent), 0 10px 18px -10px color-mix(in srgb, var(--rf-brand-700) 45%, transparent)',
            }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 420, damping: 26, mass: 0.6 }}
          >
            <motion.span
              aria-hidden
              className="pointer-events-none absolute inset-0"
              animate={{
                opacity: isDesktopExpanded ? 0.95 : 0.75,
                background:
                  'radial-gradient(80% 80% at 50% 50%, color-mix(in srgb, var(--rf-brand-100) 70%, transparent), transparent 78%)',
              }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            />

            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={isDesktopExpanded ? 'collapse-icon' : 'expand-icon'}
                initial={{ opacity: 0, rotate: -24, scale: 0.8, y: 1 }}
                animate={{ opacity: 1, rotate: 0, scale: 1, y: 0 }}
                exit={{ opacity: 0, rotate: 24, scale: 0.8, y: -1 }}
                transition={{ type: 'spring', stiffness: 460, damping: 30, mass: 0.55 }}
                className="relative z-[1] flex items-center justify-center text-[var(--rf-brand-700)] dark:text-[var(--rf-brand-500)]"
              >
                {isDesktopExpanded ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
              </motion.span>
            </AnimatePresence>
          </motion.button>

          <AnimatePresence mode="wait" initial={false}>
            {showExpandedContent ? (
              <motion.div
                key="expanded-logo"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="flex w-full items-center"
              >
                <div className="relative h-10 w-[152px] max-w-[calc(100%-2.5rem)]">
                  {fullLogoFailed ? (
                    <div className="flex h-full items-center text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100">RenkFlow</div>
                  ) : (
                    <Image
                      src="/logo-full.png"
                      alt="RenkFlow"
                      fill
                      sizes="152px"
                      className="object-contain object-left"
                      onError={() => setFullLogoFailed(true)}
                      priority
                    />
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="collapsed-logo"
                initial={{ opacity: 0, scale: 0.88 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.88 }}
                transition={{ duration: 0.24, ease: 'easeOut' }}
                className="flex items-center justify-center"
              >
                <div className="relative h-11 w-11 overflow-hidden rounded-lg border border-[color-mix(in_srgb,var(--rf-border)_76%,transparent)] bg-[var(--rf-surface)] shadow-sm">
                  {markLogoFailed ? (
                    <div className="flex h-full w-full items-center justify-center bg-[var(--rf-brand-600)] text-sm font-bold text-white">R</div>
                  ) : (
                    <Image
                      src="/logo-r.png"
                      alt="RenkFlow"
                      fill
                      sizes="44px"
                      className="object-contain p-1"
                      onError={() => setMarkLogoFailed(true)}
                    />
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <nav className="flex-1 overflow-y-auto overflow-x-visible px-3 py-4">
          <div className="space-y-4">
            {visibleGroups.map((group) => (
              <section key={group.id} className="space-y-1.5">
                <AnimatePresence initial={false}>
                  {showExpandedContent && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.18 }}
                      className={cn(
                        'flex items-center justify-between px-3 text-[11px] font-semibold uppercase tracking-[0.12em]',
                        group.id === activeGroupId
                          ? 'text-[color-mix(in_srgb,var(--rf-brand-700)_88%,var(--rf-text)_12%)] dark:text-[var(--rf-brand-500)]'
                          : 'text-slate-500 dark:text-slate-400',
                      )}
                    >
                      <span>{group.label}</span>
                      {group.id === activeGroupId && <ChevronRight size={12} className="opacity-70" />}
                    </motion.div>
                  )}
                </AnimatePresence>

                {showExpandedContent && group.id !== activeGroupId ? (
                  <div className="mx-1 flex flex-wrap items-center gap-1.5 rounded-md border border-[color-mix(in_srgb,var(--rf-border)_80%,transparent)] bg-[color-mix(in_srgb,var(--rf-surface)_94%,transparent)] px-2 py-2">
                    {group.items.slice(0, 6).map((item) => (
                      <Link
                        key={`compact-${group.id}-${item.label}`}
                        href={item.href}
                        onClick={(e) => handleItemClick(item, e)}
                        title={item.label}
                        aria-label={item.label}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-[color-mix(in_srgb,var(--rf-brand-50)_60%,var(--rf-surface)_40%)] hover:text-[var(--rf-brand-700)] dark:text-slate-400 dark:hover:text-[var(--rf-brand-500)]"
                      >
                        <item.icon size={16} />
                      </Link>
                    ))}
                    {group.items.length > 6 && (
                      <span className="px-1 text-xs font-medium text-slate-500 dark:text-slate-400">+{group.items.length - 6}</span>
                    )}
                  </div>
                ) : (
                  group.items.map((item) => {
                    const isDashboardItem = item.href === '/dashboard';
                    const isActive =
                      pathname === item.href ||
                      (isDashboardItem && pathname.startsWith('/dashboard/')) ||
                      (!isDashboardItem && item.href !== '#' && pathname.startsWith(`${item.href}/`));
                    const itemKey = `${group.id}-${item.label}`;

                    return (
                      <Link
                        key={itemKey}
                        href={item.href}
                        onClick={(e) => handleItemClick(item, e)}
                        onMouseEnter={() => {
                          if (!showExpandedContent) handleCollapsedItemHoverStart(itemKey);
                        }}
                        onMouseLeave={() => {
                          if (!showExpandedContent) handleCollapsedItemHoverEnd();
                        }}
                        onFocus={() => {
                          if (!showExpandedContent) setHoveredItemKey(itemKey);
                        }}
                        onBlur={() => {
                          if (!showExpandedContent) setHoveredItemKey(null);
                        }}
                        aria-current={isActive ? 'page' : undefined}
                        aria-label={!showExpandedContent ? item.label : undefined}
                        className={cn(
                          'group relative flex rounded-md border text-sm font-medium transition-all duration-300',
                          showExpandedContent ? 'items-center gap-3 px-3.5 py-2.5' : 'mx-auto h-10 w-10 items-center justify-center',
                          isActive
                            ? 'border-[color-mix(in_srgb,var(--rf-brand-600)_36%,var(--rf-border)_64%)] bg-[color-mix(in_srgb,var(--rf-brand-50)_55%,var(--rf-surface)_45%)] text-slate-900 dark:text-slate-100'
                            : 'border-transparent text-slate-600 dark:text-slate-400 hover:border-[color-mix(in_srgb,var(--rf-border)_72%,transparent)] hover:bg-[color-mix(in_srgb,var(--rf-surface)_92%,transparent)] hover:text-slate-900 dark:hover:text-slate-200',
                          item.action === 'logout' && 'hover:bg-red-50 dark:hover:bg-red-900/10 hover:text-red-600 dark:hover:text-red-400',
                        )}
                      >
                        {isActive && (
                          <motion.span
                            layoutId="sidebar-active-rail"
                            transition={{ type: 'spring', stiffness: 440, damping: 34, mass: 0.7 }}
                            className={cn(
                              'absolute rounded-full bg-[var(--rf-brand-600)]/90 dark:bg-[var(--rf-brand-500)]/90',
                              showExpandedContent
                                ? 'left-1 top-2.5 bottom-2.5 w-0.5'
                                : 'left-1/2 top-0.5 h-0.5 w-5 -translate-x-1/2',
                            )}
                          />
                        )}

                        <div
                          className={cn(
                            'shrink-0',
                            isActive ? 'text-[var(--rf-brand-700)] dark:text-[var(--rf-brand-500)]' : 'text-slate-400',
                          )}
                        >
                          <item.icon size={19} />
                        </div>

                        <AnimatePresence initial={false}>
                          {showExpandedContent && (
                            <motion.span
                              initial={{ opacity: 0, x: -6 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: -6 }}
                              transition={{ duration: 0.18 }}
                              className="whitespace-nowrap"
                            >
                              {item.label}
                            </motion.span>
                          )}
                        </AnimatePresence>

                        {!showExpandedContent && (
                          <AnimatePresence>
                            {hoveredItemKey === itemKey && (
                              <motion.span
                                initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -6, scale: 0.98 }}
                                animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, x: 0, scale: 1 }}
                                exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -4, scale: 0.98 }}
                                transition={{ duration: 0.16, ease: 'easeOut' }}
                                className="pointer-events-none absolute left-[calc(100%+0.6rem)] top-1/2 z-20 hidden -translate-y-1/2 whitespace-nowrap rounded-md border border-[color-mix(in_srgb,var(--rf-border)_82%,transparent)] bg-[color-mix(in_srgb,var(--rf-surface)_98%,transparent)] px-2 py-1 text-xs font-medium text-slate-700 shadow-md dark:text-slate-200 md:block"
                              >
                                {item.label}
                              </motion.span>
                            )}
                          </AnimatePresence>
                        )}
                      </Link>
                    );
                  })
                )}
              </section>
            ))}
          </div>
        </nav>

        <div className="border-t border-[color-mix(in_srgb,var(--rf-border)_84%,transparent)] bg-[color-mix(in_srgb,var(--rf-surface)_88%,transparent)] p-4">
          <div className={cn('flex items-center', showExpandedContent ? 'gap-3' : 'justify-center')}>
            <div className="relative h-10 w-10 overflow-hidden rounded-full ring-2 ring-[color-mix(in_srgb,var(--rf-surface)_90%,transparent)] shadow-sm">
              {user?.avatar ? (
                <Image
                  src={user.avatar}
                  alt={user?.name || 'User'}
                  fill
                  sizes="40px"
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-[var(--rf-brand-600)] text-sm font-bold text-white">
                  {(user?.name || 'U').charAt(0).toUpperCase()}
                </div>
              )}

              <div className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[var(--rf-surface)] bg-[var(--rf-success)]" />
            </div>

            <AnimatePresence initial={false}>
              {showExpandedContent && (
                <motion.div
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.18 }}
                  className="min-w-0"
                >
                  <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">{user?.name || 'Kullanıcı'}</p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {user?.role === 'admin' ? 'Yönetici' : 'Personel'}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </aside>
    </>
  );
}
