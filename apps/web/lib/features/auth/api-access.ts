import 'server-only';

import { NextResponse } from 'next/server';
import {
  AuthenticationError,
  AuthorizationError,
  getServerUserContext,
  requirePermission,
  type Permission,
  type ServerUserContext,
} from './serverAuth';

/** Session firm + current membership role, or the 401/403 response to return. */
export async function apiContextWithPermission(
  permission: Permission,
): Promise<{ context: ServerUserContext; denied?: undefined } | { context?: undefined; denied: NextResponse }> {
  try {
    const context = await getServerUserContext();
    requirePermission(context, permission);
    return { context };
  } catch (error) {
    if (error instanceof AuthenticationError) return { denied: NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 }) };
    if (error instanceof AuthorizationError) return { denied: NextResponse.json({ error: 'Bu veriye erişim yetkiniz yok.' }, { status: 403 }) };
    throw error;
  }
}
