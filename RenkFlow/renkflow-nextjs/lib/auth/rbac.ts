/**
 * Role-Based Access Control (RBAC) System
 * Enforces permission matrix across all API endpoints
 */

// ============================================
// Types & Constants
// ============================================

export type UserRole = 'owner' | 'admin' | 'accountant' | 'office' | 'worker' | 'member';

export type Resource = 
  | 'orders'
  | 'documents'
  | 'users'
  | 'tenants'
  | 'analytics'
  | 'settings'
  | 'billing';

export type Action = 
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'list'
  | 'export'
  | 'assign'
  | 'manage';

export interface Permission {
  resource: Resource;
  actions: Action[];
}

export interface RBACContext {
  userId: string;
  tenantId: string;
  role: UserRole;
  resourceOwnerId?: string; // For checking if user owns the resource
}

// ============================================
// Permission Matrix
// ============================================

/**
 * Comprehensive permission matrix
 * Defines what each role can do on each resource
 */
const PERMISSION_MATRIX: Record<UserRole, Permission[]> = {
  // Owner: Full access to everything
  owner: [
    { resource: 'orders', actions: ['create', 'read', 'update', 'delete', 'list', 'export', 'assign', 'manage'] },
    { resource: 'documents', actions: ['create', 'read', 'update', 'delete', 'list', 'export'] },
    { resource: 'users', actions: ['create', 'read', 'update', 'delete', 'list', 'assign', 'manage'] },
    { resource: 'tenants', actions: ['read', 'update', 'manage'] },
    { resource: 'analytics', actions: ['read', 'export'] },
    { resource: 'settings', actions: ['read', 'update', 'manage'] },
    { resource: 'billing', actions: ['read', 'update', 'manage'] },
  ],

  // Admin: Almost full access, can't manage billing or tenant settings
  admin: [
    { resource: 'orders', actions: ['create', 'read', 'update', 'delete', 'list', 'export', 'assign'] },
    { resource: 'documents', actions: ['create', 'read', 'update', 'delete', 'list', 'export'] },
    { resource: 'users', actions: ['create', 'read', 'update', 'list', 'assign'] },
    { resource: 'tenants', actions: ['read'] },
    { resource: 'analytics', actions: ['read', 'export'] },
    { resource: 'settings', actions: ['read', 'update'] },
    { resource: 'billing', actions: ['read'] },
  ],

  // Accountant: Finance-focused role, read-only orders, full finance access
  accountant: [
    { resource: 'orders', actions: ['read', 'list'] },
    { resource: 'documents', actions: ['create', 'read', 'list'] },
    { resource: 'users', actions: ['read', 'list'] },
    { resource: 'tenants', actions: ['read'] },
    { resource: 'analytics', actions: ['read', 'export'] },
    { resource: 'settings', actions: ['read'] },
    { resource: 'billing', actions: ['read'] },
  ],

  // Office: Can manage orders and documents, limited user access
  office: [
    { resource: 'orders', actions: ['create', 'read', 'update', 'list', 'export'] },
    { resource: 'documents', actions: ['create', 'read', 'update', 'list'] },
    { resource: 'users', actions: ['read', 'list'] },
    { resource: 'tenants', actions: [] },
    { resource: 'analytics', actions: ['read'] },
    { resource: 'settings', actions: ['read'] },
    { resource: 'billing', actions: [] },
  ],

  // Worker: Limited to assigned orders, can update status
  worker: [
    { resource: 'orders', actions: ['read', 'update', 'list'] }, // Can only update status of assigned orders
    { resource: 'documents', actions: ['read', 'list'] },
    { resource: 'users', actions: [] },
    { resource: 'tenants', actions: [] },
    { resource: 'analytics', actions: [] },
    { resource: 'settings', actions: [] },
    { resource: 'billing', actions: [] },
  ],

  // Member: Read-only access
  member: [
    { resource: 'orders', actions: ['read', 'list'] },
    { resource: 'documents', actions: ['read', 'list'] },
    { resource: 'users', actions: [] },
    { resource: 'tenants', actions: [] },
    { resource: 'analytics', actions: [] },
    { resource: 'settings', actions: [] },
    { resource: 'billing', actions: [] },
  ],
};

// Role hierarchy for inheritance checks
const ROLE_HIERARCHY: Record<UserRole, number> = {
  owner: 100,
  admin: 80,
  accountant: 70,
  office: 60,
  worker: 40,
  member: 20,
};

// ============================================
// Permission Checking Functions
// ============================================

/**
 * Check if a role has permission to perform an action on a resource
 */
export function hasPermission(
  role: UserRole,
  resource: Resource,
  action: Action
): boolean {
  const permissions = PERMISSION_MATRIX[role];
  if (!permissions) return false;

  const resourcePermission = permissions.find(p => p.resource === resource);
  if (!resourcePermission) return false;

  return resourcePermission.actions.includes(action);
}

/**
 * Check if role A is higher or equal to role B in hierarchy
 */
export function isRoleAtLeast(role: UserRole, minimumRole: UserRole): boolean {
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[minimumRole];
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: UserRole): Permission[] {
  return PERMISSION_MATRIX[role] || [];
}

/**
 * Get all allowed actions for a resource given a role
 */
export function getAllowedActions(role: UserRole, resource: Resource): Action[] {
  const permissions = PERMISSION_MATRIX[role];
  const resourcePermission = permissions?.find(p => p.resource === resource);
  return resourcePermission?.actions || [];
}

// ============================================
// Authorization Errors
// ============================================

export class AuthorizationError extends Error {
  public readonly statusCode: number;
  public readonly role: UserRole;
  public readonly resource: Resource;
  public readonly action: Action;

  constructor(role: UserRole, resource: Resource, action: Action) {
    super(`Role '${role}' is not authorized to '${action}' on '${resource}'`);
    this.name = 'AuthorizationError';
    this.statusCode = 403;
    this.role = role;
    this.resource = resource;
    this.action = action;
  }
}

// ============================================
// Authorization Guards
// ============================================

/**
 * Require permission - throws if not authorized
 */
export function requirePermission(
  context: RBACContext,
  resource: Resource,
  action: Action
): void {
  if (!hasPermission(context.role, resource, action)) {
    throw new AuthorizationError(context.role, resource, action);
  }
}

/**
 * Require minimum role - throws if role is too low
 */
export function requireRole(
  context: RBACContext,
  minimumRole: UserRole
): void {
  if (!isRoleAtLeast(context.role, minimumRole)) {
    throw new AuthorizationError(context.role, 'tenants', 'manage');
  }
}

/**
 * Check if user can modify another user's resource
 * Workers and members can only access their own assigned resources
 */
export function canAccessResource(
  context: RBACContext,
  resourceOwnerId?: string
): boolean {
  // Admins and above can access any resource within their tenant
  if (isRoleAtLeast(context.role, 'office')) {
    return true;
  }

  // Workers and members can only access their own resources
  if (resourceOwnerId) {
    return context.userId === resourceOwnerId;
  }

  return false;
}

/**
 * Require resource access - throws if not authorized
 */
export function requireResourceAccess(
  context: RBACContext,
  resourceOwnerId?: string
): void {
  if (!canAccessResource(context, resourceOwnerId)) {
    throw new AuthorizationError(context.role, 'orders', 'read');
  }
}

// ============================================
// Middleware Helpers
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

/**
 * Create an API route handler with RBAC enforcement
 */
export function withRBAC(
  resource: Resource,
  action: Action,
  handler: (request: NextRequest, context: RBACContext) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      // Get session
      const session = await auth();
      
      if (!session?.user) {
        return NextResponse.json(
          { success: false, error: 'Yetkilendirme gereklidir' },
          { status: 401 }
        );
      }

      const rbacContext: RBACContext = {
        userId: session.user.id || '',
        tenantId: session.user.tenantId || '',
        role: (session.user.role as UserRole) || 'member',
      };

      // Check permission
      if (!hasPermission(rbacContext.role, resource, action)) {
        return NextResponse.json(
          { 
            success: false, 
            error: `Bu işlem için yetkiniz bulunmuyor (${action} on ${resource})` 
          },
          { status: 403 }
        );
      }

      // Call the actual handler
      return handler(request, rbacContext);
    } catch (error) {
      if (error instanceof AuthorizationError) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: error.statusCode }
        );
      }
      throw error;
    }
  };
}

/**
 * Higher-order function to wrap server actions with RBAC
 */
export async function withActionRBAC<T>(
  resource: Resource,
  action: Action,
  callback: (context: RBACContext) => Promise<T>
): Promise<T> {
  const session = await auth();
  
  if (!session?.user) {
    throw new Error('Yetkilendirme gereklidir');
  }

  const rbacContext: RBACContext = {
    userId: session.user.id || '',
    tenantId: session.user.tenantId || '',
    role: (session.user.role as UserRole) || 'member',
  };

  requirePermission(rbacContext, resource, action);
  
  return callback(rbacContext);
}

// ============================================
// Utility Functions
// ============================================

/**
 * Filter data based on user's access level
 * Workers only see assigned orders, members see limited data
 */
export function filterDataByRole<T extends { assignedTo?: string; createdBy?: string }>(
  data: T[],
  context: RBACContext
): T[] {
  // Admins and above see everything
  if (isRoleAtLeast(context.role, 'office')) {
    return data;
  }

  // Workers see assigned orders
  if (context.role === 'worker') {
    return data.filter(item => item.assignedTo === context.userId);
  }

  // Members see orders they created
  if (context.role === 'member') {
    return data.filter(item => item.createdBy === context.userId);
  }

  return [];
}

/**
 * Sanitize response data based on role
 * Remove sensitive fields for lower roles
 */
export function sanitizeResponseByRole<T extends Record<string, unknown>>(
  data: T,
  context: RBACContext,
  sensitiveFields: (keyof T)[] = []
): Partial<T> {
  // Admins and above see everything
  if (isRoleAtLeast(context.role, 'admin')) {
    return data;
  }

  // Remove sensitive fields for lower roles
  const sanitized = { ...data };
  for (const field of sensitiveFields) {
    delete sanitized[field];
  }

  return sanitized;
}
