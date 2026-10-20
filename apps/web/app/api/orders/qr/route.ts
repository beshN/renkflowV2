import { redactedJson } from '@/lib/security/field-access.server';
import { NextRequest, NextResponse } from 'next/server';
import { AuthenticationError, AuthorizationError, getServerUserContext, requirePermission } from '@/lib/features/auth/serverAuth';
import { sql } from '@/lib/db';
import { resolveServerBaseUrl } from '@/lib/shared/config/runtime-env';
import { z } from 'zod';
import { toBuffer, toString } from 'qrcode';

const QuerySchema = z.object({
  token: z.string().trim().min(32),
  format: z.enum(['png', 'svg']).optional(),
});

export async function GET(request: NextRequest) {
  let tenantId: string;
  try {
    // Resolve the member's effective access (base role narrowed by a job preset or custom role)
    // rather than trusting the session's base role: a narrowing role must also hold the permission.
    const context = await getServerUserContext();
    requirePermission(context, 'orders.qr.manage');
    tenantId = context.tenantId;
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return redactedJson({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof AuthorizationError) {
      return redactedJson({ error: 'Forbidden' }, { status: 403 });
    }
    throw error;
  }

  const parsed = QuerySchema.safeParse({
    token: request.nextUrl.searchParams.get('token') || '',
    format: request.nextUrl.searchParams.get('format') || undefined,
  });

  if (!parsed.success) {
    return redactedJson({ error: 'Invalid token' }, { status: 400 });
  }

  const token = parsed.data.token;
  const format = parsed.data.format ?? 'png';

  const tokenCheck = await sql`
    SELECT id
    FROM order_qr_tokens
    WHERE tenant_id = ${tenantId}
      AND token = ${token}
      AND active = true
      AND (expires_at IS NULL OR expires_at > NOW())
    LIMIT 1
  `;

  const rows = tokenCheck as Array<{ id: string }>;
  if (rows.length === 0) {
    return redactedJson({ error: 'Token not found' }, { status: 404 });
  }

  const baseUrl = (
    resolveServerBaseUrl({
      context: 'api.orders.qr',
      fallbackOrigin: request.nextUrl.origin,
    }) || request.nextUrl.origin
  ).replace(/\/$/, '');
  const qrUrl = `${baseUrl}/q/order?token=${encodeURIComponent(token)}`;

  if (format === 'svg') {
    const svg = await toString(qrUrl, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 960,
    });

    return new NextResponse(svg, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Content-Disposition': `attachment; filename=\"order-qr-${token.slice(0, 8)}.svg\"`,
        'Cache-Control': 'private, max-age=600',
      },
    });
  }

  const png = await toBuffer(qrUrl, {
    type: 'png',
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 960,
  });

  return new NextResponse(new Uint8Array(png), {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Content-Disposition': `attachment; filename=\"order-qr-${token.slice(0, 8)}.png\"`,
      'Cache-Control': 'private, max-age=600',
    },
  });
}
