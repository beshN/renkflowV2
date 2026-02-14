import type { Permission } from '@/lib/auth/permissions';

export type DashboardNavItem = {
  id: string;
  label: string;
  href: string;
  requiresPermission?: Permission;
  requiresFinanceAccess?: boolean;
  adminOnly?: boolean;
  action?: 'logout';
};

export type DashboardNavGroup = {
  id: string;
  label: string;
  subtitle: string;
  items: DashboardNavItem[];
};

export const DASHBOARD_NAV_GROUPS: DashboardNavGroup[] = [
  {
    id: 'operations',
    label: 'Operasyon Çekirdeği',
    subtitle: 'Günlük üretim ve sipariş yönetimi',
    items: [
      { id: 'dashboard', label: 'Kontrol Paneli', href: '/dashboard' },
      { id: 'orders', label: 'Sipariş Operasyonları', href: '/orders', requiresPermission: 'orders.view' },
      { id: 'new-order', label: 'Yeni Sipariş Girişi', href: '/new-order', requiresPermission: 'orders.create' },
      { id: 'work-orders', label: 'İş Emri Takibi', href: '/work-orders', requiresPermission: 'orders.view' },
      { id: 'kanban', label: 'Akış Kanbanı', href: '/kanban', requiresPermission: 'kanban.view' },
      { id: 'search', label: 'Kayıt Arama', href: '/search' },
      { id: 'notifications', label: 'Bildirim Merkezi', href: '/notifications' },
    ],
  },
  {
    id: 'management',
    label: 'Yönetim ve Raporlama',
    subtitle: 'Finans, stok ve performans görünümü',
    items: [
      { id: 'finance', label: 'Finans Kontrolü', href: '/finance', requiresFinanceAccess: true },
      { id: 'inventory', label: 'Envanter Yönetimi', href: '/inventory', requiresPermission: 'inventory.view' },
      { id: 'reports', label: 'Operasyon Raporları', href: '/reports', requiresPermission: 'reports.view' },
      { id: 'analytics', label: 'Karar Analitiği', href: '/analytics', requiresPermission: 'analytics.view' },
    ],
  },
  {
    id: 'organization',
    label: 'Organizasyon Ayarları',
    subtitle: 'Ekip ve yetki yönetimi',
    items: [
      { id: 'team', label: 'Takım Yapısı', href: '/team', requiresPermission: 'team.view' },
      { id: 'members', label: 'Kullanıcı Üyelikleri', href: '/members' },
      { id: 'settings', label: 'Sistem Ayarları', href: '/settings', requiresPermission: 'settings.view' },
      { id: 'logout', label: 'Oturumu Kapat', href: '#', action: 'logout' },
    ],
  },
];

export const DASHBOARD_QUICK_LINKS = [
  { label: 'Kontrol Paneli', href: '/dashboard' },
  { label: 'Sipariş Operasyonları', href: '/orders' },
  { label: 'Yeni Sipariş Girişi', href: '/new-order' },
  { label: 'Finans Kontrolü', href: '/finance' },
  { label: 'Envanter Yönetimi', href: '/inventory' },
] as const;
