import type { Permission } from '@/lib/auth/permissions';

export type DashboardNavItem = {
  id: string;
  label: string;
  href: string;
  requiresPermission?: Permission;
  requiresFinanceAccess?: boolean;
  adminOnly?: boolean;
  action?: 'logout';
  badge?: string;
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
      { id: 'quotations', label: 'Teklif Yönetimi', href: '/quotations', requiresPermission: 'orders.view' },
      { id: 'work-orders', label: 'İş Emri Takibi', href: '/work-orders', requiresPermission: 'orders.view' },
      { id: 'kanban', label: 'Akış Kanbanı', href: '/kanban', requiresPermission: 'kanban.view' },
    ],
  },
  {
    id: 'supply-chain',
    label: 'Tedarik Zinciri',
    subtitle: 'Stok, tedarikçi ve satın alma',
    items: [
      { id: 'inventory', label: 'Envanter Yönetimi', href: '/inventory', requiresPermission: 'inventory.view' },
      { id: 'suppliers', label: 'Tedarikçi Yönetimi', href: '/suppliers', requiresPermission: 'inventory.view' },
      { id: 'shipments', label: 'Sevkiyat Takibi', href: '/shipments', requiresPermission: 'orders.view' },
    ],
  },
  {
    id: 'crm-finance',
    label: 'Müşteri & Finans',
    subtitle: 'CRM, finans ve ödeme yönetimi',
    items: [
      { id: 'crm', label: 'Müşteri Yönetimi', href: '/crm', requiresPermission: 'orders.view' },
      { id: 'finance', label: 'Finans Kontrolü', href: '/finance', requiresFinanceAccess: true },
    ],
  },
  {
    id: 'reporting',
    label: 'Raporlama & Analiz',
    subtitle: 'Performans görünümü ve raporlar',
    items: [
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
      { id: 'search', label: 'Kayıt Arama', href: '/search' },
      { id: 'notifications', label: 'Bildirim Merkezi', href: '/notifications' },
      { id: 'settings', label: 'Sistem Ayarları', href: '/settings', requiresPermission: 'settings.view' },
      { id: 'logout', label: 'Oturumu Kapat', href: '#', action: 'logout' },
    ],
  },
];

export const DASHBOARD_QUICK_LINKS = [
  { label: 'Kontrol Paneli', href: '/dashboard' },
  { label: 'Sipariş Operasyonları', href: '/orders' },
  { label: 'Yeni Sipariş Girişi', href: '/new-order' },
  { label: 'Teklif Yönetimi', href: '/quotations' },
  { label: 'Müşteri Yönetimi', href: '/crm' },
  { label: 'Envanter Yönetimi', href: '/inventory' },
  { label: 'Tedarikçiler', href: '/suppliers' },
  { label: 'Sevkiyat Takibi', href: '/shipments' },
  { label: 'Finans Kontrolü', href: '/finance' },
] as const;
