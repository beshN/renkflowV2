/**
 * Server-side Authentication Utilities
 * 
 * Provides a single entry point for server actions to:
 * 1. Get current user context (userId, role, tenantId)
 * 2. Enforce permissions
 * 3. Handle authorization errors
 */

import { resolveMemberAccess, sessionRevoked } from '@/lib/security/member-access.server';
import { DEFAULT_PRESET, can, permissionRequirement, type FieldGroup, type Matrix } from '@/lib/security/access-matrix';
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
  /** Set when the member's role (job preset or custom) narrows the base role. */
  narrowed?: { permissions: Matrix; hidden: FieldGroup[] };
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
  const access = await resolveMemberAccess(session.user.id, session.user.tenantId);
  if (!access || access.deactivated) throw new AuthenticationError('Firma üyeliğiniz artık aktif değil');
  if ((session.sessionId || session.issuedAt !== undefined) && await sessionRevoked(session.user.id, session.sessionId ?? null, session.issuedAt ?? null))
    throw new AuthenticationError('Oturumunuz kapatıldı. Yeniden giriş yapın.');
  const membership = { role: access.base };

  return {
    userId: session.user.id || '',
    tenantId: session.user.tenantId,
    role: membership.role as UserRole,
    email: session.user.email || '',
    name: session.user.name || '',
    ...(access.roleKey !== DEFAULT_PRESET[access.base] ? { narrowed: { permissions: access.permissions, hidden: access.hidden } } : {}),
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
  if (!hasPermission(context.role, permission) || !narrowedAllows(context, permission)) {
    throw new AuthorizationError(
      `Bu işlem için yetkiniz bulunmuyor: ${permission}`
    );
  }
}

/** A narrowing role must also hold the matrix cell this permission stands for. */
function narrowedAllows(context: ServerUserContext, permission: Permission) {
  if (!context.narrowed) return true;
  const need = permissionRequirement(permission);
  return !need || can(context.narrowed, need.module, need.action);
}

/**
 * Require any of the given permissions - throws if none match
 */
export function requireAnyPermission(
  context: ServerUserContext,
  permissions: Permission[]
): void {
  if (!hasAnyPermission(context.role, permissions) || !permissions.some((p) => hasPermission(context.role, p) && narrowedAllows(context, p))) {
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
