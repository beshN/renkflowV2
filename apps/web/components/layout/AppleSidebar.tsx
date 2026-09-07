'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { 
  Home, Receipt, PlusCircle, ClipboardList, KanbanSquare, Search, 
  Bell, Wallet, Boxes, BarChart3, Activity, Users, UserRound, 
  Settings, LogOut, ChevronLeft, ChevronRight, LayoutGrid,
  FileText, Building2, Truck, MessageSquare, ShoppingCart
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/context/AuthContext';
import { DASHBOARD_NAV_GROUPS } from '@/lib/core/dashboard-nav';
import { canAccessFinance, hasPermission, type UserRole } from '@/lib/auth/permissions';

// Map icons to dashboard-nav IDs
const NAV_ICONS: Record<string, LucideIcon> = {
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
  crm: ShoppingCart,
  reports: BarChart3,
  analytics: Activity,
  team: Users,
  members: UserRound,
  settings: Settings,
  logout: LogOut,
};

interface AppleSidebarProps {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  onExpandedChange?: (expanded: boolean) => void;
}

const SIDEBAR_COLLAPSED_WIDTH = 80;
const SIDEBAR_EXPANDED_WIDTH = 280;
const HOVER_COLLAPSE_DELAY_MS = 120;

export function AppleSidebar({ collapsed, setCollapsed, onExpandedChange }: AppleSidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const closeTimerRef = useRef<number | null>(null);
  const [isHoverExpanded, setIsHoverExpanded] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  const effectiveExpanded = !collapsed || (!isTouchDevice && isHoverExpanded);

  // Filter Nav Items based on permissions
  const navGroups = useMemo(() => {
    return DASHBOARD_NAV_GROUPS.map(group => ({
      ...group,
      items: group.items.filter(item => {
        const role = user?.role as UserRole | undefined;
        if (item.adminOnly && role !== 'owner' && role !== 'admin') return false;
        if (item.requiresFinanceAccess && role && !canAccessFinance(role)) return false;
        if (item.requiresPermission && role && !hasPermission(role, item.requiresPermission)) return false;
        return true;
      })
    })).filter(group => group.items.length > 0);
  }, [user]);

  const isActive = (href: string) => {
    if (href === '/dashboard' && pathname === '/dashboard') return true;
    if (href !== '/dashboard' && pathname.startsWith(href)) return true;
    return false;
  };

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia('(hover: none), (pointer: coarse)');
    const syncTouchDevice = () => {
      const nextIsTouch = mediaQuery.matches;
      setIsTouchDevice(nextIsTouch);
      if (nextIsTouch) {
        setIsHoverExpanded(false);
      }
    };

    syncTouchDevice();
    mediaQuery.addEventListener('change', syncTouchDevice);
    return () => {
      mediaQuery.removeEventListener('change', syncTouchDevice);
    };
  }, []);

  useEffect(() => {
    onExpandedChange?.(effectiveExpanded);
  }, [effectiveExpanded, onExpandedChange]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  const clearCloseTimer = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const handleMouseEnter = () => {
    if (!collapsed || isTouchDevice) {
      return;
    }
    clearCloseTimer();
    setIsHoverExpanded(true);
  };

  const handleMouseLeave = () => {
    if (!collapsed || isTouchDevice) {
      return;
    }
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setIsHoverExpanded(false);
    }, HOVER_COLLAPSE_DELAY_MS);
  };

  const handleToggle = () => {
    clearCloseTimer();
    const nextCollapsed = !collapsed;
    setCollapsed(nextCollapsed);
    if (!nextCollapsed) {
      setIsHoverExpanded(false);
    }
  };

  return (
    <motion.aside
      className={cn(
        "fixed left-0 top-0 z-50 h-screen flex flex-col border-r border-white/20 dark:border-white/5 shadow-2xl backdrop-blur-3xl bg-white/80 dark:bg-black/60",
        "transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
      )}
      initial={false}
      animate={{ width: effectiveExpanded ? SIDEBAR_EXPANDED_WIDTH : SIDEBAR_COLLAPSED_WIDTH }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Logo Section */}
      <div className="h-20 flex items-center justify-center relative border-b border-black/5 dark:border-white/5">
        <AnimatePresence mode="wait">
          {!effectiveExpanded ? (
            <motion.div
              key="logo-collapsed"
              initial={{ opacity: 0, scale: 0.88 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.88 }}
              className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-primary/30"
            >
              R
            </motion.div>
          ) : (
            <motion.div
              key="logo-expanded"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="flex items-center gap-3 px-6 w-full"
            >
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold shadow-md shadow-primary/20">
                R
              </div>
              <span className="text-xl font-display font-semibold tracking-tight text-foreground">RenkFlow</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Collapse Toggle */}
        <button
          onClick={handleToggle}
          className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white dark:bg-neutral-800 border border-black/10 dark:border-white/10 rounded-full flex items-center justify-center shadow-md text-muted-foreground hover:text-primary transition-colors hover:scale-110 active:scale-95 z-50"
          aria-label={collapsed ? 'Sidebar sabitleyip aç' : 'Sidebar daralt'}
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-6 px-3 scrollbar-hide">
        <div className="space-y-6">
          {navGroups.map((group) => (
            <div key={group.id}>
              {effectiveExpanded && (
                <h3 className="px-4 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider mb-2 animate-fade-in">
                  {group.label}
                </h3>
              )}
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = NAV_ICONS[item.id] || LayoutGrid;
                  const active = isActive(item.href);

                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      className="block"
                      title={!effectiveExpanded ? item.label : undefined}
                    >
                      <div
                        className={cn(
                          "relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-200 group",
                          active 
                            ? "bg-primary text-white shadow-md shadow-primary/25" 
                            : "text-muted-foreground hover:bg-black/5 dark:hover:bg-white/10 hover:text-foreground"
                        )}
                      >
                        <Icon 
                          size={20} 
                          className={cn(
                            "transition-transform group-hover:scale-110 duration-200", 
                            !effectiveExpanded && "mx-auto"
                          )} 
                          strokeWidth={active ? 2.5 : 2}
                        />
                        
                        {effectiveExpanded && (
                          <motion.span
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            className="text-sm font-medium tracking-wide"
                          >
                            {item.label}
                          </motion.span>
                        )}
                        
                        {active && effectiveExpanded && (
                          <motion.div
                            layoutId="active-pill"
                            className="absolute right-2 w-1.5 h-1.5 rounded-full bg-white/50"
                          />
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* User Profile Footer */}
      <div className="p-4 border-t border-black/5 dark:border-white/5 bg-white/30 dark:bg-black/20 backdrop-blur-md">
        <div className={cn("flex items-center gap-3", !effectiveExpanded ? "justify-center" : "")}>
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 p-[2px] shadow-lg">
            <div className="w-full h-full rounded-full bg-white dark:bg-black overflow-hidden relative">
              {user?.avatar ? (
                <Image src={user.avatar} alt="User" fill className="object-cover" />
              ) : (
                 <div className="w-full h-full flex items-center justify-center bg-neutral-100 dark:bg-neutral-800 text-sm font-bold">
                    {(user?.name?.[0] || 'U').toUpperCase()}
                 </div>
              )}
            </div>
          </div>
          
          {effectiveExpanded && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex-1 min-w-0"
            >
              <p className="text-sm font-semibold truncate text-foreground">{user?.name || 'User'}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email || 'user@renkflow.com'}</p>
            </motion.div>
          )}

          {effectiveExpanded && (
            <button className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-colors">
              <Settings size={16} />
            </button>
          )}
        </div>
      </div>
    </motion.aside>
  );
}
