/**
 * Who may do what, as data: modules × actions, the preset roles, field hiding and the password
 * policy. Pure (client and server). Every role sits on one of the six base roles the rest of the
 * code already checks; a role (preset or custom) can only narrow what its base role allows, so
 * adding roles never weakens an existing check.
 */
import type { UserRole } from '@/lib/auth/permissions';

export const MODULES = [
  'orders', 'quotations', 'customers', 'crm', 'installations', 'service', 'production', 'inventory',
  'purchasing', 'finance', 'reports', 'fleet', 'team', 'settings', 'audit',
] as const;
export type Module = (typeof MODULES)[number];
export const ACTIONS = ['view', 'create', 'edit', 'delete', 'approve', 'export'] as const;
export type Action = (typeof ACTIONS)[number];
export const FIELD_GROUPS = ['price', 'cost', 'profit', 'customer_contact'] as const;
export type FieldGroup = (typeof FIELD_GROUPS)[number];
export type Matrix = Partial<Record<Module, Action[]>>;

export const MODULE_LABELS: Record<Module, string> = {
  orders: 'Siparişler', quotations: 'Teklifler', customers: 'Müşteriler', crm: 'Potansiyel müşteriler', installations: 'Montaj',
  service: 'Servis', production: 'Üretim', inventory: 'Stok', purchasing: 'Satın alma', finance: 'Finans', reports: 'Raporlar',
  fleet: 'Araç filosu', team: 'Ekip', settings: 'Ayarlar', audit: 'Denetim izi',
};
export const ACTION_LABELS: Record<Action, string> = { view: 'Görüntüle', create: 'Oluştur', edit: 'Düzenle', delete: 'Sil', approve: 'Onayla', export: 'Dışa aktar' };
export const FIELD_LABELS: Record<FieldGroup, string> = { price: 'Fiyat', cost: 'Maliyet', profit: 'Kâr', customer_contact: 'Müşteri iletişim bilgisi' };

const ALL: Action[] = [...ACTIONS];
const RW: Action[] = ['view', 'create', 'edit', 'delete', 'export'];
const RWNoDelete: Action[] = ['view', 'create', 'edit', 'export'];
const VIEW: Action[] = ['view'];
const everything = (actions: Action[]): Matrix => Object.fromEntries(MODULES.map((m) => [m, actions])) as Matrix;

/** What each base role may do at most (the floor every other check in the code already enforces). */
export const BASE_CAPS: Record<UserRole, Matrix> = {
  owner: everything(ALL),
  admin: everything(ALL),
  office: {
    orders: RW, quotations: RW, customers: RW, crm: RW, installations: RW, service: RW, production: RW,
    inventory: RW, purchasing: RW, reports: ['view', 'export'], settings: VIEW, team: VIEW,
  },
  accountant: {
    orders: VIEW, quotations: VIEW, customers: ['view', 'export'], crm: VIEW, installations: VIEW, service: VIEW,
    inventory: VIEW, purchasing: ['view', 'export'], finance: ALL, reports: ['view', 'export'], settings: VIEW, team: VIEW,
  },
  // Rows are further limited by the existing checks (a worker sees only jobs assigned to them, as a technical view).
  worker: { orders: VIEW, production: ['view', 'edit'], inventory: VIEW, installations: ['view', 'edit'], service: ['view', 'edit'] },
  member: { orders: ['view', 'edit'], customers: VIEW },
};
/** Fields a base role never sees, whatever its role says. */
export const BASE_HIDDEN: Record<UserRole, FieldGroup[]> = {
  owner: [], admin: [], office: [], accountant: [], member: [],
  worker: ['price', 'cost', 'profit', 'customer_contact'],
};

export type Preset = { key: string; name: string; base: UserRole; permissions: Matrix; hidden: FieldGroup[]; description: string };

/** The ready roles. 'office' keeps today's behaviour; the others narrow a base role for a job. */
export const PRESETS: Preset[] = [
  { key: 'owner', name: 'Sahip', base: 'owner', permissions: BASE_CAPS.owner, hidden: [], description: 'Her şey' },
  { key: 'admin', name: 'Yönetici', base: 'admin', permissions: BASE_CAPS.admin, hidden: [], description: 'Her şey; sahipliği devredemez' },
  { key: 'office', name: 'Ofis', base: 'office', permissions: BASE_CAPS.office, hidden: [], description: 'Satış, üretim, stok ve satın almanın tamamı; finans yok' },
  {
    key: 'sales', name: 'Satış', base: 'office',
    permissions: { crm: RWNoDelete, customers: RWNoDelete, quotations: RWNoDelete, orders: ['view', 'create', 'edit'], installations: ['view', 'create', 'edit'], service: ['view', 'create', 'edit'], production: VIEW, inventory: VIEW, reports: VIEW },
    hidden: ['cost', 'profit'], description: 'Potansiyel müşteri, teklif, sipariş; maliyet ve kâr görmez',
  },
  {
    key: 'planning', name: 'Planlama', base: 'office',
    permissions: { production: RW, inventory: ['view', 'create', 'edit'], purchasing: ['view', 'create', 'edit'], orders: ['view', 'edit'], installations: RWNoDelete, service: ['view', 'edit'], reports: VIEW },
    hidden: ['price', 'profit'], description: 'Üretim, kesim, montaj planı; satış fiyatı ve kâr görmez',
  },
  { key: 'accounting', name: 'Muhasebe', base: 'accountant', permissions: BASE_CAPS.accountant, hidden: [], description: 'Finansın tamamı; diğer modülleri görür' },
  { key: 'operator', name: 'Usta / Operatör', base: 'worker', permissions: BASE_CAPS.worker, hidden: ['price', 'cost', 'profit', 'customer_contact'], description: 'Yalnız kendine atanan işler; fiyat, maliyet, müşteri yok' },
  {
    key: 'warehouse', name: 'Depocu', base: 'office',
    permissions: { inventory: RW, purchasing: ['view', 'create', 'edit'], production: VIEW, orders: VIEW },
    hidden: ['price', 'cost', 'profit', 'customer_contact'], description: 'Stok, sayım, mal kabul; fiyat ve müşteri görmez',
  },
  { key: 'readonly', name: 'Salt okunur', base: 'member', permissions: BASE_CAPS.member, hidden: ['cost', 'profit'], description: 'Siparişleri ve müşterileri görür; hiçbir şeyi değiştiremez' },
];
export const presetFor = (key: string) => PRESETS.find((p) => p.key === key) ?? null;
/** The preset a member without a chosen role gets: the one of their base role (today's behaviour). */
export const DEFAULT_PRESET: Record<UserRole, string> = { owner: 'owner', admin: 'admin', office: 'office', accountant: 'accounting', worker: 'operator', member: 'readonly' };

export type Access = { roleKey: string; roleName: string; base: UserRole; permissions: Matrix; hidden: FieldGroup[] };

/** The role's matrix cut down to what the base role allows, with the base role's hidden fields added. */
export function effectiveAccess(base: UserRole, role: { key: string; name: string; permissions: Matrix; hidden: FieldGroup[] } | null): Access {
  const caps = BASE_CAPS[base] ?? {};
  const chosen = role ?? presetFor(DEFAULT_PRESET[base])!;
  const permissions: Matrix = {};
  for (const m of MODULES) {
    const allowed = (chosen.permissions[m] ?? []).filter((a) => (caps[m] ?? []).includes(a));
    if (allowed.length) permissions[m] = ACTIONS.filter((a) => allowed.includes(a));
  }
  const hidden = FIELD_GROUPS.filter((f) => chosen.hidden.includes(f) || BASE_HIDDEN[base].includes(f));
  return { roleKey: chosen.key, roleName: chosen.name, base, permissions, hidden };
}

export const can = (access: Pick<Access, 'permissions'>, module: Module, action: Action) => (access.permissions[module] ?? []).includes(action);

/** A custom matrix as stored: only known modules and actions, nothing more than the base role allows. */
export function sanitizeMatrix(base: UserRole, raw: unknown): Matrix {
  const out: Matrix = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const m of MODULES) {
    const list = (raw as Record<string, unknown>)[m];
    if (!Array.isArray(list)) continue;
    const ok = ACTIONS.filter((a) => list.includes(a) && (BASE_CAPS[base][m] ?? []).includes(a));
    // Any action implies being able to see the module.
    if (ok.length) out[m] = ok.includes('view') ? ok : (['view', ...ok] as Action[]).filter((a) => (BASE_CAPS[base][m] ?? []).includes(a));
  }
  return out;
}

// Routes → module and action ----------------------------------------------------------------------

/** API prefixes; null = self-scoped or checked inside (search, notifications, records, own profile). */
const API_MODULES: Array<[string, Module | null]> = [
  ['/api/v1/orders', 'orders'], ['/api/orders', 'orders'], ['/api/v1/quotations', 'quotations'], ['/api/v1/sales/settings', 'settings'],
  ['/api/v1/customers', 'customers'], ['/api/v1/crm', 'crm'], ['/api/v1/leads', 'crm'], ['/api/v1/installations', 'installations'], ['/api/v1/service', 'service'],
  ['/api/v1/production', 'production'], ['/api/v1/work-orders', 'production'], ['/api/v1/inventory', 'inventory'], ['/api/v1/stock', 'inventory'],
  ['/api/v1/warehouse', 'inventory'], ['/api/v1/procurement', 'purchasing'], ['/api/v1/purchases', 'purchasing'], ['/api/v1/suppliers', 'purchasing'],
  ['/api/v1/finance', 'finance'], ['/api/v1/payments', 'finance'], ['/api/v1/accounting', 'finance'], ['/api/v1/invoices', 'finance'],
  ['/api/v1/reports', 'reports'], ['/api/v1/analytics', 'reports'], ['/api/v1/exports', 'reports'], ['/api/v1/vehicles', 'fleet'],
  ['/api/tenant/invite', 'team'], ['/api/tenant/invites', 'team'], ['/api/tenant/members', 'team'], ['/api/v1/team', 'team'], ['/api/tenant/update', 'settings'],
  ['/api/audit', 'audit'], ['/api/v1/audit', 'audit'],
  ['/api/v1/records', null], ['/api/v1/search', null], ['/api/v1/notifications', null], ['/api/v1/me', null], ['/api/v1/activity-logs', null],
];
const PAGE_MODULES: Array<[string, Module]> = [
  ['/orders', 'orders'], ['/kanban', 'orders'], ['/calendar', 'orders'], ['/quotations', 'quotations'], ['/crm', 'customers'], ['/customers', 'customers'],
  ['/leads', 'crm'], ['/installations', 'installations'], ['/service', 'service'], ['/production', 'production'],
  ['/work-orders', 'production'], ['/inventory', 'inventory'], ['/warehouse', 'inventory'], ['/purchases', 'purchasing'], ['/receipts', 'purchasing'],
  ['/suppliers', 'purchasing'], ['/finance', 'finance'], ['/accounting', 'finance'], ['/reports', 'reports'], ['/analytics', 'reports'],
  ['/vehicles', 'fleet'], ['/team', 'team'], ['/settings', 'settings'], ['/audit', 'audit'],
];
const longest = <T>(list: Array<[string, T]>, path: string) =>
  list.filter(([p]) => path === p || path.startsWith(p + '/')).sort((a, b) => b[0].length - a[0].length)[0];

/**
 * The module and action a request needs, or null when the path is not module-gated. Reads are
 * view (or export for an export path); a POST to a module's collection creates; any other write
 * edits; DELETE deletes.
 */
export function routeRequirement(path: string, method: string): { module: Module; action: Action } | null {
  const api = path.startsWith('/api/');
  const hit = api ? longest(API_MODULES, path) : longest(PAGE_MODULES, path);
  if (!hit || !hit[1]) return null;
  const module = hit[1];
  const m = method.toUpperCase();
  if (/(^|\/)(export|exports|csv)(\/|$)/.test(path) && (m === 'GET' || m === 'POST')) return { module, action: 'export' };
  if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS' || !api) return { module, action: 'view' };
  if (m === 'DELETE') return { module, action: 'delete' };
  if (m === 'POST' && path.replace(/\/$/, '') === hit[0]) return { module, action: 'create' };
  return { module, action: 'edit' };
}

// Field hiding ------------------------------------------------------------------------------------

/** Keys that carry each kind of field in the app's DTOs (camelCase and snake_case). */
export const FIELD_KEYS: Record<FieldGroup, string[]> = {
  price: [
    'unitPrice', 'unit_price', 'totalPrice', 'total_price', 'totalAmount', 'total_amount', 'subtotal', 'taxAmount', 'tax_amount',
    'discountAmount', 'discount_amount', 'price', 'prices', 'matrixUnitPrice', 'tryTotal', 'fxRate', 'fx_rate', 'amount', 'paid', 'plan',
    'payments', 'paymentStatus', 'payment_status', 'currency', 'total', 'cheapest', 'invoiceTotal', 'balance', 'collected',
  ],
  cost: ['cost', 'unitCost', 'unit_cost', 'costs', 'profileCost', 'profile_cost', 'costSnapshot', 'cost_snapshot', 'laborCostPerHour', 'labor_cost_per_hour', 'materialCost', 'laborCost', 'scrapCost'],
  profit: ['profit', 'margin', 'marginPercent', 'estimatedProfit', 'grossProfit'],
  customer_contact: [
    'email', 'phone', 'address', 'contacts', 'billingAddress', 'billing_address', 'shippingAddress', 'shipping_address', 'customerPhone',
    'customer_phone', 'customerEmail', 'customer_email', 'taxNumber', 'tax_number', 'taxOffice', 'tax_office', 'siteAddress', 'site_address', 'mapUrl',
  ],
};

/** A copy of the data without the hidden kinds of fields, at any depth. */
export function redactFields<T>(data: T, hidden: readonly FieldGroup[]): T {
  if (!hidden.length) return data;
  const drop = new Set(hidden.flatMap((g) => FIELD_KEYS[g]));
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object' && !(v instanceof Date)) {
      const out: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) if (!drop.has(k)) out[k] = walk(x);
      if (hidden.includes('price')) out.financialHidden = true;
      return out;
    }
    return v;
  };
  return walk(data) as T;
}

// Password policy ---------------------------------------------------------------------------------

export const PASSWORD_POLICY = { minLength: 10, maxLength: 128 } as const;

/** Why a password is refused (null when it is acceptable). */
export function passwordProblem(password: string, email?: string | null) {
  if (password.length < PASSWORD_POLICY.minLength) return `Şifre en az ${PASSWORD_POLICY.minLength} karakter olmalı`;
  if (password.length > PASSWORD_POLICY.maxLength) return `Şifre en fazla ${PASSWORD_POLICY.maxLength} karakter olabilir`;
  if (!/\p{L}/u.test(password) || !/\d/.test(password)) return 'Şifre en az bir harf ve bir rakam içermeli';
  const local = (email ?? '').split('@')[0]?.toLocaleLowerCase('tr');
  if (local && local.length >= 4 && password.toLocaleLowerCase('tr').includes(local)) return 'Şifre e-posta adınızı içeremez';
  return null;
}
