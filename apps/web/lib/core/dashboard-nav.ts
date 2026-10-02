import type { Permission } from '@/lib/auth/permissions';

export type DashboardNavItem = {
  id: string; label: string; href: string;
  requiresPermission?: Permission;
  requiresFinanceAccess?: boolean;
  adminOnly?: boolean;
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
      { id: 'work-orders', label: 'İş emirleri', href: '/work-orders', requiresPermission: 'orders.view' },
      { id: 'kanban', label: 'Üretim akışı', href: '/kanban', requiresPermission: 'kanban.view' },
      { id: 'shipments', label: 'Sevkiyat', href: '/shipments', requiresPermission: 'orders.view' },
    ],
  },
  {
    id: 'supply-chain', label: 'Malzeme & depo', subtitle: 'Profil, aksesuar ve tedarik',
    items: [
      { id: 'inventory', label: 'Profil & malzeme stoğu', href: '/inventory', requiresPermission: 'inventory.view' },
      { id: 'scrap', label: 'Hurda & profil artıkları', href: '/scrap', requiresPermission: 'inventory.view' },
      { id: 'purchases', label: 'Satın alma', href: '/purchases', requiresPermission: 'inventory.view' },
      { id: 'receipts', label: 'Mal kabul', href: '/receipts', requiresPermission: 'inventory.view' },
      { id: 'suppliers', label: 'Tedarikçiler', href: '/suppliers', requiresPermission: 'inventory.view' },
    ],
  },
  {
    id: 'management', label: 'Yönetim', subtitle: 'Müşteriler, raporlar ve ekip',
    items: [
      { id: 'crm', label: 'Müşteriler', href: '/crm', requiresPermission: 'orders.view' },
      { id: 'quotations', label: 'Teklifler', href: '/quotations', requiresPermission: 'orders.view' },
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
