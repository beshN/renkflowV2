import { NextResponse } from 'next/server';
import { recordError } from '@/lib/features/records/http';

export const PUBLIC_HEADERS = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex' };

export function publicJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: PUBLIC_HEADERS });
}

export function publicError(e: unknown, label: string) {
  const res = recordError(e, label);
  for (const [k, v] of Object.entries(PUBLIC_HEADERS)) res.headers.set(k, v);
  return res;
}
