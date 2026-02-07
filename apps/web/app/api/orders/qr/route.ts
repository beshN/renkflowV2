import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { hasPermission, type UserRole } from '@/lib/auth/permissions';
import { sql } from '@/lib/db';
import { z } from 'zod';
import { toBuffer, toString } from 'qrcode';

const QuerySchema = z.object({
  token: z.string().trim().min(32),
  format: z.enum(['png', 'svg']).optional(),
});

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenantId = (session.user as any).tenantId as string | undefined;
  const role = ((session.user as any).role as UserRole | undefined) ?? 'member';

  if (!tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasPermission(role, 'orders.qr.manage')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const parsed = QuerySchema.safeParse({
    token: request.nextUrl.searchParams.get('token') || '',
    format: request.nextUrl.searchParams.get('format') || undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
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
    return NextResponse.json({ error: 'Token not found' }, { status: 404 });
  }

  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin).replace(/\/$/, '');
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
