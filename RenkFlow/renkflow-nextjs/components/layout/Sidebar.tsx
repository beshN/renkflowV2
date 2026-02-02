'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/context/AuthContext';
import { useState, useEffect, useCallback } from 'react';
import { signOut } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { 
  Home, 
  Receipt, 
  PlusCircle, 
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
} from 'lucide-react';
import { canAccessFinance, hasPermission, Permission, UserRole } from '@/lib/auth/permissions';

interface NavItem {
  icon: LucideIcon;
  label: string;
  href: string;
  adminOnly: boolean;
  action?: string;
  requiresPermission?: Permission;
  requiresFinanceAccess?: boolean;
}

const navItems: NavItem[] = [
  { icon: Home, label: 'Ana Sayfa', href: '/dashboard', adminOnly: false },
  { icon: Receipt, label: 'Siparişler', href: '/orders', adminOnly: false, requiresPermission: 'orders.view' },
  { icon: PlusCircle, label: 'Yeni Sipariş', href: '/new-order', adminOnly: false, requiresPermission: 'orders.create' },
  { icon: Search, label: 'Arama', href: '/search', adminOnly: false },
  { icon: Bell, label: 'Bildirimler', href: '/notifications', adminOnly: false },
  { icon: Wallet, label: 'Finans', href: '/finance', adminOnly: false, requiresFinanceAccess: true },
  { icon: BarChart3, label: 'Raporlar', href: '/reports', adminOnly: false, requiresPermission: 'reports.view' },
  { icon: Activity, label: 'Analitik', href: '/analytics', adminOnly: false, requiresPermission: 'analytics.view' },
  { icon: Users, label: 'Ekip', href: '/team', adminOnly: false, requiresPermission: 'team.view' },
  { icon: UserRound, label: 'Üyeler', href: '/members', adminOnly: false },
  { icon: Settings, label: 'Ayarlar', href: '/settings', adminOnly: false, requiresPermission: 'settings.view' },
  { icon: LogOut, label: 'Çıkış Yap', href: '#', adminOnly: false, action: 'logout' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [logoFailed, setLogoFailed] = useState({ compact: false, full: false });

  // Filter nav items based on user role and permissions
  const filteredNavItems = navItems.filter(item => {
    // Admin only items
    if (item.adminOnly && user?.role !== 'owner' && user?.role !== 'admin') {
      return false;
    }
    
    // Finance access check
    if (item.requiresFinanceAccess && user?.role) {
      if (!canAccessFinance(user.role as UserRole)) {
        return false;
      }
    }
    
    // Permission check
    if (item.requiresPermission && user?.role) {
      if (!hasPermission(user.role as UserRole, item.requiresPermission)) {
        return false;
      }
    }
    
    return true;
  });

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

  const handleItemClick = useCallback((item: NavItem, e: React.MouseEvent) => {
    if (item.action === 'logout') {
      e.preventDefault();
      signOut({ callbackUrl: '/auth/login' });
    }
  }, []);

  const sidebarVariants = {
    collapsed: { width: '5rem' }, // w-20
    expanded: { width: '18rem' }, // w-72
  };

  return (
    <>
      {/* Mobile Hamburger Button */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        aria-label={isMobileOpen ? "Menüyü Kapat" : "Menüyü Aç"}
        className="md:hidden fixed top-4 left-4 z-[60] p-2.5 rounded-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-lg border border-white/20 dark:border-white/10 text-slate-600 dark:text-slate-300 active:scale-95 transition-all"
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

      {/* Desktop Placeholder - Keeps layout spacing constant */}
      <div className="hidden md:block w-20 flex-shrink-0 h-screen transition-all duration-300" />

      {/* Sidebar Container */}
      <motion.aside
        initial="collapsed"
        animate={isMobileOpen ? "expanded" : (isHovered ? "expanded" : "collapsed")}
        variants={sidebarVariants}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          "fixed top-0 left-0 h-screen flex flex-col z-[58]",
          "bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-r border-white/20 dark:border-white/5 shadow-2xl",
          "transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)]", // Custom easing
          isMobileOpen ? "translate-x-0 w-72" : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* Logo Section */}
        <div className="h-32 flex items-center justify-center relative flex-shrink-0 border-b border-white/10 dark:border-white/5 mb-2 overflow-hidden">
           {/* Logo R (Collapsed) */}
           <motion.div 
             animate={{ 
               opacity: isHovered || isMobileOpen ? 0 : 1,
               scale: isHovered || isMobileOpen ? 0.8 : 1,
               rotate: isHovered || isMobileOpen ? -10 : 0
             }}
             className="absolute inset-0 flex items-center justify-center pointer-events-none"
           >
              <div className="relative h-12 w-12 rounded-xl overflow-hidden shadow-lg bg-white flex items-center justify-center p-1">
                {logoFailed.compact ? (
                  <span className="text-lg font-extrabold text-slate-900">RF</span>
                ) : (
                  <Image
                    src="/renkflow-logo-new.png"
                    alt="RenkFlow"
                    fill
                    sizes="48px"
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
             className="absolute inset-0 flex items-center justify-center"
           >
              <div className="relative h-16 w-40 flex items-center justify-center p-1">
                {logoFailed.full ? (
                  <span className="text-2xl font-extrabold tracking-tight text-slate-900">RenkFlow</span>
                ) : (
                  <Image
                    src="/renkflow-logo-new.png"
                    alt="RenkFlow"
                    fill
                    sizes="160px"
                    className="object-contain"
                    onError={() => setLogoFailed((prev) => ({ ...prev, full: true }))}
                  />
                )}
              </div>
           </motion.div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto overflow-x-hidden scrollbar-none">
          {filteredNavItems.map((item) => {
             const isActive = pathname === item.href || 
                (item.href !== '/dashboard' && item.href !== '#' && pathname.startsWith(item.href));
             
             return (
               <Link
                 key={item.href}
                 href={item.href}
                 onClick={(e) => handleItemClick(item, e)}
                 className={cn(
                   "relative flex items-center gap-4 px-3.5 py-3 rounded-xl transition-all duration-300 group overflow-hidden",
                   isActive 
                     ? "text-white shadow-lg shadow-blue-500/25" 
                     : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200",
                    item.action === 'logout' && "mt-auto hover:bg-red-50 dark:hover:bg-red-900/10 hover:text-red-600 dark:hover:text-red-400"
                 )}
               >
                 {/* Active Background with Gradient */}
                 {isActive && (
                   <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 opacity-100 -z-10" />
                 )}

                 {/* Icon */}
                 <div className={cn(
                   "transition-transform duration-300 group-hover:scale-110 flex-shrink-0 relative z-10",
                   isActive ? "text-white" : "text-current"
                 )}>
                   <item.icon size={24} />
                 </div>

                 {/* Label - Animated with Framer Motion */}
                 <span className={cn(
                   "font-medium whitespace-nowrap transition-all duration-300 delay-75 origin-left relative z-10",
                   (isHovered || isMobileOpen) ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4 w-0 overflow-hidden"
                 )}>
                   {item.label}
                 </span>
                 
                 {/* Active Glow/Glass Effect Overlay */}
                 {isActive && (
                    <motion.div
                       layoutId="sidebar-active-glow"
                       className="absolute inset-0 rounded-xl bg-white/10 mix-blend-overlay z-0"
                       initial={false}
                       transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                 )}
               </Link>
             );
          })}
        </nav>

        {/* User Profile Section */}
        <div className="p-4 border-t border-white/10 dark:border-white/5 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md">
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
