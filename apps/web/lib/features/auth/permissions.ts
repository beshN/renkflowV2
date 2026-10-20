/**
 * Centralized Permissions System
 * 
 * This module defines a granular permission system that maps roles to specific permissions.
 * Used for:
 * 1. Sidebar/menu visibility
 * 2. Route-level protection
 * 3. Server action authorization
 * 
 * ROLE -> PERMISSION MAPPING:
 * - owner: All permissions (full system access)
 * - admin: All except some settings (near-full access)
 * - accountant: finance.* + reports.view + orders.view (no edit/delete on orders)
 * - office: orders.* + customers.* + kanban.* (operational access)
 * - member: orders.view/edit + customers.view + kanban.view (limited operational)
 * - worker: kanban.view + orders.view (NO financial fields visible)
 */

export type UserRole = 'owner' | 'admin' | 'accountant' | 'office' | 'worker' | 'member';

/**
 * Granular permission types
 */
export type Permission =
  // Orders
  | 'orders.view'
  | 'orders.edit'
  | 'orders.create'
  | 'orders.delete'
  | 'orders.qr.manage'
  | 'orders.qr.execute'
  | 'orders.qr.status'
  | 'orders.qr.note'
  | 'orders.qr.photo'
  // Customers
  | 'customers.view'
  | 'customers.edit'
  | 'customers.create'
  | 'customers.delete'
  // Kanban
  | 'kanban.view'
  | 'kanban.edit'
  // Reports
  | 'reports.view'
  | 'reports.export'
  // Finance - Payments
  | 'finance.view'
  | 'finance.payments.view'
  | 'finance.payments.create'
  | 'finance.payments.delete'
  // Finance - Documents
  | 'finance.documents.view'
  | 'finance.documents.upload'
  | 'finance.documents.delete'
  // Finance - Employees/Payroll
  | 'finance.employees.view'
  | 'finance.employees.create'
  | 'finance.employees.edit'
  | 'finance.employees.delete'
  | 'finance.ledger.view'
  | 'finance.ledger.create'
  | 'finance.ledger.delete'
  // Settings & Team
  | 'settings.view'
  | 'settings.edit'
  | 'team.view'
  | 'team.manage'
  // Analytics
  | 'analytics.view'
  // Inventory
  | 'inventory.view'
  | 'inventory.edit'
  | 'inventory.movements.create';

/**
 * Role to permissions mapping
 * Each role has a specific set of allowed permissions
 */
export const rolePermissions: Record<UserRole, Permission[]> = {
  // Owner: Full access to everything
  owner: [
    'orders.view', 'orders.edit', 'orders.create', 'orders.delete',
    'orders.qr.manage', 'orders.qr.execute', 'orders.qr.status', 'orders.qr.note', 'orders.qr.photo',
    'customers.view', 'customers.edit', 'customers.create', 'customers.delete',
    'kanban.view', 'kanban.edit',
    'reports.view', 'reports.export',
    'finance.view',
    'finance.payments.view', 'finance.payments.create', 'finance.payments.delete',
    'finance.documents.view', 'finance.documents.upload', 'finance.documents.delete',
    'finance.employees.view', 'finance.employees.create', 'finance.employees.edit', 'finance.employees.delete',
    'finance.ledger.view', 'finance.ledger.create', 'finance.ledger.delete',
    'settings.view', 'settings.edit',
    'team.view', 'team.manage',
    'analytics.view',
    'inventory.view', 'inventory.edit', 'inventory.movements.create',
  ],

  // Admin: Almost full access (same as owner in this MVP)
  admin: [
    'orders.view', 'orders.edit', 'orders.create', 'orders.delete',
    'orders.qr.manage', 'orders.qr.execute', 'orders.qr.status', 'orders.qr.note', 'orders.qr.photo',
    'customers.view', 'customers.edit', 'customers.create', 'customers.delete',
    'kanban.view', 'kanban.edit',
    'reports.view', 'reports.export',
    'finance.view',
    'finance.payments.view', 'finance.payments.create', 'finance.payments.delete',
    'finance.documents.view', 'finance.documents.upload', 'finance.documents.delete',
    'finance.employees.view', 'finance.employees.create', 'finance.employees.edit', 'finance.employees.delete',
    'finance.ledger.view', 'finance.ledger.create', 'finance.ledger.delete',
    'settings.view', 'settings.edit',
    'team.view', 'team.manage',
    'analytics.view',
    'inventory.view', 'inventory.edit', 'inventory.movements.create',
  ],

  // Accountant: Finance-focused + read-only orders/reports
  accountant: [
    'orders.view', // Can view but NOT edit/delete
    'orders.qr.execute', 'orders.qr.note',
    'customers.view',
    'kanban.view',
    'reports.view', 'reports.export',
    'finance.view',
    'finance.payments.view', 'finance.payments.create', // Can create but NOT delete
    'finance.documents.view', 'finance.documents.upload', // Can upload but NOT delete
    'finance.employees.view', 'finance.employees.create', 'finance.employees.edit',
    'finance.ledger.view', 'finance.ledger.create',
    'analytics.view',
    'inventory.view',
  ],

  // Office: Operational access - orders, customers, kanban
  office: [
    'orders.view', 'orders.edit', 'orders.create',
    'orders.qr.manage', 'orders.qr.execute', 'orders.qr.status', 'orders.qr.note', 'orders.qr.photo',
    'customers.view', 'customers.edit', 'customers.create',
    'kanban.view', 'kanban.edit',
    'reports.view',
    'analytics.view',
    'inventory.view', 'inventory.edit', 'inventory.movements.create',
  ],

  // Member: Limited operational access
  member: [
    'orders.view', 'orders.edit',
    'orders.qr.execute', 'orders.qr.status', 'orders.qr.note',
    'customers.view',
    'kanban.view',
    'inventory.view',
  ],

  // Worker: Minimal access - kanban and order viewing only (NO financial data)
  worker: [
    'orders.view', // Will be sanitized to exclude financial fields
    'kanban.view',
    'orders.qr.execute', 'orders.qr.status', 'orders.qr.note', 'orders.qr.photo',
    'inventory.view',
  ],
};

/**
 * Check if a user role has a specific permission
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  const permissions = rolePermissions[role];
  if (!permissions) return false;
  return permissions.includes(permission);
}

/**
 * Check if user has ANY of the given permissions
 */
export function hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  return permissions.some(permission => hasPermission(role, permission));
}

/**
 * Check if user has ALL of the given permissions
 */
export function hasAllPermissions(role: UserRole, permissions: Permission[]): boolean {
  return permissions.every(permission => hasPermission(role, permission));
}

/**
 * Get all permissions for a role
 */
export function getPermissionsForRole(role: UserRole): Permission[] {
  return rolePermissions[role] || [];
}

/**
 * Check if role can access finance module
 */
export function canAccessFinance(role: UserRole): boolean {
  return hasPermission(role, 'finance.view');
}

/**
 * Check if role can delete finance records (only owner/admin)
 */
export function canDeleteFinanceRecords(role: UserRole): boolean {
  return hasAnyPermission(role, [
    'finance.payments.delete',
    'finance.documents.delete',
    'finance.employees.delete',
  ]);
}

/**
 * Check if role should see financial fields in orders
 * Workers should NOT see total_amount, currency, etc.
 */
export function canViewFinancialFields(role: UserRole): boolean {
  return role !== 'worker';
}

/**
 * Role hierarchy for comparison
 */
const ROLE_HIERARCHY: Record<UserRole, number> = {
  owner: 100,
  admin: 90,
  accountant: 70,
  office: 60,
  member: 40,
  worker: 20,
};

/**
 * Check if roleA is at least as privileged as roleB
 */
export function isRoleAtLeast(roleA: UserRole, roleB: UserRole): boolean {
  return ROLE_HIERARCHY[roleA] >= ROLE_HIERARCHY[roleB];
}

/**
 * Finance roles that can access /finance routes
 */
export const FINANCE_ROLES: UserRole[] = ['owner', 'admin', 'accountant'];

/**
 * Check if role is a finance role
 */
export function isFinanceRole(role: UserRole): boolean {
  return FINANCE_ROLES.includes(role);
}

/**
 * Permission groups for route protection
 */
export const ROUTE_PERMISSIONS: Record<string, Permission[]> = {
  '/orders': ['orders.view'],
  '/work-orders': ['orders.view'],
  '/kanban': ['kanban.view'],
  '/reports': ['reports.view'],
  '/finance': ['finance.view'],
  '/finance/payments': ['finance.payments.view'],
  '/finance/documents': ['finance.documents.view'],
  '/finance/employees': ['finance.employees.view'],
  '/settings': ['settings.view'],
  '/team': ['team.view'],
  '/customers': ['customers.view'],
  '/inventory': ['inventory.view'],
  '/inventory/new': ['inventory.edit'],
  '/crm': ['customers.view'],
  '/accounting': ['finance.view'],
  '/new-order': ['orders.create'],
};

/**
 * Screens limited by role rather than by a single permission. The menu reads its
 * `allowedRoles` from here (lib/core/dashboard-nav.ts), proxy.ts enforces it, so a
 * hidden menu item cannot be opened by typing its address. Exception: the warehouse
 * menu item is hidden from workers, who still use the warehouse scan/labels screens.
 * '/work-orders/new' matches the work-order 'create' roles in work-orders/security.ts.
 */
export const ROUTE_ROLES: Record<string, UserRole[]> = {
  '/quotations': ['owner', 'admin', 'office', 'accountant'],
  '/production': ['owner', 'admin', 'office'],
  '/production/worker': ['owner','admin','office','worker'],
  '/products': ['owner', 'admin', 'office'],
  '/factory': ['owner', 'admin', 'office', 'worker'],
  // The wall screen shows no prices or customers, but it is set up by the office, not a worker.
  '/factory/wall': ['owner', 'admin', 'office'],
  // Delivery calendar shows customer names: not for workers.
  '/calendar': ['owner', 'admin', 'office', 'accountant'],
  '/shipments': ['owner', 'admin', 'office'],
  '/scrap': ['owner', 'admin', 'office', 'accountant'],
  '/purchases': ['owner', 'admin', 'office', 'accountant'],
  '/receipts': ['owner', 'admin', 'office', 'accountant'],
  '/suppliers': ['owner', 'admin', 'office', 'accountant'],
  '/warehouse': ['owner', 'admin', 'office', 'accountant', 'worker'],
  '/work-orders/new': ['owner', 'admin', 'office', 'accountant'],
  // Who did what: the audit trail is for the firm's owner and admins.
  '/audit': ['owner', 'admin'],
  // Leads hold prospects' contact details: not for the field crew. Installations and service show the
  // crew only their own jobs, as a technical view.
  '/leads': ['owner', 'admin', 'office', 'accountant'],
  '/installations': ['owner', 'admin', 'office', 'accountant', 'worker'],
  '/service': ['owner', 'admin', 'office', 'accountant', 'worker'],
  // The fleet (vehicles, costs, positions) is the owner's and admins' only.
  '/vehicles': ['owner', 'admin'],
};

function longestRouteMatch<T>(map: Record<string, T>, pathname: string): T | undefined {
  let best: string | undefined;
  for (const route of Object.keys(map)) {
    if ((pathname === route || pathname.startsWith(route + '/')) && (!best || route.length > best.length)) best = route;
  }
  return best === undefined ? undefined : map[best];
}

/**
 * Get required permissions for a route
 */
export function getRoutePermissions(pathname: string): Permission[] {
  // The most specific route wins: '/finance/payments/x' needs finance.payments.view, not finance.view.
  return longestRouteMatch(ROUTE_PERMISSIONS, pathname) ?? [];
}

/**
 * Check if user can access a specific route
 */
export function canAccessRoute(role: UserRole, pathname: string): boolean {
  if(role==='worker' && !['/production/worker','/account'].some(p=>pathname===p||pathname.startsWith(p+'/')))return false;
  const allowedRoles = longestRouteMatch(ROUTE_ROLES, pathname);
  if (allowedRoles && !allowedRoles.includes(role)) return false;
  const requiredPermissions = getRoutePermissions(pathname);
  if (requiredPermissions.length === 0) return true; // No permissions required
  return hasAnyPermission(role, requiredPermissions);
}
