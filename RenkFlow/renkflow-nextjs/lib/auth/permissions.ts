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
  | 'analytics.view';

/**
 * Role to permissions mapping
 * Each role has a specific set of allowed permissions
 */
export const rolePermissions: Record<UserRole, Permission[]> = {
  // Owner: Full access to everything
  owner: [
    'orders.view', 'orders.edit', 'orders.create', 'orders.delete',
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
  ],

  // Admin: Almost full access (same as owner in this MVP)
  admin: [
    'orders.view', 'orders.edit', 'orders.create', 'orders.delete',
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
  ],

  // Accountant: Finance-focused + read-only orders/reports
  accountant: [
    'orders.view', // Can view but NOT edit/delete
    'customers.view',
    'kanban.view',
    'reports.view', 'reports.export',
    'finance.view',
    'finance.payments.view', 'finance.payments.create', // Can create but NOT delete
    'finance.documents.view', 'finance.documents.upload', // Can upload but NOT delete
    'finance.employees.view', 'finance.employees.create', 'finance.employees.edit',
    'finance.ledger.view', 'finance.ledger.create',
    'analytics.view',
  ],

  // Office: Operational access - orders, customers, kanban
  office: [
    'orders.view', 'orders.edit', 'orders.create',
    'customers.view', 'customers.edit', 'customers.create',
    'kanban.view', 'kanban.edit',
    'reports.view',
    'analytics.view',
  ],

  // Member: Limited operational access
  member: [
    'orders.view', 'orders.edit',
    'customers.view',
    'kanban.view',
  ],

  // Worker: Minimal access - kanban and order viewing only (NO financial data)
  worker: [
    'orders.view', // Will be sanitized to exclude financial fields
    'kanban.view',
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
  '/kanban': ['kanban.view'],
  '/reports': ['reports.view'],
  '/finance': ['finance.view'],
  '/finance/payments': ['finance.payments.view'],
  '/finance/documents': ['finance.documents.view'],
  '/finance/employees': ['finance.employees.view'],
  '/settings': ['settings.view'],
  '/team': ['team.view'],
  '/analytics': ['analytics.view'],
  '/customers': ['customers.view'],
};

/**
 * Get required permissions for a route
 */
export function getRoutePermissions(pathname: string): Permission[] {
  // Check exact match first
  if (ROUTE_PERMISSIONS[pathname]) {
    return ROUTE_PERMISSIONS[pathname];
  }

  // Check prefix matches
  for (const [route, permissions] of Object.entries(ROUTE_PERMISSIONS)) {
    if (pathname.startsWith(route + '/')) {
      return permissions;
    }
  }

  return [];
}

/**
 * Check if user can access a specific route
 */
export function canAccessRoute(role: UserRole, pathname: string): boolean {
  const requiredPermissions = getRoutePermissions(pathname);
  if (requiredPermissions.length === 0) return true; // No permissions required
  return hasAnyPermission(role, requiredPermissions);
}
