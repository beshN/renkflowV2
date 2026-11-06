import { reportServerError } from '@/lib/observability/report-server-error';
import 'server-only';

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { WorkOrderApiError } from '@/lib/features/work-orders/security';

export const NO_STORE = { 'Cache-Control': 'private, no-store' };

/**
 * Bad input body: keeps the old `error` text so existing clients still work, and adds the first
 * Zod message plus the offending field paths. Only paths and Zod messages go out, never the
 * submitted values.
 */
export function zodErrorBody(e: ZodError): { error: string; message?: string; fields: string[] } {
  const fields = [...new Set(e.issues.map((issue) => issue.path.map(String).join('.')).filter(Boolean))];
  const message = e.issues[0]?.message;
  return { error: 'Geçersiz istek', ...(message ? { message } : {}), fields };
}

/** One error shape for the record APIs: our own refusals keep their status, bad input is 400. */
export async function recordError(e: unknown, label: string) {
  if (e instanceof WorkOrderApiError) return NextResponse.json({ error: e.message, ...(e.code ? { code: e.code } : {}) }, { status: e.status, headers: NO_STORE });
  if (e instanceof ZodError) return NextResponse.json(zodErrorBody(e), { status: 400, headers: NO_STORE });
  if (e instanceof SyntaxError) return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400, headers: NO_STORE });
  // No file storage on this installation: say so instead of a bare 500.
  if (e instanceof Error && /STORAGE_BACKEND|Blob depolaması/.test(e.message)) return NextResponse.json({ error: 'Dosya eki bu kurulumda kapalı (depolama yapılandırılmamış)' }, { status: 503, headers: NO_STORE });
  if (e instanceof Error && /Yükleme|Dosya|süresi dolmuş/.test(e.message)) return NextResponse.json({ error: e.message }, { status: 400, headers: NO_STORE });
  console.error(`[records:${label}]`, e instanceof Error ? e.message : 'failed');
  await reportServerError(`records:${label}`, e);
  return NextResponse.json({ error: 'İşlem tamamlanamadı' }, { status: 500, headers: NO_STORE });
}
