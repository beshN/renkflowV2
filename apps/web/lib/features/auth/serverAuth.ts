/**
 * Server-side Authentication Utilities
 * 
 * Provides a single entry point for server actions to:
 * 1. Get current user context (userId, role, tenantId)
 * 2. Enforce permissions
 * 3. Handle authorization errors
 */

import 'server-only';
import { auth } from '@/auth';
import { sql } from '@/lib/db';
import { 
  Permission, 
  UserRole, 
  hasPermission, 
  hasAnyPermission,
  canViewFinancialFields,
  isFinanceRole,
} from './permissions';

/**
 * Server user context returned from authentication
 */
export interface ServerUserContext {
  userId: string;
  tenantId: string;
  role: UserRole;
  email: string;
  name: string;
}

/**
 * Authorization error thrown when permission check fails
 */
export class AuthorizationError extends Error {
  public readonly statusCode = 403;
  public readonly code = 'FORBIDDEN';

  constructor(message: string = 'Bu işlem için yetkiniz bulunmuyor') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

/**
 * Authentication error thrown when user is not logged in
 */
export class AuthenticationError extends Error {
  public readonly statusCode = 401;
  public readonly code = 'UNAUTHORIZED';

  constructor(message: string = 'Oturum açmanız gerekiyor') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

/**
 * Get current server user context from session
 * Throws AuthenticationError if not authenticated
 */
export async function getServerUserContext(): Promise<ServerUserContext> {
  const session = await auth();

  if (!session?.user?.id) {
    throw new AuthenticationError();
  }

  if (!session.user.tenantId) {
    throw new AuthenticationError('Tenant bilgisi bulunamadı');
  }
  const [membership] = await sql`SELECT role FROM tenant_members WHERE tenant_id=${session.user.tenantId} AND user_id=${session.user.id} LIMIT 1`;
  if (!membership) throw new AuthenticationError('Firma üyeliğiniz artık aktif değil');

  return {
    userId: session.user.id || '',
    tenantId: session.user.tenantId,
    role: membership.role as UserRole,
    email: session.user.email || '',
    name: session.user.name || '',
  };
}

/**
 * Strict tenant-scoped context helper for actions and route handlers.
 */
export async function requireTenantContext(): Promise<ServerUserContext> {
  const context = await getServerUserContext();
  if (!context.tenantId) {
    throw new AuthenticationError('Tenant bilgisi bulunamadı');
  }
  return context;
}

/**
 * Enforce that request-scoped tenant access matches authenticated tenant.
 */
export function assertTenantAccess(
  context: Pick<ServerUserContext, 'tenantId'>,
  tenantId: string,
  message: string = 'Bu tenant için yetkiniz yok'
): void {
  if (!tenantId || context.tenantId !== tenantId) {
    throw new AuthorizationError(message);
  }
}

/**
 * Require a specific permission - throws if not authorized
 */
export function requirePermission(
  context: ServerUserContext,
  permission: Permission
): void {
  if (!hasPermission(context.role, permission)) {
    throw new AuthorizationError(
      `Bu işlem için yetkiniz bulunmuyor: ${permission}`
    );
  }
}

/**
 * Require any of the given permissions - throws if none match
 */
export function requireAnyPermission(
  context: ServerUserContext,
  permissions: Permission[]
): void {
  if (!hasAnyPermission(context.role, permissions)) {
    throw new AuthorizationError(
      `Bu işlem için yetkiniz bulunmuyor: ${permissions.join(' veya ')}`
    );
  }
}

/**
 * Require finance access - throws if not a finance role
 */
export function requireFinanceAccess(context: ServerUserContext): void {
  if (!isFinanceRole(context.role)) {
    throw new AuthorizationError('Finans modülüne erişim yetkiniz bulunmuyor');
  }
}

/**
 * Higher-order function to wrap server actions with authentication
 */
export async function withAuth<T>(
  callback: (context: ServerUserContext) => Promise<T>
): Promise<T> {
  const context = await getServerUserContext();
  return callback(context);
}

/**
 * Higher-order function to wrap server actions with permission check
 */
export async function withPermission<T>(
  permission: Permission,
  callback: (context: ServerUserContext) => Promise<T>
): Promise<T> {
  const context = await getServerUserContext();
  requirePermission(context, permission);
  return callback(context);
}

/**
 * Higher-order function to wrap server actions with finance access check
 */
export async function withFinanceAccess<T>(
  callback: (context: ServerUserContext) => Promise<T>
): Promise<T> {
  const context = await getServerUserContext();
  requireFinanceAccess(context);
  return callback(context);
}

// Re-export useful functions
export { 
  hasPermission, 
  hasAnyPermission, 
  canViewFinancialFields,
  isFinanceRole,
};
export type { Permission, UserRole };
