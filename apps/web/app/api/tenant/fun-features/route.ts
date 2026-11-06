import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { AuthenticationError, AuthorizationError, requireTenantContext } from '@/lib/auth/serverAuth';
import { crossOriginRejection } from '@/lib/features/manufacturing/http-security';
import { readFunFeatures, saveFunFeatures } from '@/lib/features/settings/fun-features.server';

const headers = { 'Cache-Control': 'private, no-store' };
const input = z.object({ enabled: z.boolean() }).strict();
function failure(error: unknown) {
  if (error instanceof AuthenticationError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
  if (error instanceof AuthorizationError) return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers });
  if (error instanceof z.ZodError || error instanceof SyntaxError) return NextResponse.json({ error: 'Geçersiz ayar' }, { status: 400, headers });
  return NextResponse.json({ error: 'Ayar alınamadı' }, { status: 500, headers });
}
export async function GET() {
  try {
    // Public error/404 pages also host games. Anonymous visitors have no firm policy.
    const session = await auth();
    if (!session?.user) return NextResponse.json({ enabled: true, canEdit: false }, { headers });
    return NextResponse.json(await readFunFeatures(await requireTenantContext()), { headers });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  const rejected = crossOriginRejection(request);
  if (rejected) return rejected;
  try {
    const context = await requireTenantContext();
    const body = input.parse(await request.json());
    return NextResponse.json(await saveFunFeatures(context, body.enabled), { headers });
  } catch (error) { return failure(error); }
}
