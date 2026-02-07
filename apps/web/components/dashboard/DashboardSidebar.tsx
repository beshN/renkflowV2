'use client';

import { useState, type MouseEvent } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  FileText,
  MapPin,
  MessageSquare,
  Briefcase,
  Download,
  Settings,
  LogOut,
  ChevronDown,
  ChevronRight,
  Search,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';

const sidebarItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard', active: true },
  { icon: Users, label: 'Müşteriler', href: '/dashboard/customers', hasSubmenu: true },
  { icon: FileText, label: 'Raporlar', href: '/dashboard/reports' },
  { icon: MapPin, label: 'Coğrafya', href: '/dashboard/geography' },
  { icon: MessageSquare, label: 'Konuşmalar', href: '/dashboard/conversations' },
  { icon: Briefcase, label: 'Anlaşmalar', href: '/dashboard/deals' },
  { icon: Download, label: 'Dışa Aktar', href: '/dashboard/export' },
];

const bottomItems = [
  { icon: Settings, label: 'Ayarlar', href: '/dashboard/settings' },
  { icon: LogOut, label: 'Çıkış Yap', href: '/auth/signout', danger: true },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);

  const toggleMenu = (label: string) => {
    setExpandedMenus(prev => 
      prev.includes(label) 
        ? prev.filter(item => item !== label)
        : [...prev, label]
    );
  };

  return (
    <aside 
      className={cn(
        "flex flex-col h-full bg-white rounded-2xl transition-all duration-300",
        collapsed ? "w-20" : "w-72"
      )}
    >
      {/* Brand */}
      <div className="flex items-center gap-2 px-6 py-5">
        <div className="relative w-8 h-8 flex-shrink-0">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full" />
          <div className="absolute inset-1 bg-gradient-to-br from-green-400 to-green-600 rounded-full opacity-60" 
               style={{ clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' }} />
        </div>
        {!collapsed && (
          <span className="font-semibold text-lg text-gray-900 tracking-tight">RenkFlow</span>
        )}
        <button 
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
        >
          {collapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>

      {/* Search */}
      {!collapsed && (
        <div className="px-3 pb-3">
          <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 rounded-2xl border border-gray-100">
            <Search className="w-4 h-4 text-gray-400" />
            <input 
              type="text"
              placeholder="Ara..."
              className="flex-1 bg-transparent text-sm text-gray-600 placeholder:text-gray-400 outline-none"
            />
          </div>
        </div>
      )}

      {/* Navigation Items */}
      <nav className="flex-1 px-2 py-2 overflow-y-auto">
        <ul className="space-y-1">
          {sidebarItems.map((item) => {
            const isActive = pathname === item.href;
            const isExpanded = expandedMenus.includes(item.label);
            
            return (
              <li key={item.label}>
                <Link
                  href={item.href}
                  onClick={(e: MouseEvent<HTMLAnchorElement>) => {
                    if (item.hasSubmenu) {
                      e.preventDefault();
                      toggleMenu(item.label);
                    }
                  }}
                  className={cn(
                    "flex items-center gap-3 px-5 py-3 rounded-3xl transition-all duration-200",
                    isActive 
                      ? "text-orange-600" 
                      : "text-gray-600 hover:bg-gray-50",
                    collapsed && "justify-center px-3"
                  )}
                >
                  <item.icon className={cn(
                    "w-4 h-4 flex-shrink-0",
                    isActive ? "text-orange-500" : "text-gray-500"
                  )} />
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-sm font-normal">{item.label}</span>
                      {item.hasSubmenu && (
                        isExpanded 
                          ? <ChevronDown className="w-4 h-4 text-gray-400" />
                          : <ChevronRight className="w-4 h-4 text-gray-400" />
                      )}
                    </>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User Section */}
      <div className="px-3 py-4 border-t border-gray-100">
        {/* User Info */}
        <div className={cn(
          "flex items-center gap-3 px-4 mb-3",
          collapsed && "justify-center px-0"
        )}>
          <div className="relative w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-orange-300 to-orange-500 flex-shrink-0">
            <div className="absolute inset-0 flex items-center justify-center text-white text-sm font-medium">
              GX
            </div>
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">Gustavo Xavier</p>
              <span className="inline-block px-2 py-0.5 text-[10px] font-normal text-gray-900 bg-amber-300 rounded-full">
                Admin
              </span>
            </div>
          )}
        </div>

        {/* Bottom Menu Items */}
        <ul className="space-y-1">
          {bottomItems.map((item) => (
            <li key={item.label}>
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-5 py-3 rounded-3xl transition-colors",
                  item.danger 
                    ? "text-red-600 hover:bg-red-50" 
                    : "text-gray-600 hover:bg-gray-50",
                  collapsed && "justify-center px-3"
                )}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                {!collapsed && (
                  <span className="text-sm font-normal">{item.label}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
