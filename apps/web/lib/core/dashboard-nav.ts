import type { Permission } from '@/lib/auth/permissions';
import { canAccessFinance, hasPermission, ROUTE_ROLES, type UserRole } from '@/lib/auth/permissions';
import { meets, routeRequirement, type Matrix } from '@/lib/security/access-matrix';

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
      { id: 'assistant', allowedRoles: ['owner', 'admin', 'office', 'accountant'], label: 'Asistan', href: '/assistant' },
      { id: 'orders', label: 'Siparişler', href: '/orders', requiresPermission: 'orders.view' },
      { id: 'new-order', label: 'Yeni sipariş', href: '/new-order', requiresPermission: 'orders.create' },
      { id: 'calendar', allowedRoles: ROUTE_ROLES['/calendar'], label: 'Takvim', href: '/calendar', requiresPermission: 'orders.view' },
      { id: 'production', allowedRoles: ROUTE_ROLES['/production'], label: 'Üretim merkezi', href: '/production', requiresPermission: 'orders.view' },
      { id: 'factory', allowedRoles: ROUTE_ROLES['/factory'], label: 'Usta ekranı', href: '/factory', requiresPermission: 'orders.view' },
      { id: 'work-orders', label: 'İş emirleri', href: '/work-orders', requiresPermission: 'orders.view' },
      { id: 'kanban', label: 'Üretim akışı', href: '/kanban', requiresPermission: 'kanban.view' },
      { id: 'shipments', allowedRoles: ROUTE_ROLES['/shipments'], label: 'Sevkiyat', href: '/shipments', requiresPermission: 'orders.view' },
      { id: 'installations', allowedRoles: ROUTE_ROLES['/installations'], label: 'Montaj', href: '/installations' },
      { id: 'service', allowedRoles: ROUTE_ROLES['/service'], label: 'Servis ve garanti', href: '/service' },
    ],
  },
  {
    id: 'supply-chain', label: 'Malzeme & depo', subtitle: 'Profil, aksesuar ve tedarik',
    items: [
      { id: 'warehouse', label: 'Depo & raf yönetimi', href: '/warehouse', allowedRoles: ['owner','admin','office','accountant'] },
      { id: 'scan', label: 'QR / barkod terminali', href: '/warehouse/scan', allowedRoles: ['owner','admin','office','accountant','worker'] },
      { id: 'inventory', label: 'Profil & malzeme stoğu', href: '/inventory', requiresPermission: 'inventory.view' },
      { id: 'scrap', allowedRoles: ROUTE_ROLES['/scrap'], label: 'Hurda & profil artıkları', href: '/scrap', requiresPermission: 'inventory.view' },
      { id: 'purchases', allowedRoles: ROUTE_ROLES['/purchases'], label: 'Satın alma', href: '/purchases', requiresPermission: 'inventory.view' },
      { id: 'receipts', allowedRoles: ROUTE_ROLES['/receipts'], label: 'Mal kabul', href: '/receipts', requiresPermission: 'inventory.view' },
      { id: 'suppliers', allowedRoles: ROUTE_ROLES['/suppliers'], label: 'Tedarikçiler', href: '/suppliers', requiresPermission: 'inventory.view' },
    ],
  },
  { id: 'finance', label: 'Finans & muhasebe', subtitle: 'Tahsilat ve mali kontrol', items: [{id:'finance',label:'Finans',href:'/finance',requiresPermission:'finance.view'},{id:'receivables',label:'Alacaklar',href:'/finance/receivables',requiresPermission:'finance.view'},{id:'invoices',label:'Faturalar',href:'/finance/invoices',requiresPermission:'finance.view'},{id:'accounting',label:'Muhasebe',href:'/accounting',requiresPermission:'finance.view'}] },
  {
    id: 'management', label: 'Yönetim', subtitle: 'Müşteriler, raporlar ve ekip',
    items: [
      { id: 'leads', allowedRoles: ROUTE_ROLES['/leads'], label: 'Potansiyel müşteriler', href: '/leads' },
      { id: 'crm', label: 'Müşteriler', href: '/crm', requiresPermission: 'customers.view' },
      { id: 'quotations', allowedRoles: ROUTE_ROLES['/quotations'], label: 'Teklifler', href: '/quotations', requiresPermission: 'orders.view' },
      { id: 'reports', label: 'Raporlar', href: '/reports', requiresPermission: 'reports.view' },
      { id: 'team', label: 'Ekip ve yetkiler', href: '/team', requiresPermission: 'team.view' },
      { id: 'vehicles', allowedRoles: ROUTE_ROLES['/vehicles'], label: 'Araç filosu', href: '/vehicles' },
      { id: 'audit', allowedRoles: ROUTE_ROLES['/audit'], label: 'Denetim izi', href: '/audit' },
      { id: 'settings', label: 'Ayarlar', href: '/settings', requiresPermission: 'settings.view' },
      { id: 'account', label: 'Hesabım', href: '/account' },
      { id: 'logout', label: 'Çıkış yap', href: '#', action: 'logout' },
    ],
  },
];

export const DASHBOARD_QUICK_LINKS = DASHBOARD_NAV_GROUPS.flatMap(group =>
  group.items.filter(item => !item.action).map(({ label, href }) => ({ label, href }))
);

/** A narrowing role's matrix (from /api/v1/me/access); absent = the base role's own checks only. */
export type NavAccess = { narrowed: boolean; permissions: Matrix } | null | undefined;

export function getVisibleNavGroups(role?: UserRole, access?: NavAccess) {
  return DASHBOARD_NAV_GROUPS.map(group => ({
    ...group,
    items: group.items.filter(item => {
      // A job preset or custom role hides the modules it cannot view (the proxy refuses them anyway).
      const need = access?.narrowed && !item.action ? routeRequirement(item.href, 'GET') : null;
      if (need && access && !meets(access, need)) return false;
      if (!role) return !item.requiresPermission && !item.requiresFinanceAccess && !item.adminOnly && !item.action;
      if (item.allowedRoles && !item.allowedRoles.includes(role)) return false;
      if (item.adminOnly && role !== 'owner' && role !== 'admin') return false;
      if (item.requiresFinanceAccess && !canAccessFinance(role)) return false;
      return !item.requiresPermission || hasPermission(role, item.requiresPermission);
    }),
  })).filter(group => group.items.length > 0);
}
