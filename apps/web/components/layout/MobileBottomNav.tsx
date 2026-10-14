'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Home, Receipt, Menu, Boxes, ClipboardList, Factory, ScanLine, Wallet, FileText, Calculator, Building2 } from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';
import { getPrimaryNavItems } from '@/lib/core/dashboard-nav';
import { useMemberAccess } from '@/lib/hooks/useMemberAccess';
import { useWorkspaceCommands } from './WorkspaceCommands';

const icons = { dashboard: Home, orders: Receipt, crm: Building2, production: Factory, inventory: Boxes, finance: Wallet, invoices: FileText, accounting: Calculator, factory: Factory, 'work-orders': ClipboardList, scan: ScanLine };

export function MobileBottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const access = useMemberAccess();

  const { openModules } = useWorkspaceCommands();
  const visibleItems = getPrimaryNavItems(user?.role, access).slice(0, 4);

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 rf-topbar border-t border-slate-200/70 dark:border-slate-800/70 safe-bottom">
      <div className="flex items-center justify-around py-2 px-1">
        {visibleItems.map((item) => {
          const Icon = icons[item.id as keyof typeof icons] || Home;
          const isActive = pathname === item.href || 
            (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'));
          
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex min-w-0 flex-1 flex-col items-center gap-0.5 py-1.5 px-1 rounded-lg transition-colors min-touch',
                isActive
                  ? 'text-primary bg-primary/10'
                  : 'text-subtle-light dark:text-subtle-dark'
              )}
            >
              <div className={cn(
                'transition-transform',
                isActive ? '' : ''
              )}>
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
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
        <button type="button" onClick={openModules} aria-label="Tüm bölümleri aç"
          className="flex min-touch min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-subtle-light dark:text-subtle-dark">
          <Menu size={20} /><span className="text-[10px] font-medium">Tümü</span>
        </button>
      </div>
    </nav>
  );
}
