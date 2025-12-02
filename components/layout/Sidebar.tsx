'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/context/AuthContext';
import { useSettings } from '@/lib/context/SettingsContext';
import { useState, useEffect } from 'react';
import { useSpotlight } from '@/components/ui/SpotlightEffect';

import { AdminLoginModal } from '@/components/auth/AdminLoginModal';

const menuItems = [
  { icon: 'dashboard', label: 'Dashboard', href: '/dashboard', adminOnly: true },
  { icon: 'receipt_long', label: 'Siparişler', href: '/orders', adminOnly: false },
  { icon: 'add_circle', label: 'Yeni Sipariş', href: '/new-order', adminOnly: true },
  { icon: 'settings', label: 'Ayarlar', href: '/settings', adminOnly: true },
  // Special item for Admin Login
  { icon: 'admin_panel_settings', label: 'Yönetici Paneli', href: '#', adminOnly: false, action: 'login' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { settings } = useSettings();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  const handleItemClick = (item: any, e: React.MouseEvent) => {
    if (item.action === 'login') {
      e.preventDefault();
      if (user?.role === 'admin') {
        // If already admin, maybe just toggle or do nothing? 
        // Or we could make this a "Logout" button if admin?
        // Let's make it a Logout action if already admin for better UX
        logout();
      } else {
        setIsLoginModalOpen(true);
      }
    }
  };

  return (
    <>
      <AdminLoginModal 
        isOpen={isLoginModalOpen} 
        onClose={() => setIsLoginModalOpen(false)} 
      />

      {/* Mobile Hamburger Button */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="md:hidden fixed top-4 left-4 z-[60] p-2 rounded-lg bg-white dark:bg-gray-800 shadow-md border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300"
      >
        <span className="material-symbols-outlined text-xl">
          {isMobileOpen ? 'close' : 'menu'}
        </span>
      </button>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/50 z-[55] animate-fadeIn"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed md:sticky top-0 h-screen flex flex-col border-r border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark transition-all duration-300 ease-in-out z-[58]",
        // Mobile styles
        isMobileOpen ? "translate-x-0 w-64" : "-translate-x-full md:translate-x-0",
        // Desktop styles
        "md:w-20 md:hover:w-72 group"
      )}>
        {/* Logo */}
        <Link
          href={user?.role === 'admin' ? "/dashboard" : "/orders"}
          className="flex h-40 items-center justify-center border-b border-border-light dark:border-border-dark overflow-hidden flex-shrink-0 relative group/logo transition-all duration-300"
        >
          <div className="flex items-center justify-center w-full h-full relative">
            {/* Collapsed State - 'R' only */}
            <div className="absolute inset-0 flex items-center justify-center transition-all duration-500 ease-out opacity-100 scale-100 group-hover:opacity-0 group-hover:scale-75 group-hover:rotate-12">
              <div className="relative h-14 w-14">
                <Image
                  src="/logo-r.png"
                  alt="RenkFlow"
                  fill
                  className="object-contain"
                />
              </div>
            </div>

            {/* Expanded State - Full Logo */}
            <div className="absolute inset-0 flex items-center justify-center transition-all duration-500 ease-out opacity-0 scale-90 -translate-x-4 group-hover:opacity-100 group-hover:scale-100 group-hover:translate-x-0">
              <div className="relative h-36 w-64">
                <Image
                  src="/logo.png"
                  alt="RenkFlow"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
            </div>
          </div>
        </Link>

        {/* Navigation */}
        <nav className="flex flex-col gap-1 p-3 flex-1 overflow-y-auto overflow-x-hidden">
          {menuItems.map((item) => (
            <SidebarItem
              key={item.href}
              item={item}
              pathname={pathname}
              user={user}
              handleItemClick={handleItemClick}
            />
          ))}
        </nav>

        {/* User Section - Simplified to just show current status */}
      <div className="p-4 border-t border-border-light dark:border-border-dark bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-sm">
        <div className="flex items-center gap-3 transition-all duration-300 justify-center md:justify-start">
          <div className="relative h-9 w-9 rounded-full overflow-hidden ring-2 ring-white dark:ring-slate-800 shadow-sm flex-shrink-0">
            <Image
              src={user?.avatar || `https://ui-avatars.com/api/?name=${user?.name || 'User'}&background=0f172a&color=fff`}
              alt={user?.name || 'User'}
              fill
              className="object-cover"
            />
          </div>
          <div className={cn(
            "flex flex-col overflow-hidden transition-all duration-300",
            // Mobile: visible
            "opacity-100 w-auto",
            // Desktop: hidden unless hovered
            "md:opacity-0 md:w-0 md:group-hover:opacity-100 md:group-hover:w-auto md:delay-75"
          )}>
            <span className="text-sm font-semibold text-text-light dark:text-text-dark truncate whitespace-nowrap">
              {user?.name}
            </span>
            <span className="text-xs text-subtle-light dark:text-subtle-dark truncate whitespace-nowrap">
              {user?.role === 'admin' ? 'Yönetici' : 'Personel'}
            </span>
          </div>
        </div>
      </div>
      </aside>
    </>
  );
}

function SidebarItem({ item, pathname, user, handleItemClick }: { item: any, pathname: string, user: any, handleItemClick: (item: any, e: React.MouseEvent) => void }) {
  const { position, opacity, handleMouseMove, handleMouseEnter, handleMouseLeave } = useSpotlight();

  // Hide admin-only items if user is not admin
  if (item.adminOnly && user?.role !== 'admin') return null;

  // Special handling for Admin Panel item text/icon if already admin
  let label = item.label;
  let icon = item.icon;
  if (item.action === 'login' && user?.role === 'admin') {
    label = 'Yönetici Çıkış';
    icon = 'logout';
  }

  const isActive = pathname === item.href || 
    (item.href !== '/dashboard' && item.href !== '#' && pathname.startsWith(item.href));

  return (
    <Link
      href={item.href}
      onClick={(e) => handleItemClick(item, e)}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative overflow-hidden',
        isActive
          ? 'bg-primary text-white shadow-md shadow-primary/20'
          : 'text-subtle-light dark:text-subtle-dark hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-text-light dark:hover:text-text-dark',
          // Special style for Admin Panel item
          item.action === 'login' && user?.role !== 'admin' && 'mt-auto border-t border-border-light dark:border-border-dark pt-4'
      )}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        className="pointer-events-none absolute -inset-px transition-opacity duration-300"
        style={{
          opacity,
          background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, rgba(255, 255, 255, 0.15), transparent 40%)`,
        }}
      />
      {isActive && (
        <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-20" />
      )}
      <span className={cn(
        "material-symbols-outlined transition-transform duration-200 group-hover:scale-110 relative z-10 flex-shrink-0",
        isActive ? "text-white" : "text-subtle-light dark:text-subtle-dark group-hover:text-primary"
      )}>
        {icon}
      </span>
      <span className={cn(
        "font-medium transition-all duration-200 relative z-10 whitespace-nowrap overflow-hidden",
        // Mobile: always visible if open
        "opacity-100 max-w-full",
        // Desktop: hidden unless hovered, width transitions
        "md:opacity-0 md:max-w-0 md:delay-75 md:group-hover:opacity-100 md:group-hover:max-w-full"
      )}>
        {label}
      </span>
    </Link>
  );
}
