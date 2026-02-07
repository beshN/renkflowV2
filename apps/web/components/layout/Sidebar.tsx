'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/context/AuthContext';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { signOut } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
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

const navGroups: NavGroup[] = [
  {
    id: 'operations',
    label: 'Operasyon',
    items: [
      { icon: Home, label: 'Ana Sayfa', href: '/dashboard' },
      { icon: Receipt, label: 'Siparişler', href: '/orders', requiresPermission: 'orders.view' },
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
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [logoFailed, setLogoFailed] = useState({ compact: false, full: false });
  const hoverLeaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Filter nav items based on user role and permissions
  const canRenderItem = useCallback((item: NavItem) => {
    if (item.adminOnly && user?.role !== 'owner' && user?.role !== 'admin') {
      return false;
    }

    if (item.requiresFinanceAccess && user?.role) {
      if (!canAccessFinance(user.role as UserRole)) {
        return false;
      }
    }

    if (item.requiresPermission && user?.role) {
      if (!hasPermission(user.role as UserRole, item.requiresPermission)) {
        return false;
      }
    }

    return true;
  }, [user?.role]);

  const visibleGroups = useMemo(() => (
    navGroups
      .map((group) => ({
        ...group,
        items: group.items.filter(canRenderItem),
      }))
      .filter((group) => group.items.length > 0)
  ), [canRenderItem]);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  // Prevent body scroll when mobile menu is open
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

  useEffect(() => {
    onDesktopExpandedChange?.(isHovered);
  }, [isHovered, onDesktopExpandedChange]);

  useEffect(() => {
    return () => {
      if (hoverLeaveTimerRef.current) {
        clearTimeout(hoverLeaveTimerRef.current);
      }
    };
  }, []);

  const handleItemClick = useCallback((item: NavItem, e: React.MouseEvent) => {
    if (item.action === 'logout') {
      e.preventDefault();
      signOut({ callbackUrl: '/auth/login' });
    }
  }, []);

  const handleDesktopEnter = useCallback(() => {
    if (hoverLeaveTimerRef.current) {
      clearTimeout(hoverLeaveTimerRef.current);
      hoverLeaveTimerRef.current = null;
    }
    setIsHovered(true);
  }, []);

  const handleDesktopLeave = useCallback(() => {
    if (hoverLeaveTimerRef.current) {
      clearTimeout(hoverLeaveTimerRef.current);
    }
    hoverLeaveTimerRef.current = setTimeout(() => {
      setIsHovered(false);
      hoverLeaveTimerRef.current = null;
    }, 120);
  }, []);

  const sidebarVariants = {
    collapsed: {
      width: '5rem',
      transition: { type: 'spring' as const, stiffness: 320, damping: 36, mass: 0.75 },
    },
    expanded: {
      width: '18rem',
      transition: { type: 'spring' as const, stiffness: 320, damping: 36, mass: 0.75 },
    },
  };

  return (
    <>
      {/* Mobile Hamburger Button */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        aria-label={isMobileOpen ? "Menüyü Kapat" : "Menüyü Aç"}
        className="md:hidden fixed top-4 left-4 z-[60] p-2.5 rounded-xl glass-button text-slate-600 dark:text-slate-300 active:scale-95 transition-all"
      >
        {isMobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="md:hidden fixed inset-0 bg-black/60 z-[55] backdrop-blur-sm"
            onClick={() => setIsMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar Container */}
      <motion.aside
        initial="collapsed"
        animate={isMobileOpen ? "expanded" : (isHovered ? "expanded" : "collapsed")}
        variants={sidebarVariants}
        onMouseEnter={handleDesktopEnter}
        onMouseLeave={handleDesktopLeave}
        className={cn(
          "fixed top-0 left-0 h-screen flex flex-col z-[58]",
          "bg-neutral-50/80 dark:bg-neutral-900/80 backdrop-blur-md border-r border-neutral-200 dark:border-neutral-800",
          "will-change-[width,transform]",
          isMobileOpen ? "translate-x-0 w-72" : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* Logo Section */}
        <div className="h-36 flex items-center justify-center relative flex-shrink-0 border-b border-white/10 dark:border-white/5 mb-2 overflow-hidden">
           {/* Logo R (Collapsed) */}
           <motion.div 
             animate={{ 
               opacity: isHovered || isMobileOpen ? 0 : 1,
               scale: isHovered || isMobileOpen ? 0.8 : 1,
               rotate: isHovered || isMobileOpen ? -10 : 0
             }}
             transition={{ type: 'spring', stiffness: 300, damping: 30 }}
             className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
              <div className="relative h-14 w-14 flex items-center justify-center">
                {logoFailed.compact ? (
                  <span className="text-2xl font-extrabold text-slate-900 dark:text-white">R</span>
                ) : (
                  <Image
                    src="/logo-r.png"
                    alt="RenkFlow"
                    fill
                    sizes="56px"
                    className="object-contain"
                    onError={() => setLogoFailed((prev) => ({ ...prev, compact: true }))}
                  />
                )}
              </div>
           </motion.div>

           {/* Full Logo (Expanded) */}
           <motion.div
             animate={{ 
               opacity: isHovered || isMobileOpen ? 1 : 0,
               scale: isHovered || isMobileOpen ? 1 : 0.9,
               x: isHovered || isMobileOpen ? 0 : -20
             }}
             transition={{ type: 'spring', stiffness: 280, damping: 28 }}
             className="absolute inset-0 flex items-center justify-center"
           >
              <div className="relative h-20 w-48 flex items-center justify-center p-1">
                {logoFailed.full ? (
                  <span className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">RenkFlow</span>
                ) : (
                  <Image
                    src="/email-assets/logo-full.png"
                    alt="RenkFlow"
                    fill
                    sizes="192px"
                    className="object-contain"
                    onError={() => setLogoFailed((prev) => ({ ...prev, full: true }))}
                  />
                )}
              </div>
           </motion.div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto overflow-x-hidden scrollbar-none">
          <div className="space-y-4">
            {visibleGroups.map((group) => (
              <section key={group.id} className="space-y-1.5">
                <div
                  className={cn(
                    "px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 transition-all duration-300",
                    (isHovered || isMobileOpen) ? "opacity-100 h-5" : "opacity-0 h-0 overflow-hidden"
                  )}
                >
                  {group.label}
                </div>

                {group.items.map((item) => {
                  const isDashboardItem = item.href === '/dashboard';
                  const isActive =
                    pathname === item.href ||
                    (isDashboardItem && pathname.startsWith('/dashboard/')) ||
                    (!isDashboardItem && item.href !== '#' && pathname.startsWith(`${item.href}/`));

                  return (
                    <Link
                      key={`${group.id}-${item.label}`}
                      href={item.href}
                      onClick={(e: React.MouseEvent<HTMLElement>) => handleItemClick(item, e)}
                      className={cn(
                        "relative flex items-center gap-3 px-3.5 py-2.5 rounded-lg transition-all duration-200 group overflow-hidden font-medium text-sm",
                        isActive
                          ? "text-primary-900 dark:text-white bg-white dark:bg-neutral-800 shadow-sm ring-1 ring-neutral-200 dark:ring-neutral-700"
                          : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-200",
                        item.action === 'logout' && "hover:bg-red-50 dark:hover:bg-red-900/10 hover:text-red-600 dark:hover:text-red-400"
                      )}
                    >
                      <div className={cn(
                        "transition-colors duration-200 flex-shrink-0",
                        isActive ? "text-primary-600 dark:text-primary-400" : "text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-neutral-300"
                      )}>
                        <item.icon size={20} />
                      </div>

                      <span className={cn(
                        "whitespace-nowrap transition-all duration-300 delay-75 origin-left",
                        (isHovered || isMobileOpen) ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4 w-0 overflow-hidden"
                      )}>
                        {item.label}
                      </span>
                    </Link>
                  );
                })}
              </section>
            ))}
          </div>
        </nav>

        {/* User Profile Section */}
        <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 bg-white/50 dark:bg-neutral-900/50">
           <div className={cn(
             "flex items-center gap-3 transition-all duration-300",
             (isHovered || isMobileOpen) ? "justify-start" : "justify-center"
           )}>
              <div className="relative h-10 w-10 rounded-full ring-2 ring-white dark:ring-slate-700 shadow-md flex-shrink-0 cursor-pointer overflow-hidden group">
                {user?.avatar ? (
                  <div className="relative w-full h-full">
                    <Image
                      src={user.avatar}
                      alt={user?.name || 'User'}
                      fill
                      sizes="40px"
                      className="object-cover transition-transform duration-500 group-hover:scale-110"
                      unoptimized
                    />
                  </div>
                ) : (
                   <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                      {(user?.name || 'U').charAt(0).toUpperCase()}
                   </div>
                )}
                
                {/* Status Indicator */}
                <div className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-white dark:border-slate-900" />
              </div>

              <div className={cn(
                 "flex flex-col transition-all duration-300 overflow-hidden whitespace-nowrap",
                 (isHovered || isMobileOpen) ? "opacity-100 max-w-[200px]" : "opacity-0 max-w-0"
              )}>
                 <span className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">
                    {user?.name}
                 </span>
                 <span className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
                    {user?.role === 'admin' ? 'Yönetici' : 'Personel'}
                 </span>
              </div>
           </div>
        </div>
      </motion.aside>
    </>
  );
}
