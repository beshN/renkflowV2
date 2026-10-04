import type { Permission } from '@/lib/auth/permissions';
import { canAccessFinance, hasPermission, type UserRole } from '@/lib/auth/permissions';

export type DashboardNavItem = {
  id: string; label: string; href: string;
  requiresPermission?: Permission;
  requiresFinanceAccess?: boolean;
  adminOnly?: boolean;
  allowedRoles?: UserRole[];
  action?: 'logout';
  badge?: string;
};
export type DashboardNavGroup = { id: string; label: string; subtitle: string; items: DashboardNavItem[] };

export const DASHBOARD_NAV_GROUPS: DashboardNavGroup[] = [
  {
    id: 'operations', label: 'Sipariş & üretim', subtitle: 'Renk Alüminyum operasyonları',
    items: [
      { id: 'dashboard', label: 'Genel bakış', href: '/dashboard' },
      { id: 'orders', label: 'Siparişler', href: '/orders', requiresPermission: 'orders.view' },
      { id: 'new-order', label: 'Yeni sipariş', href: '/new-order', requiresPermission: 'orders.create' },
      { id: 'production', allowedRoles: ['owner', 'admin', 'office'], label: 'Üretim merkezi', href: '/production', requiresPermission: 'orders.view' },
      { id: 'factory', allowedRoles: ['owner', 'admin', 'office', 'worker'], label: 'Usta ekranı', href: '/factory', requiresPermission: 'orders.view' },
      { id: 'work-orders', label: 'İş emirleri', href: '/work-orders', requiresPermission: 'orders.view' },
      { id: 'kanban', label: 'Üretim akışı', href: '/kanban', requiresPermission: 'kanban.view' },
      { id: 'shipments', allowedRoles: ['owner', 'admin', 'office'], label: 'Sevkiyat', href: '/shipments', requiresPermission: 'orders.view' },
    ],
  },
  {
    id: 'supply-chain', label: 'Malzeme & depo', subtitle: 'Profil, aksesuar ve tedarik',
    items: [
      { id: 'warehouse', label: 'Depo & raf yönetimi', href: '/warehouse', allowedRoles: ['owner','admin','office','accountant'] },
      { id: 'scan', label: 'QR / barkod terminali', href: '/warehouse/scan', allowedRoles: ['owner','admin','office','accountant','worker'] },
      { id: 'inventory', label: 'Profil & malzeme stoğu', href: '/inventory', requiresPermission: 'inventory.view' },
      { id: 'scrap', allowedRoles: ['owner', 'admin', 'office', 'accountant'], label: 'Hurda & profil artıkları', href: '/scrap', requiresPermission: 'inventory.view' },
      { id: 'purchases', allowedRoles: ['owner', 'admin', 'office', 'accountant'], label: 'Satın alma', href: '/purchases', requiresPermission: 'inventory.view' },
      { id: 'receipts', allowedRoles: ['owner', 'admin', 'office', 'accountant'], label: 'Mal kabul', href: '/receipts', requiresPermission: 'inventory.view' },
      { id: 'suppliers', allowedRoles: ['owner', 'admin', 'office', 'accountant'], label: 'Tedarikçiler', href: '/suppliers', requiresPermission: 'inventory.view' },
    ],
  },
  { id: 'finance', label: 'Finans & muhasebe', subtitle: 'Tahsilat ve mali kontrol', items: [{id:'finance',label:'Finans',href:'/finance',requiresPermission:'finance.view'},{id:'accounting',label:'Muhasebe',href:'/accounting',requiresPermission:'finance.view'}] },
  {
    id: 'management', label: 'Yönetim', subtitle: 'Müşteriler, raporlar ve ekip',
    items: [
      { id: 'crm', label: 'Müşteriler', href: '/crm', requiresPermission: 'customers.view' },
      { id: 'quotations', allowedRoles: ['owner', 'admin', 'office', 'accountant'], label: 'Teklifler', href: '/quotations', requiresPermission: 'orders.view' },
      { id: 'reports', label: 'Raporlar', href: '/reports', requiresPermission: 'reports.view' },
      { id: 'team', label: 'Ekip', href: '/team', requiresPermission: 'team.view' },
      { id: 'settings', label: 'Ayarlar', href: '/settings', requiresPermission: 'settings.view' },
      { id: 'logout', label: 'Çıkış yap', href: '#', action: 'logout' },
    ],
  },
];

export const DASHBOARD_QUICK_LINKS = DASHBOARD_NAV_GROUPS.flatMap(group =>
  group.items.filter(item => !item.action).map(({ label, href }) => ({ label, href }))
);

export function getVisibleNavGroups(role?: UserRole) {
  return DASHBOARD_NAV_GROUPS.map(group => ({
    ...group,
    items: group.items.filter(item => {
      if (!role) return !item.requiresPermission && !item.requiresFinanceAccess && !item.adminOnly && !item.action;
      if (item.allowedRoles && !item.allowedRoles.includes(role)) return false;
      if (item.adminOnly && role !== 'owner' && role !== 'admin') return false;
      if (item.requiresFinanceAccess && !canAccessFinance(role)) return false;
      return !item.requiresPermission || hasPermission(role, item.requiresPermission);
    }),
  })).filter(group => group.items.length > 0);
}
