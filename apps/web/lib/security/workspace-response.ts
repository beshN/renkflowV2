import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { CompanyHostError } from '@/lib/features/company/host.server';
import { WorkOrderApiError } from '@/lib/features/work-orders/security';
export function workspaceError(error: unknown) {
  if (error instanceof ZodError)
    return NextResponse.json(
      { error: error.issues[0]?.message || 'Alanları kontrol edin.' },
      { status: 400 },
    );
  if (error instanceof WorkOrderApiError || error instanceof CompanyHostError)
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  if (error instanceof SyntaxError)
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });
  console.error(
    '[workspace]',
    error instanceof Error ? error.message : 'Request failed',
  );
  return NextResponse.json(
    { error: 'İşlem tamamlanamadı. Tekrar deneyin.' },
    { status: 500 },
  );
}
export function workspaceJson(data: unknown) {
  return NextResponse.json(
    { data },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
