'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Home, Receipt, PlusCircle, Settings, Search, Boxes } from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';
import { hasPermission, type Permission, type UserRole } from '@/lib/auth/permissions';

const navItems = [
  { icon: Home, label: 'Ana Sayfa', href: '/dashboard' },
  { icon: Receipt, label: 'Siparişler', href: '/orders', requiresPermission: 'orders.view' as Permission },
  { icon: PlusCircle, label: 'Yeni', href: '/new-order', requiresPermission: 'orders.create' as Permission },
  { icon: Boxes, label: 'Stok', href: '/inventory', requiresPermission: 'inventory.view' as Permission },
  { icon: Search, label: 'Arama', href: '/search' },
  { icon: Settings, label: 'Ayarlar', href: '/settings' },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();

  const visibleItems = navItems.filter((item) => {
    if (!item.requiresPermission) return true;
    if (!user?.role) return false;
    return hasPermission(user.role as UserRole, item.requiresPermission);
  });

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 glass border-t-0 safe-bottom">
      <div className="flex items-center justify-around py-2 px-1">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== '/dashboard' && pathname.startsWith(item.href));
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-xl transition-all min-touch',
                isActive
                  ? 'text-primary bg-primary/10'
                  : 'text-subtle-light dark:text-subtle-dark'
              )}
            >
              <div className={cn(
                'transition-transform',
                isActive ? 'scale-110' : ''
              )}>
                <item.icon size={24} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className={cn(
                'text-[10px] font-medium',
                isActive && 'font-semibold'
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
